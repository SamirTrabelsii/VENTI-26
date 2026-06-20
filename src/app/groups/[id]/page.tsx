'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { createClient } from '@/lib/supabase/client'
import { getRobohashUrl, GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

interface MemberScore {
    user_id: string
    total_points: number
    exact_scores: number
    correct_results: number
    streak: number
    display_name: string
    joined_at: string
    display_points?: number
    live_bonus?: number
    dynamic_streak?: number
    dynamic_exact?: number
    dynamic_correct?: number
}

interface GroupData {
    id: string
    name: string
    description: string | null
    invite_code: string
    created_by: string
    created_at: string
}

function CopyBtn({ text, label }: { text: string; label: string }) {
    const [copied, setCopied] = useState(false)
    return (
        <button
            onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: copied ? 'rgba(34,197,94,0.12)' : 'var(--surface2)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                color: copied ? 'var(--green-bright)' : 'var(--dim)',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s',
            }}
        >
            {copied ? '✓ Copied!' : label}
        </button>
    )
}

export default function GroupDetailPage() {
    const params = useParams()
    const id = params.id as string
    const router = useRouter()
    const [supabase] = useState(() => createClient())

    const [group, setGroup] = useState<GroupData | null>(null)
    const [scores, setScores] = useState<MemberScore[]>([])
    const [userId, setUserId] = useState<string | null>(null)
    const [displayName, setDisplayName] = useState('Player')
    const [initials, setInitials] = useState('PL')
    const [loading, setLoading] = useState(true)
    const [leaving, setLeaving] = useState(false)

    const load = useCallback(async (_uid: string) => {
        // Group info
        const { data: g } = await supabase
            .from('groups').select('*').eq('id', id).single()
        if (!g) { router.push('/groups'); return }
        setGroup(g)

        // All members with their profiles
        const { data: members } = await supabase
            .from('group_members')
            .select('user_id, joined_at, profiles(display_name)')
            .eq('group_id', id)

        if (!members) return

        // Scores (may not exist for everyone yet)
        const { data: scoreRows } = await supabase
            .from('scores')
            .select('user_id, total_points, exact_scores, correct_results, streak')
            .eq('group_id', id)

        const scoreMap = new Map(scoreRows?.map(s => [s.user_id, s]) ?? [])

        // Merge members + scores
        const merged: MemberScore[] = members.map(m => {
            const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
            const s = scoreMap.get(m.user_id)
            return {
                user_id: m.user_id,
                display_name: (p as { display_name?: string } | null)?.display_name ?? 'Player',
                joined_at: m.joined_at,
                total_points: s?.total_points ?? 0,
                exact_scores: s?.exact_scores ?? 0,
                correct_results: s?.correct_results ?? 0,
                streak: s?.streak ?? 0,
            }
        })

        // Sort by points descending
        merged.sort((a, b) => b.total_points - a.total_points)
        setScores(merged)

    }, [id, supabase, router])

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/auth/login'); return }
            setUserId(user.id)

            const { data: p } = await supabase
                .from('profiles').select('*').eq('id', user.id).single()
            setDisplayName(p?.display_name ?? 'Player')
            setInitials(p?.avatar_initials ?? 'PL')

            await load(user.id)
            setLoading(false)
        }
        init()
    }, [load, router])

    // Polling external API removed in favor of Database-Driven Architecture

    // Real-time scores subscription
    useEffect(() => {
        if (!userId) return
        const channel = supabase
            .channel(`group-scores-${id}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'scores',
                filter: `group_id=eq.${id}`,
            }, () => { load(userId) })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [userId, id, load, supabase])

    const leaveGroup = async () => {
        if (!userId || !group) return
        const confirmed = window.confirm(`Leave "${group.name}"? You can rejoin with the invite code.`)
        if (!confirmed) return
        setLeaving(true)
        await supabase.from('group_members')
            .delete()
            .eq('group_id', id)
            .eq('user_id', userId)
        router.push('/groups')
    }

    // Calculate dynamic scores with live points
    const dynamicScores = useMemo(() => {
        return scores.map(user => ({
            ...user,
            display_points: user.total_points,
            live_bonus: 0,
            dynamic_streak: user.streak,
            dynamic_exact: user.exact_scores,
            dynamic_correct: user.correct_results
        })).sort((a, b) => (b.display_points || 0) - (a.display_points || 0))
    }, [scores])

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
                <Nav initials={initials} displayName={displayName} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                    <div style={{ fontSize: 14, color: 'var(--muted)' }}>Loading group…</div>
                </div>
            </div>
        )
    }

    if (!group) return null

    const myEntry = dynamicScores.find(s => s.user_id === userId)
    const myRank = myEntry ? dynamicScores.indexOf(myEntry) + 1 : null
    const RANK_COLORS = ['#d4a843', '#b0b8c8', '#cd7f32']

    const shareText = `Join my World Cup 2026 prediction group "${group.name}"!\nCode: ${group.invite_code}\nSign up at venti26.app`

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={initials} displayName={displayName} />

            <div style={{ maxWidth: 860, margin: '0 auto', padding: '88px 24px 60px' }}>

                {/* Back */}
                <Link href="/groups" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, color: 'var(--gold)', textDecoration: 'none',
                    marginBottom: 24,
                }}>
                    ← All groups
                </Link>

                {/* Group header card */}
                <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 20, overflow: 'hidden', marginBottom: 24,
                }}>
                    <div style={{ height: 3, background: 'linear-gradient(90deg,var(--gold),var(--gold-light),var(--gold))' }} />
                    <div style={{ padding: '24px 28px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                            <div>
                                <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 52, lineHeight: 0.9, color: 'var(--cream)', marginBottom: 6 }}>
                                    {group.name}
                                </h1>
                                {group.description && (
                                    <p style={{ fontSize: 14, color: 'var(--dim)' }}>{group.description}</p>
                                )}
                                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                                    {dynamicScores.length} {dynamicScores.length === 1 ? 'member' : 'members'}
                                </p>
                            </div>

                            {/* Your rank pill */}
                            {myEntry && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '14px 22px',
                                    background: 'rgba(212,168,67,0.08)',
                                    border: '1px solid var(--border-gold)',
                                    borderRadius: 16,
                                }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                                        Your rank
                                    </div>
                                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 48, color: 'var(--gold)', lineHeight: 1 }}>
                                        #{myRank}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                        of {dynamicScores.length}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Invite code section */}
                        <div style={{
                            marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 16px', borderRadius: 12,
                                background: 'rgba(212,168,67,0.06)', border: '1px solid var(--border-gold)',
                            }}>
                                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Invite code</span>
                                <span style={{
                                    fontFamily: 'DM Mono, monospace', fontSize: 20,
                                    color: 'var(--gold)', letterSpacing: 4, fontWeight: 600,
                                }}>
                                    {group.invite_code}
                                </span>
                            </div>
                            <CopyBtn text={group.invite_code} label="Copy code" />
                            <CopyBtn text={shareText} label="Copy invite message" />
                            <button
                                onClick={leaveGroup}
                                disabled={leaving}
                                style={{
                                    marginLeft: 'auto', padding: '8px 16px', borderRadius: 10,
                                    background: 'transparent', border: '1px solid rgba(200,57,43,0.3)',
                                    color: '#e05c4a', fontSize: 13, cursor: 'pointer',
                                    fontFamily: 'DM Sans, sans-serif',
                                }}
                            >
                                {leaving ? '…' : 'Leave group'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* My stats row */}
                {myEntry && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                        {[
                            { label: 'Your rank', value: `#${myRank}`, accent: 'var(--gold)' },
                            { label: 'Points', value: myEntry.display_points, accent: 'var(--green-bright)' },
                            { label: 'Exact scores', value: myEntry.exact_scores, accent: 'var(--blue-accent)' },
                            { label: 'Streak', value: `${myEntry.streak} 🔥`, accent: '#e05c4a' },
                        ].map(s => (
                            <div key={s.label} style={{
                                background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: 14, padding: '16px 18px',
                                borderLeft: `3px solid ${s.accent}`,
                            }}>
                                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                                    {s.label}
                                </div>
                                <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: 'var(--cream)' }}>
                                    {s.value}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Leaderboard */}
                <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 20, overflow: 'hidden',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '18px 22px', borderBottom: '1px solid var(--border)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: 'var(--cream)' }}>Leaderboard</span>
                            <span style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 20,
                                background: 'rgba(34,197,94,0.10)', color: 'var(--green-bright)',
                                border: '1px solid rgba(34,197,94,0.2)', fontWeight: 600, letterSpacing: 1,
                            }}>
                                LIVE
                            </span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {dynamicScores.length} players
                        </span>
                    </div>

                    {dynamicScores.length === 0 ? (
                        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
                            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                                No scores yet — predict matches to appear here!
                            </p>
                            <a href="/predict" style={{
                                display: 'inline-block', marginTop: 16, padding: '10px 24px',
                                borderRadius: 10, background: 'var(--gold)', color: '#0a0a0a',
                                fontWeight: 700, fontSize: 13, textDecoration: 'none',
                            }}>
                                Start Predicting →
                            </a>
                        </div>
                    ) : (
                        dynamicScores.map((s: MemberScore, i: number) => {
                            const isMe = s.user_id === userId
                            const rankColor = i < 3 ? RANK_COLORS[i] : 'var(--muted)'
                            const rankIcon = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

                            return (
                                <div
                                    key={s.user_id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '16px 22px',
                                        borderBottom: '1px solid var(--border)',
                                        background: isMe ? 'rgba(212,168,67,0.04)' : 'transparent',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    {/* Rank */}
                                    <div style={{
                                        width: 36, textAlign: 'center', flexShrink: 0,
                                        fontFamily: 'Bebas Neue', fontSize: 24, color: rankColor,
                                    }}>
                                        {rankIcon ?? i + 1}
                                    </div>

                                    {/* Robohash avatar */}
                                    <img
                                        src={getRobohashUrl(s.display_name, 60)}
                                        alt={s.display_name}
                                        width={40} height={40}
                                        style={{
                                            borderRadius: '50%', flexShrink: 0,
                                            border: isMe ? '2px solid var(--gold)' : '2px solid var(--border)',
                                        }}
                                    />

                                    {/* Name + detail */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 14, fontWeight: 600,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            color: isMe ? 'var(--gold)' : 'var(--cream)',
                                        }}>
                                            {s.display_name}
                                            {isMe && <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>· you</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 10 }}>
                                            <span>{s.dynamic_exact ?? s.exact_scores} exact</span>
                                            <span>{s.dynamic_correct ?? s.correct_results} correct</span>
                                            {(s.dynamic_streak || 0) > 0 && <span style={{ color: '#e05c4a' }}>🔥 {s.dynamic_streak} streak</span>}
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                        <div style={{
                                            fontFamily: 'Bebas Neue', fontSize: 32,
                                            color: isMe ? 'var(--gold)' : 'var(--cream)', lineHeight: 1
                                        }}>
                                            {s.display_points}
                                        </div>
                                        {s.live_bonus && s.live_bonus > 0 ? (
                                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', marginTop: 2, background: 'rgba(212,168,67,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                                                +{s.live_bonus} LIVE
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginTop: 4 }}>
                                                pts
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}

                    {/* Footer hint */}
                    {scores.length > 0 && (
                        <div style={{
                            padding: '14px 22px',
                            borderTop: '1px solid var(--border)',
                            fontSize: 12, color: 'var(--muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span>Scores update in real-time as matches finish</span>
                            <a href="/predict" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
                                Add predictions →
                            </a>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}