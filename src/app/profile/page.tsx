// src/app/profile/page.tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/lib/supabase/client'
import { SCORING_REFERENCE, scoreMatch } from '@/lib/scoring'
import { GROUP_MATCHES, KNOCKOUT_MATCHES, TEAMS, getFlagUrl, getRobohashUrl } from '@/lib/wc2026-data'
import { motion } from 'framer-motion'

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

function matchIdForLiveKoPick(pick: any) {
    if (pick.round === 'final' || pick.round === 'third_place') return pick.round
    return `${pick.round}_${pick.slot_index + 1}`
}

import { BADGE_DEFINITIONS, getBadgeProgress } from '@/lib/badges'

type Tier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'crown' | 'lightning'

const TIER_CONFIG: Record<Tier, {
    label: string; color: string; glow: string; border: string; bg: string
}> = {
    bronze: { label: 'Bronze', color: '#cd7f32', glow: 'rgba(205,127,50,0.22)', border: 'rgba(205,127,50,0.32)', bg: 'rgba(205,127,50,0.06)' },
    silver: { label: 'Silver', color: '#b0b8c8', glow: 'rgba(176,184,200,0.22)', border: 'rgba(176,184,200,0.32)', bg: 'rgba(176,184,200,0.06)' },
    gold: { label: 'Gold', color: '#d4a843', glow: 'rgba(212,168,67,0.28)', border: 'rgba(212,168,67,0.42)', bg: 'rgba(212,168,67,0.09)' },
    diamond: { label: 'Diamond', color: '#5b9fff', glow: 'rgba(91,159,255,0.28)', border: 'rgba(91,159,255,0.42)', bg: 'rgba(91,159,255,0.09)' },
    crown: { label: 'Crown', color: '#e05c4a', glow: 'rgba(224,92,74,0.28)', border: 'rgba(224,92,74,0.42)', bg: 'rgba(224,92,74,0.09)' },
    lightning: { label: 'Lightning', color: '#a855f7', glow: 'rgba(168,85,247,0.28)', border: 'rgba(168,85,247,0.42)', bg: 'rgba(168,85,247,0.09)' },
}

const DNA_PROFILES = [
    { id: 'sniper', icon: '🎯', label: 'The Sniper', color: '#d4a843', description: 'Exact scores, precise margins. You do not just predict results — you predict scorelines. Patience and precision define you.' },
    { id: 'romantic', icon: '🎨', label: 'The Romantic', color: '#e05c4a', description: 'You believe in beautiful, attacking football. High-scoring games, bold picks, big names winning big matches.' },
    { id: 'contrarian', icon: '🐺', label: 'The Contrarian', color: '#22c55e', description: 'Underdogs, upsets, dark horses. You love going against the grain — and when you are right, the points are magnificent.' },
    { id: 'pragmatist', icon: '🧱', label: 'The Pragmatist', color: '#5b9fff', description: 'Draws, tight margins, defensive outcomes. You respect the grind. You know that 1-0 is the most honest scoreline in football.' },
]

// Colour helpers for match history rows — no goal_diff
function predBg(type: string) {
    if (type === 'exact') return 'rgba(212,168,67,0.1)'
    if (type === 'correct') return 'rgba(91,159,255,0.1)'
    return 'var(--surface3)'
}
function predColor(type: string) {
    if (type === 'exact') return 'var(--gold)'
    if (type === 'correct') return '#5b9fff'
    return 'var(--muted)'
}
function predBorder(type: string) {
    if (type === 'exact') return 'var(--gold)'
    if (type === 'correct') return '#5b9fff'
    return 'var(--border)'
}
function mobilePredColor(type: string) {
    if (type === 'exact') return 'var(--gold)'
    if (type === 'correct') return '#10b981'
    return 'var(--cream)'
}

function ProfileContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [supabase] = useState(() => createClient())

    const [profile, setProfile] = useState<any>(null)
    const [predCount, setPredCount] = useState(0)
    const [totalPoints, setTotalPoints] = useState(0)
    const [exactCount, setExactCount] = useState(0)
    const [currentStreak, setCurrentStreak] = useState(0)
    const [bestStreak, setBestStreak] = useState(0)
    const [selectedBadge, setSelectedBadge] = useState<any>(null)
    const [activeFilter, setActiveFilter] = useState<'all' | Tier>('all')
    const [loading, setLoading] = useState(true)

    const [historyMatches, setHistoryMatches] = useState<any[]>([])
    const [pointsProgression, setPointsProgression] = useState<number[]>([])
    const [visibleHistoryCount, setVisibleHistoryCount] = useState(10)

    const [earnedBadges, setEarnedBadges] = useState<Set<string>>(new Set())
    const [badgeProgress, setBadgeProgress] = useState<Record<string, { current: number; target: number }>>({})

    useEffect(() => {
        const init = async () => {
            let targetUserId = searchParams.get('id')

            if (!targetUserId) {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) { router.push('/auth/login'); return }
                targetUserId = user.id
            }

            const { data: p } = await supabase.from('profiles').select('*').eq('id', targetUserId).single()
            setProfile(p)

            const { data: predictions } = await supabase.from('predictions').select('*').eq('user_id', targetUserId)
            const { data: liveKoPicks } = await supabase.from('live_ko_picks').select('*').eq('user_id', targetUserId)

            setPredCount((predictions?.length ?? 0) + (liveKoPicks?.length ?? 0))

            const normalizedLiveKoPicks = (liveKoPicks || []).map(bp => ({
                ...bp,
                match_id: matchIdForLiveKoPick(bp),
                qualifier_pick: bp.team_code,
            }))

            const allPredictions = [...(predictions || []), ...normalizedLiveKoPicks]

            const { data: dbBadges } = await supabase.from('user_badges').select('badge_id').eq('user_id', targetUserId)
            setEarnedBadges(new Set((dbBadges || []).map(b => b.badge_id)))

            // Fetch ALL DB matches (not just finished) so we have real team names & qualifiers
            const { data: allDbMatches } = await supabase.from('matches').select('*')
            const dbMatches = (allDbMatches || []).filter((m: any) => m.status === 'finished')

            // Build a lookup by match id for quick access
            const dbMatchById = new Map<string, any>()
            for (const m of allDbMatches || []) dbMatchById.set(m.id, m)

            let liveMatches: any[] = []
            try {
                const res = await fetch('/api/matches/live')
                if (res.ok) {
                    const data = await res.json()
                    liveMatches = data.matches || []
                }
            } catch { }

            const activeLiveMatches = liveMatches.filter(
                m => m.status === 'FINISHED' || m.status === 'IN_PLAY' || m.status === 'PAUSED'
            )

            const hist: any[] = []
            const processedMatchIds = new Set<string>()

            // 1. Process live API matches first (most up-to-date scores)
            for (const lm of activeLiveMatches) {
                const dbMatch = (allDbMatches || []).find(
                    (m: any) => m.home_team === lm.homeTeam?.tla && m.away_team === lm.awayTeam?.tla
                )
                if (!dbMatch) {
                    console.warn('[Profile] Live API match has no DB match', {
                        home: lm.homeTeam?.tla,
                        away: lm.awayTeam?.tla,
                        status: lm.status,
                    })
                    continue
                }

                const staticMatch = ALL_MATCHES.find(m => m.id === dbMatch.id)
                if (!staticMatch) continue
                if (lm.score.fullTime.home === null || lm.score.fullTime.away === null) continue

                // Use DB match for real team names and qualifier
                const realHomeTeam = dbMatch.home_team
                const realAwayTeam = dbMatch.away_team
                const realQualifier = dbMatch?.qualifier ?? null

                const pred = allPredictions.find(p => p.match_id === dbMatch.id)

                if (pred && typeof pred.home_score === 'number') {
                    const isKnockout = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(staticMatch.group_label)
                    const res = scoreMatch(
                        pred.home_score,
                        pred.away_score,
                        lm.score.fullTime.home,
                        lm.score.fullTime.away,
                        isKnockout,
                        {
                            predQualifier: pred.qualifier_pick ?? pred.team_code ?? null,
                            realQualifier,
                        }
                    )
                    hist.push({
                        ...staticMatch,
                        home_team: realHomeTeam,
                        away_team: realAwayTeam,
                        real_home_score: lm.score.fullTime.home,
                        real_away_score: lm.score.fullTime.away,
                        went_to_penalties: dbMatch.went_to_penalties ?? false,
                        penalty_home_score: dbMatch.penalty_home_score ?? null,
                        penalty_away_score: dbMatch.penalty_away_score ?? null,
                        pred_home_score: pred.home_score,
                        pred_away_score: pred.away_score,
                        points: res.total,
                        type: res.type,
                        status: lm.status,
                    })
                } else {
                    hist.push({
                        ...staticMatch,
                        home_team: realHomeTeam,
                        away_team: realAwayTeam,
                        real_home_score: lm.score.fullTime.home,
                        real_away_score: lm.score.fullTime.away,
                        went_to_penalties: dbMatch.went_to_penalties ?? false,
                        penalty_home_score: dbMatch.penalty_home_score ?? null,
                        penalty_away_score: dbMatch.penalty_away_score ?? null,
                        pred_home_score: null,
                        pred_away_score: null,
                        points: 0,
                        type: 'none',
                        status: lm.status,
                    })
                }
                processedMatchIds.add(dbMatch.id)
            }

            // 2. Process DB finished matches
            for (const dbm of dbMatches) {
                if (processedMatchIds.has(dbm.id)) continue

                const staticMatch = ALL_MATCHES.find(m => m.id === dbm.id)
                const pred = allPredictions.find(p => p.match_id === dbm.id)

                if (typeof dbm.home_score !== 'number') continue

                // Always use DB team names — they have the real teams, not placeholders
                const realHomeTeam = dbm.home_team ?? staticMatch?.home_team
                const realAwayTeam = dbm.away_team ?? staticMatch?.away_team

                if (pred && typeof pred.home_score === 'number') {
                    const isKnockout = dbm.stage
                        ? !['group', 'group_stage', 'GROUP_STAGE'].includes(dbm.stage)
                        : false
                    const res = scoreMatch(
                        pred.home_score,
                        pred.away_score,
                        dbm.home_score,
                        dbm.away_score,
                        isKnockout,
                        {
                            predQualifier: pred.qualifier_pick ?? pred.team_code ?? null,
                            realQualifier: dbm.qualifier ?? null,
                        }
                    )
                    hist.push({
                        ...staticMatch,
                        home_team: realHomeTeam,
                        away_team: realAwayTeam,
                        real_home_score: dbm.home_score,
                        real_away_score: dbm.away_score,
                        went_to_penalties: dbm.went_to_penalties ?? false,
                        penalty_home_score: dbm.penalty_home_score ?? null,
                        penalty_away_score: dbm.penalty_away_score ?? null,
                        pred_home_score: pred.home_score,
                        pred_away_score: pred.away_score,
                        points: res.total,
                        type: res.type,
                        status: dbm.status,
                    })
                } else {
                    hist.push({
                        ...staticMatch,
                        home_team: realHomeTeam,
                        away_team: realAwayTeam,
                        real_home_score: dbm.home_score,
                        real_away_score: dbm.away_score,
                        went_to_penalties: dbm.went_to_penalties ?? false,
                        penalty_home_score: dbm.penalty_home_score ?? null,
                        penalty_away_score: dbm.penalty_away_score ?? null,
                        pred_home_score: null,
                        pred_away_score: null,
                        points: 0,
                        type: 'none',
                        status: dbm.status,
                    })
                }
            }

            hist.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
            setHistoryMatches(hist)

            // KPIs — single pass over history
            let dynTotal = 0
            let dynExact = 0
            let dynCurrentStreak = 0
            let dynBestStreak = 0

            for (const m of hist) {
                dynTotal += m.points
                if (m.type === 'exact') dynExact++

                if (m.status === 'FINISHED' || m.status === 'finished') {
                    if (m.type === 'exact' || m.type === 'correct') {
                        dynCurrentStreak++
                        if (dynCurrentStreak > dynBestStreak) dynBestStreak = dynCurrentStreak
                    } else {
                        dynCurrentStreak = 0
                    }
                }
            }

            setTotalPoints(dynTotal)
            setExactCount(dynExact)
            setCurrentStreak(dynCurrentStreak)
            setBestStreak(dynBestStreak)

            let cum = 0
            setPointsProgression([0, ...hist.map(m => { cum += m.points; return cum })])

            const progress = getBadgeProgress({
                userId: targetUserId,
                predictions: allPredictions,
                bracketPicks: liveKoPicks || [],
                finishedMatches: hist,
                allFinishedMatches: hist,
            }, new Set((dbBadges || []).map(b => b.badge_id)))
            setBadgeProgress(progress)

            setLoading(false)
        }
        init()
    }, [searchParams])

    const badges = BADGE_DEFINITIONS.map(b => {
        const p = badgeProgress[b.id] || { current: 0, target: 1 }
        return {
            ...b,
            progress: Math.min(p.current, p.target),
            maxProgress: p.target,
            unlocked: earnedBadges.has(b.id),
        }
    })
    const unlockedCount = badges.filter(b => b.unlocked).length

    const finishedPredictedMatches = historyMatches.filter(m =>
        (m.status === 'FINISHED' || m.status === 'finished') &&
        m.pred_home_score !== null && m.pred_home_score !== undefined
    )
    const finishedCorrectOutcomeMatches = finishedPredictedMatches.filter(
        m => m.type === 'exact' || m.type === 'correct'
    )
    const resultAccuracy = finishedPredictedMatches.length > 0
        ? Math.round((finishedCorrectOutcomeMatches.length / finishedPredictedMatches.length) * 100)
        : 0

    const dnaProfile = exactCount >= 5
        ? DNA_PROFILES[0]
        : predCount >= 30 && resultAccuracy < 40
            ? DNA_PROFILES[2]
            : predCount >= 20
                ? DNA_PROFILES[1]
                : DNA_PROFILES[3]

    const displayName = profile?.display_name ?? 'Player'
    const filteredBadges = activeFilter === 'all' ? badges : badges.filter(b => b.tier === activeFilter)

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Nav initials="PL" />
                <div style={{ fontSize: 14, color: 'var(--muted)', paddingTop: 80 }}>Loading your profile…</div>
            </div>
        )
    }

    const maxProgPoints = Math.max(...pointsProgression, 10)
    const svgWidth = 800
    const svgHeight = 200
    const polylinePoints = pointsProgression.map((p, i) => {
        const x = (i / Math.max(1, pointsProgression.length - 1)) * svgWidth
        const y = svgHeight - (p / maxProgPoints) * svgHeight
        return `${x},${y}`
    }).join(' ')

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)', paddingBottom: 100 }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={displayName} />

            {/* ── HERO ── */}
            <div style={{ position: 'relative', overflow: 'hidden', paddingTop: 64 }}>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 55% 40% at 15% 0%, rgba(212,168,67,0.09) 0%, transparent 60%), radial-gradient(ellipse 55% 40% at 85% 0%, rgba(212,168,67,0.09) 0%, transparent 60%)` }} />
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.022, backgroundImage: 'linear-gradient(var(--cream) 1px,transparent 1px),linear-gradient(90deg,var(--cream) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

                <div className="resp-flex-stack resp-padding" style={{ maxWidth: 1200, margin: '0 auto', padding: '52px 40px 44px', position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 32 }}>
                    <img
                        src={getRobohashUrl(displayName, 120)}
                        alt="Avatar"
                        className="resp-hero-avatar"
                        style={{ width: 120, height: 120, borderRadius: '50%', background: profile?.avatar_color || 'var(--surface2)', border: '4px solid var(--gold)', objectFit: 'cover', boxShadow: '0 0 40px rgba(212,168,67,0.3)' }}
                    />
                    <div>
                        <h1 className="resp-hero-title" style={{ fontFamily: 'Bebas Neue', fontSize: 64, lineHeight: 0.9, color: 'var(--cream)', letterSpacing: 2, marginBottom: 8 }}>
                            {displayName}
                        </h1>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            <span style={{ fontSize: 16, color: 'var(--gold)', fontWeight: 600 }}>{totalPoints} Points</span>
                            <span style={{ fontSize: 14, color: 'var(--muted)' }}>•</span>
                            <span style={{ fontSize: 14, color: 'var(--dim)' }}>
                                Joined {profile?.created_at
                                    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                                    : 'recently'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="resp-padding" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 40px' }}>

                {/* ── KPI & PROGRESSION GRAPH ROW ── */}
                <div className="resp-grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, marginBottom: 52 }}>
                    {/* KPIs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                            { icon: '🎯', label: 'Exact Scores', value: exactCount, accent: '#e05c4a' },
                            { icon: '📊', label: 'Result Accuracy', value: `${resultAccuracy}%`, accent: '#5b9fff' },
                            { icon: '🔥', label: 'Current Streak', value: currentStreak > 0 ? `${currentStreak}` : '—', accent: '#22c55e' },
                            { icon: '🏆', label: 'Best Streak', value: bestStreak, accent: 'var(--gold)' },
                            { icon: '⚽', label: 'Total Predictions', value: `${predCount} / 104`, accent: 'var(--gold)' },
                        ].map(c => (
                            <div key={c.label} style={{ background: 'var(--surface2)', border: `1px solid var(--border)`, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 24 }}>{c.icon}</span>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--dim)' }}>{c.label}</span>
                                </div>
                                <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: c.accent }}>{c.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Progression Graph */}
                    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 32px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cream)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Points Progression</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Cumulative Points</div>
                        </div>
                        <div style={{ flex: 1, position: 'relative', minHeight: 200, display: 'flex', alignItems: 'flex-end', paddingTop: 20 }}>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)', width: '100%', height: '25%' }} />
                                ))}
                            </div>
                            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible', position: 'relative', zIndex: 10 }} preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.3" />
                                        <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <motion.polyline
                                    points={`${polylinePoints} ${svgWidth},${svgHeight} 0,${svgHeight}`}
                                    fill="url(#grad)"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                />
                                <motion.polyline
                                    points={polylinePoints}
                                    fill="none"
                                    stroke="var(--gold)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 1.5, ease: 'easeOut' }}
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* ── MATCH HISTORY ── */}
                <Section label="Match History">
                    <div style={{ background: 'var(--surface2)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div className="match-card-header resp-match-row-header" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                            <div>Date</div>
                            <div>Match</div>
                            <div style={{ textAlign: 'center' }}>Your Prediction</div>
                            <div style={{ textAlign: 'right' }}>Points Earned</div>
                        </div>

                        {historyMatches.length > 0
                            ? historyMatches.slice().reverse().slice(0, visibleHistoryCount).map((m, i) => {
                                const hasPred = m.pred_home_score !== null && m.pred_home_score !== undefined
                                return (
                                    <div key={i} className="match-card" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr', gap: 16, padding: '20px 24px', borderBottom: i < historyMatches.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>

                                        {/* DESKTOP */}
                                        <div className="desktop-only" style={{ fontSize: 12, color: 'var(--dim)' }}>
                                            {new Date(m.kickoff).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}<br />
                                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                {new Date(m.kickoff).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontWeight: 600, color: 'var(--cream)', width: 36, textAlign: 'right' }}>{m.home_team}</span>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                                <div style={{ background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 6, fontSize: 14, fontFamily: 'Bebas Neue', letterSpacing: 1, color: 'var(--cream)', border: '1px solid var(--border)' }}>
                                                    {m.real_home_score} - {m.real_away_score}
                                                </div>
                                                {m.went_to_penalties && (
                                                    <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                                                        Pen: {m.penalty_home_score}-{m.penalty_away_score}
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontWeight: 600, color: 'var(--cream)', width: 36 }}>{m.away_team}</span>
                                        </div>

                                        <div className="desktop-only" style={{ textAlign: 'center' }}>
                                            <div style={{
                                                background: hasPred ? predBg(m.type) : 'var(--black)',
                                                color: hasPred ? predColor(m.type) : 'var(--muted)',
                                                border: `1px solid ${hasPred ? predBorder(m.type) : 'rgba(255,255,255,0.1)'}`,
                                                padding: '4px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, letterSpacing: 1,
                                            }}>
                                                {hasPred ? `${m.pred_home_score} - ${m.pred_away_score}` : 'Missed'}
                                            </div>
                                        </div>

                                        <div className="desktop-only" style={{ textAlign: 'right', fontFamily: 'Bebas Neue', fontSize: 24, color: m.points > 0 ? 'var(--gold)' : 'var(--muted)' }}>
                                            +{m.points}
                                        </div>

                                        {/* MOBILE */}
                                        <div className="match-card-mobile-only match-card-mobile-header">
                                            <div>{new Date(m.kickoff).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                            <div style={{ color: 'var(--gold)' }}>{m.group_label}</div>
                                        </div>
                                        <div className="match-card-mobile-only match-card-mobile-teams">
                                            <span style={{ fontSize: 16, width: 40, textAlign: 'right', color: 'var(--dim)' }}>{m.home_team}</span>
                                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                <span>{m.real_home_score} - {m.real_away_score}</span>
                                                {m.went_to_penalties && (
                                                    <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                                                        Pen: {m.penalty_home_score}-{m.penalty_away_score}
                                                    </span>
                                                )}
                                            </span>
                                            <span style={{ fontSize: 16, width: 40, textAlign: 'left', color: 'var(--dim)' }}>{m.away_team}</span>
                                        </div>
                                        <div className="match-card-mobile-only match-card-mobile-footer">
                                            <div>
                                                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginRight: 8 }}>Pick:</span>
                                                {hasPred ? (
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: mobilePredColor(m.type) }}>
                                                        {m.pred_home_score} - {m.pred_away_score}
                                                        {m.type === 'exact' && (
                                                            <span style={{ marginLeft: 6, fontSize: 9, background: 'rgba(212,168,67,0.2)', color: 'var(--gold)', padding: '2px 4px', borderRadius: 4 }}>EXACT</span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: 12, color: 'var(--red-accent)' }}>Missed</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: m.points > 0 ? 'var(--gold)' : 'var(--muted)' }}>
                                                +{m.points} pts
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                            : (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
                                    No completed predictions yet.
                                </div>
                            )}

                        {historyMatches.length > visibleHistoryCount && (
                            <div style={{ padding: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                                <button
                                    onClick={() => setVisibleHistoryCount(v => v + 10)}
                                    style={{ padding: '8px 24px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--cream)', fontSize: 13, cursor: 'pointer' }}>
                                    Load More
                                </button>
                            </div>
                        )}
                    </div>
                </Section>

                {/* ── BADGE WALL ── */}
                <Section
                    label="Badge Collection"
                    right={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                {unlockedCount} / {BADGE_DEFINITIONS.length} unlocked
                            </span>
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                        {(Object.keys(TIER_CONFIG) as Tier[]).map(tierKey => {
                            const tierBadges = filteredBadges.filter(b => b.tier === tierKey)
                            if (tierBadges.length === 0) return null
                            const t = TIER_CONFIG[tierKey]
                            return (
                                <div key={tierKey}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: t.color, textTransform: 'uppercase', letterSpacing: 2 }}>
                                            {t.label} Tier
                                        </div>
                                        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${t.border}, transparent)` }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))', gap: 16 }}>
                                        {tierBadges.map(b => (
                                            <BadgeCard key={b.id} badge={b} onClick={() => setSelectedBadge(b)} />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Section>

                {/* ── PREDICTION DNA ── */}
                <Section label="Prediction DNA">
                    <div style={{ background: `linear-gradient(140deg, ${dnaProfile.color}13 0%, var(--surface2) 55%)`, border: `1px solid ${dnaProfile.color}38`, borderRadius: 18, padding: '32px 40px', display: 'flex', alignItems: 'center', gap: 32 }}>
                        <div style={{ width: 80, height: 80, borderRadius: 20, background: `${dnaProfile.color}18`, border: `2px solid ${dnaProfile.color}45`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, flexShrink: 0 }}>
                            {dnaProfile.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>You predict like</div>
                            <div style={{ fontFamily: 'Bebas Neue', fontSize: 36, color: dnaProfile.color, marginBottom: 8 }}>{dnaProfile.label}</div>
                            <p style={{ fontSize: 15, color: 'var(--dim)', lineHeight: 1.6, maxWidth: 600 }}>{dnaProfile.description}</p>
                        </div>
                    </div>
                </Section>

            </div>

            {selectedBadge && <BadgeModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />}
        </div>
    )
}

function Section({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 52 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 4, height: 24, borderRadius: 2, background: 'var(--gold)' }} />
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--cream)', letterSpacing: 1 }}>{label}</span>
                </div>
                {right}
            </div>
            {children}
        </div>
    )
}

