'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/lib/supabase/client'
import { getRobohashUrl } from '@/lib/wc2026-data'
import type { Group, Profile } from '@/types'

interface GroupWithMeta extends Group {
    member_count: number
    my_rank: number | null
    my_points: number | null
    leader_name: string | null
    leader_points: number | null
    members_preview: { display_name: string }[]
}

const S: Record<string, React.CSSProperties> = {
    input: {
        width: '100%', padding: '12px 14px', borderRadius: 12,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        color: 'var(--cream)', fontSize: 14, outline: 'none',
        fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.2s',
    },
    label: {
        display: 'block', fontSize: 11, fontWeight: 600,
        letterSpacing: 1.5, textTransform: 'uppercase' as const,
        color: 'var(--muted)', marginBottom: 6,
    },
    btnPrimary: {
        width: '100%', padding: '13px 0', borderRadius: 12,
        background: 'var(--gold)', color: '#0a0a0a',
        fontWeight: 700, fontSize: 14, border: 'none',
        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    },
    btnSecondary: {
        padding: '10px 20px', borderRadius: 10,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        color: 'var(--dim)', fontSize: 13, cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif',
    },
}

// ── Modal shell ────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: {
    title: string; onClose: () => void; children: React.ReactNode
}) {
    return (
        <div
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
            style={{
                position: 'fixed', inset: 0, zIndex: 100,
                background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
        >
            <div style={{
                width: '100%', maxWidth: 460,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 20, overflow: 'hidden',
                animation: 'modalIn 0.2s ease',
            }}>
                <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
                <div style={{ height: 3, background: 'linear-gradient(90deg,var(--gold),var(--gold-light),var(--gold))' }} />
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px 22px', borderBottom: '1px solid var(--border)',
                }}>
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 26, color: 'var(--gold)' }}>{title}</span>
                    <button onClick={onClose} style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        color: 'var(--dim)', cursor: 'pointer', fontSize: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                </div>
                <div style={{ padding: '22px 22px 24px' }}>{children}</div>
            </div>
        </div>
    )
}

// ── Copy button (available for future use in modals) ────────────────────────

