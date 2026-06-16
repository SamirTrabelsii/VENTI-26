'use client'

import { useState, useMemo, useEffect } from 'react'
import { GROUP_MATCHES, KNOCKOUT_MATCHES, getTeam, getAdjustedKickoff } from '@/lib/wc2026-data'
import MatchModal, { MatchData as ModalMatchData } from '@/components/MatchModal'
import TeamFlag from '@/components/TeamFlag'
import { scoreMatch } from '@/lib/scoring'

// ── Helpers ────────────────────────────────────────────────────────────────────
const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

const ROUND_LABELS: Record<string, string> = {
    R32: 'Round of 32',
    R16: 'Round of 16',
    QF: 'Quarter-Final',
    SF: 'Semi-Final',
    '3RD': '3rd Place Play-off',
    FINAL: 'Final',
}

const isKnockout = (groupLabel: string) =>
    ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(groupLabel)

/** For knockout placeholders like "1A", "W-QF/1", etc., we format them nicely */
function formatPlaceholder(code: string): string {
    if (code.startsWith('W-')) return `Winner ${code.slice(2).replace('/', ' ')}`
    if (code.startsWith('L-')) return `Loser ${code.slice(2).replace('/', ' ')}`
    if (/^\d[A-L]$/.test(code)) {
        const pos = code[0] === '1' ? '1st' : code[0] === '2' ? '2nd' : `${code[0]}th`
        return `${pos} Group ${code[1]}`
    }
    if (code.includes('/')) return `Best 3rd (${code})`
    return code
}

interface FixturesClientProps {
    predictions: Array<{ match_id: string; home_score: number; away_score: number }>
    dbMatches: Array<{ id: string; status: string; home_score: number | null; away_score: number | null }>
    apiMatches?: any[]
}

