'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/lib/supabase/client'
import { SCORING_REFERENCE } from '@/lib/scoring'

// ─── BADGE DEFINITIONS ────────────────────────────────────────────────────────

type Tier = 'silver' | 'gold' | 'legendary'
type Category = 'accuracy' | 'social' | 'bravery' | 'legendary'

interface Badge {
    id: string
    icon: string
    label: string
    definition: string
    condition: string
    tier: Tier
    category: Category
    maxProgress: number
}

const TIER_CONFIG: Record<Tier, {
    label: string; color: string; glow: string; border: string; bg: string
}> = {
    silver: { label: 'Silver', color: '#b0b8c8', glow: 'rgba(176,184,200,0.22)', border: 'rgba(176,184,200,0.32)', bg: 'rgba(176,184,200,0.06)' },
    gold: { label: 'Gold', color: '#d4a843', glow: 'rgba(212,168,67,0.28)', border: 'rgba(212,168,67,0.42)', bg: 'rgba(212,168,67,0.09)' },
    legendary: { label: 'Legendary', color: '#e05c4a', glow: 'rgba(224,92,74,0.28)', border: 'rgba(224,92,74,0.42)', bg: 'rgba(224,92,74,0.09)' },
}

const CATEGORY_LABEL: Record<Category, string> = {
    accuracy: 'Accuracy',
    social: 'Social',
    bravery: 'Bravery',
    legendary: 'Legend',
}

const ALL_BADGES: Badge[] = [
    // ── SILVER ──────────────────────────────────────────────────────────────────
    {
        id: 'sharpshooter', icon: '🎯', tier: 'silver', category: 'accuracy',
        label: 'Sharpshooter',
        definition: 'Scoreline precision separates real analysts from casual fans. You called three exact results in a single round.',
        condition: 'Get 3 exact score predictions correct within a single group round.',
        maxProgress: 3,
    },
    {
        id: 'hot_streak', icon: '🔥', tier: 'silver', category: 'accuracy',
        label: 'Hot Streak',
        definition: 'Five matches in a row. The momentum was real — and so was your reading of the game.',
        condition: 'Predict the correct outcome in 5 consecutive matches.',
        maxProgress: 5,
    },
    {
        id: 'giant_killer', icon: '⚡', tier: 'silver', category: 'bravery',
        label: 'Giant Killer',
        definition: 'You saw the upset while everyone backed the favourite. Three times you were right when the crowd was wrong.',
        condition: 'Correctly predict 3 matches where the lower-ranked FIFA team wins.',
        maxProgress: 3,
    },
    {
        id: 'recruiter', icon: '🤝', tier: 'silver', category: 'social',
        label: 'The Recruiter',
        definition: 'A prediction game lives or dies by the quality of the rivals. You built the squad.',
        condition: 'Create a group and have 5 or more players join it.',
        maxProgress: 5,
    },

    // ── GOLD ────────────────────────────────────────────────────────────────────
    {
        id: 'score_oracle', icon: '🔢', tier: 'gold', category: 'accuracy',
        label: 'Score Oracle',
        definition: 'Ten exact scorelines. Not lucky guesses — pattern recognition at the highest level.',
        condition: 'Accumulate 10 exact score predictions across the full tournament.',
        maxProgress: 10,
    },
    {
        id: 'pole_position', icon: '📈', tier: 'gold', category: 'social',
        label: 'Pole Position',
        definition: 'When the group stage closed, you were top of the board. Now you have a target on your back.',
        condition: 'Be ranked #1 in any of your groups at the end of the group stage.',
        maxProgress: 1,
    },
    {
        id: 'contrarian', icon: '🧠', tier: 'gold', category: 'bravery',
        label: 'The Contrarian',
        definition: 'The community was wrong, and you knew it — ten separate times. Independent thinking rewarded.',
        condition: 'Correctly predict 10 matches where your pick differed from the community majority.',
        maxProgress: 10,
    },
    {
        id: 'perfect_day', icon: '✨', tier: 'gold', category: 'accuracy',
        label: 'Perfect Day',
        definition: 'One full match day. Every game. Every result. A statistical near-impossibility — and you did it.',
        condition: 'Predict every match result correctly on a single match day (minimum 3 games).',
        maxProgress: 1,
    },

    // ── LEGENDARY ────────────────────────────────────────────────────────────────
    {
        id: 'hat_trick_hero', icon: '🎩', tier: 'legendary', category: 'accuracy',
        label: 'Hat-trick Hero',
        definition: 'Three exact scores. Back. To. Back. To. Back. You are not predicting. You are reading the future.',
        condition: 'Get 3 exact score predictions correct in 3 consecutive matches.',
        maxProgress: 3,
    },
    {
        id: 'final_whistle', icon: '🏟️', tier: 'legendary', category: 'accuracy',
        label: 'Final Whistle',
        definition: 'The biggest match in world football. Billions watching. You called the exact scoreline.',
        condition: 'Predict the exact final score of the World Cup 2026 Final.',
        maxProgress: 1,
    },
    {
        id: 'the_oracle', icon: '🔮', tier: 'legendary', category: 'legendary',
        label: 'The Oracle',
        definition: 'Across 32 nations, 72 matches, and thousands of competitors — you sit in the top 1% globally. There is no higher honour.',
        condition: 'Finish the tournament ranked in the top 1% of all players by accuracy.',
        maxProgress: 1,
    },
    {
        id: 'nostradamus', icon: '👑', tier: 'legendary', category: 'legendary',
        label: 'Nostradamus',
        definition: 'Before a single ball was kicked, before the groups were even played, you named the champion. And you were right.',
        condition: 'Correctly predict the World Cup 2026 champion before the tournament begins.',
        maxProgress: 1,
    },
]

