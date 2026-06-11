'use client'
import { useState, useEffect, useCallback } from 'react'
import { GROUP_MATCHES, getAdjustedKickoff } from '@/lib/wc2026-data'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Goal {
    minute: number
    team: { name: string }
    scorer: { name: string }
    type: string
}

interface MatchData {
    id: number
    utcDate: string
    status: 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | string
    minute?: number
    stage: string
    group?: string
    homeTeam: { name: string; shortName: string; crest: string; tla: string }
    awayTeam: { name: string; shortName: string; crest: string; tla: string }
    score: {
        fullTime: { home: number | null; away: number | null }
        halfTime: { home: number | null; away: number | null }
    }
    goals: Goal[]
    venue?: string
    referees?: Array<{ name: string; type: string }>
}

import MatchModal from './MatchModal'

// ── Flag helper ────────────────────────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
    USA: '🇺🇸', PAN: '🇵🇦', UZB: '🇺🇿', BHR: '🇧🇭',
    ARG: '🇦🇷', CHI: '🇨🇱', ALB: '🇦🇱', NGA: '🇳🇬',
    MEX: '🇲🇽', ECU: '🇪🇨', NZL: '🇳🇿', SEN: '🇸🇳',
    FRA: '🇫🇷', BEL: '🇧🇪', ISR: '🇮🇱', ITA: '🇮🇹',
    ESP: '🇪🇸', BRA: '🇧🇷', JPN: '🇯🇵', KSA: '🇸🇦',
    GER: '🇩🇪', POR: '🇵🇹', COD: '🇨🇩', CRC: '🇨🇷',
    ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', NED: '🇳🇱', EGY: '🇪🇬', KOR: '🇰🇷',
    MAR: '🇲🇦', COL: '🇨🇴', TUN: '🇹🇳',
    CAN: '🇨🇦', URU: '🇺🇾', AUS: '🇦🇺', CIV: '🇨🇮',
    DEN: '🇩🇰', SRB: '🇷🇸', IRN: '🇮🇷',
    CHE: '🇨🇭', GRE: '🇬🇷', HUN: '🇭🇺', TGO: '🇹🇬',
    CRO: '🇭🇷', RSA: '🇿🇦', VEN: '🇻🇪', SVK: '🇸🇰',
}

const getFlag = (tla: string) => FLAG_MAP[tla] ?? '🏳️'

// ── Status styling ─────────────────────────────────────────────────────────────
const getStatusStyle = (status: string) => {
    switch (status) {
        case 'IN_PLAY':
        case 'PAUSED':
            return { bg: 'rgba(200,57,43,0.15)', color: '#e05c4a', border: 'rgba(200,57,43,0.3)', label: 'LIVE' }
        case 'FINISHED':
            return { bg: 'rgba(34,197,94,0.10)', color: '#22c55e', border: 'rgba(34,197,94,0.25)', label: 'FT' }
        case 'SCHEDULED':
            return { bg: 'rgba(255,255,255,0.05)', color: 'rgba(244,241,235,0.45)', border: 'rgba(255,255,255,0.08)', label: 'Soon' }
        default:
            return { bg: 'rgba(255,255,255,0.05)', color: 'rgba(244,241,235,0.45)', border: 'rgba(255,255,255,0.08)', label: status }
    }
}

const formatKickoff = (utc: string) => {
    const d = getAdjustedKickoff(utc)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Europe/Paris' }) + ' · ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris' }) + ' CET/CEST'
}

const formatGroup = (g?: string) =>
    g ? 'Group ' + g.replace('GROUP_', '') : ''

// ── Main component ─────────────────────────────────────────────────────────────
interface LiveMatchesProps {
    predictions?: Array<{ match_id: string; home_score: number; away_score: number }>
    dashboardMode?: boolean
}

