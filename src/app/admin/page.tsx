'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/lib/supabase/client'
import { getRobohashUrl, getFlagUrl } from '@/lib/wc2026-data'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
    users: number
    predictions: number
    groups: number
    bracketPicks: number
    matches: { upcoming: number; live: number; finished: number }
    usersCompleted: number
    recentUsers: { id: string; display_name: string; email: string; created_at: string }[]
    recentPredictions: { id: string; user_id: string; match_id: string; home_score: number; away_score: number; created_at: string; profile: { display_name: string } | null }[]
}

interface AdminUser {
    id: string; email: string; display_name: string; avatar_initials: string; avatar_color: string; created_at: string
    predictions: number; bracket_picks: number; groups: number; is_unlocked?: boolean
    score: { total_points: number; exact_scores: number; correct_results: number; streak: number } | null
}

interface AdminMatch {
    id: string; group_label: string; match_number: number; home_team: string; away_team: string
    home_flag: string; away_flag: string; home_score: number | null; away_score: number | null
    kickoff: string; venue: string; city: string; status: string; minute: number | null
    prediction_count: number
}

interface AdminGroup {
    id: string; name: string; description: string | null; invite_code: string; created_at: string
    created_by: string; member_count: number
    members: { user_id: string; display_name: string; email: string; joined_at: string; total_points: number }[]
}

interface AdminPrediction {
    id: string; user_id: string; match_id: string; home_score: number; away_score: number
    created_at: string; updated_at: string
    profile: { display_name: string; email: string } | null
}

interface ScoringComparison {
    comparison_version?: string
    generated_at?: string
    finished_matches: number
    users: number
    stored_new_mismatches?: number
    totals: { current_total: number; new_total: number; legacy_total: number }
    rows: {
        user_id: string
        display_name: string
        email: string
        current_total: number
        new_total: number
        legacy_total: number
        new_match_points?: number
        legacy_match_points?: number
        played_matches?: number
        selected_group_id?: string | null
        delta_new_vs_legacy: number
        delta_current_vs_new: number
    }[]
}

type Tab = 'overview' | 'matches' | 'users' | 'groups' | 'predictions' | 'scoring' | 'tools'