// ─── DNA PROFILES ─────────────────────────────────────────────────────────────
const DNA_PROFILES = [
    { id: 'sniper', icon: '🎯', label: 'The Sniper', color: '#d4a843', description: 'Exact scores, precise margins. You do not just predict results — you predict scorelines. Patience and precision define you.' },
    { id: 'romantic', icon: '🎨', label: 'The Romantic', color: '#e05c4a', description: 'You believe in beautiful, attacking football. High-scoring games, bold picks, big names winning big matches.' },
    { id: 'contrarian', icon: '🐺', label: 'The Contrarian', color: '#22c55e', description: 'Underdogs, upsets, dark horses. You love going against the grain — and when you are right, the points are magnificent.' },
    { id: 'pragmatist', icon: '🧱', label: 'The Pragmatist', color: '#5b9fff', description: 'Draws, tight margins, defensive outcomes. You respect the grind. You know that 1-0 is the most honest scoreline in football.' },
]

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function InsightsPage() {
    const router = useRouter()
    const [supabase] = useState(() => createClient())

    const [profile, setProfile] = useState<any>(null)
    const [predCount, setPredCount] = useState(0)
    const [exactCount, setExactCount] = useState(0)
    const [totalPoints, setTotalPoints] = useState(0)
    const [streak, setStreak] = useState(0)
    const [correctCount, setCorrectCount] = useState(0)
    const [selectedBadge, setSelectedBadge] = useState<(Badge & { progress: number; unlocked: boolean }) | null>(null)
    const [activeFilter, setActiveFilter] = useState<'all' | Tier>('all')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/auth/login'); return }

            const { data: p } = await supabase
                .from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)

            const { count } = await supabase
                .from('predictions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
            setPredCount(count ?? 0)

            // Best score row across all groups
            const { data: scoreRows } = await supabase
                .from('scores')
                .select('total_points, exact_scores, correct_results, streak')
                .eq('user_id', user.id)
                .order('total_points', { ascending: false })
                .limit(1)

            if (scoreRows?.[0]) {
                setTotalPoints(scoreRows[0].total_points ?? 0)
                setExactCount(scoreRows[0].exact_scores ?? 0)
                setCorrectCount(scoreRows[0].correct_results ?? 0)
                setStreak(scoreRows[0].streak ?? 0)
            }

            setLoading(false)
        }
        init()
    }, [])

    // ── Badge progress from real data ──────────────────────────────────────────
    const badgeProgress: Record<string, number> = {
        sharpshooter: Math.min(exactCount, 3),
        hot_streak: Math.min(streak, 5),
        giant_killer: 0,
        recruiter: 0,
        score_oracle: Math.min(exactCount, 10),
        pole_position: 0,
        contrarian: 0,
        perfect_day: 0,
        hat_trick_hero: 0,
        final_whistle: 0,
        the_oracle: 0,
        nostradamus: 0,
    }

    const badges = ALL_BADGES.map(b => ({
        ...b,
        progress: badgeProgress[b.id] ?? 0,
        unlocked: (badgeProgress[b.id] ?? 0) >= b.maxProgress,
    }))

    const unlockedCount = badges.filter(b => b.unlocked).length
    const accuracy = predCount > 0 ? Math.round((exactCount / predCount) * 100) : 0
    const resultAccuracy = predCount > 0 ? Math.round((correctCount / predCount) * 100) : 0

    // DNA profile — derived from real stats
    const dnaProfile =
        exactCount >= 5 ? DNA_PROFILES[0] :  // Sniper
            predCount >= 30 && resultAccuracy < 40 ? DNA_PROFILES[2] :  // Contrarian
                predCount >= 20 ? DNA_PROFILES[1] :  // Romantic
                    DNA_PROFILES[3]    // Pragmatist

    const displayName = profile?.display_name ?? 'Player'

    const filteredBadges = activeFilter === 'all'
        ? badges
        : badges.filter(b => b.tier === activeFilter)

    const groupRef = SCORING_REFERENCE.groupAndKnockout
    const knockRef = SCORING_REFERENCE.knockoutSupplement

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Nav initials="PL" />
                <div style={{ fontSize: 14, color: 'var(--muted)', paddingTop: 80 }}>Loading your palmares…</div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={displayName} />

            {/* ── HERO ── */}
            <div style={{ position: 'relative', overflow: 'hidden', paddingTop: 64 }}>
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: `
            radial-gradient(ellipse 55% 40% at 15% 0%, rgba(212,168,67,0.09) 0%, transparent 60%),
            radial-gradient(ellipse 55% 40% at 85% 0%, rgba(212,168,67,0.09) 0%, transparent 60%),
            radial-gradient(ellipse 90% 25% at 50% 0%, rgba(244,241,235,0.03) 0%, transparent 50%)
          `,
                }} />
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.022,
                    backgroundImage: 'linear-gradient(var(--cream) 1px,transparent 1px),linear-gradient(90deg,var(--cream) 1px,transparent 1px)',
                    backgroundSize: '48px 48px',
                }} />

                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '52px 40px 44px', position: 'relative' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>
                        World Cup 2026 · Your Legacy
                    </p>
                    <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 100, lineHeight: 0.84, color: 'var(--cream)', letterSpacing: 2, marginBottom: 16 }}>
                        THE<br />
                        <span style={{ color: 'var(--gold)' }}>PALMARES</span><br />
                        ROOM
                    </h1>
                    <p style={{ fontSize: 15, color: 'var(--dim)', maxWidth: 460, lineHeight: 1.75 }}>
                        Every exact score. Every bold upset call. Every streak. This is where your World Cup story is written.
                    </p>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 80px' }}>

                {/* ── TROPHY CABINET ── */}
                <Section label="Trophy Cabinet">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
                        {[
                            { icon: '🏆', label: 'Total Points', value: totalPoints, sub: 'across all groups', accent: '#d4a843', glow: 'rgba(212,168,67,0.14)' },
                            { icon: '🎯', label: 'Exact Scores', value: exactCount, sub: `from ${predCount} preds`, accent: '#e05c4a', glow: 'rgba(224,92,74,0.11)' },
                            { icon: '📊', label: 'Result Accuracy', value: `${resultAccuracy}%`, sub: 'correct outcomes', accent: '#5b9fff', glow: 'rgba(91,159,255,0.11)' },
                            { icon: '🔥', label: 'Best Streak', value: streak, sub: 'consecutive correct', accent: '#22c55e', glow: 'rgba(34,197,94,0.11)' },
                        ].map(c => (
                            <div key={c.label} style={{
                                background: `linear-gradient(140deg, ${c.glow} 0%, var(--surface) 55%)`,
                                border: `1px solid ${c.accent}28`,
                                borderRadius: 18, padding: '24px 20px',
                                position: 'relative', overflow: 'hidden', textAlign: 'center',
                            }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)` }} />
                                <div style={{ fontSize: 28, marginBottom: 10 }}>{c.icon}</div>
                                <div style={{ fontFamily: 'Bebas Neue', fontSize: 50, lineHeight: 1, color: c.accent, marginBottom: 6 }}>{c.value}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)', marginBottom: 3 }}>{c.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Progress bar */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18 }}>
                        <span style={{ fontSize: 18 }}>⚽</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 7 }}>
                                <span style={{ fontWeight: 600, color: 'var(--cream)' }}>Group stage predictions</span>
                                <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold)' }}>{predCount} / 72 matches</span>
                            </div>
                            <div style={{ height: 7, borderRadius: 4, background: 'var(--surface3)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(100, Math.round((predCount / 72) * 100))}%`, background: 'linear-gradient(90deg, var(--gold), var(--gold-light))', transition: 'width 1s ease' }} />
                            </div>
                        </div>
                        <div style={{ fontFamily: 'Bebas Neue', fontSize: 26, color: 'var(--gold)', flexShrink: 0 }}>
                            {Math.min(100, Math.round((predCount / 72) * 100))}%
                        </div>
                    </div>
                </Section>

                {/* ── BADGE WALL ── */}
                <Section
                    label="Badge Collection"
                    right={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                {unlockedCount} / {ALL_BADGES.length} unlocked
                            </span>
                            <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                                {(['all', 'silver', 'gold', 'legendary'] as const).map(f => (
                                    <button key={f} onClick={() => setActiveFilter(f)} style={{
                                        padding: '4px 12px', borderRadius: 7, border: 'none',
                                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                        fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
                                        background: activeFilter === f ? 'var(--surface3)' : 'transparent',
                                        color: activeFilter === f
                                            ? (f === 'all' ? 'var(--cream)' : TIER_CONFIG[f as Tier]?.color)
                                            : 'var(--muted)',
                                    }}>
                                        {f === 'all' ? 'All' : TIER_CONFIG[f as Tier].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    }
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))', gap: 12 }}>
                        {filteredBadges.map(b => (
                            <BadgeCard key={b.id} badge={b} onClick={() => setSelectedBadge(b)} />
                        ))}
                    </div>
                </Section>

                {/* ── PREDICTION DNA ── */}
                <Section label="Prediction DNA">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                        {/* Profile */}
                        <div style={{
                            background: `linear-gradient(140deg, ${dnaProfile.color}13 0%, var(--surface) 55%)`,
                            border: `1px solid ${dnaProfile.color}38`,
                            borderRadius: 18, padding: '26px 26px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                                <div style={{
                                    width: 60, height: 60, borderRadius: 16,
                                    background: `${dnaProfile.color}18`,
                                    border: `2px solid ${dnaProfile.color}45`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
                                }}>
                                    {dnaProfile.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>You predict like</div>
                                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 30, color: dnaProfile.color }}>{dnaProfile.label}</div>
                                </div>
                            </div>
                            <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.75 }}>{dnaProfile.description}</p>
                            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
                                Based on {predCount} predictions · {exactCount} exact · {streak} streak · {resultAccuracy}% result accuracy
                            </div>
                        </div>

                        {/* Bars */}
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '26px 26px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)', marginBottom: 20 }}>Your stats breakdown</div>
                            {[
                                { label: 'Predictions made', pct: Math.min(100, Math.round((predCount / 72) * 100)), color: 'var(--gold)', note: `${predCount} / 72` },
                                { label: 'Exact score rate', pct: accuracy, color: '#e05c4a', note: `${accuracy}% exact` },
                                { label: 'Result accuracy', pct: resultAccuracy, color: '#5b9fff', note: `${resultAccuracy}% correct` },
                                { label: 'Streak power', pct: Math.min(100, streak * 20), color: '#22c55e', note: `${streak} best streak` },
                            ].map(bar => (
                                <div key={bar.label} style={{ marginBottom: 18 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                                        <span style={{ fontWeight: 500, color: 'var(--cream)' }}>{bar.label}</span>
                                        <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>{bar.note}</span>
                                    </div>
                                    <div style={{ height: 7, borderRadius: 4, background: 'var(--surface3)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: 4, width: `${bar.pct}%`, background: bar.color, transition: 'width 1.2s ease' }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </Section>

                {/* ── SCORING FORMULA ── */}
                <Section label="The Scoring Formula">
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>

                        {/* Top 4 rules */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border)' }}>
                            {groupRef.map((r, i) => (
                                <div key={r.label} style={{
                                    padding: '22px 20px', textAlign: 'center',
                                    borderRight: i < groupRef.length - 1 ? '1px solid var(--border)' : 'none',
                                    background: r.pts === 25 ? 'rgba(212,168,67,0.04)' : 'transparent',
                                }}>
                                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 46, color: r.pts === 25 ? 'var(--gold)' : 'var(--cream)', lineHeight: 1 }}>
                                        +{r.pts}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)', marginTop: 6, marginBottom: 3 }}>{r.label}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{r.note}</div>
                                </div>
                            ))}
                        </div>

                        {/* Knockout supplement */}
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(224,92,74,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#e05c4a', padding: '3px 10px', borderRadius: 20, background: 'rgba(224,92,74,0.12)', border: '1px solid rgba(224,92,74,0.25)' }}>
                                    Knockout supplement
                                </span>
                                {knockRef.map((r, i) => (
                                    <span key={r.label} style={{ fontSize: 13, color: i === knockRef.length - 1 ? 'var(--gold)' : 'var(--dim)' }}>
                                        <strong style={{ color: '#e05c4a' }}>+{r.pts}</strong> {r.label}
                                        {i < knockRef.length - 1 && <span style={{ color: 'var(--muted)', margin: '0 8px' }}>·</span>}
                                    </span>
                                ))}
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                                Qualifier bonus only applies when the 90-min result is a draw (match goes to penalties). Max per knockout match = <strong style={{ color: 'var(--gold)' }}>35 pts</strong>.
                            </p>
                        </div>

                        {/* Original Prediction Multipliers */}
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(212,168,67,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)', padding: '3px 10px', borderRadius: 20, background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.3)' }}>
                                    🔒 Original Prediction Multipliers
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Locked before June 11 · Applies to knockout rounds only</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                                {SCORING_REFERENCE.originalMultipliers.map(m => (
                                    <div key={m.round} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                        <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: 'var(--gold)', lineHeight: 1 }}>×{m.multiplier}</div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cream)', marginTop: 4 }}>{m.label}</div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>{m.note}</div>
                                    </div>
                                ))}
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                                If your original bracket pick matches the real fixture AND you didn&apos;t re-predict, your match score is multiplied. Wrong fixture = <strong style={{ color: '#e05c4a' }}>0 pts</strong>.
                            </p>
                        </div>

                        {/* Bracket Bonuses */}
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(91,159,255,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#5b9fff', padding: '3px 10px', borderRadius: 20, background: 'rgba(91,159,255,0.12)', border: '1px solid rgba(91,159,255,0.3)' }}>
                                    🏆 Tournament Bracket Bonuses
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Awarded automatically when each stage completes</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                                {SCORING_REFERENCE.bracketBonuses.map(b => (
                                    <div key={b.label} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                        <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: '#5b9fff', lineHeight: 1 }}>+{b.pts}</div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cream)', marginTop: 4, lineHeight: 1.3 }}>{b.label}</div>
                                        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>{b.note}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Global Lock Banner */}
                        <div style={{ padding: '14px 24px', background: 'rgba(212,168,67,0.06)', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 22, flexShrink: 0 }}>🔒</span>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 2 }}>{SCORING_REFERENCE.lockRules.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{SCORING_REFERENCE.lockRules.note}</div>
                            </div>
                        </div>

                        {/* Examples row */}
                        <div style={{ padding: '16px 24px' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Worked examples</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                {[
                                    { pred: '2–1', real: '2–1', pts: 25, label: 'Exact score (group)' },
                                    { pred: '3–1', real: '2–0', pts: 15, label: 'Outcome + goal diff' },
                                    { pred: '1–1', real: '0–0', pts: 10, label: 'Correct draw' },
                                    { pred: '2–1 (orig, R16)', real: '2–1', pts: 50, label: 'Exact × 2 R16 multiplier' },
                                    { pred: '1–1 + qual ✓', real: '1–1 pen', pts: 35, label: 'Exact + qualifier (group)' },
                                    { pred: 'Wrong fixture (orig)', real: 'Different teams', pts: 0, label: 'Invalid fixture = 0 pts' },
                                ].map(ex => (
                                    <div key={ex.label} style={{ background: 'var(--surface2)', border: `1px solid ${ex.pts === 0 ? 'rgba(224,92,74,0.3)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--dim)' }}>
                                                {ex.pred} → {ex.real}
                                            </span>
                                            <span style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: ex.pts === 0 ? '#e05c4a' : ex.pts >= 50 ? '#5b9fff' : ex.pts >= 25 ? 'var(--gold)' : 'var(--cream)' }}>
                                                {ex.pts === 0 ? '0' : `+${ex.pts}`}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ex.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Section>


                {/* ── CTA if early in journey ── */}
                {predCount < 12 && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(212,168,67,0.09) 0%, rgba(212,168,67,0.03) 100%)',
                        border: '1px solid var(--border-gold)', borderRadius: 18,
                        padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
                    }}>
                        <div style={{ fontSize: 44 }}>⚽</div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 30, color: 'var(--gold)', marginBottom: 5 }}>
                                Your palmares is waiting
                            </h3>
                            <p style={{ fontSize: 14, color: 'var(--dim)', maxWidth: 420 }}>
                                {predCount} prediction{predCount !== 1 ? 's' : ''} made so far. Every match you predict builds your legacy, unlocks badges, and climbs the leaderboard.
                            </p>
                        </div>
                        <a href="/predict" style={{ padding: '13px 28px', borderRadius: 12, background: 'var(--gold)', color: '#0a0a0a', fontWeight: 700, fontSize: 14, textDecoration: 'none', flexShrink: 0 }}>
                            Predict now →
                        </a>
                    </div>
                )}

            </div>

            {/* Badge detail modal */}
            {selectedBadge && (
                <BadgeModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
            )}
        </div>
    )
}

// ─── SECTION WRAPPER ──────────────────────────────────────────────────────────
function Section({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 52 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 3, height: 22, borderRadius: 2, background: 'var(--gold)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--cream)', letterSpacing: 1 }}>{label}</span>
                </div>
                {right}
            </div>
            {children}
        </div>
    )
}

// ─── BADGE CARD ───────────────────────────────────────────────────────────────
function BadgeCard({ badge, onClick }: { badge: Badge & { progress: number; unlocked: boolean }; onClick: () => void }) {
    const t = TIER_CONFIG[badge.tier]
    const pct = badge.maxProgress > 1 ? Math.round((badge.progress / badge.maxProgress) * 100) : badge.unlocked ? 100 : 0

    return (
        <div
            onClick={onClick}
            style={{
                background: badge.unlocked ? t.bg : 'var(--surface)',
                border: `1px solid ${badge.unlocked ? t.border : 'var(--border)'}`,
                borderRadius: 14, padding: '16px 16px',
                cursor: 'pointer', transition: 'all 0.18s',
                position: 'relative', overflow: 'hidden',
                opacity: badge.unlocked ? 1 : 0.68,
                filter: badge.unlocked ? 'none' : 'grayscale(0.5)',
            }}
            onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'translateY(-2px)'
                el.style.boxShadow = badge.unlocked ? `0 10px 36px ${t.glow}` : '0 6px 20px rgba(0,0,0,0.35)'
                el.style.borderColor = badge.unlocked ? t.color : 'rgba(255,255,255,0.14)'
                el.style.opacity = '1'
            }}
            onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = 'none'
                el.style.borderColor = badge.unlocked ? t.border : 'var(--border)'
                el.style.opacity = badge.unlocked ? '1' : '0.68'
            }}
        >
            {badge.unlocked && (
                <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${t.glow} 0%, transparent 70%)`, pointerEvents: 'none' }} />
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Icon */}
                <div style={{
                    width: 48, height: 48, borderRadius: 13, flexShrink: 0,
                    background: badge.unlocked ? `${t.color}1a` : 'var(--surface2)',
                    border: `2px solid ${badge.unlocked ? t.color : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                    boxShadow: badge.unlocked ? `0 0 14px ${t.glow}` : 'none',
                }}>
                    {badge.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                            color: t.color, padding: '2px 6px', borderRadius: 8,
                            background: `${t.color}13`, border: `1px solid ${t.color}28`,
                        }}>
                            {t.label}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 500 }}>
                            {CATEGORY_LABEL[badge.category]}
                        </span>
                        {badge.unlocked && <span style={{ marginLeft: 'auto', fontSize: 12, color: t.color }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: badge.unlocked ? 'var(--cream)' : 'var(--dim)', marginBottom: 3 }}>
                        {badge.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                        {badge.condition}
                    </div>
                </div>
            </div>

            {badge.maxProgress > 1 && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                        <span>Progress</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', color: badge.unlocked ? t.color : 'var(--muted)' }}>
                            {badge.progress} / {badge.maxProgress}
                        </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--surface3)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: badge.unlocked ? t.color : `${t.color}70`, transition: 'width 0.8s ease' }} />
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── BADGE MODAL ──────────────────────────────────────────────────────────────
function BadgeModal({ badge, onClose }: { badge: Badge & { progress: number; unlocked: boolean }; onClose: () => void }) {
    const t = TIER_CONFIG[badge.tier]

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    return (
        <div
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
            <div style={{
                width: '100%', maxWidth: 420,
                background: badge.unlocked ? `linear-gradient(160deg, ${t.bg} 0%, var(--surface) 50%)` : 'var(--surface)',
                border: `1px solid ${badge.unlocked ? t.border : 'var(--border)'}`,
                borderRadius: 22, overflow: 'hidden',
                animation: 'modalIn 0.22s ease',
                boxShadow: badge.unlocked ? `0 0 70px ${t.glow}` : 'none',
            }}>
                <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.94) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
                <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${t.color}, transparent)` }} />

                {/* Hero icon */}
                <div style={{ padding: '36px 28px 20px', textAlign: 'center', background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${t.glow} 0%, transparent 70%)` }}>
                    <div style={{
                        width: 84, height: 84, borderRadius: 22, margin: '0 auto 14px',
                        background: `${t.color}1a`, border: `3px solid ${badge.unlocked ? t.color : t.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42,
                        boxShadow: badge.unlocked ? `0 0 40px ${t.glow}` : 'none',
                        filter: badge.unlocked ? 'none' : 'grayscale(0.65)',
                    }}>
                        {badge.icon}
                    </div>
                    <div style={{ display: 'inline-block', marginBottom: 8, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: t.color, padding: '3px 12px', borderRadius: 20, background: `${t.color}13`, border: `1px solid ${t.color}28` }}>
                        {t.label} · {CATEGORY_LABEL[badge.category]}
                    </div>
                    <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 38, color: badge.unlocked ? 'var(--cream)' : 'var(--dim)' }}>{badge.label}</h2>
                    {badge.unlocked && (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: t.color }}>✓ Unlocked</div>
                    )}
                </div>

                <div style={{ padding: '4px 28px 28px' }}>
                    {/* Definition */}
                    <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>What it means</div>
                        <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.75, fontStyle: 'italic' }}>&ldquo;{badge.definition}&rdquo;</p>
                    </div>

                    {/* Condition */}
                    <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 18, background: badge.unlocked ? `${t.color}0d` : 'var(--surface2)', border: `1px solid ${badge.unlocked ? t.border : 'var(--border)'}` }}>
                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>How to unlock</div>
                        <p style={{ fontSize: 13, color: badge.unlocked ? t.color : 'var(--cream)', fontWeight: 500 }}>{badge.condition}</p>
                    </div>

                    {/* Progress */}
                    {badge.maxProgress > 1 && (
                        <div style={{ marginBottom: 18 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 7 }}>
                                <span>Progress</span>
                                <span style={{ fontFamily: 'DM Mono, monospace', color: badge.unlocked ? t.color : 'var(--muted)' }}>{badge.progress} / {badge.maxProgress}</span>
                            </div>
                            <div style={{ height: 9, borderRadius: 5, background: 'var(--surface3)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 5, width: `${Math.min(100, Math.round((badge.progress / badge.maxProgress) * 100))}%`, background: `linear-gradient(90deg, ${t.color}, ${t.color}bb)`, transition: 'width 0.8s ease' }} />
                            </div>
                        </div>
                    )}

                    <button onClick={onClose} style={{
                        width: '100%', padding: '12px 0', borderRadius: 12,
                        background: badge.unlocked ? t.color : 'var(--surface2)',
                        color: badge.unlocked ? '#0a0a0a' : 'var(--dim)',
                        border: badge.unlocked ? 'none' : '1px solid var(--border)',
                        fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                    }}>
                        {badge.unlocked ? 'Close' : 'Keep predicting →'}
                    </button>
                </div>
            </div>
        </div>
    )
}