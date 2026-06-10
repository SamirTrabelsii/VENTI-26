'use client'

import { memo, useMemo } from 'react'
import { getTeam, MatchData } from '@/lib/wc2026-data'
import TeamFlag from '@/components/TeamFlag'
import { usePredictions } from '@/components/PredictionContext'

interface Props {
    groupMatches: MatchData[]
}

interface TeamStats {
    code: string
    group: string
    p: number
    w: number
    d: number
    l: number
    gf: number
    ga: number
    pts: number
    gd?: number
}

const ThirdPlaceTable = memo(function ThirdPlaceTable({ groupMatches }: Props) {
    const { groupScores } = usePredictions()

    const thirdPlaced = useMemo(() => {
        const teams: Record<string, TeamStats> = {}

        // Initialize all teams
        groupMatches.forEach(m => {
            if (!teams[m.home_team]) teams[m.home_team] = { code: m.home_team, group: m.group_label, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
            if (!teams[m.away_team]) teams[m.away_team] = { code: m.away_team, group: m.group_label, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
        })

        groupMatches.forEach(m => {
            const score = groupScores[m.id]
            if (!score || score.home === '' || score.away === '') return

            const home = score.home
            const away = score.away

            teams[m.home_team].p += 1
            teams[m.away_team].p += 1
            teams[m.home_team].gf += home
            teams[m.home_team].ga += away
            teams[m.away_team].gf += away
            teams[m.away_team].ga += home

            if (home > away) {
                teams[m.home_team].w += 1
                teams[m.home_team].pts += 3
                teams[m.away_team].l += 1
            } else if (home < away) {
                teams[m.away_team].w += 1
                teams[m.away_team].pts += 3
                teams[m.home_team].l += 1
            } else {
                teams[m.home_team].d += 1
                teams[m.away_team].d += 1
                teams[m.home_team].pts += 1
                teams[m.away_team].pts += 1
            }
        })

        // Group teams by group
        const groups: Record<string, TeamStats[]> = {}
        Object.values(teams).forEach(t => {
            if (!groups[t.group]) groups[t.group] = []
            groups[t.group].push({ ...t, gd: t.gf - t.ga })
        })

        // Sort each group and find the 3rd placed team
        const rankedThirds: TeamStats[] = []
        Object.values(groups).forEach(g => {
            g.sort((a, b) => {
                if (a.pts !== b.pts) return b.pts - a.pts
                if (a.gd !== b.gd) return (b.gd ?? 0) - (a.gd ?? 0)
                if (a.gf !== b.gf) return b.gf - a.gf
                return a.code.localeCompare(b.code)
            })
            if (g.length >= 3) {
                rankedThirds.push(g[2])
            }
        })

        // Sort the 12 third-placed teams
        rankedThirds.sort((a, b) => {
            if (a.pts !== b.pts) return b.pts - a.pts
            if (a.gd !== b.gd) return (b.gd ?? 0) - (a.gd ?? 0)
            if (a.gf !== b.gf) return b.gf - a.gf
            return a.code.localeCompare(b.code)
        })

        return rankedThirds
    }, [groupMatches, groupScores])

    return (
        <div style={{ marginTop: 40, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 18, fontFamily: 'Bebas Neue' }}>
                Overall 3rd-Place Ranking (Top 8 Advance)
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                        <tr style={{ background: 'var(--surface2)', color: 'var(--muted)', textAlign: 'left', fontSize: 12 }}>
                            <th style={{ padding: '10px 20px', fontWeight: 600 }}>Rank</th>
                            <th style={{ padding: '10px 20px', fontWeight: 600 }}>Grp</th>
                            <th style={{ padding: '10px 20px', fontWeight: 600 }}>Team</th>
                            <th style={{ padding: '10px', fontWeight: 600, textAlign: 'center' }}>P</th>
                            <th style={{ padding: '10px', fontWeight: 600, textAlign: 'center' }}>W</th>
                            <th style={{ padding: '10px', fontWeight: 600, textAlign: 'center' }}>D</th>
                            <th style={{ padding: '10px', fontWeight: 600, textAlign: 'center' }}>L</th>
                            <th style={{ padding: '10px', fontWeight: 600, textAlign: 'center' }}>GD</th>
                            <th style={{ padding: '10px 20px', fontWeight: 600, textAlign: 'center' }}>Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {thirdPlaced.map((row, i) => {
                            const advances = i < 8;
                            return (
                                <tr key={row.code} style={{ borderTop: '1px solid var(--border)', background: advances ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
                                    <td style={{ padding: '12px 20px', color: 'var(--muted)', width: 14 }}>{i + 1}</td>
                                    <td style={{ padding: '12px 20px', color: 'var(--muted)', width: 14, fontWeight: 700 }}>{row.group}</td>
                                    <td style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                                        <TeamFlag teamCode={row.code} size={24} />
                                        {getTeam(row.code)?.name || row.code}
                                    </td>
                                    <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{row.p}</td>
                                    <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{row.w}</td>
                                    <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{row.d}</td>
                                    <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{row.l}</td>
                                    <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{(row.gd ?? 0) > 0 ? `+${row.gd}` : row.gd}</td>
                                    <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 700, color: advances ? 'var(--green-bright)' : 'var(--red)' }}>{row.pts}</td>
                                </tr>
                            )
                        })}
                        {thirdPlaced.length === 0 && (
                            <tr>
                                <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                                    Predict matches to see third-place standings
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
})

export default ThirdPlaceTable
