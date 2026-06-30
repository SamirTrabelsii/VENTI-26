// src/components/DynamicHomeStats.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { scoreMatch } from '@/lib/scoring'
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]
const isKnockoutLabel = (groupLabel: string) =>
    ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(groupLabel)

interface Props {
    // Computed server-side via computeFreshScores — always accurate
    freshPoints: number
    freshExact: number
    freshCorrect: number
    freshStreak: number
    // Match IDs already included in freshPoints (status = finished in DB)
    scoredMatchIds: string[]
    // Raw predictions for live bonus calculation
    predictions: any[]        // from `predictions` table
    bracketPicks: any[]       // from `live_ko_picks` normalized
    dbMatches: any[]
    // UI props
    groupPreds: number
    bracketPreds: number
    totalMatches: number
    myGroupsLength: number
    firstGroupName: string | null
    myRank: number | null
}

export default function DynamicHomeStats({
    freshPoints,
    freshExact,
    freshCorrect,
    freshStreak,
    scoredMatchIds,
    predictions,
    bracketPicks,
    dbMatches,
    groupPreds,
    bracketPreds,
    totalMatches,
    myGroupsLength,
    firstGroupName,
    myRank,
}: Props) {
    const [liveApiMatches, setLiveApiMatches] = useState<any[]>([])

    useEffect(() => {
        const fetchLive = async () => {
            try {
                const res = await fetch('/api/matches/live', { cache: 'no-store' })
                if (res.ok) {
                    const data = await res.json()
                    setLiveApiMatches(data.matches || [])
                }
            } catch { }
        }
        fetchLive()
        const int = setInterval(fetchLive, 60_000)
        return () => clearInterval(int)
    }, [])

    const stats = useMemo(() => {
        const scoredIds = new Set(scoredMatchIds)

        // Single prediction lookup by match_id
        const predByMatchId = new Map<string, any>()
        for (const p of predictions) predByMatchId.set(p.match_id, p)
        for (const bp of bracketPicks) predByMatchId.set(bp.match_id, bp)

        let liveBonus = 0
        let pendingBonus = 0

        for (const lm of liveApiMatches) {
            const dbMatch = dbMatches.find(
                m => m.home_team === lm.homeTeam?.tla && m.away_team === lm.awayTeam?.tla
            )
            if (!dbMatch) {
                console.warn('[DynamicHomeStats] Live API match has no DB match', {
                    home: lm.homeTeam?.tla,
                    away: lm.awayTeam?.tla,
                    status: lm.status,
                })
                continue
            }

            const staticMatch = ALL_MATCHES.find(sm => sm.id === dbMatch.id)
            if (!staticMatch) continue
            // Already counted in freshPoints
            if (scoredIds.has(dbMatch.id)) continue

            const isInPlay = lm.status === 'IN_PLAY' || lm.status === 'PAUSED'
            const isFinished = lm.status === 'FINISHED'
            if (!isInPlay && !isFinished) continue

            const hScore = lm.score?.fullTime?.home
            const aScore = lm.score?.fullTime?.away
            if (typeof hScore !== 'number' || typeof aScore !== 'number') continue

            const pred = predByMatchId.get(dbMatch.id)
            if (!pred) continue

            const ko = isKnockoutLabel(staticMatch.group_label)
            const res = scoreMatch(
                pred.home_score,
                pred.away_score,
                hScore,
                aScore,
                ko,
                {
                    predQualifier: pred.qualifier_pick ?? pred.team_code ?? null,
                    realQualifier: dbMatch.qualifier ?? staticMatch.qualifier ?? null,
                }
            )

            if (isFinished) pendingBonus += res.total
            else liveBonus += res.total
        }

        return {
            points: freshPoints + liveBonus + pendingBonus,
            liveBonus,
            exact: freshExact,
            correct: freshCorrect,
            streak: freshStreak,
        }
    }, [freshPoints, freshExact, freshCorrect, freshStreak, scoredMatchIds, liveApiMatches, predictions, bracketPicks, dbMatches])

    const totalPreds = groupPreds + bracketPreds

    const cards = [
        {
            label: 'Predictions',
            accent: 'var(--gold)',
            value: `${totalPreds} / ${totalMatches}`,
            sub: `${groupPreds} group · ${bracketPreds} knockout`,
        },
        {
            label: 'Total Points',
            accent: 'var(--blue-accent)',
            value: stats.points,
            sub: `${stats.exact} exact · ${stats.correct} correct${stats.liveBonus > 0 ? ` · +${stats.liveBonus} live` : ''}`,
        },
        {
            label: 'My Leagues',
            accent: 'var(--green-bright)',
            value: myGroupsLength,
            sub: firstGroupName
                ? `Rank #${myRank ?? '—'} in ${firstGroupName}`
                : 'Join a league to compete',
        },
        {
            label: 'Current Streak',
            accent: '#a855f7',
            value: stats.streak > 0 ? `🔥 ${stats.streak}` : '—',
            sub: stats.streak > 0
                ? `${stats.streak} correct in a row`
                : 'Get predictions right to build a streak',
        },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {cards.map(c => (
                <div
                    key={c.label}
                    className="relative overflow-hidden rounded-[14px] p-[14px] md:p-4 border border-[var(--border)] glass-panel transition-transform hover:-translate-y-1"
                >
                    <div
                        className="absolute inset-0 opacity-[0.05] pointer-events-none"
                        style={{ background: `radial-gradient(circle at top right, ${c.accent}, transparent 70%)` }}
                    />
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c.accent }} />
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, paddingLeft: 12 }}>
                        {c.label}
                    </p>
                    <p style={{ fontFamily: 'Bebas Neue', fontSize: 40, color: 'var(--cream)', paddingLeft: 12, lineHeight: 1 }}>
                        {c.value}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 12, marginTop: 4 }}>
                        {c.sub}
                    </p>
                </div>
            ))}
        </div>
    )
}
