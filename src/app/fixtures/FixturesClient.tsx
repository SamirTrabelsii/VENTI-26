'use client'

import { useState, useMemo, useEffect } from 'react'
import { GROUP_MATCHES, KNOCKOUT_MATCHES, getTeam, getAdjustedKickoff } from '@/lib/wc2026-data'
import MatchModal, { MatchData as ModalMatchData } from '@/components/MatchModal'
import TeamFlag from '@/components/TeamFlag'
import { scoreMatch } from '@/lib/scoring'
import { createClient } from '@/lib/supabase/client'

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
    dbMatches: Array<{ id: string; status: string; home_score: number | null; away_score: number | null; kickoff?: string }>
}

export default function FixturesClient({ predictions, dbMatches }: FixturesClientProps) {
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'group' | 'knockout'>('all')
    const [currentDbMatches, setCurrentDbMatches] = useState(dbMatches)
    const [liveApiMatches, setLiveApiMatches] = useState<any[]>([])

    useEffect(() => {
        setCurrentDbMatches(dbMatches)
    }, [dbMatches])

    useEffect(() => {
        const fetchLive = async () => {
            try {
                const res = await fetch('/api/matches/live', { cache: 'no-store' })
                const data = await res.json()
                if (data.matches) setLiveApiMatches(data.matches)
            } catch {
                // Ignore API failures
            }
        }
        fetchLive()
        const interval = setInterval(fetchLive, 60_000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const supabase = createClient()
        const channel = supabase.channel('fixtures_matches')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
                setCurrentDbMatches(prev => prev.map(m => m.id === payload.new.id ? payload.new as any : m))
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    // Combine static matches
    const fullMatches = useMemo(() => {
        return ALL_MATCHES.map(m => {
            const dbMatch = currentDbMatches.find(d => d.id === m.id)
            const effHome = dbMatch?.home_team ?? m.home_team;
            const effAway = dbMatch?.away_team ?? m.away_team;
            const apiMatch = liveApiMatches.find(l => l.homeTeam.tla === effHome && l.awayTeam.tla === effAway)

            let status = dbMatch?.status ?? 'upcoming'
            let hScore = dbMatch?.home_score ?? null
            let aScore = dbMatch?.away_score ?? null

            if (apiMatch) {
                if (apiMatch.status === 'IN_PLAY' || apiMatch.status === 'PAUSED') status = 'live'
                else if (apiMatch.status === 'FINISHED') status = 'finished'
                
                if (apiMatch.score?.fullTime?.home !== null && apiMatch.score?.fullTime?.home !== undefined) {
                    hScore = apiMatch.score.fullTime.home
                }
                if (apiMatch.score?.fullTime?.away !== null && apiMatch.score?.fullTime?.away !== undefined) {
                    aScore = apiMatch.score.fullTime.away
                }
            }

            return {
                ...m,
                home_team: dbMatch?.home_team ?? m.home_team,
                away_team: dbMatch?.away_team ?? m.away_team,
                kickoff: dbMatch?.kickoff ?? m.kickoff,
                dbStatus: status,
                actualHomeScore: hScore,
                actualAwayScore: aScore,
                isKnockoutMatch: isKnockout(m.group_label),
            }
        })
    }, [currentDbMatches, liveApiMatches])

    // Filter
    const filteredMatches = useMemo(() => {
        if (filter === 'group') return fullMatches.filter(m => !m.isKnockoutMatch)
        if (filter === 'knockout') return fullMatches.filter(m => m.isKnockoutMatch)
        return fullMatches
    }, [fullMatches, filter])


    // ── Sorted date groups & Live matches ──────────────────────────────────────
    const liveMatches = useMemo(() => {
        return filteredMatches.filter(m => m.dbStatus === 'live')
    }, [filteredMatches])

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
            const isoDate = d.toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' }) // YYYY-MM-DD
            const dateLabel = d.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'Africa/Tunis',
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

    // Match Card Component
    const MatchCard = ({ m }: { m: any }) => {
        const homeTeam = getTeam(m.home_team)
        const awayTeam = getTeam(m.away_team)
        const isFinished = m.dbStatus === 'finished'
        const isLive = m.dbStatus === 'live'
        const ko = m.isKnockoutMatch
        const roundLabel = ROUND_LABELS[m.group_label]

        const prediction = predictions.find(p => p.match_id === m.id)
        let provisionalPoints: number | null = null
        if ((isLive || isFinished) && prediction && m.actualHomeScore !== null && m.actualAwayScore !== null) {
            const effPredHome = !prediction.is_repredicted && typeof prediction.original_home_score === 'number' ? prediction.original_home_score : prediction.home_score;
            const effPredAway = !prediction.is_repredicted && typeof prediction.original_away_score === 'number' ? prediction.original_away_score : prediction.away_score;
            
            const isFixtureCorrect = !ko ||
                !prediction.predicted_home_team ||
                !prediction.predicted_away_team ||
                (prediction.predicted_home_team === m.home_team && prediction.predicted_away_team === m.away_team);

            const res = scoreMatch(effPredHome, effPredAway, m.actualHomeScore, m.actualAwayScore, ko, {
                predQualifier: prediction.qualifier || prediction.qualifier_pick || prediction.team_code,
                realQualifier: m.qualifier || null,
                isRepredicted: !!prediction.is_repredicted,
                multiplier: m.multiplier || 1,
                isFixtureCorrect
            })
            provisionalPoints = res.total
        }

        return (
            <div
                onClick={() => setSelectedMatchId(m.id)}
                style={{
                    background: isLive ? 'rgba(200,57,43,0.03)' : ko ? 'linear-gradient(135deg, var(--surface) 0%, rgba(212,168,67,0.03) 100%)' : 'var(--surface)',
                    border: `1px solid ${isLive ? 'rgba(200,57,43,0.35)' : ko ? 'var(--border-gold)' : 'var(--border)'}`,
                    borderRadius: 14, padding: '16px 20px',
                    cursor: 'pointer', transition: 'all 0.2s',
                    position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = isLive ? 'rgba(200,57,43,0.8)' : 'var(--gold)'
                    el.style.transform = 'translateY(-2px)'
                    el.style.boxShadow = isLive ? '0 8px 24px rgba(200,57,43,0.2)' : '0 8px 24px rgba(0,0,0,0.3)'
                }}
                onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = isLive ? 'rgba(200,57,43,0.35)' : ko ? 'var(--border-gold)' : 'var(--border)'
                    el.style.transform = 'translateY(0)'
                    el.style.boxShadow = 'none'
                }}
            >
                {ko && !isLive && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--gold), var(--gold-light), var(--gold))' }} />
                )}
                {isLive && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                        background: 'linear-gradient(90deg, #e05c4a, #d4a843, #e05c4a)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 2s linear infinite',
                    }} />
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: isLive ? '#e05c4a' : ko ? 'var(--gold)' : 'var(--muted)',
                    }}>
                        {ko ? (roundLabel ?? m.group_label) : `Group ${m.group_label}`}
                    </span>
                    {isLive ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#e05c4a', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e05c4a', animation: 'pulse 1.5s ease-in-out infinite' }} /> LIVE
                        </span>
                    ) : isFinished ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green-bright)', letterSpacing: 1 }}>FT</span>
                    ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                            {getAdjustedKickoff(m.kickoff).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Tunis' })} <span style={{ fontSize: 9, opacity: 0.7 }}>GMT+1</span>
                        </span>
                    )}
                </div>

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
                    <span style={{ fontSize: 24, fontFamily: 'Bebas Neue', color: (isLive || isFinished) ? 'var(--gold)' : 'var(--muted)' }}>
                        {(isLive || isFinished) ? m.actualHomeScore : '—'}
                    </span>
                </div>

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
                    <span style={{ fontSize: 24, fontFamily: 'Bebas Neue', color: (isLive || isFinished) ? 'var(--gold)' : 'var(--muted)' }}>
                        {(isLive || isFinished) ? m.actualAwayScore : '—'}
                    </span>
                </div>

                {provisionalPoints !== null && provisionalPoints > 0 && (
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', background: 'rgba(212,168,67,0.1)', padding: '4px 8px', borderRadius: 6 }}>
                            +{provisionalPoints} pts
                        </span>
                    </div>
                )}
            </div>
        )
    }

    const scrollToLastPlayed = () => {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
        
        let targetIso = null
        for (const g of sortedDateGroups) {
            if (g.isoDate === todayStr) {
                targetIso = g.isoDate
                break
            }
            if (g.isoDate < todayStr) {
                targetIso = g.isoDate
            }
        }
        
        // If tournament hasn't started, target first day. If finished, target last day.
        if (!targetIso && sortedDateGroups.length > 0) {
            targetIso = sortedDateGroups[0].isoDate
        }

        if (targetIso) {
            const el = document.getElementById(`date-${targetIso}`)
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 100
                window.scrollTo({ top: y, behavior: 'smooth' })
            }
        }
    }

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

            {/* Controls Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 32 }}>
                {/* Filters */}
                <div style={{
                    display: 'flex', gap: 4,
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

                {/* Jump to Latest Button */}
                <button
                    onClick={scrollToLastPlayed}
                    className="hover-glow"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 10,
                        background: 'rgba(212,168,67,0.1)', border: '1px solid var(--gold)',
                        color: 'var(--gold)', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: 1
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = '#000' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,168,67,0.1)'; e.currentTarget.style.color = 'var(--gold)' }}
                >
                    ↓ Last Played
                </button>
            </div>

            {/* Live Matches Section */}
            {liveMatches.length > 0 && (
                <div style={{ marginBottom: 48 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
                        borderBottom: '1px solid rgba(200,57,43,0.3)', paddingBottom: 12
                    }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e05c4a', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: '#e05c4a', letterSpacing: 1.5, margin: 0 }}>
                            Featured Live Games
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                        {liveMatches.map(m => <MatchCard key={m.id} m={m} />)}
                    </div>
                </div>
            )}

            {/* Matches List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                {sortedDateGroups.map(({ date, isoDate, matches }) => (
                    <div key={isoDate} id={`date-${isoDate}`}>
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
                            {matches.map(m => <MatchCard key={m.id} m={m} />)}
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
