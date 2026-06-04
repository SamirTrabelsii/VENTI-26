'use client'
import { useState, useEffect, useCallback } from 'react'
import { GROUP_MATCHES } from '@/lib/wc2026-data'

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
    const d = new Date(utc)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const formatGroup = (g?: string) =>
    g ? 'Group ' + g.replace('GROUP_', '') : ''

// ── Match Detail Modal ─────────────────────────────────────────────────────────
function MatchModal({ match, prediction, onClose }: { match: MatchData; prediction: { home_score: number, away_score: number } | null; onClose: () => void }) {
    const st = getStatusStyle(match.status)
    const hScore = match.score.fullTime.home
    const aScore = match.score.fullTime.away
    const htH = match.score.halfTime.home
    const htA = match.score.halfTime.away
    const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'
    const isFinished = match.status === 'FINISHED'

    const safeGoals = match.goals || []
    const homeGoals = safeGoals.filter(g => g.team.name === match.homeTeam.name)
    const awayGoals = safeGoals.filter(g => g.team.name === match.awayTeam.name)

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    return (
        <div
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
            style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(0,0,0,0.80)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
            }}
        >
            <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                width: '100%', maxWidth: 520,
                overflow: 'hidden',
                animation: 'modalIn 0.2s ease',
            }}>
                <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>

                {/* Top gold bar */}
                <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), var(--gold-light), var(--gold))' }} />

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                            textTransform: 'uppercase', padding: '3px 10px',
                            borderRadius: 20, background: st.bg, color: st.color,
                            border: `1px solid ${st.border}`,
                        }}>
                            {st.label}{isLive && match.minute ? ` · ${match.minute}'` : ''}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {formatGroup(match.group)} · {formatKickoff(match.utcDate)}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'var(--surface2)', border: '1px solid var(--border)',
                            color: 'var(--dim)', cursor: 'pointer', fontSize: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >✕</button>
                </div>

                {/* Extra Details (Venue & Referees) */}
                <div style={{ padding: '0 20px 10px', display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)' }}>
                    {match.venue && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🏟️</span> {match.venue}
                        </div>
                    )}
                    {match.referees && match.referees.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>👨‍⚖️</span> {match.referees[0].name} (Ref)
                        </div>
                    )}
                </div>

                {/* Main score */}
                <div style={{ padding: '18px 20px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

                        {/* Home */}
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                                {match.homeTeam.crest ? (
                                    <img src={match.homeTeam.crest} alt={match.homeTeam.tla} style={{ width: 64, height: 64, objectFit: 'contain' }} />
                                ) : (
                                    <span style={{ fontSize: 48 }}>{getFlag(match.homeTeam.tla)}</span>
                                )}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>{match.homeTeam.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{match.homeTeam.tla}</div>
                        </div>

                        {/* Score */}
                        <div style={{ textAlign: 'center', padding: '0 16px' }}>
                            {isLive || isFinished ? (
                                <>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        fontFamily: 'Bebas Neue, sans-serif', fontSize: 64,
                                        color: 'var(--cream)', lineHeight: 1,
                                    }}>
                                        <span style={{ color: isLive ? 'var(--gold)' : 'var(--cream)' }}>{hScore}</span>
                                        <span style={{ color: 'var(--muted)', fontSize: 40 }}>–</span>
                                        <span style={{ color: isLive ? 'var(--gold)' : 'var(--cream)' }}>{aScore}</span>
                                    </div>
                                    {(isFinished && htH !== null) && (
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                            HT: {htH}–{htA}
                                        </div>
                                    )}
                                    {isLive && (
                                        <div style={{
                                            marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                                            fontSize: 11, fontWeight: 700, color: '#e05c4a',
                                            fontFamily: 'DM Mono, monospace',
                                        }}>
                                            <span style={{
                                                width: 6, height: 6, borderRadius: '50%', background: '#e05c4a',
                                                animation: 'pulse 1.5s ease-in-out infinite',
                                                display: 'inline-block',
                                            }} />
                                            <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }`}</style>
                                            {match.minute}&apos;
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--muted)' }}>VS</div>
                            )}
                        </div>

                        {/* Away */}
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                                {match.awayTeam.crest ? (
                                    <img src={match.awayTeam.crest} alt={match.awayTeam.tla} style={{ width: 64, height: 64, objectFit: 'contain' }} />
                                ) : (
                                    <span style={{ fontSize: 48 }}>{getFlag(match.awayTeam.tla)}</span>
                                )}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>{match.awayTeam.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{match.awayTeam.tla}</div>
                        </div>

                    </div>
                </div>

                {/* Goal timeline */}
                {safeGoals.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
                        <p style={{
                            fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                            textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12,
                        }}>
                            Goals
                        </p>
                        <div style={{ display: 'flex', gap: 20 }}>
                            {/* Home goals */}
                            <div style={{ flex: 1 }}>
                                {homeGoals.map((g, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        marginBottom: 6, fontSize: 12,
                                    }}>
                                        <span>⚽</span>
                                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--gold)', minWidth: 28 }}>
                                            {g.minute}&apos;
                                        </span>
                                        <span style={{ color: 'var(--cream)' }}>{g.scorer?.name ?? '—'}</span>
                                        {g.type === 'OWN_GOAL' && <span style={{ fontSize: 10, color: '#e05c4a' }}>OG</span>}
                                        {g.type === 'PENALTY' && <span style={{ fontSize: 10, color: 'var(--gold)' }}>P</span>}
                                    </div>
                                ))}
                            </div>
                            {/* Away goals */}
                            <div style={{ flex: 1 }}>
                                {awayGoals.map((g, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        marginBottom: 6, fontSize: 12, flexDirection: 'row-reverse',
                                    }}>
                                        <span>⚽</span>
                                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--gold)', minWidth: 28, textAlign: 'right' }}>
                                            {g.minute}&apos;
                                        </span>
                                        <span style={{ color: 'var(--cream)', textAlign: 'right' }}>{g.scorer?.name ?? '—'}</span>
                                        {g.type === 'OWN_GOAL' && <span style={{ fontSize: 10, color: '#e05c4a' }}>OG</span>}
                                        {g.type === 'PENALTY' && <span style={{ fontSize: 10, color: 'var(--gold)' }}>P</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Your prediction for this match */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px',
                        background: 'var(--surface2)', borderRadius: 10,
                        border: '1px solid var(--border)',
                    }}>
                        <span style={{ fontSize: 16 }}>🎯</span>
                        <span style={{ fontSize: 12, color: 'var(--dim)' }}>Your prediction</span>
                        
                        {prediction ? (
                            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, fontFamily: 'Bebas Neue', color: 'var(--cream)' }}>
                                <span>{prediction.home_score}</span>
                                <span style={{ color: 'var(--muted)', fontSize: 14 }}>–</span>
                                <span>{prediction.away_score}</span>
                            </span>
                        ) : (
                            <span style={{ marginLeft: 'auto', fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--gold)' }}>
                                Not predicted
                            </span>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex', gap: 10,
                }}>

                <a
                    href="/predict"
                    style={{
                        flex: 1, padding: '10px 0', borderRadius: 10,
                        background: 'var(--gold)', color: '#0a0a0a',
                        fontWeight: 700, fontSize: 13, textAlign: 'center',
                        textDecoration: 'none',
                    }}
                >
                    Predict This Match
                </a>
                <button
                    onClick={onClose}
                    style={{
                        padding: '10px 20px', borderRadius: 10,
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        color: 'var(--dim)', fontSize: 13, cursor: 'pointer',
                    }}
                >
                    Close
                </button>
            </div>
        </div>
    </div >
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
interface LiveMatchesProps {
    predictions?: Array<{ match_id: string; home_score: number; away_score: number }>
}

export default function LiveMatches({ predictions = [] }: LiveMatchesProps) {
    const [matches, setMatches] = useState<MatchData[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'live' | 'today' | 'finished'>('all')
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
    const filtered = matches.filter(m => {
        if (filter === 'live') return m.status === 'IN_PLAY' || m.status === 'PAUSED'
        if (filter === 'today') return m.utcDate.startsWith(todayStr)
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
                                {new Date(m.utcDate).toLocaleTimeString('en-US', {
                                    hour: '2-digit', minute: '2-digit'
                                })}
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
                        Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Filter tabs */}
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