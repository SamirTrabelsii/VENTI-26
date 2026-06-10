// ─────────────────────────────────────────────────────────────────────────────
// VENTI 26 — Scoring Engine
// ─────────────────────────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  POINTS SYSTEM — same rules apply to group stage AND knockout phase     │
// ├─────────────────────────────────────────────────────────────────────────┤
// │  +25  Exact scoreline          e.g. predicted 2-1, result 2-1          │
// │  +10  Correct outcome          right winner OR right draw, wrong score  │
// │  + 5  Correct goal difference  only when outcome correct + not a draw   │
// │  + 1  Correct goals one team   per team, NOT awarded on exact score     │
// ├─────────────────────────────────────────────────────────────────────────┤
// │  KNOCKOUT SUPPLEMENT (draws that go to penalties)                       │
// │  +10  Correct qualifier        team that actually advances              │
// │                                                                         │
// │  Max per knockout match = 35 pts (25 exact + 10 qualifier)              │
// │  The qualifier bonus ONLY applies when the 90-min result is a draw      │
// │  and the match goes to extra time / penalties.                          │
// ├─────────────────────────────────────────────────────────────────────────┤
// │  WORKED EXAMPLES                                                        │
// │  Pred 2-1 / Real 2-1               → +25 (exact)                       │
// │  Pred 3-1 / Real 2-0               → +10 +5 = +15 (outcome+diff)       │
// │  Pred 3-1 / Real 2-1               → +10 +0 +1 = +11 (out+away goal)   │
// │  Pred 2-1 / Real 2-3               → +1 (home goals = 2 in both)       │
// │  Pred 1-1 / Real 0-0               → +10 (draw, no diff rule)          │
// │  Pred 2-0 / Real 1-0               → +10 +5 +1 = +16 (out+diff+away)   │
// │  Pred 2-2 / Real 2-2 / qual ✓      → +25 +10 = +35 (exact+qualifier)   │
// │  Pred 2-2 / Real 2-2 / qual ✗      → +25 (exact, wrong qualifier)      │
// │  Pred 1-1 / Real 0-0 / qual ✓      → +10 +10 = +20 (draw+qualifier)    │
// └─────────────────────────────────────────────────────────────────────────┘

export interface BreakdownItem {
    rule: string
    pts: number
}

export interface ScoringResult {
    total: number
    breakdown: BreakdownItem[]
    // Legacy field kept so existing callers (route.ts) don't break
    points: number
    type: 'exact' | 'correct' | 'goal_diff' | 'partial' | 'miss'
}

export const POINTS = {
    EXACT_SCORE: 25,
    CORRECT_OUTCOME: 10,
    CORRECT_GOAL_DIFF: 5,
    CORRECT_TEAM_GOALS: 1,  // per team, max ×2 per match
    KNOCKOUT_QUALIFIER: 10,
    EARLY_LOCK: 2,  // displayed in UI, applied separately
} as const

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

function outcome(home: number, away: number): 1 | 0 | -1 {
    if (home > away) return 1
    if (home < away) return -1
    return 0
}

function classifyType(breakdown: BreakdownItem[]): ScoringResult['type'] {
    const rules = breakdown.map(b => b.rule)
    if (rules.includes('Exact scoreline')) return 'exact'
    if (rules.includes('Correct goal difference')) return 'goal_diff'
    if (rules.includes('Correct outcome')) return 'correct'
    if (breakdown.length > 0) return 'partial'
    return 'miss'
}

// ─── CORE SCORER (group stage rules, no qualifier) ────────────────────────────

function coreScore(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
): BreakdownItem[] {
    const bd: BreakdownItem[] = []

    // ── Rule 1: Exact scoreline ──────────────────────────────────────────────
    const isExact = predHome === realHome && predAway === realAway
    if (isExact) {
        bd.push({ rule: 'Exact scoreline', pts: POINTS.EXACT_SCORE })
        // Exact score is terminal — no other rules apply
        return bd
    }

    // ── Rule 2: Correct outcome ──────────────────────────────────────────────
    const predOutcome = outcome(predHome, predAway)
    const realOutcome = outcome(realHome, realAway)

    if (predOutcome === realOutcome) {
        bd.push({ rule: 'Correct outcome', pts: POINTS.CORRECT_OUTCOME })

        // ── Rule 3: Goal difference (non-draws only) ─────────────────────────
        if (predOutcome !== 0) {
            const predDiff = Math.abs(predHome - predAway)
            const realDiff = Math.abs(realHome - realAway)
            if (predDiff === realDiff) {
                bd.push({ rule: 'Correct goal difference', pts: POINTS.CORRECT_GOAL_DIFF })
            }
        }
        // For draws: rule 3 does NOT apply (stated explicitly in spec)
    }

    // ── Rule 4: Individual team goals (independent of outcome, not on exact) ─
    if (predHome === realHome) {
        bd.push({ rule: 'Correct home team goals', pts: POINTS.CORRECT_TEAM_GOALS })
    }
    if (predAway === realAway) {
        bd.push({ rule: 'Correct away team goals', pts: POINTS.CORRECT_TEAM_GOALS })
    }

    return bd
}

