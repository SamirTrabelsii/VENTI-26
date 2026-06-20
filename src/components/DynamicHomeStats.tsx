'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Score } from '@/types'
import { scoreMatch } from '@/lib/scoring'
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

interface Props {
    myScore: Score | null
    predictions: any[]
    groupPreds: number
    bracketPreds: number
    totalMatches: number
    myGroupsLength: number
    firstGroupName: string | null
    myRank: number | null
    dbMatchStatuses: Record<string, string>
}

export default function DynamicHomeStats({
    myScore, predictions, groupPreds, bracketPreds, totalMatches, myGroupsLength, firstGroupName, myRank, dbMatchStatuses
}: Props) {
    const [liveMatches, setLiveMatches] = useState<any[]>([])

    useEffect(() => {
        const fetchLive = async () => {
            try {
                const res = await fetch('/api/matches/live', { cache: 'no-store' })
                if (res.ok) {
                    const data = await res.json()
                    setLiveMatches(data.matches || [])
                }
            } catch { }
        }
        fetchLive()
        const int = setInterval(fetchLive, 60_000)
        return () => clearInterval(int)
    }, [])

    const stats = useMemo(() => {
        let activeLiveBonus = 0
        let pendingFinishedBonus = 0
        let dynamicStreak = myScore?.streak ?? 0
        let dynamicExact = myScore?.exact_scores ?? 0
        let dynamicCorrect = myScore?.correct_results ?? 0

        if (!myScore) return { points: 0, streak: 0, exact: 0, correct: 0 }

        const activeMatchesWithDbId = liveMatches.map(lm => {
            const staticMatch = ALL_MATCHES.find((sm: any) =>
                sm.home_team === lm.homeTeam?.tla && sm.away_team === lm.awayTeam?.tla
            )
            return { ...lm, dbId: staticMatch?.id, isKo: staticMatch ? ['R32','R16','QF','SF','3RD','FINAL'].includes(staticMatch.group_label) : false }
        }).filter((m: any) => m.dbId)

        const unsyncedFinished = activeMatchesWithDbId.filter((lm: any) => lm.status === 'FINISHED' && dbMatchStatuses[lm.dbId] !== 'finished')
        unsyncedFinished.sort((a: any, b: any) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())

        for (const lm of unsyncedFinished) {
            const pred = predictions.find(p => p.match_id === lm.dbId)
            if (pred && lm.score.fullTime.home !== null && lm.score.fullTime.away !== null) {
                const res = scoreMatch(pred.home_score, pred.away_score, lm.score.fullTime.home, lm.score.fullTime.away, lm.isKo)
                if (res.type === 'exact') dynamicExact++
                if (['exact', 'correct', 'goal_diff'].includes(res.type)) dynamicCorrect++
                if (['exact', 'correct', 'goal_diff'].includes(res.type)) {
                    dynamicStreak++
                } else {
                    dynamicStreak = 0
                }
            } else {
                dynamicStreak = 0
            }
        }

        for (const lm of activeMatchesWithDbId) {
            const pred = predictions.find(p => p.match_id === lm.dbId)
            const isSyncedToDb = dbMatchStatuses[lm.dbId] === 'finished'
            if (pred && !isSyncedToDb && lm.score.fullTime.home !== null && lm.score.fullTime.away !== null) {
                const res = scoreMatch(pred.home_score, pred.away_score, lm.score.fullTime.home, lm.score.fullTime.away, lm.isKo)
                if (lm.status === 'FINISHED') pendingFinishedBonus += res.total
                else activeLiveBonus += res.total
            }
        }

        return {
            points: myScore.total_points + activeLiveBonus + pendingFinishedBonus,
            streak: dynamicStreak,
            exact: dynamicExact,
            correct: dynamicCorrect
        }
    }, [myScore, liveMatches, predictions, dbMatchStatuses])

    const totalPreds = groupPreds + bracketPreds

    const cards = [
        {
            label: 'Predictions', accent: 'var(--gold)',
            value: `${totalPreds} / ${totalMatches}`,
            sub: `${groupPreds} group · ${bracketPreds} knockout`,
        },
        {
            label: 'Total Points', accent: 'var(--blue-accent)',
            value: stats.points,
            sub: `${stats.exact} exact · ${stats.correct} correct`,
        },
        {
            label: 'My Leagues', accent: 'var(--green-bright)',
            value: myGroupsLength,
            sub: firstGroupName ? `Rank #${myRank ?? '—'} in ${firstGroupName}` : 'Join a league to compete',
        },
        {
            label: 'Current Streak', accent: '#a855f7',
            value: stats.streak > 0 ? `🔥 ${stats.streak}` : '—',
            sub: stats.streak > 0 ? `${stats.streak} correct in a row` : 'Get predictions right to build a streak',
        },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {cards.map(c => (
                <div key={c.label} className="relative overflow-hidden rounded-[14px] p-[14px] md:p-4 border border-[var(--border)] glass-panel transition-transform hover:-translate-y-1">
                    <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ background: `radial-gradient(circle at top right, ${c.accent}, transparent 70%)` }} />
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c.accent }} />
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, paddingLeft: 12 }}>{c.label}</p>
                    <p style={{ fontFamily: 'Bebas Neue', fontSize: 40, color: 'var(--cream)', paddingLeft: 12, lineHeight: 1 }}>{c.value}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 12, marginTop: 4 }}>{c.sub}</p>
                </div>
            ))}
        </div>
    )
}
