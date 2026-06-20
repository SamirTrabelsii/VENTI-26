// VENTI 26 scoring engine
//
// Current match scoring:
// - +10 for correct outcome (winner or draw)
// - +15 score proximity, penalized by total score error:
//   error 0 => +15, 1 => +10, 2 => +6, 3 => +3, 4 => +1, 5+ => +0
// - Knockout drawn matches can add +10 for the correct qualifier.
//
// Legacy scoring has been completely removed in favor of the active backend engine.

export interface BreakdownItem {
    rule: string
    pts: number
}

export interface ScoringResult {
    total: number
    breakdown: BreakdownItem[]
    // Legacy field kept so existing callers do not break.
    points: number
    type: 'exact' | 'correct' | 'goal_diff' | 'partial' | 'miss'
}

export interface ScoringOptions {
    predQualifier?: string | null
    realQualifier?: string | null
    isRepredicted?: boolean
    multiplier?: number
    isFixtureCorrect?: boolean
}

export const POINTS = {
    EXACT_SCORE: 25,
    CORRECT_OUTCOME: 10,
    PROXIMITY_MAX: 15,
    KNOCKOUT_QUALIFIER: 10,
    EARLY_LOCK: 2,
} as const

function outcome(home: number, away: number): 1 | 0 | -1 {
    if (home > away) return 1
    if (home < away) return -1
    return 0
}

function classifyType(breakdown: BreakdownItem[]): ScoringResult['type'] {
    const rules = breakdown.map(b => b.rule)
    if (rules.some(r => r.includes('Exact scoreline') || r.includes('error 0'))) return 'exact'
    if (rules.includes('Correct outcome')) return 'correct'
    if (breakdown.some(b => b.pts > 0)) return 'partial'
    return 'miss'
}

function toResult(breakdown: BreakdownItem[]): ScoringResult {
    const total = breakdown.reduce((s, b) => s + b.pts, 0)
    return {
        total,
        breakdown,
        points: total,
        type: classifyType(breakdown),
    }
}

function coreScore(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
): BreakdownItem[] {
    const breakdown: BreakdownItem[] = []

    const isCorrectOutcome = outcome(predHome, predAway) === outcome(realHome, realAway)
    const totalError = Math.abs(predHome - realHome) + Math.abs(predAway - realAway)

    if (isCorrectOutcome) {
        breakdown.push({ rule: 'Correct outcome', pts: POINTS.CORRECT_OUTCOME }) // +10
        
        let bonus = 0;
        if (totalError === 0) bonus = 15;
        else if (totalError === 1) bonus = 5;
        else if (totalError === 2) bonus = 0; // 10 + 0 = 10 pts total
        else if (totalError === 3) bonus = -5; // 10 - 5 = 5 pts total
        else if (totalError === 4) bonus = -8; // 10 - 8 = 2 pts total
        else bonus = -10; // 10 - 10 = 0 pts total
        
        if (bonus > 0) {
            breakdown.push({ rule: `Score proximity bonus (error ${totalError})`, pts: bonus })
        } else if (bonus < 0) {
            breakdown.push({ rule: `Score proximity penalty (error ${totalError >= 5 ? '5+' : totalError})`, pts: bonus })
        }
    } else {
        // Wrong Outcome (Mercy Rule)
        let mercyPts = 0;
        if (totalError === 1) mercyPts = 5;
        else if (totalError === 2) mercyPts = 2;
        else mercyPts = 0;
        
        if (mercyPts > 0) {
            breakdown.push({ rule: `Close miss mercy (error ${totalError})`, pts: mercyPts })
        }
    }

    // Goal / No Goal (BTTS) Consolation Bonus
    const realBTTS = realHome > 0 && realAway > 0;
    const predBTTS = predHome > 0 && predAway > 0;
    if (totalError > 0 && realBTTS === predBTTS) {
        breakdown.push({ rule: 'Goal/No-Goal Bonus', pts: 1 })
    }

    return breakdown
}

