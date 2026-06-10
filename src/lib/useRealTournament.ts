'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GROUPS, GROUP_MATCHES } from '@/lib/wc2026-data'

export interface RealTournamentState {
    // Array of team_codes in order (1st to 4th) for each group
    groupStandings: Record<string, string[]>
    // Array of team_codes for 3rd place teams, sorted by ranking
    thirdPlaceRanking: string[]
    // Record of bracket slot key to actual advancing team_code
    knockoutResults: Record<string, string>
}

type DbMatch = {
    id: string
    group_label: string
    home_team: string
    away_team: string
    home_score: number | null
    away_score: number | null
    status: string
    qualifier?: string | null
}

type TeamStats = {
    code: string
    pts: number
    gd: number
    gf: number
}

const EMPTY_GROUP_STANDINGS = GROUPS.reduce((acc, group) => {
    acc[group] = ['TBD', 'TBD', 'TBD', 'TBD']
    return acc
}, {} as Record<string, string[]>)

function rankTeams(stats: Record<string, TeamStats>) {
    return Object.values(stats)
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.code.localeCompare(b.code))
        .map(t => t.code)
}

function getBracketResultKey(matchId: string) {
    if (matchId === 'final') return 'final_0'
    if (matchId === 'third_place') return 'third_place_0'

    const match = matchId.match(/^([a-z0-9]+)_(\d+)$/)
    if (!match) return null

    return `${match[1]}_${Number(match[2]) - 1}`
}

function computeRealState(matches: DbMatch[]): RealTournamentState {
    const groupStandings: Record<string, string[]> = { ...EMPTY_GROUP_STANDINGS }
    const thirdPlaceCandidates: TeamStats[] = []

    GROUPS.forEach(group => {
        const groupMatches = GROUP_MATCHES.filter(m => m.group_label === group)
        const dbGroupMatches = groupMatches
            .map(m => matches.find(db => db.id === m.id))
            .filter(Boolean) as DbMatch[]

        const isGroupComplete = dbGroupMatches.length === groupMatches.length && dbGroupMatches.every(m =>
            m.status === 'finished' &&
            typeof m.home_score === 'number' &&
            typeof m.away_score === 'number'
        )

        if (!isGroupComplete) return

        const stats: Record<string, TeamStats> = {}
        groupMatches.forEach(m => {
            stats[m.home_team] ??= { code: m.home_team, pts: 0, gd: 0, gf: 0 }
            stats[m.away_team] ??= { code: m.away_team, pts: 0, gd: 0, gf: 0 }
        })

        dbGroupMatches.forEach(m => {
            const homeScore = m.home_score as number
            const awayScore = m.away_score as number

            stats[m.home_team].gf += homeScore
            stats[m.away_team].gf += awayScore
            stats[m.home_team].gd += homeScore - awayScore
            stats[m.away_team].gd += awayScore - homeScore

            if (homeScore > awayScore) stats[m.home_team].pts += 3
            else if (awayScore > homeScore) stats[m.away_team].pts += 3
            else {
                stats[m.home_team].pts += 1
                stats[m.away_team].pts += 1
            }
        })

        const ranked = rankTeams(stats)
        groupStandings[group] = ranked
        if (ranked[2]) thirdPlaceCandidates.push(stats[ranked[2]])
    })

    const thirdPlaceRanking = thirdPlaceCandidates
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.code.localeCompare(b.code))
        .map(t => t.code)

    const knockoutResults: Record<string, string> = {}
    matches.forEach(match => {
        if (match.status !== 'finished') return
        if (!['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(match.group_label)) return
        if (typeof match.home_score !== 'number' || typeof match.away_score !== 'number') return

        const key = getBracketResultKey(match.id)
        if (!key) return

        if (match.home_score > match.away_score) knockoutResults[key] = match.home_team
        else if (match.away_score > match.home_score) knockoutResults[key] = match.away_team
        else if (match.qualifier) knockoutResults[key] = match.qualifier
    })

    return {
        groupStandings,
        thirdPlaceRanking,
        knockoutResults,
    }
}

export function useRealTournament() {
    const [realState, setRealState] = useState<RealTournamentState>({
        groupStandings: EMPTY_GROUP_STANDINGS,
        thirdPlaceRanking: [],
        knockoutResults: {}
    })

    useEffect(() => {
        let mounted = true
        const supabase = createClient()

        const loadRealState = async () => {
            const { data } = await supabase
                .from('matches')
                .select('id, group_label, home_team, away_team, home_score, away_score, status, qualifier')

            if (mounted) {
                setRealState(computeRealState((data ?? []) as DbMatch[]))
            }
        }

        loadRealState()

        const channel = supabase
            .channel('real-tournament-state')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, loadRealState)
            .subscribe()

        return () => {
            mounted = false
            supabase.removeChannel(channel)
        }
    }, [])

    return realState
}