function BadgeCard({ badge, onClick }: { badge: any; onClick: () => void }) {
    const t = TIER_CONFIG[badge.tier as Tier]
    return (
        <div onClick={onClick} style={{
            background: badge.unlocked ? t.bg : 'var(--surface2)',
            border: `1px solid ${badge.unlocked ? t.border : 'var(--border)'}`,
            borderRadius: 14, padding: '16px', cursor: 'pointer',
            opacity: badge.unlocked ? 1 : 0.5,
            filter: badge.unlocked ? 'none' : 'grayscale(1)',
            boxShadow: badge.unlocked ? `0 0 24px ${t.glow}, inset 0 0 12px ${t.glow}` : 'none',
            transform: badge.unlocked ? 'translateY(-2px)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative', overflow: 'hidden',
        }}>
            {badge.unlocked && (
                <div style={{ position: 'absolute', top: -20, right: -20, width: 60, height: 60, background: `radial-gradient(circle, ${t.color}33 0%, transparent 70%)`, pointerEvents: 'none' }} />
            )}
            <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: badge.unlocked ? `${t.color}1a` : 'var(--surface3)', border: `2px solid ${badge.unlocked ? t.color : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {badge.icon}
                </div>
                <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: t.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{t.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cream)' }}>{badge.label}</div>
                </div>
            </div>
        </div>
    )
}

function BadgeModal({ badge, onClose }: { badge: any; onClose: () => void }) {
    const t = TIER_CONFIG[badge.tier as Tier]
    return (
        <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface2)', border: `1px solid ${t.border}`, borderRadius: 22, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>{badge.icon}</div>
                <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 36, color: t.color, marginBottom: 12 }}>{badge.label}</h2>
                <p style={{ color: 'var(--dim)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>{badge.description}</p>
                {badge.maxProgress > 1 && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                            <span>Progress</span>
                            <span>{badge.progress} / {badge.maxProgress}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: t.color, width: `${(badge.progress / badge.maxProgress) * 100}%` }} />
                        </div>
                    </div>
                )}
                <button onClick={onClose} style={{ padding: '10px 24px', background: 'var(--surface3)', borderRadius: 8, color: 'var(--cream)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Close</button>
            </div>
        </div>
    )
}

export default function ProfilePage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', background: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>Loading profile…</div>
            </div>
        }>
            <ProfileContent />
        </Suspense>
    )
}
