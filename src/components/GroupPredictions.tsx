'use client'

import { memo } from 'react'
import MatchCard from '@/components/MatchCard'
import type { MatchData } from '@/lib/wc2026-data'
import { getTeam } from '@/lib/wc2026-data'
import type { Prediction } from '@/types'
import { usePredictions } from '@/components/PredictionContext'
import TeamFlag from '@/components/TeamFlag'

interface Props {
    activeMatches: MatchData[]
    predictions: Prediction[]
    userId: string
    nextGroup: string | null
}

const GroupPredictions = memo(function GroupPredictions({ activeMatches, userId, nextGroup }: Props) {
    const { groupScores, setGroupScore, isLocked } = usePredictions()


    const handleScoreChange = (matchId: string, home: number | '', away: number | '') => {
        if (isLocked) return
        setGroupScore(matchId, home, away)
    }



    const standings = () => {
        const teams: Record<string, { p: number, w: number, d: number, l: number, gf: number, ga: number, pts: number }> = {}

        activeMatches.forEach(m => {
            if (!teams[m.home_team]) teams[m.home_team] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
            if (!teams[m.away_team]) teams[m.away_team] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
        })

        activeMatches.forEach(m => {
            const s = groupScores[m.id]
            if (!s) return

            const home = s.home
            const away = s.away

            if (home === '' || away === '') return

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

        const arr = Object.entries(teams).map(([code, stats]) => ({
            code,
            ...stats,
            gd: stats.gf - stats.ga
        }))

        arr.sort((a, b) => {
            if (a.pts !== b.pts) return b.pts - a.pts
            if (a.gd !== b.gd) return b.gd - a.gd
            if (a.gf !== b.gf) return b.gf - a.gf
            return a.code.localeCompare(b.code)
        })

        return arr
    }

    const table = standings()

    return (
        <div>
            {activeMatches.map((match) => {
                const s = groupScores[match.id] || { home: '', away: '' }
                return (
                    <MatchCard
                        key={match.id}
                        match={match}
                        prediction={undefined}
                        userId={userId}
                        localHome={s.home}
                        localAway={s.away}
                        onChange={(home, away) => handleScoreChange(match.id, home, away)}
                        hideSaveButton
                        disabled={isLocked}
                    />
                )
            })}

            <div style={{ marginTop: 40, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 18, fontFamily: 'Bebas Neue' }}>
                    Live Standings
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                        <tr style={{ background: 'var(--surface2)', color: 'var(--muted)', textAlign: 'left', fontSize: 12 }}>
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
                        {table.map((row, i) => (
                            <tr key={row.code} style={{ borderTop: '1px solid var(--border)', background: i < 2 ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}>
                                <td style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                                    <span style={{ color: 'var(--muted)', width: 14 }}>{i + 1}</span>
                                    <TeamFlag teamCode={row.code} size={24} />
                                    {getTeam(row.code)?.name || row.code}
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{row.p}</td>
                                <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{row.w}</td>
                                <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{row.d}</td>
                                <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{row.l}</td>
                                <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--dim)' }}>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                                <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--gold)' }}>{row.pts}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{
                textAlign: 'center',
                marginTop: 28,
                paddingTop: 20,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16
            }}>
                {nextGroup && (
                    <a
                        href={`/predict?group=${nextGroup}`}
                        style={{
                            display: 'inline-block',
                            padding: '12px 32px',
                            borderRadius: 12,
                            background: 'var(--surface2)',
                            color: 'var(--cream)',
                            fontWeight: 700,
                            textDecoration: 'none',
                            border: '1px solid var(--border)'
                        }}
                    >
                        Next: Group {nextGroup} →
                    </a>
                )}
            </div>
        </div>
    )
})

export default GroupPredictions
