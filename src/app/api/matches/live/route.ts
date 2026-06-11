import { NextResponse } from 'next/server'
import { getTeam, TEAMS } from '@/lib/wc2026-data'

let cachedMatches: any[] = []
let cacheTimestamp: number = 0

export async function GET() {
    try {
        // Fail fast if the external API hangs
        const res = await fetch('https://worldcup26.ir/get/games', {
            next: { revalidate: 30 }, // cache 30s
            signal: AbortSignal.timeout(6000) // 4 second timeout
        })

        if (!res.ok) {
            if (cachedMatches.length > 0) {
                console.warn(`[Live API] External API failed with ${res.status}. Serving stale cache from ${new Date(cacheTimestamp).toISOString()}`)
                return NextResponse.json({ matches: cachedMatches, stale: true })
            }
            return NextResponse.json({ error: 'External API failure' }, { status: 502 })
        }

        const data = await res.json()
        const games = data.games || data

        // Map worldcup26.ir format to the legacy football-data.org format
        // Expected structure by LiveMatches.tsx:
        // {
        //     id: number,
        //     utcDate: string,
        //     status: 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED',
        //     minute?: number,
        //     stage: string,
        //     group?: string,
        //     homeTeam: { name: string, shortName: string, crest: string, tla: string },
        //     awayTeam: { name: string, shortName: string, crest: string, tla: string },
        //     score: { fullTime: { home: number | null, away: number | null }, halfTime: { home: null, away: null } },
        //     goals: []
        // }

        const mappedMatches = games.map((g: any) => {
            // Map status
            let status = 'SCHEDULED'
            if (g.finished === 'TRUE' || g.finished === true || g.time_elapsed === 'finished') {
                status = 'FINISHED'
            } else if (g.time_elapsed && g.time_elapsed !== 'notstarted' && g.time_elapsed !== 'finished') {
                status = 'IN_PLAY'
            }

            // Map minute
            let minute = undefined
            if (status === 'IN_PLAY') {
                minute = parseInt(g.time_elapsed) || undefined
            }

            // Map scores
            const home_score = status === 'SCHEDULED' ? null : parseInt(g.home_score) || 0
            const away_score = status === 'SCHEDULED' ? null : parseInt(g.away_score) || 0

            // Parse date
            let utcDate = ''
            if (g.local_date) {
                const [datePart, timePart] = g.local_date.split(' ')
                const [month, day, year] = datePart.split('/')
                utcDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00.000Z`
            }

            // Parse teams — look up by numeric ID first (worldcup26.ir uses numeric team IDs)
            const homeTeamData = TEAMS.find(t => t.id === String(g.home_team_id)) || getTeam(g.home_team_name_en || '')
            const awayTeamData = TEAMS.find(t => t.id === String(g.away_team_id)) || getTeam(g.away_team_name_en || '')
            const homeTla = homeTeamData?.code || 'TBD'
            const awayTla = awayTeamData?.code || 'TBD'
            const homeName = g.home_team_name_en || g.home_team_label || homeTeamData?.name || 'TBD'
            const awayName = g.away_team_name_en || g.away_team_label || awayTeamData?.name || 'TBD'

            return {
                id: parseInt(g.id),
                utcDate,
                status,
                minute,
                stage: g.type === 'group' ? 'GROUP_STAGE' : g.type.toUpperCase(),
                group: g.type === 'group' ? `GROUP_${g.group}` : undefined,
                homeTeam: { name: homeName, shortName: homeTla, crest: '', tla: homeTla },
                awayTeam: { name: awayName, shortName: awayTla, crest: '', tla: awayTla },
                score: {
                    fullTime: { home: home_score, away: away_score },
                    halfTime: { home: null, away: null }
                },
                goals: [] // worldcup26.ir has home_scorers as string, hard to parse into array of objects easily right now
            }
        })

        cachedMatches = mappedMatches
        cacheTimestamp = Date.now()

        return NextResponse.json({ matches: mappedMatches })
    } catch (err: any) {
        if (cachedMatches.length > 0) {
            console.warn(`[Live API] Fetch threw an error: ${err?.message}. Serving stale cache from ${new Date(cacheTimestamp).toISOString()}`)
            return NextResponse.json({ matches: cachedMatches, stale: true })
        }
        return NextResponse.json({ error: 'External API failure' }, { status: 502 })
    }
}