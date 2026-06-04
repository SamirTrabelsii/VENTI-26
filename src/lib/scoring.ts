export interface ScoringResult {
    points: number
    type: 'exact' | 'goal_diff' | 'correct' | 'partial' | 'miss'
}

export const POINTS = {
    EXACT_SCORE: 20,
    CORRECT_RESULT: 10,
    GOAL_DIFF: 5,
    HOME_GOALS: 1,
    AWAY_GOALS: 1,
    KNOCKOUT_WIN: 10,
    QUARTER_WIN: 15,
    SEMI_WIN: 20,
    FINAL_WIN: 30,
    CHAMPION: 50,
    EARLY_LOCK: 2,
} as const

export function scoreMatch(
    predicted_home: number,
    predicted_away: number,
    actual_home: number,
    actual_away: number
): ScoringResult {
    if (predicted_home === actual_home && predicted_away === actual_away) {
        return { points: POINTS.EXACT_SCORE, type: 'exact' }
    }
    
    let points = 0;
    let type: ScoringResult['type'] = 'miss';
    
    const predictedResult = Math.sign(predicted_home - predicted_away)
    const actualResult = Math.sign(actual_home - actual_away)
    
    if (predictedResult === actualResult) {
        points += POINTS.CORRECT_RESULT;
        type = 'correct';
        
        const predictedDiff = predicted_home - predicted_away
        const actualDiff = actual_home - actual_away
        if (predictedDiff === actualDiff) {
            points += POINTS.GOAL_DIFF;
            type = 'goal_diff';
        }
    }
    
    if (predicted_home === actual_home) {
        points += POINTS.HOME_GOALS;
    }
    
    if (predicted_away === actual_away) {
        points += POINTS.AWAY_GOALS;
    }
    
    if (points > 0 && type === 'miss') {
        type = 'partial';
    }
    
    return { points, type }
}

export function formatPoints(pts: number): string {
    return pts > 0 ? `+${pts}` : `${pts}`
}