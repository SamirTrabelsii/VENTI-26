import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES } from '@/lib/wc2026-data'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import LiveMatches from '@/components/LiveMatches'
import LiveLeaderboard from '@/components/LiveLeaderboard'
import PointsFormula from '@/components/PointsFormula'
import type { Score } from '@/types'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

    const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name, description)')
        .eq('user_id', user.id)
        .limit(3)

    const { data: preds, count: predCount } = await supabase
        .from('predictions')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)

    const { count: bracketCount } = await supabase
        .from('bracket_picks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

    const firstGroupId = myGroups?.[0]?.group_id ?? null

    let scores: Score[] = []
    if (firstGroupId) {
        const { data } = await supabase
            .from('scores')
            .select('*, profile:profiles(display_name, avatar_initials, avatar_color, email)')
            .eq('group_id', firstGroupId)
            .order('total_points', { ascending: false })
            .limit(10)
        scores = data ?? []
    }

    // Countdown
    const kickoff = new Date('2026-06-11T18:00:00Z')
    const now = new Date()
    const diffMs = Math.max(0, kickoff.getTime() - now.getTime())
    const days = Math.floor(diffMs / 86400000)
    const hours = Math.floor((diffMs % 86400000) / 3600000)
    const mins = Math.floor((diffMs % 3600000) / 60000)


    const groupTotal = GROUP_MATCHES.length  // 72
    const knockoutTotal = 32  // R32(16) + R16(8) + QF(4) + SF(2) + 3rd(1) + Final(1)
    const totalMatches = groupTotal + knockoutTotal  // 104
    const groupPredCount = predCount ?? 0
    const knockoutPredCount = bracketCount ?? 0
    const totalPredCount = groupPredCount + knockoutPredCount
    const pct = Math.round((totalPredCount / totalMatches) * 100)

    const firstGroupName = (myGroups?.[0]?.groups as unknown as { name: string })?.name ?? null

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <div style={{ position: 'relative', zIndex: 10 }}>
                <Nav 
                    initials={profile?.avatar_initials ?? 'PL'} 
                />
            </div>

            {/* ── HERO ── */}
            <div style={{ position: 'relative', overflow: 'hidden', paddingTop: 64 }}>
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(212,168,67,0.10) 0%, transparent 70%)',
                }} />

                <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 40px 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>

                        {/* Title block */}
                        <div>
                            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                                Welcome back, {profile?.display_name ?? 'Player'}
                            </p>
                            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 80, lineHeight: 0.9, color: 'var(--cream)', letterSpacing: 1 }}>
                                YOUR<br /><span style={{ color: 'var(--gold)' }}>WORLD</span><br />CUP
                            </h1>
                            <p style={{ marginTop: 14, fontSize: 15, color: 'var(--dim)', maxWidth: 380 }}>
                                {totalPredCount === 0
                                    ? 'The tournament starts June 11. Start predicting to compete!'
                                    : `${totalPredCount} of ${totalMatches} matches predicted. Keep going — every match counts.`}
                            </p>
                            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <Link href="/predict" style={{
                                    padding: '13px 28px', borderRadius: 12, textDecoration: 'none',
                                    background: 'var(--gold)', color: '#0a0a0a',
                                    fontWeight: 700, fontSize: 14,
                                }}>
                                    {totalPredCount === 0 ? 'Start Predicting →' : 'Continue Predicting →'}
                                </Link>
                                <Link href="/groups" style={{
                                    padding: '13px 20px', borderRadius: 12, textDecoration: 'none',
                                    background: 'var(--surface2)', border: '1px solid var(--border)',
                                    color: 'var(--dim)', fontSize: 14, fontWeight: 500,
                                }}>
                                    Invite Friends
                                </Link>
                            </div>
                        </div>

                        {/* Countdown card */}
                        <div style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border-gold)',
                            borderRadius: 18, padding: '24px 28px',
                            minWidth: 280, flexShrink: 0,
                            position: 'relative', overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                                background: 'linear-gradient(90deg, var(--gold), var(--gold-light), var(--gold))',
                            }} />
                            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>
                                Kickoff in
                            </p>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                                {[
                                    { num: String(days).padStart(2, '0'), label: 'Days' },
                                    { num: String(hours).padStart(2, '0'), label: 'Hours' },
                                    { num: String(mins).padStart(2, '0'), label: 'Mins' },
                                ].map((u, i) => (
                                    <div key={u.label} style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                                        {i > 0 && (
                                            <span style={{ fontFamily: 'Bebas Neue', fontSize: 36, color: 'var(--gold-dim)', paddingBottom: 8 }}>:</span>
                                        )}
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{ fontFamily: 'Bebas Neue', fontSize: 54, color: 'var(--cream)', display: 'block', lineHeight: 1 }}>
                                                {u.num}
                                            </span>
                                            <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                                                {u.label}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Prediction progress */}
                            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                                    <span>Prediction progress</span>
                                    <span>{pct}%</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 3, background: 'var(--gold)',
                                        width: `${pct}%`, transition: 'width 1s ease',
                                    }} />
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
                                    {groupPredCount} / {groupTotal} groups · {knockoutPredCount} / {knockoutTotal} knockout
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* ── STAT CARDS ── */}
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 40px 28px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                    {[
                        { label: 'Predictions', value: totalPredCount, sub: `of ${totalMatches} matches`, accent: 'var(--gold)' },
                        { label: 'My Groups', value: myGroups?.length ?? 0, sub: 'active competitions', accent: 'var(--green-bright)' },
                        { label: 'Total Points', value: scores.find(s => s.user_id === user.id)?.total_points ?? 0, sub: 'points earned so far', accent: 'var(--blue-accent)' },
                        { label: 'Hot Streak', value: `${scores.find(s => s.user_id === user.id)?.streak ?? 0}🔥`, sub: 'consecutive correct', accent: '#e05c4a' },
                    ].map(c => (
                        <div
                            key={c.label}
                            style={{
                                background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden',
                            }}
                        >
                            <div style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: 3, background: c.accent,
                            }} />
                            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, paddingLeft: 12 }}>
                                {c.label}
                            </p>
                            <p style={{ fontFamily: 'Bebas Neue', fontSize: 40, color: 'var(--cream)', paddingLeft: 12, lineHeight: 1 }}>
                                {c.value}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 12, marginTop: 4 }}>
                                {c.sub}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── MAIN CONTENT GRID ── */}
            <div style={{
                maxWidth: 1400, margin: '0 auto',
                padding: '0 40px 60px',
                display: 'grid',
                gridTemplateColumns: '1fr 380px',
                gap: 24,
            }}>

                {/* Left column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Live matches */}
                    <div style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 18, padding: 24,
                    }}>
                        <LiveMatches predictions={preds ?? []} />
                    </div>

                    {/* Points formula */}
                    <PointsFormula />

                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Live leaderboard */}
                    <div style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 18, overflow: 'hidden',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '18px 20px',
                            borderBottom: '1px solid var(--border)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: 'var(--cream)' }}>
                                    {firstGroupName ?? 'Your Group'}
                                </span>
                                <span style={{
                                    fontSize: 10, padding: '2px 8px', borderRadius: 20,
                                    background: 'rgba(34,197,94,0.10)', color: 'var(--green-bright)',
                                    border: '1px solid rgba(34,197,94,0.2)',
                                    fontWeight: 600, letterSpacing: 1,
                                }}>
                                    LIVE
                                </span>
                            </div>
                            <Link href="/groups" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>
                                All groups →
                            </Link>
                        </div>

                        {firstGroupId ? (
                            <LiveLeaderboard
                                groupId={firstGroupId}
                                currentUserId={user.id}
                                initialScores={scores}
                            />
                        ) : (
                            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
                                    Join a group to see the leaderboard
                                </p>
                                <Link href="/groups" style={{
                                    display: 'inline-block', padding: '10px 24px',
                                    borderRadius: 10, background: 'var(--gold)', color: '#0a0a0a',
                                    fontWeight: 700, fontSize: 13, textDecoration: 'none',
                                }}>
                                    Join Group
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Quick actions */}
                    <div style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 18, padding: 20,
                    }}>
                        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
                            Quick Actions
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { href: '/predict', icon: '⚽', label: 'Predict Matches', sub: `${totalPredCount} / ${totalMatches} done` },
                                { href: '/bracket', icon: '🏟️', label: 'Build Your Bracket', sub: 'Pick your champion' },
                                { href: '/groups', icon: '👥', label: 'Manage Groups', sub: `${myGroups?.length ?? 0} active` },
                                { href: '/insights', icon: '📊', label: 'View Insights', sub: 'Achievements & stats' },
                            ].map(a => (
                                <a key={a.href} href={a.href} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 14px', borderRadius: 12, textDecoration: 'none',
                                    background: 'var(--surface2)', border: '1px solid var(--border)',
                                    transition: 'border-color 0.15s',
                                }}
                                    className="hover:border-gold"
                                >
                                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cream)' }}>{a.label}</div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.sub}</div>
                                    </div>
                                    <span style={{ color: 'var(--muted)', fontSize: 14 }}>→</span>
                                </a>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}