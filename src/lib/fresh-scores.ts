import { scoreMatch } from '@/lib/scoring'

export interface FreshScoreTotals {
    total_points: number
    exact_scores: number
    correct_results: number
    streak: number
}

function isKnockoutMatch(match: any) {
    return match.stage ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage) : false
}

function matchIdForPick(pick: any) {
    if (pick.round === 'final' || pick.round === 'third_place') return pick.round
    return `${pick.round}_${pick.slot_index + 1}`
}

export function computeFreshScores(
    userIds: string[],
    finishedMatches: any[],
    predictions: any[],
    bracketPicks: any[],
    bracketBonusByUser: Map<string, number> = new Map(),
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

    const totals = new Map<string, FreshScoreTotals>()

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
