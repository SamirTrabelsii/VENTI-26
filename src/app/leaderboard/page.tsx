import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES, getRobohashUrl } from '@/lib/wc2026-data'
import Nav from '@/components/Nav'
import { redirect } from 'next/navigation'

const GROUP_TOTAL = GROUP_MATCHES.length   // 72
const KNOCKOUT_TOTAL = 32                  // R32(16)+R16(8)+QF(4)+SF(2)+3rd(1)+Final(1)
const TOTAL_MATCHES = GROUP_TOTAL + KNOCKOUT_TOTAL  // 104

interface LeaderboardUser {
    id: string
    display_name: string
    avatar_initials: string
    avatar_color: string
    total_points: number
    exact_scores: number
    correct_results: number
    streak: number
    group_preds: number
    bracket_preds: number
    total_preds: number
}

export default async function LeaderboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let profile = null
    if (user) {
        const { data: profileData } = await supabase
            .from('profiles').select('*').eq('id', user.id).single()
        profile = profileData
    }

    // 1. Fetch ALL registered users
    const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_initials, avatar_color')
        .order('created_at', { ascending: true })

    // 2. Fetch scores (deduplicated per user)
    const { data: scoresData } = await supabase
        .from('scores')
        .select('user_id, total_points, exact_scores, correct_results, streak')
        .order('total_points', { ascending: false })

    const scoresMap = new Map<string, { total_points: number, exact_scores: number, correct_results: number, streak: number }>()
    for (const row of (scoresData || [])) {
        if (!scoresMap.has(row.user_id)) {
            scoresMap.set(row.user_id, {
                total_points: row.total_points,
                exact_scores: row.exact_scores,
                correct_results: row.correct_results,
                streak: row.streak,
            })
        }
    }

    // Helper to fetch all rows beyond 1000 limit
    async function fetchAllUserIds(table: string) {
        const allData: any[] = []
        let hasMore = true
        let start = 0
        while (hasMore) {
            const { data } = await supabase.from(table).select('user_id').range(start, start + 999)
            if (data && data.length > 0) {
                allData.push(...data)
                start += 1000
                if (data.length < 1000) hasMore = false
            } else {
                hasMore = false
            }
        }
        return allData
    }

    // 3. Fetch group prediction counts per user
    const groupPredData = await fetchAllUserIds('predictions')
    const groupPredCounts = new Map<string, number>()
    for (const row of groupPredData) {
        groupPredCounts.set(row.user_id, (groupPredCounts.get(row.user_id) ?? 0) + 1)
    }

    // 4. Fetch bracket prediction counts per user
    const bracketPredData = await fetchAllUserIds('bracket_picks')
    const bracketPredCounts = new Map<string, number>()
    for (const row of bracketPredData) {
        bracketPredCounts.set(row.user_id, (bracketPredCounts.get(row.user_id) ?? 0) + 1)
    }

    // 5. Build unified leaderboard with all users
    const leaderboard: LeaderboardUser[] = (allProfiles || []).map(p => {
        const score = scoresMap.get(p.id)
        const groupPreds = groupPredCounts.get(p.id) ?? 0
        const bracketPreds = bracketPredCounts.get(p.id) ?? 0
        return {
            id: p.id,
            display_name: p.display_name ?? 'Player',
            avatar_initials: p.avatar_initials ?? '??',
            avatar_color: p.avatar_color ?? '#555',
            total_points: score?.total_points ?? 0,
            exact_scores: score?.exact_scores ?? 0,
            correct_results: score?.correct_results ?? 0,
            streak: score?.streak ?? 0,
            group_preds: groupPreds,
            bracket_preds: bracketPreds,
            total_preds: groupPreds + bracketPreds,
        }
    })

    // Sort: by points descending, then by prediction progress descending, then by name
    leaderboard.sort((a, b) =>
        b.total_points - a.total_points
        || b.total_preds - a.total_preds
        || a.display_name.localeCompare(b.display_name)
    )

    const initials = profile?.avatar_initials ?? 'PL'

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={initials} isGuest={!user} />

            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '100px 5% 60px' }}>
                <div style={{ marginBottom: 40, textAlign: 'center' }}>
                    <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 64, color: 'var(--cream)', letterSpacing: 1, lineHeight: 1 }}>
                        GLOBAL <span style={{ color: 'var(--gold)' }}>LEADERBOARD</span>
                    </h1>
                    <p style={{ color: 'var(--muted)', marginTop: 8 }}>
                        {leaderboard.length} registered predictor{leaderboard.length !== 1 ? 's' : ''} · {TOTAL_MATCHES} matches to predict
                    </p>
                </div>

                <style>{`
                    @media (max-width: 640px) {
                        .hide-on-mobile { display: none !important; }
                    }
                `}</style>
                <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 18,
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', padding: '16px 20px',
                        borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
                        fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
                        textTransform: 'uppercase', color: 'var(--muted)'
                    }}>
                        <div style={{ width: 40, textAlign: 'center' }}>Rank</div>
                        <div style={{ flex: 1, paddingLeft: 16 }}>Player</div>
                        <div className="hide-on-mobile" style={{ width: 130, textAlign: 'center' }}>Progress</div>
                        <div className="hide-on-mobile" style={{ width: 70, textAlign: 'center' }}>Exact</div>
                        <div className="hide-on-mobile" style={{ width: 70, textAlign: 'center' }}>Correct</div>
                        <div style={{ width: 100, textAlign: 'right' }}>Total Pts</div>
                    </div>

                    {/* Rows */}
                    {leaderboard.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
                            No users have signed up yet.
                        </div>
                    ) : (
                        leaderboard.map((row, index) => {
                            const isMe = user && row.id === user.id
                            const progressPct = Math.round((row.total_preds / TOTAL_MATCHES) * 100)

                            // Progress status
                            let progressColor = 'var(--muted)'
                            let progressLabel = 'Not started'
                            if (progressPct === 100) {
                                progressColor = 'var(--green-bright)'
                                progressLabel = 'Complete'
                            } else if (progressPct > 0) {
                                progressColor = 'var(--gold)'
                                progressLabel = `${row.total_preds}/${TOTAL_MATCHES}`
                            }

                            return (
                                <div key={row.id} style={{
                                    display: 'flex', alignItems: 'center', padding: '14px 20px',
                                    borderBottom: '1px solid var(--border)',
                                    background: isMe ? 'rgba(212,168,67,0.06)' : 'transparent',
                                    transition: 'background 0.15s',
                                }}>
                                    {/* Rank */}
                                    <div style={{
                                        width: 40, textAlign: 'center',
                                        fontFamily: 'Bebas Neue', fontSize: 24,
                                        color: index < 3 ? 'var(--gold)' : 'var(--muted)'
                                    }}>
                                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                                    </div>

                                    {/* Player */}
                                    <div style={{ flex: 1, paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <img
                                            src={getRobohashUrl(row.display_name, 60)}
                                            alt={row.display_name}
                                            style={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                background: row.avatar_color,
                                                flexShrink: 0,
                                                objectFit: 'cover',
                                            }}
                                        />
                                        <div>
                                            <div style={{ fontSize: 15, fontWeight: 600, color: isMe ? 'var(--gold)' : 'var(--cream)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {row.display_name}
                                                {isMe && <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--gold)', color: '#000', borderRadius: 4, fontWeight: 700 }}>YOU</span>}
                                            </div>
                                            {row.streak > 0 && (
                                                <div style={{ fontSize: 11, color: '#e05c4a', marginTop: 2 }}>
                                                    🔥 {row.streak} streak
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="hide-on-mobile" style={{ width: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <div style={{
                                            width: '100%', height: 6, borderRadius: 3,
                                            background: 'var(--surface3)', overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                height: '100%', borderRadius: 3,
                                                background: progressPct === 100
                                                    ? 'var(--green-bright)'
                                                    : progressPct > 0
                                                        ? 'var(--gold)'
                                                        : 'transparent',
                                                width: `${progressPct}%`,
                                                transition: 'width 0.6s ease',
                                            }} />
                                        </div>
                                        <div style={{
                                            fontSize: 10, fontWeight: 600, color: progressColor,
                                            letterSpacing: 0.5,
                                        }}>
                                            {progressLabel}
                                        </div>
                                    </div>

                                    {/* Exact */}
                                    <div className="hide-on-mobile" style={{ width: 70, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
                                        {row.exact_scores}
                                    </div>

                                    {/* Correct */}
                                    <div className="hide-on-mobile" style={{ width: 70, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
                                        {row.correct_results}
                                    </div>

                                    {/* Total Points */}
                                    <div style={{
                                        width: 100, textAlign: 'right',
                                        fontFamily: 'Bebas Neue', fontSize: 28,
                                        color: row.total_points > 0 ? 'var(--cream)' : 'var(--muted)',
                                    }}>
                                        {row.total_points}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
