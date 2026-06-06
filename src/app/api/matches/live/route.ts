import { NextResponse } from 'next/server'
import { getTeam } from '@/lib/wc2026-data'

export async function GET() {
    try {
        const res = await fetch('https://worldcup26.ir/get/games', {
            next: { revalidate: 30 }, // cache 30s
        })

        if (!res.ok) {
            return NextResponse.json({ matches: [] })
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

            // Parse teams
            const homeTla = getTeam(g.home_team_id)?.code || 'TBD'
            const awayTla = getTeam(g.away_team_id)?.code || 'TBD'
            const homeName = g.home_team_name_en || g.home_team_label || 'TBD'
            const awayName = g.away_team_name_en || g.away_team_label || 'TBD'

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

        return NextResponse.json({ matches: mappedMatches })
    } catch {
        return NextResponse.json({ matches: [] })
    }
}