export default function LiveMatches({ predictions = [], dashboardMode = true }: LiveMatchesProps) {
    const [matches, setMatches] = useState<MatchData[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'live' | 'today' | 'finished'>(dashboardMode ? 'today' : 'all')
    const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const fetchMatches = useCallback(async () => {
        try {
            const res = await fetch('/api/matches/live', { cache: 'no-store' })
            const data = await res.json()
            setMatches(data.matches ?? [])
            setLastUpdated(new Date())
        } catch {
            // silent fail — keep existing data
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchMatches()
        // Poll every 60 seconds — more frequent during live games
        const interval = setInterval(fetchMatches, 60_000)
        return () => clearInterval(interval)
    }, [fetchMatches])

    // ── Filter logic ────────────────────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0]
    
    // In dashboard mode, we combine live and today.
    const filtered = matches.filter(m => {
        const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED'
        const isToday = m.utcDate.startsWith(todayStr)
        
        if (dashboardMode) {
            return isLive || isToday
        }

        if (filter === 'live') return isLive
        if (filter === 'today') return isToday
        if (filter === 'finished') return m.status === 'FINISHED'
        return true
    })

    const liveCount = matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED').length

    // ── Match tile ──────────────────────────────────────────────────────────────
    const MatchTile = ({ m }: { m: MatchData }) => {
        const st = getStatusStyle(m.status)
        const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED'
        const isFinished = m.status === 'FINISHED'
        const hScore = m.score.fullTime.home
        const aScore = m.score.fullTime.away

        return (
            <div
                onClick={() => setSelectedMatch(m)}
                style={{
                    background: 'var(--surface)',
                    border: `1px solid ${isLive ? 'rgba(200,57,43,0.35)' : 'var(--border)'}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                    position: 'relative',
                    overflow: 'hidden',
                }}
                onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--border-gold)'
                    el.style.transform = 'translateY(-2px)'
                    el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)'
                }}
                onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = isLive ? 'rgba(200,57,43,0.35)' : 'var(--border)'
                    el.style.transform = 'translateY(0)'
                    el.style.boxShadow = 'none'
                }}
            >
                {/* Live pulse strip */}
                {isLive && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                        background: 'linear-gradient(90deg, #e05c4a, #d4a843, #e05c4a)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 2s linear infinite',
                    }} />
                )}
                <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

                {/* Status + group */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                        textTransform: 'uppercase', padding: '2px 8px',
                        borderRadius: 20, background: st.bg, color: st.color,
                        border: `1px solid ${st.border}`,
                        display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        {isLive && (
                            <span style={{
                                width: 5, height: 5, borderRadius: '50%', background: '#e05c4a',
                                animation: 'pulse 1.5s ease-in-out infinite', display: 'inline-block',
                            }} />
                        )}
                        {st.label}{isLive && m.minute ? ` ${m.minute}'` : ''}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                        {formatGroup(m.group)}
                    </span>
                </div>

                {/* Teams + score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Home */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {m.homeTeam.crest ? (
                            <img src={m.homeTeam.crest} alt={m.homeTeam.tla} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                        ) : (
                            <span style={{ fontSize: 24 }}>{getFlag(m.homeTeam.tla)}</span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)' }}>
                            {m.homeTeam.shortName}
                        </span>
                    </div>

                    {/* Score or time */}
                    <div style={{ textAlign: 'center', minWidth: 60 }}>
                        {isLive || isFinished ? (
                            <span style={{
                                fontFamily: 'Bebas Neue, sans-serif', fontSize: 28,
                                color: isLive ? 'var(--gold)' : 'var(--cream)',
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                                <span>{hScore}</span>
                                <span style={{ color: 'var(--muted)', fontSize: 20 }}>–</span>
                                <span>{aScore}</span>
                            </span>
                        ) : (
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                                {getAdjustedKickoff(m.utcDate).toLocaleTimeString('en-US', {
                                    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris'
                                })} <span style={{ fontSize: 10, opacity: 0.7 }}>CET/CEST</span>
                            </span>
                        )}
                    </div>

                    {/* Away */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row-reverse' }}>
                        {m.awayTeam.crest ? (
                            <img src={m.awayTeam.crest} alt={m.awayTeam.tla} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                        ) : (
                            <span style={{ fontSize: 24 }}>{getFlag(m.awayTeam.tla)}</span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)', textAlign: 'right' }}>
                            {m.awayTeam.shortName}
                        </span>
                    </div>
                </div>

                {/* Last goal ticker */}
                {(m.goals?.length ?? 0) > 0 && m.goals && (
                    <div style={{
                        marginTop: 10, paddingTop: 8,
                        borderTop: '1px solid var(--border)',
                        fontSize: 11, color: 'var(--muted)',
                        display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        <span>⚽</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold)' }}>
                            {m.goals[m.goals.length - 1].minute}&apos;
                        </span>
                        <span>{m.goals[m.goals.length - 1].scorer?.name}</span>
                        <span style={{ opacity: 0.6 }}>({m.goals[m.goals.length - 1].team.name.slice(0, 3).toUpperCase()})</span>
                    </div>
                )}
            </div>
        )
    }

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div>
            {/* Section header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 14,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 26, color: 'var(--cream)' }}>
                        World Cup 2026
                    </h2>
                    {liveCount > 0 && (
                        <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                            textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20,
                            background: 'rgba(200,57,43,0.15)', color: '#e05c4a',
                            border: '1px solid rgba(200,57,43,0.3)',
                            display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                            <span style={{
                                width: 6, height: 6, borderRadius: '50%', background: '#e05c4a',
                                animation: 'pulse 1.5s ease-in-out infinite', display: 'inline-block',
                            }} />
                            {liveCount} LIVE
                        </span>
                    )}
                </div>
                {lastUpdated && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}
                    </span>
                )}
            </div>

            {/* Filter tabs (hidden in dashboard mode) */}
            {!dashboardMode && (
                <div style={{
                    display: 'flex', gap: 4, marginBottom: 16,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10, padding: 4,
                    width: 'fit-content',
                }}>
                    {([
                        { key: 'all', label: 'All Matches' },
                        { key: 'live', label: `Live${liveCount > 0 ? ` (${liveCount})` : ''}` },
                        { key: 'today', label: 'Today' },
                        { key: 'finished', label: 'Results' },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            style={{
                                padding: '6px 14px', borderRadius: 7,
                                fontSize: 12, fontWeight: 500,
                                background: filter === tab.key ? 'var(--surface3)' : 'transparent',
                                color: filter === tab.key ? 'var(--cream)' : 'var(--muted)',
                                border: 'none', cursor: 'pointer',
                                fontFamily: 'DM Sans, sans-serif',
                                transition: 'all 0.15s',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {dashboardMode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>Live & Today's Matches</span>
                    <a href="/fixtures" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>View Full Fixtures →</a>
                </div>
            )}

            {/* Match grid */}
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} style={{
                            height: 110, borderRadius: 14,
                            background: 'linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                        }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--muted)', fontSize: 14 }}>
                    {filter === 'live'
                        ? '⚽ No live matches right now — check back during match days'
                        : filter === 'today'
                            ? '📅 No matches scheduled for today'
                            : 'No matches found'}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {filtered.map(m => <MatchTile key={m.id} m={m} />)}
                </div>
            )}

            {/* Match detail modal */}
            {selectedMatch && (
                <MatchModal 
                    match={selectedMatch} 
                    localMatchId={GROUP_MATCHES.find(g => g.home_team === selectedMatch.homeTeam.tla && g.away_team === selectedMatch.awayTeam.tla)?.id}
                    prediction={
                        predictions.find(p => p.match_id === GROUP_MATCHES.find(g => g.home_team === selectedMatch.homeTeam.tla && g.away_team === selectedMatch.awayTeam.tla)?.id) 
                        ?? null
                    }
                    onClose={() => setSelectedMatch(null)} 
                />
            )}
        </div>
    )
}