// ── Main page ──────────────────────────────────────────────────────────────────
export default function GroupsPage() {
    const [groups, setGroups] = useState<GroupWithMeta[]>([])
    const [profile, setProfile] = useState<Profile | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [showJoin, setShowJoin] = useState(false)
    const [groupName, setGroupName] = useState('')
    const [groupDesc, setGroupDesc] = useState('')
    const [inviteCode, setInviteCode] = useState('')
    const [joinError, setJoinError] = useState('')
    const [loading, setLoading] = useState(false)
    const [pageLoading, setPageLoading] = useState(true)
    const [supabase] = useState(() => createClient())
    const router = useRouter()

    const loadGroups = useCallback(async (uid: string) => {
        const { data: memberships } = await supabase
            .from('group_members')
            .select('group_id, groups(id, name, description, invite_code, created_by, created_at)')
            .eq('user_id', uid)

        if (!memberships) return

        const rawGroups = memberships
            .map(m => (Array.isArray(m.groups) ? m.groups[0] : m.groups) as unknown as Group)
            .filter(Boolean)

        // For each group, load member count + scores enriched
        const enriched: GroupWithMeta[] = await Promise.all(
            rawGroups.map(async g => {
                // Member count
                const { count } = await supabase
                    .from('group_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('group_id', g.id)

                // Scores for leaderboard preview
                const { data: scores } = await supabase
                    .from('scores')
                    .select('user_id, total_points, profile:profiles(display_name)')
                    .eq('group_id', g.id)
                    .order('total_points', { ascending: false })
                    .limit(5)

                const myScoreRow = scores?.find(s => s.user_id === uid)
                const myRank = scores
                    ? scores.findIndex(s => s.user_id === uid) + 1
                    : null
                const leader = scores?.[0]
                const leaderProfile = Array.isArray(leader?.profile) ? leader.profile[0] : leader?.profile

                // Members preview for avatars
                const { data: members } = await supabase
                    .from('group_members')
                    .select('profiles(display_name)')
                    .eq('group_id', g.id)
                    .limit(5)

                const membersPreview = members
                    ?.map(m => {
                        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                        const profile = p as { display_name?: string } | null
                        return { display_name: profile?.display_name ?? '?' }
                    }) ?? []

                return {
                    ...g,
                    member_count: count ?? 0,
                    my_rank: myRank || null,
                    my_points: myScoreRow?.total_points ?? null,
                    leader_name: leaderProfile?.display_name ?? null,
                    leader_points: leader?.total_points ?? null,
                    members_preview: membersPreview,
                }
            })
        )

        setGroups(enriched)
    }, [supabase])

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/auth/login'); return }
            setUserId(user.id)
            const { data: p } = await supabase
                .from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)
            await loadGroups(user.id)
            setPageLoading(false)
        }
        init()
    }, [])

    const createGroup = async () => {
        if (!groupName.trim() || !userId) return
        setLoading(true)
        const { data: g, error } = await supabase
            .from('groups')
            .insert({ name: groupName.trim(), description: groupDesc.trim() || null, created_by: userId })
            .select().single()

        if (!error && g) {
            await supabase.from('group_members').insert({ group_id: g.id, user_id: userId })
            setGroupName(''); setGroupDesc(''); setShowCreate(false)
            await loadGroups(userId)
        }
        setLoading(false)
    }

    const joinGroup = async () => {
        if (!inviteCode.trim() || !userId) return
        setJoinError('')
        setLoading(true)

        const { data: g } = await supabase
            .from('groups').select('*')
            .eq('invite_code', inviteCode.toUpperCase().trim())
            .single()

        if (!g) {
            setJoinError('No group found with that code. Check and try again.')
            setLoading(false)
            return
        }

        const { error } = await supabase
            .from('group_members')
            .upsert({ group_id: g.id, user_id: userId })

        if (!error) {
            setInviteCode(''); setShowJoin(false)
            await loadGroups(userId)
        }
        setLoading(false)
    }

    const displayName = profile?.display_name ?? profile?.email ?? 'Player'

    if (pageLoading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
                <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={displayName} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                    <div style={{ fontSize: 14, color: 'var(--muted)' }}>Loading your groups…</div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={displayName} />

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 40px 60px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
                            Your competition
                        </p>
                        <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 64, lineHeight: 0.9, color: 'var(--cream)' }}>
                            GROUPS &<br />RIVALS
                        </h1>
                        <p style={{ marginTop: 10, fontSize: 14, color: 'var(--dim)', maxWidth: 400 }}>
                            Compete in private groups. Share your invite code and see who predicts best.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={() => setShowJoin(true)}
                            style={{
                                padding: '12px 22px', borderRadius: 12,
                                background: 'var(--surface2)', border: '1px solid var(--border)',
                                color: 'var(--dim)', fontSize: 14, fontWeight: 500,
                                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}
                        >
                            🔑 Join a group
                        </button>
                        <button
                            onClick={() => setShowCreate(true)}
                            style={{
                                padding: '12px 22px', borderRadius: 12,
                                background: 'var(--gold)', color: '#0a0a0a',
                                fontSize: 14, fontWeight: 700, border: 'none',
                                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}
                        >
                            ＋ Create a group
                        </button>
                    </div>
                </div>

                {/* Groups grid */}
                {groups.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '64px 20px',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 20,
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                        <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: 'var(--cream)', marginBottom: 8 }}>
                            No groups yet
                        </h2>
                        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24, maxWidth: 340, margin: '0 auto 24px' }}>
                            Create your first group and invite friends to compete on predictions.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button onClick={() => setShowCreate(true)} style={{ ...S.btnPrimary, width: 'auto', padding: '12px 28px' }}>
                                Create a group
                            </button>
                            <button onClick={() => setShowJoin(true)} style={{ ...S.btnSecondary }}>
                                Join with a code
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
                        {groups.map(g => <GroupCard key={g.id} g={g} />)}

                        {/* Create new card */}
                        <button
                            onClick={() => setShowCreate(true)}
                            style={{
                                background: 'transparent',
                                border: '1.5px dashed var(--border)',
                                borderRadius: 20, padding: 24,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                gap: 10, cursor: 'pointer', minHeight: 200,
                                transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-gold)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: 'var(--surface2)', border: '1px solid var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 24, color: 'var(--dim)',
                            }}>＋</div>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--dim)' }}>New group</span>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Invite friends to compete</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ── Create modal ── */}
            {showCreate && (
                <Modal title="Create Group" onClose={() => { setShowCreate(false); setGroupName(''); setGroupDesc('') }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={S.label}>Group name *</label>
                            <input
                                style={S.input}
                                placeholder="e.g. The Office Predictions 2026"
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-gold)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label style={S.label}>Description (optional)</label>
                            <input
                                style={S.input}
                                placeholder="e.g. Work crew · prize: coffee"
                                value={groupDesc}
                                onChange={e => setGroupDesc(e.target.value)}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-gold)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                            />
                        </div>
                        <div style={{
                            padding: '12px 14px', borderRadius: 10,
                            background: 'rgba(212,168,67,0.06)', border: '1px solid var(--border-gold)',
                            fontSize: 12, color: 'var(--gold)',
                        }}>
                            💡 After creating, you&apos;ll get an invite code to share with friends.
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                style={{ ...S.btnSecondary }}
                                onClick={() => { setShowCreate(false); setGroupName(''); setGroupDesc('') }}
                            >
                                Cancel
                            </button>
                            <button
                                style={{ ...S.btnPrimary, opacity: loading || !groupName.trim() ? 0.6 : 1 }}
                                disabled={loading || !groupName.trim()}
                                onClick={createGroup}
                            >
                                {loading ? 'Creating…' : 'Create Group →'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Join modal ── */}
            {showJoin && (
                <Modal title="Join Group" onClose={() => { setShowJoin(false); setInviteCode(''); setJoinError('') }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={S.label}>Invite code</label>
                            <input
                                style={{ ...S.input, textTransform: 'uppercase', letterSpacing: 3, fontFamily: 'DM Mono, monospace', fontSize: 18 }}
                                placeholder="XXXXXXXX"
                                value={inviteCode}
                                onChange={e => { setInviteCode(e.target.value.toUpperCase()); setJoinError('') }}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-gold)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                                maxLength={8}
                                autoFocus
                            />
                        </div>
                        {joinError && (
                            <div style={{
                                padding: '10px 14px', borderRadius: 10,
                                background: 'rgba(200,57,43,0.12)', border: '1px solid rgba(200,57,43,0.25)',
                                color: '#e05c4a', fontSize: 13,
                            }}>
                                {joinError}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                style={S.btnSecondary}
                                onClick={() => { setShowJoin(false); setInviteCode(''); setJoinError('') }}
                            >
                                Cancel
                            </button>
                            <button
                                style={{ ...S.btnPrimary, opacity: loading || inviteCode.length < 6 ? 0.6 : 1 }}
                                disabled={loading || inviteCode.length < 6}
                                onClick={joinGroup}
                            >
                                {loading ? 'Joining…' : 'Join Group →'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}

// ── Group card ─────────────────────────────────────────────────────────────────
function GroupCard({ g }: {
    g: GroupWithMeta
}) {
    const [copied, setCopied] = useState(false)

    const copyCode = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        navigator.clipboard?.writeText(g.invite_code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const rankLabel = g.my_rank
        ? g.my_rank === 1 ? '👑 1st' : g.my_rank === 2 ? '🥈 2nd' : g.my_rank === 3 ? '🥉 3rd' : `#${g.my_rank}`
        : '—'

    return (
        <a
            href={`/groups/${g.id}`}
            style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 20, overflow: 'hidden', textDecoration: 'none',
                display: 'block', transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-gold)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 16px 48px rgba(0,0,0,0.5)'
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
            }}
        >
            {/* Top */}
            <div style={{ padding: '20px 20px 14px', position: 'relative', overflow: 'hidden' }}>
                {/* Subtle gold glow top-left */}
                <div style={{
                    position: 'absolute', top: -40, left: -40,
                    width: 160, height: 160, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(212,168,67,0.07) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                            fontFamily: 'Bebas Neue', fontSize: 26, color: 'var(--cream)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                            {g.name}
                        </h3>
                        {g.description && (
                            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{g.description}</p>
                        )}
                    </div>
                    {/* Your rank badge */}
                    <div style={{
                        flexShrink: 0, marginLeft: 12,
                        padding: '4px 12px', borderRadius: 20,
                        background: g.my_rank === 1 ? 'rgba(212,168,67,0.15)' : 'var(--surface2)',
                        border: `1px solid ${g.my_rank === 1 ? 'var(--border-gold)' : 'var(--border)'}`,
                        fontFamily: 'Bebas Neue', fontSize: 18,
                        color: g.my_rank === 1 ? 'var(--gold)' : 'var(--dim)',
                    }}>
                        {rankLabel}
                    </div>
                </div>

                {/* Member avatars */}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, gap: 0 }}>
                    {g.members_preview.map((m, i) => (
                        <img
                            key={i}
                            src={getRobohashUrl(m.display_name, 40)}
                            alt={m.display_name}
                            title={m.display_name}
                            width={28} height={28}
                            style={{
                                borderRadius: '50%',
                                border: '2px solid var(--surface)',
                                marginLeft: i === 0 ? 0 : -8,
                                position: 'relative',
                                zIndex: g.members_preview.length - i,
                            }}
                        />
                    ))}
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>
                        {g.member_count} {g.member_count === 1 ? 'player' : 'players'}
                    </span>
                </div>
            </div>

            {/* Bottom bar */}
            <div style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                {/* Points + leader */}
                <div style={{ fontSize: 12 }}>
                    {g.my_points !== null ? (
                        <span style={{ color: 'var(--cream)' }}>
                            <span style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: 'var(--gold)' }}>
                                {g.my_points}
                            </span>
                            <span style={{ color: 'var(--muted)', marginLeft: 4 }}>pts</span>
                        </span>
                    ) : (
                        <span style={{ color: 'var(--muted)' }}>No predictions yet</span>
                    )}
                    {g.leader_name && g.my_rank !== 1 && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            Leader: <span style={{ color: 'var(--cream)' }}>{g.leader_name}</span> · {g.leader_points} pts
                        </div>
                    )}
                </div>

                {/* Invite code + copy */}
                <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={e => e.preventDefault()}
                >
                    <span style={{
                        fontFamily: 'DM Mono, monospace', fontSize: 12,
                        color: 'var(--gold)', letterSpacing: 2,
                        padding: '4px 10px', borderRadius: 8,
                        background: 'rgba(212,168,67,0.08)',
                        border: '1px solid var(--border-gold)',
                    }}>
                        {g.invite_code}
                    </span>
                    <button
                        onClick={copyCode}
                        title="Copy invite code"
                        style={{
                            width: 28, height: 28, borderRadius: 7,
                            background: copied ? 'rgba(34,197,94,0.12)' : 'var(--surface2)',
                            border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                            color: copied ? 'var(--green-bright)' : 'var(--muted)',
                            cursor: 'pointer', fontSize: 13,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        {copied ? '✓' : '⧉'}
                    </button>
                </div>
            </div>
        </a>
    )
}