function applyKnockoutExtras(
    breakdown: BreakdownItem[],
    realHome: number,
    realAway: number,
    options: ScoringOptions,
): ScoringResult {
    const {
        predQualifier = null,
        realQualifier = null,
        isRepredicted = false,
        multiplier = 1,
        isFixtureCorrect = true,
    } = options

    if (outcome(realHome, realAway) === 0 && predQualifier && realQualifier && predQualifier === realQualifier) {
        breakdown.push({
            rule: 'Correct qualifier (knockout)',
            pts: POINTS.KNOCKOUT_QUALIFIER,
        })
    }

    let result = toResult(breakdown)

    if (!isRepredicted && isFixtureCorrect && multiplier > 1 && result.total > 0) {
        const bonus = (result.total * multiplier) - result.total
        breakdown.push({
            rule: `Original Prediction Multiplier (x${multiplier})`,
            pts: bonus,
        })
        result = toResult(breakdown)
    }

    return result
}

function scoreGroupMatch(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
): ScoringResult {
    return toResult(coreScore(predHome, predAway, realHome, realAway))
}

function scoreKnockoutMatch(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
    options: ScoringOptions = {},
): ScoringResult {
    if (!options.isRepredicted && options.isFixtureCorrect === false) {
        return {
            total: 0,
            breakdown: [{ rule: 'Invalid fixture (Original Prediction)', pts: 0 }],
            points: 0,
            type: 'miss',
        }
    }

    return applyKnockoutExtras(
        coreScore(predHome, predAway, realHome, realAway),
        realHome,
        realAway,
        options,
    )
}

export function scoreMatch(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
    isKnockout = false,
    options: ScoringOptions = {},
): ScoringResult {
    return isKnockout
        ? scoreKnockoutMatch(predHome, predAway, realHome, realAway, options)
        : scoreGroupMatch(predHome, predAway, realHome, realAway)
}

export function formatPoints(pts: number): string {
    return pts > 0 ? `+${pts}` : `${pts}`
}

export const SCORING_REFERENCE = {
    groupAndKnockout: [
        { pts: 10, label: 'Correct outcome', note: 'Right winner or draw. Miss the outcome and this bonus is lost.' },
        { pts: 15, label: 'Score proximity', note: 'Starts at +15 and penalizes Total Goal Error (sum of home & away goal difference). Correct outcome drops: Error 0=+15, 1=+5, 2=0, 3=-5, 4=-8, 5+=-10. Wrong outcome mercy: Error 1=+5, 2=+2, 3+=0.' },
        { pts: 1, label: 'Goal / No-Goal Bonus', note: '+1 point for correctly predicting if both teams score (Goal/Goal) or not (No Goal). Does not apply to Exact Scores.' },
        { pts: 25, label: 'Maximum score', note: 'Exact scoreline gives +10 outcome and +15 proximity.' },
    ],
    knockoutSupplement: [
        { pts: 10, label: 'Correct qualifier', note: 'Team that advances after penalties. Applies only when the 90-minute result is a draw.' },
        { pts: 35, label: 'Maximum knockout match', note: 'Exact score (25) + correct qualifier (10).' },
    ],
    originalMultipliers: [
        { round: 'R32', label: 'Round of 32', multiplier: 1.5, note: 'Your original locked prediction x 1.5' },
        { round: 'R16', label: 'Round of 16', multiplier: 2, note: 'Your original locked prediction x 2' },
        { round: 'QF', label: 'Quarter-Finals', multiplier: 3, note: 'Your original locked prediction x 3' },
        { round: 'SF', label: 'Semi-Finals', multiplier: 4, note: 'Your original locked prediction x 4' },
        { round: 'F', label: 'Final', multiplier: 5, note: 'Your original locked prediction x 5' },
    ],
    bracketBonuses: [
        { pts: 1, label: 'Per qualifier (R32)', note: 'Each original team pick that makes the Round of 32' },
        { pts: 2, label: 'Per qualifier (R16)', note: 'Each original team pick that reaches the Round of 16' },
        { pts: 4, label: 'Per qualifier (QF)', note: 'Each original team pick that reaches the Quarter-Finals' },
        { pts: 8, label: 'Per qualifier (SF)', note: 'Each original team pick that reaches the Semi-Finals' },
        { pts: 16, label: 'Per finalist', note: 'Each original team pick that reaches the Final' },
        { pts: 32, label: 'World Cup champion', note: 'If your original predicted champion wins it all' },
    ],
    lockRules: {
        deadline: '2026-06-11T19:00:00Z',
        label: 'Opening Kickoff Lock - June 11',
        note: 'Original group predictions and original bracket picks lock at the first match kickoff. Live knockout re-predictions open later only for known knockout fixtures and lock per match at kickoff.',
    },
}