export default function FixturesClient({ predictions, dbMatches, apiMatches = [] }: FixturesClientProps) {
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'group' | 'knockout'>('all')
    const [liveMatches, setLiveMatches] = useState<any[]>([])

    // Fetch real-time live matches
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

    // Combine static matches with API live statuses
    const fullMatches = useMemo(() => {
        return ALL_MATCHES.map(m => {
            const dbMatch = dbMatches.find(d => d.id === m.id)
            // Match by home + away team code (works for both football-data.org and worldcup26.ir responses)
            const liveMatch = liveMatches.find(l =>
                (l._homeCode === m.home_team && l._awayCode === m.away_team) ||
                (l.homeTeam?.tla === m.home_team && l.awayTeam?.tla === m.away_team)
            )

            let status = dbMatch?.status ?? 'upcoming'
            let homeScore = dbMatch?.home_score ?? null
            let awayScore = dbMatch?.away_score ?? null

            if (liveMatch && liveMatch.status !== 'SCHEDULED') {
                if (liveMatch.status === 'IN_PLAY' || liveMatch.status === 'PAUSED') status = 'live'
                else if (liveMatch.status === 'FINISHED') status = 'finished'

                homeScore = liveMatch.score?.fullTime?.home ?? homeScore
                awayScore = liveMatch.score?.fullTime?.away ?? awayScore
            }

            return {
                ...m,
                kickoff: m.kickoff,
                dbStatus: status,
                actualHomeScore: homeScore,
                actualAwayScore: awayScore,
                isKnockoutMatch: isKnockout(m.group_label),
            }
        })
    }, [dbMatches, liveMatches])

    // Filter
    const filteredMatches = useMemo(() => {
        if (filter === 'group') return fullMatches.filter(m => !m.isKnockoutMatch)
        if (filter === 'knockout') return fullMatches.filter(m => m.isKnockoutMatch)
        return fullMatches
    }, [fullMatches, filter])


    // ── Sorted date groups — array preserves chronological order ──────────────

    const sortedDateGroups = useMemo(() => {
        // Sort matches by kickoff timestamp first
        const sorted = [...filteredMatches].sort(
            (a, b) => getAdjustedKickoff(a.kickoff).getTime() - getAdjustedKickoff(b.kickoff).getTime()
        )
        // Group into an array of { date, isoDate, matches } in chronological order
        const result: { date: string; isoDate: string; matches: typeof fullMatches }[] = []
        for (const m of sorted) {
            const d = getAdjustedKickoff(m.kickoff)
            // Key on the ISO date in GMT+1 — e.g. "2026-06-11" (never shifts day across midnight)
            const isoDate = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) // YYYY-MM-DD
            const dateLabel = d.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'Europe/Paris',
            })
            const existing = result.find(g => g.isoDate === isoDate)
            if (existing) {
                existing.matches.push(m)
            } else {
                result.push({ date: dateLabel, isoDate, matches: [m] })
            }
        }
        // Sort matches within each day by kickoff time too
        result.forEach(g => g.matches.sort(
            (a, b) => getAdjustedKickoff(a.kickoff).getTime() - getAdjustedKickoff(b.kickoff).getTime()
        ))
        return result
    }, [filteredMatches])



    // Convert local MatchData to ModalMatchData when selected
    const selectedModalMatch = useMemo<ModalMatchData | null>(() => {
        if (!selectedMatchId) return null
        const m = fullMatches.find(x => x.id === selectedMatchId)
        if (!m) return null

        const homeTeam = getTeam(m.home_team)
        const awayTeam = getTeam(m.away_team)
        const ko = m.isKnockoutMatch

        let status = 'SCHEDULED'
        if (m.dbStatus === 'finished') status = 'FINISHED'
        if (m.dbStatus === 'live') status = 'IN_PLAY'

        const roundLabel = ROUND_LABELS[m.group_label] ?? m.group_label

        return {
            id: m.id,
            utcDate: m.kickoff,
            status,
            stage: ko ? 'KNOCKOUT' : 'GROUP_STAGE',
            group: ko ? roundLabel : 'GROUP_' + m.group_label,
            homeTeam: {
                name: homeTeam?.name ?? (ko ? formatPlaceholder(m.home_team) : m.home_team),
                shortName: homeTeam?.code ?? m.home_team,
                tla: m.home_team,
                crest: homeTeam ? `https://flagcdn.com/w80/${homeTeam.iso2}.png` : undefined,
            },
            awayTeam: {
                name: awayTeam?.name ?? (ko ? formatPlaceholder(m.away_team) : m.away_team),
                shortName: awayTeam?.code ?? m.away_team,
                tla: m.away_team,
                crest: awayTeam ? `https://flagcdn.com/w80/${awayTeam.iso2}.png` : undefined,
            },
            score: {
                fullTime: { home: m.actualHomeScore, away: m.actualAwayScore },
                halfTime: { home: null, away: null },
            },
            goals: [],
            venue: `${m.venue}, ${m.city}`,
        }
    }, [selectedMatchId, fullMatches])

    // Stats
    const groupCount = fullMatches.filter(m => !m.isKnockoutMatch).length
    const koCount = fullMatches.filter(m => m.isKnockoutMatch).length

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 40px 60px' }}>

            {/* Page Header */}
            <div style={{ marginBottom: 40 }}>
                <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 64, color: 'var(--cream)', lineHeight: 1 }}>
                    Tournament <span style={{ color: 'var(--gold)' }}>Fixtures</span>
                </h1>
                <p style={{ color: 'var(--muted)', fontSize: 16, marginTop: 8 }}>
                    {groupCount} group stage + {koCount} knockout = {groupCount + koCount} total matches
                </p>
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 32,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 6, width: 'fit-content',
            }}>
                {([
                    { key: 'all', label: `All (${groupCount + koCount})` },
                    { key: 'group', label: `Group Stage (${groupCount})` },
                    { key: 'knockout', label: `Knockouts (${koCount})` },
                ] as const).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        style={{
                            padding: '8px 20px', borderRadius: 8,
                            fontSize: 13, fontWeight: 600,
                            background: filter === tab.key ? 'var(--surface3)' : 'transparent',
                            color: filter === tab.key ? 'var(--cream)' : 'var(--dim)',
                            border: 'none', cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Matches List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                {sortedDateGroups.map(({ date, isoDate, matches }) => (
                    <div key={isoDate}>
                        {/* Date Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16,
                            position: 'sticky', top: 64, background: 'var(--black)', zIndex: 10,
                            padding: '16px 0', borderBottom: '1px solid var(--border)',
                        }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--cream)', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                                {date}
                            </h2>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                            <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                {matches.length} match{matches.length > 1 ? 'es' : ''}
                            </span>
                        </div>

                        {/* Matches Grid for the Date */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                            {matches.map(m => {
                                const homeTeam = getTeam(m.home_team)
                                const awayTeam = getTeam(m.away_team)
                                const isFinished = m.dbStatus === 'finished'
                                const isLive = m.dbStatus === 'live'
                                const ko = m.isKnockoutMatch
                                const roundLabel = ROUND_LABELS[m.group_label]

                                const prediction = predictions.find(p => p.match_id === m.id)
                                let provisionalPoints: number | null = null
                                if ((isLive || isFinished) && prediction && m.actualHomeScore !== null && m.actualAwayScore !== null) {
                                    const res = scoreMatch(prediction.home_score, prediction.away_score, m.actualHomeScore, m.actualAwayScore, ko)
                                    provisionalPoints = res.total
                                }

                                return (
                                    <div
                                        key={m.id}
                                        onClick={() => setSelectedMatchId(m.id)}
                                        style={{
                                            background: ko ? 'linear-gradient(135deg, var(--surface) 0%, rgba(212,168,67,0.03) 100%)' : 'var(--surface)',
                                            border: `1px solid ${isLive ? 'rgba(200,57,43,0.35)' : ko ? 'var(--border-gold)' : 'var(--border)'}`,
                                            borderRadius: 14, padding: '16px 20px',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            position: 'relative', overflow: 'hidden',
                                        }}
                                        onMouseEnter={e => {
                                            const el = e.currentTarget as HTMLElement
                                            el.style.borderColor = 'var(--gold)'
                                            el.style.transform = 'translateY(-2px)'
                                            el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'
                                        }}
                                        onMouseLeave={e => {
                                            const el = e.currentTarget as HTMLElement
                                            el.style.borderColor = isLive ? 'rgba(200,57,43,0.35)' : ko ? 'var(--border-gold)' : 'var(--border)'
                                            el.style.transform = 'translateY(0)'
                                            el.style.boxShadow = 'none'
                                        }}
                                    >
                                        {/* Top accent for knockout */}
                                        {ko && (
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--gold), var(--gold-light), var(--gold))' }} />
                                        )}

                                        {/* Status line */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <span style={{
                                                fontSize: 11, fontWeight: 600,
                                                color: ko ? 'var(--gold)' : 'var(--muted)',
                                            }}>
                                                {ko ? (roundLabel ?? m.group_label) : `Group ${m.group_label}`}
                                            </span>
                                            {isLive ? (
                                                <span style={{ fontSize: 10, fontWeight: 700, color: '#e05c4a', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e05c4a' }} /> LIVE
                                                </span>
                                            ) : isFinished ? (
                                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green-bright)', letterSpacing: 1 }}>FT</span>
                                            ) : (
                                                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                                                    {getAdjustedKickoff(m.kickoff).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris' })} <span style={{ fontSize: 9, opacity: 0.7 }}>CET/CEST</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Home Team */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                {homeTeam ? (
                                                    <TeamFlag teamCode={m.home_team} size={24} />
                                                ) : (
                                                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🏳️</span>
                                                )}
                                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cream)' }}>
                                                    {homeTeam?.name ?? formatPlaceholder(m.home_team)}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: 20, fontFamily: 'Bebas Neue', color: (isLive || isFinished) ? 'var(--gold)' : 'var(--muted)' }}>
                                                {(isLive || isFinished) ? m.actualHomeScore : '—'}
                                            </span>
                                        </div>

                                        {/* Away Team */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                {awayTeam ? (
                                                    <TeamFlag teamCode={m.away_team} size={24} />
                                                ) : (
                                                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🏳️</span>
                                                )}
                                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cream)' }}>
                                                    {awayTeam?.name ?? formatPlaceholder(m.away_team)}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: 20, fontFamily: 'Bebas Neue', color: (isLive || isFinished) ? 'var(--gold)' : 'var(--muted)' }}>
                                                {(isLive || isFinished) ? m.actualAwayScore : '—'}
                                            </span>
                                        </div>

                                        {/* Venue & Points */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span>🏟️</span> {m.venue}, {m.city}
                                            </div>
                                            {provisionalPoints !== null && provisionalPoints > 0 && (
                                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', background: 'rgba(212,168,67,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                                                    +{provisionalPoints} pts
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {selectedModalMatch && (
                <MatchModal
                    match={selectedModalMatch}
                    localMatchId={selectedModalMatch.id.toString()}
                    prediction={predictions.find(p => p.match_id === selectedModalMatch.id) ?? null}
                    onClose={() => setSelectedMatchId(null)}
                />
            )}
        </div>
    )
}
