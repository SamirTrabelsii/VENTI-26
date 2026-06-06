import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES } from '@/lib/wc2026-data'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import LiveMatches from '@/components/LiveMatches'
import LiveLeaderboard from '@/components/LiveLeaderboard'
import type { Score } from '@/types'
import { SCORING_REFERENCE } from '@/lib/scoring'
import QuickActions from '@/components/QuickActions'
import FAQSection from '@/components/FAQSection'
import LockBanner from '@/components/LockBanner'
import MotionDiv from '@/components/MotionDiv'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    // ── Parallel DB fetch (no more waterfall) ─────────────────────────────────
    const [
        { data: profile },
        { data: myGroups },
        { data: preds, count: predCount },
        { count: bracketCount },
    ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('group_members').select('group_id, groups(id, name, description)').eq('user_id', user.id).limit(3),
        supabase.from('predictions').select('*', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('bracket_picks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    const firstGroupId = myGroups?.[0]?.group_id ?? null
    const firstGroupName = (myGroups?.[0]?.groups as unknown as { name: string })?.name ?? null

    let scores: Score[] = []
    let myScore: Score | null = null

    if (firstGroupId) {
        const { data } = await supabase
            .from('scores')
            .select('*, profile:profiles(display_name, avatar_initials, avatar_color, email)')
            .eq('group_id', firstGroupId)
            .order('total_points', { ascending: false })
            .limit(10)
        scores = data ?? []
        myScore = scores.find(s => s.user_id === user.id) ?? null
    }

    // ── Countdown ──────────────────────────────────────────────────────────────
    const kickoff = new Date('2026-06-11T21:00:00Z')   // USA vs Mexico opening match
    const now = new Date()
    const diffMs = Math.max(0, kickoff.getTime() - now.getTime())
    const days = Math.floor(diffMs / 86400000)
    const hours = Math.floor((diffMs % 86400000) / 3600000)
    const mins = Math.floor((diffMs % 3600000) / 60000)

    // ── Progress ───────────────────────────────────────────────────────────────
    const groupTotal = GROUP_MATCHES.length          // 72 group stage matches
    const groupPreds = predCount ?? 0
    const bracketPreds = bracketCount ?? 0
    const groupPct = Math.min(100, Math.round((groupPreds / groupTotal) * 100))

    // ── My rank in first group ─────────────────────────────────────────────────
    const myRank = myScore
        ? scores.findIndex(s => s.user_id === user.id) + 1
        : null

    const displayName = profile?.display_name ?? profile?.email ?? 'Player'

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={displayName} />

            {/* ── HERO ── */}
            <MotionDiv 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ position: 'relative', overflow: 'hidden', paddingTop: 64 }}
            >
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(212,168,67,0.15) 0%, transparent 70%)',
                }} />
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.02,
                    backgroundImage: 'linear-gradient(var(--cream) 1px,transparent 1px),linear-gradient(90deg,var(--cream) 1px,transparent 1px)',
                    backgroundSize: '52px 52px',
                }} />

                <div className="px-5 py-8 md:px-10 md:py-12 relative max-w-[1400px] mx-auto">
                    <div className="flex flex-col lg:flex-row items-start justify-between gap-8 flex-wrap">

                        {/* Title */}
                        <div>
                            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                                Welcome back, {displayName}
                            </p>
                            <h1 className="font-display text-6xl md:text-[80px] leading-[0.88] text-cream tracking-wide">
                                YOUR<br /><span className="gradient-text">WORLD</span><br />CUP
                            </h1>
                            <p style={{ marginTop: 14, fontSize: 15, color: 'var(--dim)', maxWidth: 380, lineHeight: 1.7 }}>
                                {groupPreds === 0
                                    ? 'The tournament kicks off June 11. Start predicting to compete!'
                                    : `${groupPreds} of ${groupTotal} group matches predicted. ${bracketPreds > 0 ? `Bracket: ${bracketPreds} picks.` : 'Build your bracket to earn more points.'}`
                                }
                            </p>
                            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <Link href="/predict" style={{ padding: '13px 28px', borderRadius: 12, textDecoration: 'none', background: 'var(--gold)', color: '#0a0a0a', fontWeight: 700, fontSize: 14 }}>
                                    {groupPreds === 0 ? 'Start Predicting →' : 'Continue Predicting →'}
                                </Link>
                                {bracketPreds === 0 && (
                                    <Link href="/bracket" style={{ padding: '13px 20px', borderRadius: 12, textDecoration: 'none', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--dim)', fontSize: 14, fontWeight: 500 }}>
                                        Build Bracket →
                                    </Link>
                                )}
                                <Link href="/groups" style={{ padding: '13px 20px', borderRadius: 12, textDecoration: 'none', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--dim)', fontSize: 14, fontWeight: 500 }}>
                                    Invite Friends
                                </Link>
                            </div>
                        </div>

                        {/* Countdown + progress */}
                        <div className="glass-panel w-full lg:w-auto min-w-[288px] relative overflow-hidden flex-shrink-0 rounded-[18px] p-6 md:p-7">
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--gold), var(--gold-light), var(--gold))' }} />

                            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>
                                Kickoff in
                            </p>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 20 }}>
                                {[
                                    { num: String(days).padStart(2, '0'), label: 'Days' },
                                    { num: String(hours).padStart(2, '0'), label: 'Hours' },
                                    { num: String(mins).padStart(2, '0'), label: 'Mins' },
                                ].map((u, i) => (
                                    <div key={u.label} style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                                        {i > 0 && <span style={{ fontFamily: 'Bebas Neue', fontSize: 36, color: 'var(--gold-dim)', paddingBottom: 8 }}>:</span>}
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{ fontFamily: 'Bebas Neue', fontSize: 54, color: 'var(--cream)', display: 'block', lineHeight: 1 }}>{u.num}</span>
                                            <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4, display: 'block' }}>{u.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Group stage progress */}
                            <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                                    <span>Group stage predictions</span>
                                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold)' }}>{groupPct}%</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 3, width: `${groupPct}%`, background: 'var(--gold)', transition: 'width 1s ease' }} />
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{groupPreds} / {groupTotal} matches</div>
                            </div>
                        </div>

                    </div>
                </div>
            </MotionDiv>

            {/* ── STAT CARDS ── */}
            <MotionDiv 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                className="max-w-[1400px] mx-auto px-5 pb-7 md:px-10 md:pb-7"
            >
                <LockBanner />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {[
                        {
                            label: 'Group Predictions', accent: 'var(--gold)',
                            value: groupPreds,
                            sub: `${groupTotal - groupPreds} remaining`,
                        },
                        {
                            label: 'My Best Rank', accent: 'var(--green-bright)',
                            value: myRank ? `#${myRank}` : '—',
                            sub: firstGroupName ? `in ${firstGroupName}` : 'Join a group',
                        },
                        {
                            label: 'Total Points', accent: 'var(--blue-accent)',
                            value: myScore?.total_points ?? 0,
                            sub: `${myScore?.exact_scores ?? 0} exact · ${myScore?.correct_results ?? 0} correct`,
                        },
                        {
                            label: 'Hot Streak', accent: '#e05c4a',
                            value: `${myScore?.streak ?? 0}${(myScore?.streak ?? 0) > 0 ? ' 🔥' : ''}`,
                            sub: 'consecutive correct',
                        },
                    ].map(c => (
                        <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c.accent }} />
                            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, paddingLeft: 12 }}>{c.label}</p>
                            <p style={{ fontFamily: 'Bebas Neue', fontSize: 40, color: 'var(--cream)', paddingLeft: 12, lineHeight: 1 }}>{c.value}</p>
                            <p style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 12, marginTop: 4 }}>{c.sub}</p>
                        </div>
                    ))}
                </div>
            </MotionDiv>

            {/* ── MAIN GRID ── */}
            <div className="max-w-[1400px] mx-auto px-5 pb-16 md:px-10 md:pb-[60px] grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

                {/* Left */}
                <MotionDiv 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
                >
                    <QuickActions actions={[
                        { href: '/groups', icon: '👥', label: 'Groups & Leagues', sub: 'Compete against your friends' },
                        { href: '/insights', icon: '🏆', label: 'The Palmares Room', sub: 'Unlock badges & trophies' },
                        { href: '/rules', icon: '📖', label: 'Scoring Rules', sub: 'How points are calculated' }
                    ]} />

                    {/* Live matches */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 24 }}>
                        <LiveMatches predictions={preds ?? []} />
                    </div>

                    {/* Scoring formula — inline, no separate component needed */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📐</span>
                            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cream)' }}>Points Formula</span>
                            <Link href="/insights" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>Full details →</Link>
                        </div>

                        {/* Group rules */}
                        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-[var(--border)]">
                            {SCORING_REFERENCE.groupAndKnockout.map((r, i) => (
                                <div key={r.label} className="p-4 text-center border-r border-b md:border-b-0 border-[var(--border)]" style={{
                                    background: r.pts === 25 ? 'rgba(212,168,67,0.04)' : 'transparent',
                                }}>
                                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 36, color: r.pts === 25 ? 'var(--gold)' : 'var(--cream)', lineHeight: 1 }}>+{r.pts}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cream)', marginTop: 4 }}>{r.label}</div>
                                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{r.note}</div>
                                </div>
                            ))}
                        </div>

                        {/* Knockout supplement */}
                        <div style={{ padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#e05c4a', padding: '2px 8px', borderRadius: 10, background: 'rgba(224,92,74,0.10)', border: '1px solid rgba(224,92,74,0.22)' }}>
                                Knockout
                            </span>
                            {SCORING_REFERENCE.knockoutSupplement.map((r, i) => (
                                <span key={r.label} style={{ fontSize: 12, color: i === 1 ? 'var(--gold)' : 'var(--dim)' }}>
                                    <strong style={{ color: '#e05c4a' }}>+{r.pts}</strong> {r.label}
                                    {i === 0 && <span style={{ color: 'var(--muted)', margin: '0 8px' }}>·</span>}
                                </span>
                            ))}
                            <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
                                Max/match: <strong style={{ color: 'var(--gold)' }}>35 pts</strong>
                            </span>
                        </div>
                    </div>

                </MotionDiv>

                {/* Right */}
                <MotionDiv 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                >

                    {/* Live leaderboard */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: 'var(--cream)' }}>
                                    {firstGroupName ?? 'Your Group'}
                                </span>
                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(34,197,94,0.10)', color: 'var(--green-bright)', border: '1px solid rgba(34,197,94,0.2)', fontWeight: 600, letterSpacing: 1 }}>
                                    LIVE
                                </span>
                            </div>
                            <Link href="/groups" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>All groups →</Link>
                        </div>

                        {firstGroupId ? (
                            <LiveLeaderboard groupId={firstGroupId} currentUserId={user.id} initialScores={scores} />
                        ) : (
                            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Join a group to see the leaderboard</p>
                                <Link href="/groups" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 10, background: 'var(--gold)', color: '#0a0a0a', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                                    Join a Group
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Palmares teaser */}
                    <div style={{ background: 'linear-gradient(135deg, rgba(212,168,67,0.10) 0%, rgba(212,168,67,0.03) 100%)', border: '1px solid var(--border-gold)', borderRadius: 18, padding: '20px 22px', textAlign: 'center' }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
                        <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--gold)', marginBottom: 4 }}>The Palmares Room</div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
                            Badges, trophies, DNA profile and full scoring breakdown.
                        </p>
                        <Link href="/insights" style={{ display: 'inline-block', padding: '10px 22px', borderRadius: 10, background: 'var(--gold)', color: '#0a0a0a', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                            Enter →
                        </Link>
                    </div>

                </MotionDiv>
            </div>

            {/* ── FAQ ── */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 80px' }}>
                <FAQSection />
            </div>
        </div>
    )
}