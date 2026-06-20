// VENTI 26 scoring engine
//
// Base match scoring:
// - Exact scoreline: 25 points, with no other scoreline bonuses.
// - Non-exact correct result: 10 points + a goal-accuracy bonus.
// - Draw/win mismatch: only an error-1 prediction can earn 5 goal-accuracy points.
// - Full winner reversal: no result or goal-accuracy points.
// - BTTS / same-team clean sheet: +3 on any non-exact prediction.
// - Knockout matches can add +5 for the correct team that advances.

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
    CORRECT_RESULT: 10,
    KNOCKOUT_QUALIFIER: 5,
    BTTS_OR_CLEAN_SHEET: 3,
    EARLY_LOCK: 2,
} as const

function outcome(home: number, away: number): 1 | 0 | -1 {
    if (home > away) return 1
    if (home < away) return -1
    return 0
}

function classifyType(breakdown: BreakdownItem[]): ScoringResult['type'] {
    const rules = breakdown.map(b => b.rule)
    if (rules.includes('Perfect prediction')) return 'exact'
    if (rules.includes('Correct match result')) return 'correct'
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

    const predictedOutcome = outcome(predHome, predAway)
    const actualOutcome = outcome(realHome, realAway)
    const isCorrectOutcome = predictedOutcome === actualOutcome
    const isExact = predHome === realHome && predAway === realAway
    const totalError = Math.abs(predHome - realHome) + Math.abs(predAway - realAway)

    if (isExact) {
        return [{ rule: 'Perfect prediction', pts: POINTS.EXACT_SCORE }]
    }

    if (isCorrectOutcome) {
        breakdown.push({ rule: 'Correct match result', pts: POINTS.CORRECT_RESULT })

        const bonus = goalAccuracyBonus(totalError)
        if (bonus > 0) {
            breakdown.push({ rule: `Goal accuracy bonus (off by ${totalError})`, pts: bonus })
        }
    } else {
        const isDrawWinMismatch = predictedOutcome === 0 || actualOutcome === 0
        if (isDrawWinMismatch && totalError === 1) {
            breakdown.push({ rule: 'Draw/win close-score bonus', pts: 5 })
        }
    }

    if (hasBttsOrSameCleanSheetBonus(predHome, predAway, realHome, realAway)) {
        breakdown.push({ rule: 'Goal-Goal/No Goal bonus', pts: POINTS.BTTS_OR_CLEAN_SHEET })
    }

    return breakdown
}

function goalAccuracyBonus(totalError: number): number {
    if (totalError === 1) return 5
    if (totalError === 2) return 4
    if (totalError === 3) return 3
    if (totalError === 4) return 2
    if (totalError === 5) return 1
    return 0
}

function hasBttsOrSameCleanSheetBonus(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
): boolean {
    const predictedBothTeamsScored = predHome > 0 && predAway > 0
    const actualBothTeamsScored = realHome > 0 && realAway > 0
    if (predictedBothTeamsScored && actualBothTeamsScored) return true

    const predictedHomeShutOut = predHome === 0
    const predictedAwayShutOut = predAway === 0
    const actualHomeShutOut = realHome === 0
    const actualAwayShutOut = realAway === 0

    return (
        (predictedHomeShutOut && actualHomeShutOut) ||
        (predictedAwayShutOut && actualAwayShutOut)
    )
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

    if (predQualifier && realQualifier && predQualifier === realQualifier) {
        breakdown.push({
            rule: 'Correct advancing team (knockout)',
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
        { pts: 25, label: 'Perfect prediction', note: 'Exact scoreline. This caps the scoreline rules, so no result, goal-accuracy, or BTTS/clean-sheet bonus is added.' },
        { pts: 10, label: 'Correct match result', note: 'Right home win, draw, or away win when the score is not exact.' },
        { pts: '5/4/3/2/1' as const, label: 'Goal accuracy bonus', note: 'Only with a correct result: off by 1 to 5 total goals. Off by more than 5 earns no accuracy bonus.' },
        { pts: 5, label: 'Draw/win close miss', note: 'If one side predicted a draw and the other had a winner, only an off-by-1 score earns this bonus.' },
    ],
    knockoutSupplement: [
        { pts: 5, label: 'Correct advancing team', note: 'Team that advances to the next round, regardless of the scoreline result.' },
        { pts: 30, label: 'Live knockout maximum', note: 'Exact score (25) + correct advancing team (5), before original-prediction multipliers.' },
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