// ─── Styles ───────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, overflow: 'hidden',
}
const th: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase',
    color: 'var(--muted)', padding: '10px 12px', textAlign: 'left',
    borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
}
const td: React.CSSProperties = {
    padding: '10px 12px', borderBottom: '1px solid var(--border)',
    fontSize: 13, color: 'var(--dim)',
}
const btnGold: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, background: 'var(--gold)', color: '#0a0a0a',
    fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
}
const btnDanger: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 6, background: 'rgba(224,92,74,0.12)',
    border: '1px solid rgba(224,92,74,0.3)', color: '#e05c4a',
    fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
}
const btnSmall: React.CSSProperties = {
    padding: '5px 10px', borderRadius: 6, background: 'var(--surface2)',
    border: '1px solid var(--border)', color: 'var(--dim)',
    fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
}
const inputStyle: React.CSSProperties = {
    width: 50, padding: '5px 6px', borderRadius: 6,
    background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--cream)', fontSize: 14, textAlign: 'center',
    fontFamily: 'DM Mono, monospace', outline: 'none',
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
    const [tab, setTab] = useState<Tab>('overview')
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
    const [profile, setProfile] = useState<{ avatar_initials: string; display_name: string } | null>(null)
    const router = useRouter()

    useEffect(() => {
        const check = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/auth/login'); return }
            const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            setProfile(p)
            // Try hitting the admin stats endpoint to see if we're admin
            const res = await fetch('/api/admin/stats')
            setIsAdmin(res.ok)
        }
        check()
    }, [router])

    if (isAdmin === null) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>Checking admin access…</p>
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
                <Nav initials={profile?.avatar_initials ?? 'PL'} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 16 }}>
                    <div style={{ fontSize: 64 }}>🔒</div>
                    <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 42, color: 'var(--cream)' }}>Access Denied</h1>
                    <p style={{ color: 'var(--muted)', fontSize: 14 }}>You don&apos;t have admin access. Contact the administrator.</p>
                </div>
            </div>
        )
    }

    const tabs: { key: Tab; label: string; icon: string }[] = [
        { key: 'overview', label: 'Overview', icon: '📊' },
        { key: 'matches', label: 'Matches', icon: '⚽' },
        { key: 'users', label: 'Users', icon: '👥' },
        { key: 'groups', label: 'Groups', icon: '🏆' },
        { key: 'predictions', label: 'Predictions', icon: '🎯' },
        { key: 'scoring', label: 'Scoring', icon: '#' },
        { key: 'tools', label: 'Test Tools', icon: '🔧' },
    ]

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={profile?.display_name} />

            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '88px 32px 60px' }}>
                {/* Header */}
                <div style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 6, background: 'rgba(224,92,74,0.12)', border: '1px solid rgba(224,92,74,0.3)', color: '#e05c4a' }}>
                            Admin
                        </span>
                    </div>
                    <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 56, color: 'var(--cream)', lineHeight: 1 }}>
                        COMMAND <span style={{ color: 'var(--gold)' }}>CENTER</span>
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>Platform management, match scoring, and test tools</p>
                </div>

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{
                                padding: '10px 18px', fontSize: 13, fontWeight: 600,
                                background: 'transparent', border: 'none',
                                borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                                color: tab === t.key ? 'var(--gold)' : 'var(--muted)',
                                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                                display: 'flex', alignItems: 'center', gap: 6,
                                transition: 'color 0.15s, border-color 0.15s',
                            }}
                        >
                            <span>{t.icon}</span> {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                {tab === 'overview' && <OverviewTab />}
                {tab === 'matches' && <MatchesTab />}
                {tab === 'users' && <UsersTab />}
                {tab === 'groups' && <GroupsTab />}
                {tab === 'predictions' && <PredictionsTab />}
                {tab === 'scoring' && <ScoringTab />}
                {tab === 'tools' && <ToolsTab />}
            </div>
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: Overview
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function OverviewTab() {
    const [stats, setStats] = useState<Stats | null>(null)

    useEffect(() => {
        fetch('/api/admin/stats').then(r => r.json()).then(setStats)
    }, [])

    if (!stats) return <Loading />

    const statCards = [
        { label: 'Registered Users', value: stats.users, accent: 'var(--gold)', icon: '👥' },
        { label: 'Total Predictions', value: stats.predictions, accent: 'var(--green-bright)', icon: '🎯' },
        { label: 'Groups Created', value: stats.groups, accent: 'var(--blue-accent)', icon: '🏆' },
        { label: 'Bracket Picks', value: stats.bracketPicks, accent: '#e05c4a', icon: '🏟️' },
        { label: 'Matches Finished', value: stats.matches.finished, accent: 'var(--gold)', icon: '✅' },
        { label: 'Users Completed 72', value: stats.usersCompleted, accent: 'var(--green-bright)', icon: '🎖️' },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {statCards.map(c => (
                    <div key={c.label} style={{ ...card, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c.accent }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12 }}>
                            <span style={{ fontSize: 28 }}>{c.icon}</span>
                            <div>
                                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>{c.label}</p>
                                <p style={{ fontFamily: 'Bebas Neue', fontSize: 36, color: 'var(--cream)', lineHeight: 1 }}>{c.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Match status bar */}
            <div style={card}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>⚽</span>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cream)' }}>Match Status</span>
                </div>
                <div style={{ padding: '16px 18px', display: 'flex', gap: 20 }}>
                    {[
                        { label: 'Upcoming', count: stats.matches.upcoming, color: 'var(--muted)' },
                        { label: 'Live', count: stats.matches.live, color: 'var(--green-bright)' },
                        { label: 'Finished', count: stats.matches.finished, color: 'var(--gold)' },
                    ].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                            <span style={{ fontSize: 13, color: 'var(--dim)' }}>{s.label}: <strong style={{ color: 'var(--cream)' }}>{s.count}</strong></span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Two-column: recent users + recent predictions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                {/* Recent users */}
                <div style={card}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cream)' }}>
                            👤 Recent Sign-ups
                        </span>
                    </div>
                    {stats.recentUsers.map(u => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                            <img src={getRobohashUrl(u.display_name, 40)} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                {new Date(u.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Recent predictions */}
                <div style={card}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cream)' }}>
                            🎯 Recent Predictions
                        </span>
                    </div>
                    {stats.recentPredictions.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)' }}>{p.profile?.display_name ?? 'Unknown'}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Match {p.match_id}</div>
                            </div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>
                                {p.home_score} – {p.away_score}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                {new Date(p.created_at).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: Matches
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MatchesTab() {
    const [matches, setMatches] = useState<AdminMatch[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLog, setActionLog] = useState<string[]>([])
    const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})

    const loadMatches = useCallback(async () => {
        const res = await fetch('/api/admin/matches')
        const data = await res.json()
        setMatches(data.matches ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { loadMatches() }, [loadMatches])

    const finishMatch = async (matchId: string) => {
        const s = scores[matchId]
        if (!s || s.home === '' || s.away === '') {
            setActionLog(prev => [`⚠️ Enter both scores for ${matchId}`, ...prev])
            return
        }
        const home = parseInt(s.home)
        const away = parseInt(s.away)
        if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
            setActionLog(prev => [`⚠️ Invalid scores for ${matchId}`, ...prev])
            return
        }

        // 1. Update match result
        const r1 = await fetch('/api/admin/matches', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ match_id: matchId, home_score: home, away_score: away, status: 'finished' }),
        })
        if (!r1.ok) {
            setActionLog(prev => [`❌ Failed to update ${matchId}`, ...prev])
            return
        }
        setActionLog(prev => [`✅ Match ${matchId} → ${home}-${away} (finished)`, ...prev])

        // 2. Trigger scoring
        const r2 = await fetch('/api/admin/matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ match_id: matchId }),
        })
        const scoreResult = await r2.json()
        setActionLog(prev => [`📊 Scored ${matchId}: ${scoreResult.processed ?? 0} entries, ${scoreResult.predictions_found ?? 0} predictions`, ...prev])

        await loadMatches()
    }

    if (loading) return <Loading />

    // Group matches by group_label
    const grouped = matches.reduce<Record<string, AdminMatch[]>>((acc, m) => {
        (acc[m.group_label] ??= []).push(m)
        return acc
    }, {})

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Action log */}
            {actionLog.length > 0 && (
                <div style={{ ...card, padding: 16, maxHeight: 160, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1 }}>Action Log</span>
                        <button onClick={() => setActionLog([])} style={btnSmall}>Clear</button>
                    </div>
                    {actionLog.map((msg, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--dim)', padding: '2px 0', fontFamily: 'DM Mono, monospace' }}>{msg}</div>
                    ))}
                </div>
            )}

            {Object.entries(grouped).map(([group, groupMatches]) => (
                <div key={group} style={card}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                        <span style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: 'var(--gold)' }}>Group {group}</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={th}>ID</th>
                                <th style={th}>Match</th>
                                <th style={th}>Kickoff</th>
                                <th style={th}>Status</th>
                                <th style={th}>Score</th>
                                <th style={th}>Preds</th>
                                <th style={th}>Set Result</th>
                                <th style={th}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupMatches.map(m => (
                                <tr key={m.id}>
                                    <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{m.id}</td>
                                    <td style={td}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <img src={getFlagUrl(m.home_team)} alt="" style={{ width: 20, borderRadius: 2 }} />
                                            <span style={{ fontWeight: 600, color: 'var(--cream)' }}>{m.home_team}</span>
                                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>vs</span>
                                            <span style={{ fontWeight: 600, color: 'var(--cream)' }}>{m.away_team}</span>
                                            <img src={getFlagUrl(m.away_team)} alt="" style={{ width: 20, borderRadius: 2 }} />
                                        </div>
                                    </td>
                                    <td style={{ ...td, fontSize: 11 }}>
                                        {new Date(m.kickoff).toLocaleDateString('en-US', { timeZone: 'Etc/GMT-1' })} {new Date(m.kickoff).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Etc/GMT-1' })}
                                    </td>
                                    <td style={td}>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                            background: m.status === 'finished' ? 'rgba(34,197,94,0.10)' : m.status === 'live' ? 'rgba(224,92,74,0.10)' : 'var(--surface2)',
                                            color: m.status === 'finished' ? 'var(--green-bright)' : m.status === 'live' ? '#e05c4a' : 'var(--muted)',
                                            border: `1px solid ${m.status === 'finished' ? 'rgba(34,197,94,0.25)' : m.status === 'live' ? 'rgba(224,92,74,0.25)' : 'var(--border)'}`,
                                            textTransform: 'uppercase', letterSpacing: 1,
                                        }}>
                                            {m.status}
                                        </span>
                                    </td>
                                    <td style={{ ...td, fontFamily: 'Bebas Neue', fontSize: 20, color: m.home_score !== null ? 'var(--cream)' : 'var(--muted)' }}>
                                        {m.home_score !== null ? `${m.home_score} – ${m.away_score}` : '—'}
                                    </td>
                                    <td style={{ ...td, textAlign: 'center', color: 'var(--gold)', fontWeight: 600 }}>
                                        {m.prediction_count}
                                    </td>
                                    <td style={td}>
                                        {m.status !== 'finished' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <input
                                                    type="number" min="0" max="20"
                                                    style={inputStyle}
                                                    placeholder="H"
                                                    value={scores[m.id]?.home ?? ''}
                                                    onChange={e => setScores(prev => ({
                                                        ...prev,
                                                        [m.id]: { home: e.target.value, away: prev[m.id]?.away ?? '' }
                                                    }))}
                                                />
                                                <span style={{ color: 'var(--muted)', fontSize: 14 }}>–</span>
                                                <input
                                                    type="number" min="0" max="20"
                                                    style={inputStyle}
                                                    placeholder="A"
                                                    value={scores[m.id]?.away ?? ''}
                                                    onChange={e => setScores(prev => ({
                                                        ...prev,
                                                        [m.id]: { home: prev[m.id]?.home ?? '', away: e.target.value }
                                                    }))}
                                                />
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: 11, color: 'var(--green-bright)' }}>✓ Done</span>
                                        )}
                                    </td>
                                    <td style={td}>
                                        {m.status !== 'finished' ? (
                                            <button onClick={() => finishMatch(m.id)} style={btnGold}>
                                                Finish & Score
                                            </button>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    const r = await fetch('/api/admin/matches', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ match_id: m.id }),
                                                    })
                                                    const data = await r.json()
                                                    setActionLog(prev => [`🔄 Re-scored ${m.id}: ${data.processed ?? 0} entries`, ...prev])
                                                }}
                                                style={btnSmall}
                                            >
                                                Re-score
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: Users
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function UsersTab() {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [actionMsg, setActionMsg] = useState('')

    const loadUsers = useCallback(async () => {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        setUsers(data.users ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { loadUsers() }, [loadUsers])

    const resetUser = async (userId: string, name: string) => {
        if (!confirm(`Reset all predictions, bracket picks, and scores for "${name}"?\n\nThis cannot be undone.`)) return
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset', user_id: userId }),
        })
        const data = await res.json()
        setActionMsg(`✅ Reset ${name}: ${data.results?.join(', ')}`)
        await loadUsers()
    }

    const resetPassword = async (userId: string, name: string) => {
        if (!confirm(`Generate a temporary password for "${name}"?\n\nTheir old password will stop working immediately.`)) return
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_password', user_id: userId, display_name: name }),
        })
        const data = await res.json()
        if (res.ok) {
            setActionMsg(`Password reset for ${name}. Temporary password: ${data.temporary_password}`)
        } else {
            setActionMsg(`❌ Password reset failed: ${data.error}`)
        }
    }

    const deleteUser = async (userId: string, name: string) => {
        if (!confirm(`⚠️ DELETE user "${name}"?\n\nThis will permanently remove their account and all data.\nThis cannot be undone!`)) return
        const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' })
        if (res.ok) {
            setActionMsg(`🗑️ Deleted user ${name}`)
            await loadUsers()
        } else {
            const data = await res.json()
            setActionMsg(`❌ Failed: ${data.error}`)
        }
    }

    const toggleUnlock = async (userId: string, name: string, currentStatus: boolean) => {
        const newStatus = !currentStatus
        if (!confirm(`${newStatus ? 'Unlock' : 'Lock'} predictions for "${name}"?`)) return
        
        const res = await fetch('/api/admin/users/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, is_unlocked: newStatus }),
        })
        
        if (res.ok) {
            setActionMsg(`✅ ${newStatus ? 'Unlocked' : 'Locked'} ${name}`)
            await loadUsers()
        } else {
            const data = await res.json()
            setActionMsg(`❌ Failed to toggle unlock: ${data.error}`)
        }
    }

    if (loading) return <Loading />

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{users.length} registered user{users.length !== 1 ? 's' : ''}</span>
                {actionMsg && (
                    <div style={{ fontSize: 12, color: 'var(--gold)', padding: '4px 12px', borderRadius: 8, background: 'rgba(212,168,67,0.08)', border: '1px solid var(--border-gold)' }}>
                        {actionMsg}
                    </div>
                )}
            </div>

            <div style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={th}>Player</th>
                            <th style={th}>Email</th>
                            <th style={th}>Joined</th>
                            <th style={{ ...th, textAlign: 'center' }}>Preds</th>
                            <th style={{ ...th, textAlign: 'center' }}>Bracket</th>
                            <th style={{ ...th, textAlign: 'center' }}>Groups</th>
                            <th style={{ ...th, textAlign: 'center' }}>Points</th>
                            <th style={{ ...th, textAlign: 'center' }}>Exact</th>
                            <th style={{ ...th, textAlign: 'center' }}>Streak</th>
                            <th style={th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id}>
                                <td style={td}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <img src={getRobohashUrl(u.display_name, 40)} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                                        <span style={{ fontWeight: 600, color: 'var(--cream)' }}>{u.display_name}</span>
                                        {u.is_unlocked && <span style={{ fontSize: 10, background: 'rgba(212,168,67,0.15)', color: 'var(--gold)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>UNLOCKED</span>}
                                    </div>
                                </td>
                                <td style={{ ...td, fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {u.email}
                                </td>
                                <td style={{ ...td, fontSize: 11 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                <td style={{ ...td, textAlign: 'center', fontWeight: 600, color: u.predictions > 0 ? 'var(--gold)' : 'var(--muted)' }}>
                                    {u.predictions}/72
                                </td>
                                <td style={{ ...td, textAlign: 'center', color: u.bracket_picks > 0 ? 'var(--cream)' : 'var(--muted)' }}>
                                    {u.bracket_picks}
                                </td>
                                <td style={{ ...td, textAlign: 'center' }}>{u.groups}</td>
                                <td style={{ ...td, textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 20, color: (u.score?.total_points ?? 0) > 0 ? 'var(--cream)' : 'var(--muted)' }}>
                                    {u.score?.total_points ?? 0}
                                </td>
                                <td style={{ ...td, textAlign: 'center' }}>{u.score?.exact_scores ?? 0}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                    {(u.score?.streak ?? 0) > 0 ? `🔥 ${u.score!.streak}` : '0'}
                                </td>
                                <td style={td}>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => toggleUnlock(u.id, u.display_name, u.is_unlocked ?? false)} style={{ ...btnSmall, background: u.is_unlocked ? 'rgba(212,168,67,0.15)' : 'var(--surface2)', borderColor: u.is_unlocked ? 'var(--gold)' : 'var(--border)', color: u.is_unlocked ? 'var(--gold)' : 'var(--dim)' }} title={u.is_unlocked ? 'Lock predictions' : 'Unlock predictions'}>
                                            {u.is_unlocked ? '🔒' : '🔓'}
                                        </button>
                                        <button onClick={() => resetPassword(u.id, u.display_name)} style={btnSmall} title="Reset password">
                                            🔑
                                        </button>
                                        <button onClick={() => resetUser(u.id, u.display_name)} style={btnSmall} title="Reset predictions & scores">
                                            🔄
                                        </button>
                                        <button onClick={() => deleteUser(u.id, u.display_name)} style={btnDanger} title="Delete user">
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: Groups
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function GroupsTab() {
    const [groups, setGroups] = useState<AdminGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<string | null>(null)

    const loadGroups = useCallback(async () => {
        const res = await fetch('/api/admin/groups')
        const data = await res.json()
        setGroups(data.groups ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { loadGroups() }, [loadGroups])

    const deleteGroup = async (groupId: string, name: string) => {
        if (!confirm(`⚠️ DELETE group "${name}"?\n\nThis will permanently remove the group and all its members/scores.\nThis cannot be undone!`)) return
        const res = await fetch(`/api/admin/groups?id=${groupId}`, { method: 'DELETE' })
        if (res.ok) {
            await loadGroups()
        } else {
            const data = await res.json()
            alert(`❌ Failed to delete: ${data.error}`)
        }
    }

    if (loading) return <Loading />

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{groups.length} group{groups.length !== 1 ? 's' : ''} created</span>

            <div style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={th}>Group Name</th>
                            <th style={th}>Invite Code</th>
                            <th style={{ ...th, textAlign: 'center' }}>Members</th>
                            <th style={th}>Created By</th>
                            <th style={th}>Created</th>
                            <th style={th}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map(g => (
                            <Fragment key={g.id}>
                                <tr key={g.id}>
                                    <td style={td}>
                                        <div>
                                            <span style={{ fontWeight: 600, color: 'var(--cream)' }}>{g.name}</span>
                                            {g.description && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{g.description}</div>}
                                        </div>
                                    </td>
                                    <td style={td}>
                                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--gold)', letterSpacing: 2, padding: '3px 8px', borderRadius: 6, background: 'rgba(212,168,67,0.08)', border: '1px solid var(--border-gold)' }}>
                                            {g.invite_code}
                                        </span>
                                    </td>
                                    <td style={{ ...td, textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 22, color: 'var(--cream)' }}>
                                        {g.member_count}
                                    </td>
                                    <td style={{ ...td, fontSize: 12 }}>{g.created_by}</td>
                                    <td style={{ ...td, fontSize: 11 }}>{new Date(g.created_at).toLocaleDateString()}</td>
                                    <td style={td}>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button
                                                onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                                                style={btnSmall}
                                            >
                                                {expanded === g.id ? '▲ Hide' : '▼ Members'}
                                            </button>
                                            <button onClick={() => deleteGroup(g.id, g.name)} style={btnDanger} title="Delete group">
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {expanded === g.id && g.members.map(m => (
                                    <tr key={m.user_id} style={{ background: 'rgba(212,168,67,0.03)' }}>
                                        <td style={{ ...td, paddingLeft: 32 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <img src={getRobohashUrl(m.display_name, 40)} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                                                <span style={{ fontSize: 12, color: 'var(--cream)' }}>{m.display_name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...td, fontSize: 11 }}>{m.email}</td>
                                        <td style={{ ...td, textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 18, color: m.total_points > 0 ? 'var(--gold)' : 'var(--muted)' }}>
                                            {m.total_points} pts
                                        </td>
                                        <td colSpan={2} style={{ ...td, fontSize: 11 }}>
                                            Joined {new Date(m.joined_at).toLocaleDateString()}
                                        </td>
                                        <td style={td} />
                                    </tr>
                                ))}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: Predictions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PredictionsTab() {
    const [predictions, setPredictions] = useState<AdminPrediction[]>([])
    const [loading, setLoading] = useState(false)
    const [filter, setFilter] = useState({ match_id: '', user_id: '' })

    const loadPredictions = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (filter.match_id) params.set('match_id', filter.match_id)
        if (filter.user_id) params.set('user_id', filter.user_id)
        const res = await fetch(`/api/admin/predictions?${params}`)
        const data = await res.json()
        setPredictions(data.predictions ?? [])
        setLoading(false)
    }, [filter])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filter bar */}
            <div style={{ ...card, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                        Match ID
                    </label>
                    <input
                        style={{ ...inputStyle, width: 100, textAlign: 'left' }}
                        placeholder="e.g. a1"
                        value={filter.match_id}
                        onChange={e => setFilter(f => ({ ...f, match_id: e.target.value }))}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                        User ID
                    </label>
                    <input
                        style={{ ...inputStyle, width: 280, textAlign: 'left', fontSize: 11 }}
                        placeholder="UUID"
                        value={filter.user_id}
                        onChange={e => setFilter(f => ({ ...f, user_id: e.target.value }))}
                    />
                </div>
                <button onClick={loadPredictions} style={btnGold}>
                    🔍 Search
                </button>
                <button onClick={() => { setFilter({ match_id: '', user_id: '' }); setPredictions([]) }} style={btnSmall}>
                    Clear
                </button>
            </div>

            {loading ? <Loading /> : predictions.length > 0 ? (
                <div style={card}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={th}>Player</th>
                                <th style={th}>Match</th>
                                <th style={{ ...th, textAlign: 'center' }}>Prediction</th>
                                <th style={th}>Created</th>
                                <th style={th}>Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {predictions.map(p => (
                                <tr key={p.id}>
                                    <td style={td}>
                                        <span style={{ fontWeight: 600, color: 'var(--cream)' }}>{p.profile?.display_name ?? 'Unknown'}</span>
                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.profile?.email ?? ''}</div>
                                    </td>
                                    <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{p.match_id}</td>
                                    <td style={{ ...td, textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 22, color: 'var(--gold)' }}>
                                        {p.home_score} – {p.away_score}
                                    </td>
                                    <td style={{ ...td, fontSize: 11 }}>{new Date(p.created_at).toLocaleString()}</td>
                                    <td style={{ ...td, fontSize: 11 }}>{new Date(p.updated_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>
                    Use the filters above to search predictions. Try entering a match ID like &quot;a1&quot;.
                </div>
            )}
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: Scoring
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

function ScoringTab() {
    const [comparison, setComparison] = useState<ScoringComparison | null>(null)
    const [loadingComparison, setLoadingComparison] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadScoringComparison = async () => {
        setLoadingComparison(true)
        setError(null)

        const res = await fetch('/api/admin/scoring-comparison', { cache: 'no-store' })
        const data = await res.json()

        if (res.ok) {
            setComparison(data)
        } else {
            setError(data.error ?? 'Could not load scoring comparison')
        }

        setLoadingComparison(false)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ ...card, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                    <div>
                        <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 30, color: 'var(--blue-accent)', lineHeight: 1 }}>Scoring System Comparison</h3>
                        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                            Compare stored totals against the active scoring formula for every user.
                        </p>
                    </div>
                    <button onClick={loadScoringComparison} disabled={loadingComparison} style={{ ...btnGold, opacity: loadingComparison ? 0.6 : 1 }}>
                        {loadingComparison ? 'Loading...' : 'Load Comparison'}
                    </button>
                </div>

                {error && (
                    <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, border: '1px solid rgba(224,92,74,0.3)', background: 'rgba(224,92,74,0.1)', color: '#e05c4a', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                {!comparison && !error && (
                    <div style={{ padding: 18, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 13 }}>
                        Click Load Comparison to calculate old vs new points from finished matches.
                    </div>
                )}

                {comparison && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.22)', color: 'var(--dim)', fontSize: 12 }}>
                            Comparison version: <span style={{ color: 'var(--cream)', fontFamily: 'DM Mono, monospace' }}>{comparison.comparison_version ?? 'unknown'}</span>
                            {comparison.generated_at && (
                                <span> · Generated: <span style={{ color: 'var(--cream)', fontFamily: 'DM Mono, monospace' }}>{new Date(comparison.generated_at).toLocaleString()}</span></span>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                            {[
                                { label: 'Finished matches', value: comparison.finished_matches },
                                { label: 'Current stored', value: comparison.totals.current_total },
                                { label: 'New formula', value: comparison.totals.new_total },
                                { label: 'Old formula', value: comparison.totals.legacy_total },
                                { label: 'Stored mismatches', value: comparison.stored_new_mismatches ?? 0 },
                            ].map(item => (
                                <div key={item.label} style={{ padding: 12, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--cream)', lineHeight: 1.1 }}>{item.value}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ maxHeight: 520, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={th}>Player</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Current stored</th>
                                        <th style={{ ...th, textAlign: 'right' }}>New formula</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Old formula</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Current - New</th>
                                        <th style={{ ...th, textAlign: 'right' }}>New - Old</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparison.rows.map(row => (
                                        <tr key={row.user_id}>
                                            <td style={td}>
                                                <span style={{ color: 'var(--cream)', fontWeight: 600 }}>{row.display_name}</span>
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{row.email}</div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                    {row.played_matches ?? 0} scored matches{row.selected_group_id ? ` · group ${String(row.selected_group_id).slice(0, 8)}` : ''}
                                                </div>
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{row.current_total}</td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--gold)' }}>
                                                {row.new_total}
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>match {row.new_match_points ?? row.new_total}</div>
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>
                                                {row.legacy_total}
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>match {row.legacy_match_points ?? row.legacy_total}</div>
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace', color: row.delta_current_vs_new === 0 ? 'var(--green-bright)' : '#e05c4a' }}>
                                                {row.delta_current_vs_new > 0 ? '+' : ''}{row.delta_current_vs_new}
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace', color: row.delta_new_vs_legacy >= 0 ? 'var(--green-bright)' : '#e05c4a' }}>
                                                {row.delta_new_vs_legacy > 0 ? '+' : ''}{row.delta_new_vs_legacy}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// TAB: Test Tools
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ToolsTab() {
    const [log, setLog] = useState<string[]>([])
    const [simulating, setSimulating] = useState(false)
    const [resetting, setResetting] = useState(false)
    const [matchCount, setMatchCount] = useState('3')
    const [comparison, setComparison] = useState<ScoringComparison | null>(null)
    const [loadingComparison, setLoadingComparison] = useState(false)

    const simulate = async () => {
        setSimulating(true)
        setLog(prev => ['🔄 Starting simulation...', ...prev])
        const res = await fetch('/api/admin/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ match_count: parseInt(matchCount) || 3 }),
        })
        const data = await res.json()
        setLog(prev => [
            `✅ Simulation complete! ${data.matches_simulated} matches, ${data.predictions_created} predictions, ${data.score_entries} scores`,
            ...(data.log ?? []).map((l: string) => `   ${l}`),
            ...prev,
        ])
        setSimulating(false)
    }

    const reset = async (full: boolean) => {
        const msg = full
            ? '⚠️ FULL RESET: This will revert ALL matches, delete ALL predictions, and clear ALL scores.\n\nAre you sure?'
            : 'Reset test matches (a1-a6), delete their predictions, and clear scores.\n\nContinue?'
        if (!confirm(msg)) return

        setResetting(true)
        setLog(prev => [`🔄 Running ${full ? 'full' : 'partial'} reset...`, ...prev])
        const res = await fetch('/api/admin/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full }),
        })
        const data = await res.json()
        setLog(prev => [
            `✅ ${full ? 'Full' : 'Partial'} reset complete!`,
            ...(data.log ?? []).map((l: string) => `   ${l}`),
            ...prev,
        ])
        setResetting(false)
    }

    const loadScoringComparison = async () => {
        setLoadingComparison(true)
        setLog(prev => ['Loading scoring system comparison...', ...prev])
        const res = await fetch('/api/admin/scoring-comparison')
        const data = await res.json()
        if (res.ok) {
            setComparison(data)
            setLog(prev => [`Loaded comparison for ${data.users} users and ${data.finished_matches} finished matches`, ...prev])
        } else {
            setLog(prev => [`Error: ${data.error ?? 'Could not load scoring comparison'}`, ...prev])
        }
        setLoadingComparison(false)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                {/* Simulate card */}
                <div style={{ ...card, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span style={{ fontSize: 24 }}>🧪</span>
                        <div>
                            <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--gold)', lineHeight: 1 }}>Simulate Matches</h3>
                            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Finishes Group A matches with fake results, generates random predictions for all users, and runs scoring.</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                        <label style={{ fontSize: 12, color: 'var(--dim)' }}>Matches to simulate:</label>
                        <input
                            type="number" min="1" max="6"
                            style={{ ...inputStyle, width: 60 }}
                            value={matchCount}
                            onChange={e => setMatchCount(e.target.value)}
                        />
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>(max 6, Group A)</span>
                    </div>
                    <button
                        onClick={simulate}
                        disabled={simulating}
                        style={{ ...btnGold, width: '100%', padding: '12px 0', opacity: simulating ? 0.6 : 1, fontSize: 14 }}
                    >
                        {simulating ? '⏳ Simulating...' : '🚀 Run Simulation'}
                    </button>
                </div>

                {/* Reset card */}
                <div style={{ ...card, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span style={{ fontSize: 24 }}>🧹</span>
                        <div>
                            <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: '#e05c4a', lineHeight: 1 }}>Reset Data</h3>
                            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Clean up test data. Choose partial (test matches only) or full (everything).</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button
                            onClick={() => reset(false)}
                            disabled={resetting}
                            style={{ ...btnSmall, width: '100%', padding: '10px 0', fontSize: 13, opacity: resetting ? 0.6 : 1 }}
                        >
                            {resetting ? '⏳ Resetting...' : '🔄 Partial Reset (test matches only)'}
                        </button>
                        <button
                            onClick={() => reset(true)}
                            disabled={resetting}
                            style={{ ...btnDanger, width: '100%', padding: '10px 0', fontSize: 13, opacity: resetting ? 0.6 : 1 }}
                        >
                            ⚠️ Full Reset (ALL matches, predictions, scores)
                        </button>
                    </div>
                </div>
            </div>

            {/* Sync Matches with API card */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 24 }}>🔄</span>
                    <div>
                        <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--gold)', lineHeight: 1 }}>Sync Matches with API</h3>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Forcefully overwrites the Supabase matches table with the latest statuses and scores from the external live APIs.</p>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        setLog(prev => ['🔄 Syncing matches with external API...', ...prev])
                        const res = await fetch('/api/admin/sync-all-matches', { method: 'POST' })
                        const data = await res.json()
                        setLog(prev => [
                            res.ok ? `✅ Done! ${data.updatedCount} matches updated.` : `❌ Error: ${data.error}`,
                            ...(data.updatedMatches ?? []).map((m: string) => `   ${m}`),
                            ...prev
                        ])
                    }}
                    style={{ padding: '12px 0', borderRadius: 8, background: 'var(--gold)', color: '#0a0a0a', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', width: '100%' }}
                >
                    🌐 Run Sync Matches
                </button>
            </div>

            {/* Bracket Bonus Recalculation card */}
            <div style={{ ...card, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 24 }}>🏆</span>
                    <div>
                        <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--gold)', lineHeight: 1 }}>Recalculate Bracket Bonuses</h3>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Scans all finished knockout matches and updates bracket bonus points for each player based on their original tournament prediction.</p>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        setLog(prev => ['🔄 Recalculating bracket bonuses...', ...prev])
                        const res = await fetch('/api/admin/bracket-bonus', {
                            method: 'POST',
                            headers: { 'x-scoring-secret': (document.getElementById('scoring-secret') as HTMLInputElement)?.value ?? '' }
                        })
                        const data = await res.json()
                        setLog(prev => [
                            res.ok ? `✅ Done! ${data.processedUsers} users, ${data.updatedScoreRows} score rows updated` : `❌ Error: ${data.error}`,
                            ...prev
                        ])
                    }}
                    style={{ ...btnGold, width: '100%', padding: '12px 0', fontSize: 14 }}
                >
                    🔢 Run Bracket Bonus Calculation
                </button>
            </div>

            {/* Admin-only scoring comparison card */}
            <div style={{ ...card, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 24 }}>#</span>
                        <div>
                            <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--blue-accent)', lineHeight: 1 }}>Scoring System Comparison</h3>
                            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Admin-only view comparing stored totals with the active formula.</p>
                        </div>
                    </div>
                    <button onClick={loadScoringComparison} disabled={loadingComparison} style={{ ...btnGold, opacity: loadingComparison ? 0.6 : 1 }}>
                        {loadingComparison ? 'Loading...' : 'Compare Systems'}
                    </button>
                </div>

                {comparison && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                            {[
                                { label: 'Finished matches', value: comparison.finished_matches },
                                { label: 'New total', value: comparison.totals.new_total },
                                { label: 'Legacy total', value: comparison.totals.legacy_total },
                                { label: 'Delta', value: comparison.totals.new_total - comparison.totals.legacy_total },
                            ].map(item => (
                                <div key={item.label} style={{ padding: 12, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--cream)', lineHeight: 1.1 }}>{item.value}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={th}>Player</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Current</th>
                                        <th style={{ ...th, textAlign: 'right' }}>New</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Old</th>
                                        <th style={{ ...th, textAlign: 'right' }}>New - Old</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparison.rows.slice(0, 20).map(row => (
                                        <tr key={row.user_id}>
                                            <td style={td}>
                                                <span style={{ color: 'var(--cream)', fontWeight: 600 }}>{row.display_name}</span>
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{row.email}</div>
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{row.current_total}</td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--gold)' }}>{row.new_total}</td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{row.legacy_total}</td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace', color: row.delta_new_vs_legacy >= 0 ? 'var(--green-bright)' : '#e05c4a' }}>
                                                {row.delta_new_vs_legacy > 0 ? '+' : ''}{row.delta_new_vs_legacy}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>


            <div style={{ ...card, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cream)' }}>
                        📋 Activity Log
                    </span>
                    <button onClick={() => setLog([])} style={btnSmall}>Clear</button>
                </div>
                <div style={{
                    maxHeight: 300, overflowY: 'auto', padding: 12, borderRadius: 8,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    fontFamily: 'DM Mono, monospace', fontSize: 12, lineHeight: 1.8,
                }}>
                    {log.length === 0 ? (
                        <span style={{ color: 'var(--muted)' }}>No actions yet. Run a simulation or reset to see output here.</span>
                    ) : (
                        log.map((line, i) => (
                            <div key={i} style={{ color: line.startsWith('✅') ? 'var(--green-bright)' : line.startsWith('❌') || line.startsWith('⚠️') ? '#e05c4a' : 'var(--dim)' }}>
                                {line}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Loading spinner ──────────────────────────────────────────────────────────

function Loading() {
    return (
        <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10, animation: 'spin 1s linear infinite' }}>⚽</div>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        </div>
    )
}
