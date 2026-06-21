import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES } from '@/lib/wc2026-data'
import Nav from '@/components/Nav'
import LeaderboardClient, { LeaderboardUser } from './LeaderboardClient'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { scoreMatch } from '@/lib/scoring'

const GROUP_TOTAL = GROUP_MATCHES.length   // 72
const KNOCKOUT_TOTAL = 32                  // R32(16)+R16(8)+QF(4)+SF(2)+3rd(1)+Final(1)
const TOTAL_MATCHES = GROUP_TOTAL + KNOCKOUT_TOTAL  // 104

function isKnockoutMatch(match: any) {
    return match.stage ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage) : false
}

function matchIdForPick(pick: any) {
    if (pick.round === 'final' || pick.round === 'third_place') return pick.round
    return `${pick.round}_${pick.slot_index + 1}`
}

function computeFreshScores(
    userIds: string[],
    finishedMatches: any[],
    predictions: any[],
    bracketPicks: any[],
    bracketBonusByUser: Map<string, number>,
) {
    const predictionByUserMatch = new Map<string, any>()
    for (const p of predictions) predictionByUserMatch.set(`${p.user_id}:${p.match_id}`, p)
    for (const bp of bracketPicks) {
        const matchId = matchIdForPick(bp)
        predictionByUserMatch.set(`${bp.user_id}:${matchId}`, {
            ...bp,
            match_id: matchId,
            qualifier_pick: bp.team_code,
        })
    }

    const totals = new Map<string, { total_points: number; exact_scores: number; correct_results: number; streak: number }>()

    for (const userId of userIds) {
        let total_points = bracketBonusByUser.get(userId) ?? 0
        let exact_scores = 0
        let correct_results = 0
        let streak = 0

        for (const match of finishedMatches) {
            const prediction = predictionByUserMatch.get(`${userId}:${match.id}`)
            if (!prediction) {
                streak = 0
                continue
            }

            const predHome = !prediction.is_repredicted && typeof prediction.original_home_score === 'number'
                ? prediction.original_home_score
                : prediction.home_score
            const predAway = !prediction.is_repredicted && typeof prediction.original_away_score === 'number'
                ? prediction.original_away_score
                : prediction.away_score

            if (typeof predHome !== 'number' || typeof predAway !== 'number') {
                streak = 0
                continue
            }

            const isKnockout = isKnockoutMatch(match)
            const isFixtureCorrect = !isKnockout ||
                !prediction.predicted_home_team ||
                !prediction.predicted_away_team ||
                (prediction.predicted_home_team === match.home_team && prediction.predicted_away_team === match.away_team)

            const result = scoreMatch(predHome, predAway, match.home_score, match.away_score, isKnockout, {
                predQualifier: prediction.qualifier_pick || prediction.qualifier || prediction.team_code || null,
                realQualifier: match.qualifier || null,
                isRepredicted: !!prediction.is_repredicted,
                multiplier: match.multiplier || 1,
                isFixtureCorrect,
            })

            total_points += result.total

            if (result.type === 'exact') exact_scores++
            if (['exact', 'correct', 'goal_diff'].includes(result.type)) {
                correct_results++
                streak++
            } else {
                streak = 0
            }
        }

        totals.set(userId, { total_points, exact_scores, correct_results, streak })
    }

    return totals
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
    const allProfiles = await fetchAllRows(
        supabase.from('profiles').select('id, display_name, avatar_initials, avatar_color').order('created_at', { ascending: true })
    )

    // 2. Fetch raw prediction data and recompute totals instead of trusting cached scores.
    const [groupPredData, bracketPredData, scoresData, finishedMatchesData] = await Promise.all([
        fetchAllRows(supabase.from('predictions').select('*')),
        fetchAllRows(supabase.from('bracket_picks').select('*')),
        fetchAllRows(supabase.from('scores').select('user_id, bracket_bonus_points')),
        fetchAllRows(supabase.from('matches').select('*').eq('status', 'finished')),
    ])



    // 3. Fetch group prediction counts per user
    const groupPredCounts = new Map<string, number>()
    for (const row of groupPredData) {
        groupPredCounts.set(row.user_id, (groupPredCounts.get(row.user_id) ?? 0) + 1)
    }

    // 4. Fetch bracket prediction counts per user
    const bracketPredCounts = new Map<string, number>()
    for (const row of bracketPredData) {
        bracketPredCounts.set(row.user_id, (bracketPredCounts.get(row.user_id) ?? 0) + 1)
    }

    const bracketBonusByUser = new Map<string, number>()
    for (const row of scoresData) {
        const current = bracketBonusByUser.get(row.user_id) ?? 0
        bracketBonusByUser.set(row.user_id, Math.max(current, row.bracket_bonus_points ?? 0))
    }

    const finishedMatches = finishedMatchesData
        .filter((m: any) => m.home_score !== null && m.away_score !== null)
        .sort((a: any, b: any) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

    const scoresMap = computeFreshScores(
        (allProfiles || []).map(p => p.id),
        finishedMatches,
        groupPredData,
        bracketPredData,
        bracketBonusByUser,
    )

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
