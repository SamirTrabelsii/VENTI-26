'use client'
import { useState, useEffect } from 'react'
import { getRobohashUrl, getAdjustedKickoff, GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'
import { scoreMatch } from '@/lib/scoring'
import { useMemo } from 'react'

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

interface Goal {
    minute: number
    team: { name: string }
    scorer: { name: string }
    type: string
}

export interface MatchData {
    id: number | string
    utcDate: string
    status: 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | string
    minute?: number
    stage: string
    group?: string
    homeTeam: { name: string; shortName: string; crest?: string; tla: string }
    awayTeam: { name: string; shortName: string; crest?: string; tla: string }
    score: {
        fullTime: { home: number | null; away: number | null }
        halfTime: { home: number | null; away: number | null }
    }
    goals: Goal[]
    venue?: string
    referees?: Array<{ name: string; type: string }>
}

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

const getStatusStyle = (status: string) => {
    switch (status) {
        case 'IN_PLAY':
        case 'PAUSED':
            return { bg: 'rgba(200,57,43,0.15)', color: '#e05c4a', border: 'rgba(200,57,43,0.3)', label: 'LIVE' }
        case 'FINISHED':
            return { bg: 'rgba(34,197,94,0.10)', color: '#22c55e', border: 'rgba(34,197,94,0.25)', label: 'FT' }
        case 'SCHEDULED':
        case 'UPCOMING':
            return { bg: 'rgba(255,255,255,0.05)', color: 'rgba(244,241,235,0.45)', border: 'rgba(255,255,255,0.08)', label: 'Soon' }
        default:
            return { bg: 'rgba(255,255,255,0.05)', color: 'rgba(244,241,235,0.45)', border: 'rgba(255,255,255,0.08)', label: status }
    }
}

const formatKickoff = (utc: string) => {
    const d = getAdjustedKickoff(utc)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Africa/Tunis' }) + ' · ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Tunis' }) + ' GMT+1'
}

const formatGroup = (g?: string) =>
    g ? 'Group ' + g.replace('GROUP_', '') : ''

interface LeaderboardEntry {
    user_id: string
    display_name: string
    avatar_initials: string
    avatar_color: string
    predicted_home: number
    predicted_away: number
    points: number | null
    isExact: boolean
}

export default function MatchModal({ 
    match, 
    localMatchId, 
    prediction, 
    onClose 
}: { 
    match: MatchData
    localMatchId?: string
    prediction?: { home_score: number, away_score: number } | null
    onClose: () => void 
}) {
    const st = getStatusStyle(match.status)
    const hScore = match.score.fullTime.home
    const aScore = match.score.fullTime.away
    const htH = match.score.halfTime.home
    const htA = match.score.halfTime.away
    const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'
    const isFinished = match.status === 'FINISHED'
    const hasPrediction = prediction != null

    const safeGoals = match.goals || []
    const homeGoals = safeGoals.filter(g => g.team.name === match.homeTeam.name)
    const awayGoals = safeGoals.filter(g => g.team.name === match.awayTeam.name)

    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [loadingBoard, setLoadingBoard] = useState(false)

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    useEffect(() => {
        if (localMatchId && (isLive || isFinished)) {
            setLoadingBoard(true)
            fetch(`/api/matches/${localMatchId}/leaderboard`)
                .then(r => r.json())
                .then(data => {
                    if (data.leaderboard) setLeaderboard(data.leaderboard)
                    setLoadingBoard(false)
                })
                .catch(() => setLoadingBoard(false))
        } else {
            setLeaderboard([])
            setLoadingBoard(false)
        }
    }, [localMatchId, isLive, isFinished])

    const displayLeaderboard = useMemo(() => {
        if (!leaderboard || leaderboard.length === 0) return []

        return leaderboard.map(u => {
            let points = u.points
            let isExact = u.isExact

            // Calculate live points if the match is live or finished and DB points are still pending
            if (points === null && (isLive || isFinished) && hScore !== null && aScore !== null) {
                const dbMatch = ALL_MATCHES.find(m => m.id === localMatchId)
                const isKoMatch = dbMatch ? ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(dbMatch.group_label) : false
                
                const res = scoreMatch(u.predicted_home, u.predicted_away, hScore, aScore, isKoMatch)
                points = res.total
                isExact = res.type === 'exact'
            }

            return { ...u, points, isExact }
        }).sort((a, b) => {
            const pA = a.points || 0
            const pB = b.points || 0
            return pB - pA || (b.isExact ? 1 : 0) - (a.isExact ? 1 : 0) || a.display_name.localeCompare(b.display_name)
        })
    }, [leaderboard, isLive, isFinished, hScore, aScore, localMatchId])

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
                maxHeight: '90vh',
                overflowY: 'auto',
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

                {/* Match Leaderboard */}
                {(isLive || isFinished) && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)' }}>
                            Global Predictions
                        </p>
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                            {leaderboard.length} user{leaderboard.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    
                    {loadingBoard ? (
                        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>Loading rankings...</div>
                    ) : displayLeaderboard.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
                            {displayLeaderboard.map((u, i) => (
                                <div key={u.user_id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    background: u.isExact ? 'rgba(212,168,67,0.08)' : 'var(--surface2)',
                                    border: `1px solid ${u.isExact ? 'var(--border-gold)' : 'var(--border)'}`,
                                    padding: '10px 14px', borderRadius: 10
                                }}>
                                    <span style={{ width: 18, fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                                        {i + 1}
                                    </span>
                                    <img 
                                        src={getRobohashUrl(u.display_name, 48)} 
                                        alt={u.display_name}
                                        style={{ 
                                            width: 28, height: 28, borderRadius: '50%', 
                                            border: `1.5px solid ${u.isExact ? 'var(--gold)' : 'var(--border)'}`,
                                            objectFit: 'cover'
                                        }} 
                                    />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {u.display_name}
                                    </span>
                                    
                                    <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, color: 'var(--dim)', paddingRight: 10 }}>
                                        {u.predicted_home} - {u.predicted_away}
                                    </span>
                                    
                                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 48, textAlign: 'right', color: u.points === null ? 'var(--muted)' : u.isExact ? 'var(--gold)' : 'var(--green-bright)' }}>
                                        {u.points === null ? 'Pending' : `+${u.points}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
                            No predictions found for this match.
                        </div>
                    )}
                </div>
                )}

                {/* Your prediction for this match */}
                {prediction !== undefined && (
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
                )}

                {/* Footer */}
                <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex', gap: 10,
                }}>
                {(!isFinished && !isLive && !hasPrediction) && (
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
                )}
                <button
                    onClick={onClose}
                    style={{
                        flex: (isFinished || isLive) ? 1 : undefined,
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