// ─── PUBLIC: GROUP STAGE ──────────────────────────────────────────────────────

export function scoreGroupMatch(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
): ScoringResult {
    const breakdown = coreScore(predHome, predAway, realHome, realAway)
    const total = breakdown.reduce((s, b) => s + b.pts, 0)
    return {
        total,
        breakdown,
        points: total,           // legacy alias
        type: classifyType(breakdown),
    }
}

// ─── PUBLIC: KNOCKOUT STAGE ───────────────────────────────────────────────────
//
// predQualifier / realQualifier: the team code that the player picked /
// that actually advanced (e.g. 'BRA', 'FRA').
// Pass null for realQualifier when the match result is not yet known.
//
// The qualifier bonus ONLY makes sense when the 90-min result is a draw
// (the match went to extra time / penalties). For non-draw knockout results,
// the winner is already determined by the 90-min score so no bonus applies.

export interface ScoringOptions {
    predQualifier?: string | null
    realQualifier?: string | null
    isRepredicted?: boolean
    multiplier?: number
    isFixtureCorrect?: boolean
}

export function scoreKnockoutMatch(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
    options: ScoringOptions = {}
): ScoringResult {
    const {
        predQualifier = null,
        realQualifier = null,
        isRepredicted = false,
        multiplier = 1,
        isFixtureCorrect = true,
    } = options

    // Fixture Validation Rule: If using original prediction and teams are wrong -> 0 points
    if (!isRepredicted && !isFixtureCorrect) {
        return {
            total: 0,
            breakdown: [{ rule: 'Invalid fixture (Original Prediction)', pts: 0 }],
            points: 0,
            type: 'miss'
        }
    }

    const breakdown = coreScore(predHome, predAway, realHome, realAway)

    // ── Qualifier bonus — only when result is a draw (penalties situation) ───
    const realOutcome = outcome(realHome, realAway)
    const isDraw = realOutcome === 0

    if (isDraw && predQualifier && realQualifier) {
        if (predQualifier === realQualifier) {
            breakdown.push({
                rule: 'Correct qualifier (knockout)',
                pts: POINTS.KNOCKOUT_QUALIFIER,
            })
        }
    }

    let total = breakdown.reduce((s, b) => s + b.pts, 0)

    // Original Prediction Multiplier
    if (!isRepredicted && isFixtureCorrect && multiplier > 1 && total > 0) {
        const bonus = (total * multiplier) - total
        breakdown.push({
            rule: `Original Prediction Multiplier (x${multiplier})`,
            pts: bonus
        })
        total *= multiplier
    }

    return {
        total,
        breakdown,
        points: total,
        type: classifyType(breakdown),
    }
}

// ─── PUBLIC: UNIFIED ENTRY POINT ──────────────────────────────────────────────

export function scoreMatch(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
    isKnockout = false,
    options: ScoringOptions = {}
): ScoringResult {
    return isKnockout
        ? scoreKnockoutMatch(predHome, predAway, realHome, realAway, options)
        : scoreGroupMatch(predHome, predAway, realHome, realAway)
}

// ─── FORMATTING ───────────────────────────────────────────────────────────────

export function formatPoints(pts: number): string {
    return pts > 0 ? `+${pts}` : `${pts}`
}

// ─── SCORING REFERENCE (used in UI — insights page formula display) ───────────

export const SCORING_REFERENCE = {
    groupAndKnockout: [
        { pts: 25, label: 'Exact score', note: 'Perfect scoreline — terminal, no other rules stack' },
        { pts: 10, label: 'Correct outcome', note: 'Right winner or draw, any scoreline' },
        { pts: 5, label: 'Goal difference', note: 'Right margin — only on non-draw correct outcomes' },
        { pts: 1, label: 'Team goals (per team)', note: 'One team\'s tally matches — not awarded on exact score' },
    ],
    knockoutSupplement: [
        { pts: 10, label: 'Correct qualifier', note: 'Team that advances after penalties — only on drawn 90-min results' },
        { pts: 35, label: 'Maximum per match', note: 'Exact score (25) + correct qualifier (10)' },
    ],
    originalMultipliers: [
        { round: 'R32', label: 'Round of 32', multiplier: 1.5, note: 'Your original locked prediction × 1.5' },
        { round: 'R16', label: 'Round of 16', multiplier: 2, note: 'Your original locked prediction × 2' },
        { round: 'QF', label: 'Quarter-Finals', multiplier: 3, note: 'Your original locked prediction × 3' },
        { round: 'SF', label: 'Semi-Finals', multiplier: 4, note: 'Your original locked prediction × 4' },
        { round: 'F', label: 'Final', multiplier: 5, note: 'Your original locked prediction × 5' },
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
        deadline: '2026-06-11T13:00:00Z',
        label: 'Opening Kickoff Lock - June 11',
        note: 'Original group predictions and original bracket picks lock at the first match kickoff. Live knockout re-predictions open later only for known knockout fixtures and lock per match at kickoff.',
    },
}
