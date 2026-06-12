import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES, TOURNAMENT_LOCK } from '@/lib/wc2026-data'
import Link from 'next/link'
import Image from 'next/image'
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
import ScoringRulesDrawer from '@/components/ScoringRulesDrawer'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    // ── DB Fetch (Graceful for Guests) ────────────────────────────────────────
    let profile = null
    let myGroups: any[] = []
    let preds: any[] = []
    let predCount = 0
    let bracketCount = 0
    let scores: Score[] = []
    let myScore: Score | null = null
    let firstGroupId: string | null = null
    let firstGroupName: string | null = null

    if (user) {
        const [
            { data: pData },
            { data: mgData },
            { data: pRows, count: pCount },
            { count: bCount },
        ] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('group_members').select('group_id, groups(id, name, description)').eq('user_id', user.id).limit(3),
            supabase.from('predictions').select('*', { count: 'exact' }).eq('user_id', user.id),
            supabase.from('bracket_picks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        ])
        
        profile = pData
        myGroups = mgData || []
        preds = pRows || []
        predCount = pCount || 0
        bracketCount = bCount || 0

        firstGroupId = myGroups?.[0]?.group_id ?? null
        firstGroupName = (myGroups?.[0]?.groups as unknown as { name: string })?.name ?? null

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
    }

    // ── Countdown ──────────────────────────────────────────────────────────────
    const kickoff = new Date(TOURNAMENT_LOCK)
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
    const myRank = myScore && user
        ? scores.findIndex(s => s.user_id === user.id) + 1
        : null

    const isGuest = !user
    const displayName = profile?.display_name ?? profile?.email ?? (isGuest ? 'Explorer' : 'Player')

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={displayName} isGuest={isGuest} />

            {/* ── HERO ── */}
            <MotionDiv 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ position: 'relative', overflow: 'hidden', paddingTop: 64 }}
            >
                {/* Immersive Dark Background */}
                <div className="absolute inset-0 pointer-events-none -z-10">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[var(--black)] to-[var(--black)]" />
                </div>

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
                        <div className="flex-1 min-w-[300px]">
                            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                                Welcome back, {displayName}
                            </p>
                            <h1 className="font-display text-6xl md:text-[80px] leading-[0.88] text-cream tracking-wide">
                                PREDICT.<br /><span className="gradient-text">COMPETE.</span><br />CONQUER.
                            </h1>
                            <p style={{ marginTop: 14, fontSize: 15, color: 'var(--dim)', maxWidth: 380, lineHeight: 1.7 }}>
                                Lock in your group stage scores, build your knockout bracket, and climb the global leaderboards.
                            </p>
                            <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {groupPreds === 0 && (
                                    <Link href="/predict" className="hover-glow" style={{ padding: '13px 28px', borderRadius: 12, textDecoration: 'none', background: 'var(--gold)', color: '#0a0a0a', fontWeight: 700, fontSize: 14, transition: 'all 0.2s' }}>
                                        Start Predicting →
                                    </Link>
                                )}
                                {groupPreds > 0 && groupPreds < groupTotal && (
                                    <Link href="/predict" className="hover-glow" style={{ padding: '13px 28px', borderRadius: 12, textDecoration: 'none', background: 'var(--gold)', color: '#0a0a0a', fontWeight: 700, fontSize: 14, transition: 'all 0.2s' }}>
                                        Continue Predicting →
                                    </Link>
                                )}
                                {groupPreds === groupTotal && bracketPreds === 0 && (
                                    <Link href="/bracket" className="hover-glow" style={{ padding: '13px 28px', borderRadius: 12, textDecoration: 'none', background: 'var(--gold)', color: '#0a0a0a', fontWeight: 700, fontSize: 14, transition: 'all 0.2s', boxShadow: '0 0 15px rgba(212,168,67,0.4)' }}>
                                        Build Knockout Bracket →
                                    </Link>
                                )}
                                {groupPreds === groupTotal && bracketPreds > 0 && (
                                    <Link href="/predict" className="bg-[var(--surface2)] hover:bg-[var(--surface3)]" style={{ padding: '13px 28px', borderRadius: 12, textDecoration: 'none', border: '1px solid var(--border)', color: 'var(--dim)', fontWeight: 500, fontSize: 14, transition: 'all 0.2s' }}>
                                        Review Predictions
                                    </Link>
                                )}
                                
                                <Link href="/groups" className="bg-[var(--surface2)] hover:bg-[var(--surface3)]" style={{ padding: '13px 20px', borderRadius: 12, textDecoration: 'none', border: '1px solid var(--border)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, transition: 'all 0.2s' }}>
                                    Invite Friends
                                </Link>
                            </div>
                        </div>

                        {/* Trophy Visual */}
                        <div className="hidden lg:block relative flex-shrink-0 w-[240px] h-[300px] -mt-10 opacity-90 drop-shadow-[0_0_40px_rgba(212,168,67,0.3)]">
                            <Image
                                src="/images/trophy.png"
                                alt="World Cup Trophy"
                                fill
                                sizes="(max-width: 1024px) 100vw, 240px"
                                style={{ objectFit: 'contain' }}
                                priority
                            />
                        </div>

                        {/* Countdown + progress */}
                        <div className="glass-panel w-full lg:w-auto min-w-[288px] relative overflow-hidden flex-shrink-0 rounded-[18px] p-6 md:p-7 z-10">
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
                            <div style={{ overflowX: 'auto', paddingBottom: 60, WebkitOverflowScrolling: 'touch' }}>
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
                            label: 'Completion Status', accent: 'var(--gold)',
                            value: groupPreds === groupTotal && bracketPreds > 0 ? '100%' : `${Math.round(((groupPreds + (bracketPreds > 0 ? 15 : 0)) / (groupTotal + 15)) * 100)}%`,
                            sub: `${groupPreds}/${groupTotal} groups · ${bracketPreds > 0 ? 'Bracket done' : 'No bracket'}`,
                        },
                        {
                            label: 'My Leagues', accent: 'var(--green-bright)',
                            value: myGroups.length,
                            sub: firstGroupName ? `Best Rank: #${myRank ?? '—'} in ${firstGroupName}` : 'You are not in any leagues',
                        },
                        {
                            label: 'Total Points', accent: 'var(--blue-accent)',
                            value: myScore?.total_points ?? 0,
                            sub: 'Awaiting Kickoff',
                        },
                        {
                            label: 'Accuracy', accent: '#a855f7',
                            value: '— %',
                            sub: 'Tournament starts June 11',
                        },
                    ].map(c => (
                        <div key={c.label} className="relative overflow-hidden rounded-[14px] p-[14px] md:p-4 border border-[var(--border)] glass-panel transition-transform hover:-translate-y-1">
                            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ background: `radial-gradient(circle at top right, ${c.accent}, transparent 70%)` }} />
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
                        { href: '/insights', icon: '🏆', label: 'The Palmares Room', sub: 'Unlock badges & trophies' }
                    ]} />

                    {/* Live matches */}
                    <div className="relative overflow-hidden rounded-[18px] p-6 border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
                        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ background: 'radial-gradient(circle at center, var(--gold), transparent 80%)' }} />
                        <div className="relative z-10">
                            <LiveMatches predictions={preds ?? []} />
                        </div>
                    </div>

                    {/* Scoring formula */}
                    <div className="relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
                        <div className="flex items-center gap-2 px-5 py-4">
                            <span className="text-base">📐</span>
                            <span className="text-[11px] font-semibold tracking-[1.5px] uppercase text-cream">Points Formula</span>
                            <div className="ml-auto">
                                <ScoringRulesDrawer customTrigger={
                                    <span className="text-xs text-gold cursor-pointer hover:underline">View full breakdown →</span>
                                } />
                            </div>
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

                        {firstGroupId && user ? (
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
