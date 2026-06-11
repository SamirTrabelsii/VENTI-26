import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES, getRobohashUrl } from '@/lib/wc2026-data'
import Nav from '@/components/Nav'
import { redirect } from 'next/navigation'
import LeaderboardClient, { LeaderboardUser } from './LeaderboardClient'

const GROUP_TOTAL = GROUP_MATCHES.length   // 72
const KNOCKOUT_TOTAL = 32                  // R32(16)+R16(8)+QF(4)+SF(2)+3rd(1)+Final(1)
const TOTAL_MATCHES = GROUP_TOTAL + KNOCKOUT_TOTAL  // 104



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
    async function fetchAll(table: string, columns: string) {
        const allData: any[] = []
        let hasMore = true
        let start = 0
        while (hasMore) {
            const { data } = await supabase.from(table).select(columns).range(start, start + 999)
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
    const groupPredData = await fetchAll('predictions', 'user_id')
    const groupPredCounts = new Map<string, number>()
    for (const row of groupPredData) {
        groupPredCounts.set(row.user_id, (groupPredCounts.get(row.user_id) ?? 0) + 1)
    }

    // 4. Fetch bracket prediction counts per user
    const bracketPredData = await fetchAll('bracket_picks', 'user_id')
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

    // 6. Fetch ALL predictions for the Live Prediction Matrix
    // This is safe for a few thousand users. It allows the client to do O(N) scoring dynamically without 
    // requiring complex server-sent events for every goal.
    const allPredictions = await fetchAll('predictions', 'user_id, match_id, home_score, away_score')

    // 7. Fetch DB match status so we know which matches are already officially synced
    const { data: dbMatches } = await supabase.from('matches').select('id, status')
    const dbMatchStatusMap = new Map<string, string>()
    if (dbMatches) {
        dbMatches.forEach(m => dbMatchStatusMap.set(m.id, m.status))
    }

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

                <LeaderboardClient
                    initialLeaderboard={leaderboard}
                    predictions={allPredictions}
                    currentUserId={user?.id}
                    dbMatchStatuses={Object.fromEntries(dbMatchStatusMap)}
                />
            </div>
        </div>
    )
}
