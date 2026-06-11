'use client'

import { useState, useEffect, useMemo } from 'react'
import { getRobohashUrl, GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'
import { scoreMatch } from '@/lib/scoring'

const TOTAL_MATCHES = 104
const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

export interface LeaderboardUser {
    id: string
    display_name: string
    avatar_initials: string
    avatar_color: string
    total_points: number
    exact_scores: number
    correct_results: number
    streak: number
    group_preds: number
    bracket_preds: number
    total_preds: number
}

interface Prediction {
    user_id: string
    match_id: string
    home_score: number
    away_score: number
}

interface LeaderboardClientProps {
    initialLeaderboard: LeaderboardUser[]
    predictions: Prediction[]
    currentUserId?: string
    dbMatchStatuses?: Record<string, string>
}

export default function LeaderboardClient({ initialLeaderboard, predictions, currentUserId, dbMatchStatuses = {} }: LeaderboardClientProps) {
    const [liveMatches, setLiveMatches] = useState<any[]>([])

    // Poll live matches every 60s
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

    // Recalculate leaderboard dynamically
    const dynamicLeaderboard = useMemo(() => {
        // Find which matches are actively in-play or recently finished but maybe not synced to DB yet
        // A live match is one from the API that is IN_PLAY or PAUSED or FINISHED. 
        // For FINISHED matches, we only calculate points if the DB sync hasn't run yet (db status != 'finished').
        // If db status == 'finished', the backend cron has officially synced the score to the DB, so we don't double-count.
        const activeLiveMatches = liveMatches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'FINISHED')

        if (activeLiveMatches.length === 0) {
            return initialLeaderboard
        }

        // We need to map api_id to our DB id
        const activeMatchesWithDbId = activeLiveMatches.map(lm => {
            const dbMatch = ALL_MATCHES.find(m => m.home_team === lm.homeTeam.tla && m.away_team === lm.awayTeam.tla)
            return {
                ...lm,
                dbId: dbMatch?.id,
                isKo: dbMatch ? ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(dbMatch.group_label) : false
            }
        }).filter(m => m.dbId)

        return initialLeaderboard.map(user => {
            let activeLiveBonus = 0
            let pendingFinishedBonus = 0

            for (const lm of activeMatchesWithDbId) {
                // Find prediction for this user and match
                const pred = predictions.find(p => p.user_id === user.id && p.match_id === lm.dbId)
                const isSyncedToDb = dbMatchStatuses[lm.dbId] === 'finished'
                // If points are already synced in DB, the backend sync has happened! So don't add live points!
                if (pred && !isSyncedToDb && lm.score.fullTime.home !== null && lm.score.fullTime.away !== null) {
                    const res = scoreMatch(pred.home_score, pred.away_score, lm.score.fullTime.home, lm.score.fullTime.away, lm.isKo)
                    
                    if (lm.status === 'FINISHED') {
                        pendingFinishedBonus += res.total
                    } else {
                        activeLiveBonus += res.total
                    }
                }
            }

            return {
                ...user,
                display_points: user.total_points + activeLiveBonus + pendingFinishedBonus,
                live_bonus: activeLiveBonus
            }
        }).sort((a, b) =>
            b.display_points - a.display_points
            || b.total_preds - a.total_preds
            || a.display_name.localeCompare(b.display_name)
        )
    }, [initialLeaderboard, predictions, liveMatches, dbMatchStatuses])

    return (
        <>
            <style>{`
                @media (max-width: 640px) {
                    .hide-on-mobile { display: none !important; }
                }
            `}</style>
            <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 18,
                overflow: 'hidden',
            }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', padding: '16px 20px',
                borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
                fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
                textTransform: 'uppercase', color: 'var(--muted)'
            }}>
                <div style={{ width: 40, textAlign: 'center' }}>Rank</div>
                <div style={{ flex: 1, paddingLeft: 16 }}>Player</div>
                <div className="hide-on-mobile" style={{ width: 130, textAlign: 'center' }}>Progress</div>
                <div className="hide-on-mobile" style={{ width: 70, textAlign: 'center' }}>Exact</div>
                <div className="hide-on-mobile" style={{ width: 70, textAlign: 'center' }}>Correct</div>
                <div style={{ width: 100, textAlign: 'right' }}>Total Pts</div>
            </div>

            {/* Rows */}
            {dynamicLeaderboard.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
                    No users have signed up yet.
                </div>
            ) : (
                dynamicLeaderboard.map((row: any, index) => {
                    const isMe = currentUserId && row.id === currentUserId
                    const progressPct = Math.round((row.total_preds / TOTAL_MATCHES) * 100)

                    let progressColor = 'var(--muted)'
                    let progressLabel = 'Not started'
                    if (progressPct === 100) {
                        progressColor = 'var(--green-bright)'
                        progressLabel = 'Complete'
                    } else if (progressPct > 0) {
                        progressColor = 'var(--gold)'
                        progressLabel = `${row.total_preds}/${TOTAL_MATCHES}`
                    }

                    return (
                        <div key={row.id} style={{
                            display: 'flex', alignItems: 'center', padding: '14px 20px',
                            borderBottom: '1px solid var(--border)',
                            background: isMe ? 'rgba(212,168,67,0.06)' : 'transparent',
                            transition: 'background 0.15s',
                        }}>
                            {/* Rank */}
                            <div style={{
                                width: 40, textAlign: 'center',
                                fontFamily: 'Bebas Neue', fontSize: 24,
                                color: index < 3 ? 'var(--gold)' : 'var(--muted)'
                            }}>
                                {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                            </div>

                            {/* Player */}
                            <div style={{ flex: 1, paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <img
                                    src={getRobohashUrl(row.display_name, 60)}
                                    alt={row.display_name}
                                    style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: row.avatar_color,
                                        flexShrink: 0,
                                        objectFit: 'cover',
                                    }}
                                />
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 600, color: isMe ? 'var(--gold)' : 'var(--cream)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {row.display_name}
                                        {isMe && <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--gold)', color: '#000', borderRadius: 4, fontWeight: 700 }}>YOU</span>}
                                    </div>
                                    {row.streak > 0 && (
                                        <div style={{ fontSize: 11, color: '#e05c4a', marginTop: 2 }}>
                                            🔥 {row.streak} streak
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Progress */}
                            <div className="hide-on-mobile" style={{ width: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{
                                    width: '100%', height: 6, borderRadius: 3,
                                    background: 'var(--surface3)', overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%', borderRadius: 3,
                                        background: progressPct === 100 ? 'var(--green-bright)' : progressPct > 0 ? 'var(--gold)' : 'transparent',
                                        width: `${progressPct}%`,
                                        transition: 'width 0.6s ease',
                                    }} />
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: progressColor, letterSpacing: 0.5 }}>
                                    {progressLabel}
                                </div>
                            </div>

                            {/* Exact */}
                            <div className="hide-on-mobile" style={{ width: 70, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
                                {row.exact_scores}
                            </div>

                            {/* Correct */}
                            <div className="hide-on-mobile" style={{ width: 70, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
                                {row.correct_results}
                            </div>

                            {/* Total Points */}
                            <div style={{
                                width: 100, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center'
                            }}>
                                <div style={{
                                    fontFamily: 'Bebas Neue', fontSize: 28,
                                    color: row.display_points > 0 ? 'var(--cream)' : 'var(--muted)',
                                    lineHeight: 1
                                }}>
                                    {row.display_points}
                                </div>
                                {row.live_bonus > 0 && (
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', marginTop: 2, background: 'rgba(212,168,67,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                                        +{row.live_bonus} LIVE
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })
            )}
            </div>
        </>
    )
}
