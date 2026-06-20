'use client'

import { useState, useEffect, useMemo } from 'react'
import { getRobohashUrl, GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { scoreMatch } from '@/lib/scoring'

const TOTAL_MATCHES = 104
const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]
const isKnockout = (groupLabel: string) => ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(groupLabel)

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

interface LeaderboardClientProps {
    initialLeaderboard: LeaderboardUser[]
    initialLiveMatches?: any[]
    livePredictions?: any[]
    currentUserId?: string
}

export default function LeaderboardClient({ initialLeaderboard, initialLiveMatches = [], livePredictions = [], currentUserId }: LeaderboardClientProps) {
    const router = useRouter()
    const [currentLeaderboard, setCurrentLeaderboard] = useState<LeaderboardUser[]>(initialLeaderboard)
    const [liveMatches, setLiveMatches] = useState<any[]>(initialLiveMatches)

    useEffect(() => {
        setCurrentLeaderboard(initialLeaderboard)
        setLiveMatches(initialLiveMatches)
    }, [initialLeaderboard, initialLiveMatches])

    const [liveApiMatches, setLiveApiMatches] = useState<any[]>([])

    useEffect(() => {
        const fetchLive = async () => {
            try {
                const res = await fetch('/api/matches/live', { cache: 'no-store' })
                const data = await res.json()
                if (data.matches) setLiveApiMatches(data.matches)
            } catch { }
        }
        fetchLive()
        const interval = setInterval(fetchLive, 60_000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const supabase = createClient()
        const channel = supabase.channel('leaderboard_realtime')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scores' }, (payload) => {
                setCurrentLeaderboard(prev => prev.map(u => {
                    if (u.id === payload.new.user_id) {
                        return {
                            ...u,
                            total_points: payload.new.total_points,
                            exact_scores: payload.new.exact_scores,
                            correct_results: payload.new.correct_results,
                            streak: payload.new.streak,
                        }
                    }
                    return u
                }))
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
                setLiveMatches(prev => {
                    const matchIdx = prev.findIndex(m => m.id === payload.new.id)
                    if (payload.new.status === 'live') {
                        if (matchIdx >= 0) {
                            const newArr = [...prev]
                            newArr[matchIdx] = payload.new
                            return newArr
                        } else {
                            return [...prev, payload.new]
                        }
                    } else {
                        // If it's no longer live, remove it from live array
                        return prev.filter(m => m.id !== payload.new.id)
                    }
                })
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    const dynamicLeaderboard = useMemo(() => {
        const mapped = currentLeaderboard.map(user => {
            let liveBonus = 0
            let uncommittedBonus = 0
            let exactBonus = 0
            let correctBonus = 0

            // Add points for any currently live matches
            for (const match of liveMatches) {
                const staticMatch = ALL_MATCHES.find(m => m.id === match.id)
                if (!staticMatch) continue

                const effHome = match.home_team ?? staticMatch.home_team;
                const effAway = match.away_team ?? staticMatch.away_team;
                const apiMatch = liveApiMatches.find(l => l.homeTeam.tla === effHome && l.awayTeam.tla === effAway)

                let hScore = match.home_score
                let aScore = match.away_score
                let isLiveOrFinished = match.status === 'live'
                let isApiFinished = false

                if (apiMatch) {
                    if (apiMatch.status === 'IN_PLAY' || apiMatch.status === 'PAUSED' || apiMatch.status === 'FINISHED') {
                        isLiveOrFinished = true
                    }
                    if (apiMatch.status === 'FINISHED') {
                        isApiFinished = true
                    }
                    if (apiMatch.score?.fullTime?.home !== null && apiMatch.score?.fullTime?.home !== undefined) {
                        hScore = apiMatch.score.fullTime.home
                    }
                    if (apiMatch.score?.fullTime?.away !== null && apiMatch.score?.fullTime?.away !== undefined) {
                        aScore = apiMatch.score.fullTime.away
                    }
                }

                if (!isLiveOrFinished || hScore === null || aScore === null) continue
                
                const pred = livePredictions.find(p => p.user_id === user.id && p.match_id === match.id)
                if (pred) {
                    const ko = isKnockout(staticMatch.group_label)
                    
                    const effPredHome = !pred.is_repredicted && typeof pred.original_home_score === 'number' ? pred.original_home_score : pred.home_score;
                    const effPredAway = !pred.is_repredicted && typeof pred.original_away_score === 'number' ? pred.original_away_score : pred.away_score;
                    
                    const isFixtureCorrect = !ko ||
                        !pred.predicted_home_team ||
                        !pred.predicted_away_team ||
                        (pred.predicted_home_team === effHome && pred.predicted_away_team === effAway)

                    const result = scoreMatch(
                        effPredHome, effPredAway,
                        hScore, aScore,
                        ko,
                        { 
                            predQualifier: pred.qualifier_pick || pred.qualifier || pred.team_code, 
                            realQualifier: match.qualifier || staticMatch.qualifier || null,
                            isRepredicted: !!pred.is_repredicted,
                            multiplier: match.multiplier || staticMatch.multiplier || 1,
                            isFixtureCorrect
                        }
                    )
                    
                    if (isApiFinished) {
                        uncommittedBonus += result.total
                    } else {
                        liveBonus += result.total
                    }
                    
                    if (result.type === 'exact') exactBonus += 1
                    if (result.type === 'correct' || result.type === 'goal_diff') correctBonus += 1
                }
            }

            return {
                ...user,
                display_points: user.total_points + liveBonus + uncommittedBonus,
                live_bonus: liveBonus,
                dynamic_streak: user.streak,
                dynamic_exact: user.exact_scores + exactBonus,
                dynamic_correct: user.correct_results + correctBonus
            }
        })
        mapped.sort((a, b) => b.display_points - a.display_points)
        return mapped
    }, [currentLeaderboard, liveMatches, livePredictions, liveApiMatches])

    const top3 = dynamicLeaderboard.slice(0, 3)
    const rest = dynamicLeaderboard.slice(3)
    const podiumLayout = [top3[1], top3[0], top3[2]] // 2nd, 1st, 3rd

    return (
        <>
            <style>{`
                @media (max-width: 640px) {
                    .hide-on-mobile { display: none !important; }
                    .podium-container { transform: scale(0.85); margin-bottom: 20px !important; }
                }
            `}</style>

            {/* Top 3 Podium */}
            {top3.length > 0 && (
                <div className="podium-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 16, marginBottom: 60, marginTop: 20 }}>
                    {podiumLayout.map((user, i) => {
                        if (!user) return null
                        const rank = i === 0 ? 2 : i === 1 ? 1 : 3
                        const height = rank === 1 ? 180 : rank === 2 ? 140 : 120
                        const color = rank === 1 ? 'var(--gold)' : rank === 2 ? '#C0C0C0' : '#CD7F32'
                        const isMe = currentUserId && user.id === currentUserId

                        return (
                            <div key={user.id} onClick={() => router.push(`/profile?id=${user.id}`)} style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', width: 130, cursor: 'pointer',
                                transform: 'translateY(0)', transition: 'transform 0.2s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-10px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                <div style={{ position: 'relative', marginBottom: -20, zIndex: 10 }}>
                                    <img src={getRobohashUrl(user.display_name, rank === 1 ? 100 : 80)} style={{
                                        width: rank === 1 ? 100 : 80, height: rank === 1 ? 100 : 80, borderRadius: '50%',
                                        border: `4px solid ${color}`, background: user.avatar_color, objectFit: 'cover'
                                    }} />
                                    <div style={{
                                        position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
                                        background: color, color: '#000', width: 32, height: 32, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 18,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                    }}>
                                        {rank}
                                    </div>
                                    {isMe && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', color: '#000', fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 800 }}>YOU</div>}
                                </div>
                                <div style={{
                                    width: '100%', height: height, background: isMe ? 'rgba(212,168,67,0.1)' : 'var(--surface2)',
                                    border: `1px solid ${color}`, borderBottom: 'none',
                                    borderTopLeftRadius: 16, borderTopRightRadius: 16,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 35,
                                    boxShadow: rank === 1 ? '0 -10px 40px rgba(212,168,67,0.15)' : 'none'
                                }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cream)', textAlign: 'center', padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{user.display_name}</div>
                                    <div style={{ fontSize: 32, fontFamily: 'Bebas Neue', color: color, marginTop: 4, lineHeight: 1 }}>{user.display_points}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                                        {user.live_bonus > 0 && <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>+{user.live_bonus} live</span>}
                                        PTS
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
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
                    <div className="hide-on-mobile" style={{ width: 80, textAlign: 'center' }}>Stats</div>
                    <div style={{ width: 100, textAlign: 'right' }}>Total Pts</div>
                </div>

                {/* Rows */}
                {rest.length === 0 && top3.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
                        No users have signed up yet.
                    </div>
                ) : (
                    rest.map((row: any, index) => {
                        const isMe = currentUserId && row.id === currentUserId
                        const progressPct = Math.round((row.total_preds / TOTAL_MATCHES) * 100)
                        const actualRank = index + 4 // Because we sliced 3

                        return (
                            <div key={row.id}
                                onClick={() => router.push(`/profile?id=${row.id}`)}
                                style={{
                                    display: 'flex', alignItems: 'center', padding: '16px 20px',
                                    borderBottom: '1px solid var(--border)',
                                    background: isMe ? 'rgba(212,168,67,0.06)' : 'transparent',
                                    transition: 'all 0.2s ease',
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={e => {
                                    if (!isMe) e.currentTarget.style.background = 'var(--surface2)'
                                    e.currentTarget.style.transform = 'scale(1.01)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = isMe ? 'rgba(212,168,67,0.06)' : 'transparent'
                                    e.currentTarget.style.transform = 'scale(1)'
                                }}>
                                {/* Rank */}
                                <div style={{
                                    width: 40, textAlign: 'center',
                                    fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--muted)'
                                }}>
                                    {actualRank}
                                </div>

                                {/* Player */}
                                <div style={{ flex: 1, paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <img
                                        src={getRobohashUrl(row.display_name, 60)}
                                        alt={row.display_name}
                                        style={{
                                            width: 44, height: 44, borderRadius: '50%',
                                            background: row.avatar_color,
                                            flexShrink: 0, objectFit: 'cover',
                                            border: '2px solid var(--border)'
                                        }}
                                    />
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 600, color: isMe ? 'var(--gold)' : 'var(--cream)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {row.display_name}
                                            {isMe && <span style={{ fontSize: 10, padding: '2px 8px', background: 'var(--gold)', color: '#000', borderRadius: 6, fontWeight: 800 }}>YOU</span>}
                                        </div>
                                        {row.dynamic_streak > 0 && (
                                            <div style={{ fontSize: 12, color: '#ff6b6b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                                🔥 {row.dynamic_streak} Streak
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress */}
                                <div className="hide-on-mobile" style={{ width: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                    <div style={{
                                        width: '100%', height: 6, borderRadius: 3,
                                        background: 'var(--surface3)', overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            height: '100%', borderRadius: 3,
                                            background: progressPct === 100 ? 'var(--green-bright)' : progressPct > 0 ? 'var(--gold)' : 'transparent',
                                            width: `${progressPct}%`,
                                        }} />
                                    </div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: progressPct === 100 ? 'var(--green-bright)' : progressPct > 0 ? 'var(--gold)' : 'var(--muted)', letterSpacing: 0.5 }}>
                                        {progressPct === 100 ? 'Complete' : progressPct > 0 ? `${row.total_preds}/${TOTAL_MATCHES}` : 'Not started'}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="hide-on-mobile" style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <div style={{ fontSize: 11, background: 'rgba(212,168,67,0.1)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                                        {row.dynamic_exact} EX
                                    </div>
                                    <div style={{ fontSize: 11, background: 'var(--surface3)', color: 'var(--cream)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                                        {row.dynamic_correct} CR
                                    </div>
                                </div>

                                {/* Total Points */}
                                <div style={{
                                    width: 100, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center'
                                }}>
                                    <div style={{
                                        fontFamily: 'Bebas Neue', fontSize: 32,
                                        color: row.display_points > 0 ? 'var(--cream)' : 'var(--muted)',
                                        lineHeight: 1
                                    }}>
                                        {row.display_points}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                                        {row.live_bonus > 0 && <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>+{row.live_bonus} live</span>}
                                        PTS
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </>
    )
}
