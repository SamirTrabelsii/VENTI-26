import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES, getRobohashUrl } from '@/lib/wc2026-data'
import Nav from '@/components/Nav'
import { redirect } from 'next/navigation'
import LeaderboardClient, { LeaderboardUser } from './LeaderboardClient'
import { fetchAllRows } from '@/lib/supabase/pagination'

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
    const allProfiles = await fetchAllRows(
        supabase.from('profiles').select('id, display_name, avatar_initials, avatar_color').order('created_at', { ascending: true })
    )

    // 2. Fetch scores (deduplicated per user — take MAX across all group rows)
    const scoresData = await fetchAllRows(
        supabase.from('scores').select('user_id, total_points, exact_scores, correct_results, streak').order('total_points', { ascending: false })
    )

    const scoresMap = new Map<string, { total_points: number, exact_scores: number, correct_results: number, streak: number }>()
    for (const row of (scoresData || [])) {
        const existing = scoresMap.get(row.user_id)
        if (!existing || row.total_points > existing.total_points) {
            scoresMap.set(row.user_id, {
                total_points: row.total_points,
                exact_scores: row.exact_scores,
                correct_results: row.correct_results,
                streak: row.streak,
            })
        }
    }



    // 3. Fetch group prediction counts per user
    const groupPredData = await fetchAllRows(supabase.from('predictions').select('user_id'))
    const groupPredCounts = new Map<string, number>()
    for (const row of groupPredData) {
        groupPredCounts.set(row.user_id, (groupPredCounts.get(row.user_id) ?? 0) + 1)
    }

    // 4. Fetch bracket prediction counts per user
    const bracketPredData = await fetchAllRows(supabase.from('bracket_picks').select('user_id'))
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

    const initials = profile?.avatar_initials ?? 'PL'

    // 6. Fetch live matches and predictions for those matches to calculate live points
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    const liveMatches = await fetchAllRows(
        supabase.from('matches')
            .select('*')
            .neq('status', 'finished')
            .lte('kickoff', twoHoursFromNow)
    )

    let livePredictions: any[] = []
    if (liveMatches.length > 0) {
        livePredictions = await fetchAllRows(supabase.from('predictions').select('*').in('match_id', liveMatches.map((m: any) => m.id)))
    }

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
                    initialLiveMatches={liveMatches}
                    livePredictions={livePredictions}
                    currentUserId={user?.id}
                />
            </div>
        </div>
    )
}
