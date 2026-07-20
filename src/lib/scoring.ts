// ─────────────────────────────────────────────────────────────
// VENTI 26 — Scoring Engine
//
// Group stage & Knockout (same base rules):
//   Exact scoreline          → 25 pts  (nothing else added)
//   Correct result (not exact) → 10 pts + goal accuracy bonus
//   Goal accuracy bonus      → off by 1→+5, 2→+4, 3→+3, 4→+2, 5→+1
//   Draw/win mismatch        → +5 only if off by exactly 1 goal total
//   BTTS or same clean sheet → +3 on any non-exact prediction
//
// Knockout only (on top of base):
//   Correct qualifier (advancing team) → +10 pts
//
// Group stage qualifier bonus (awarded once after group phase, stored separately):
//   +1 pt per team correctly predicted to reach R32
// ─────────────────────────────────────────────────────────────

export interface BreakdownItem {
  rule: string;
  pts: number;
}

export interface ScoringResult {
  total: number;
  breakdown: BreakdownItem[];
  /** Kept for backwards compatibility with existing callers */
  points: number;
  type: "exact" | "correct" | "partial" | "miss";
}

export interface ScoringOptions {
  /** The team code the user predicted to advance (knockout only) */
  predQualifier?: string | null;
  /** The team code that actually advanced (from matches.qualifier) */
  realQualifier?: string | null;
}

export const POINTS = {
  EXACT_SCORE: 25,
  CORRECT_RESULT: 10,
  KNOCKOUT_QUALIFIER: 10,
  BTTS_OR_CLEAN_SHEET: 3,
  GROUP_QUALIFIER_BONUS: 1,
} as const;

// ─── Internal helpers ──────────────────────────────────────────

function outcome(home: number, away: number): 1 | 0 | -1 {
  if (home > away) return 1;
  if (home < away) return -1;
  return 0;
}

function goalAccuracyBonus(totalError: number): number {
  if (totalError === 1) return 5;
  if (totalError === 2) return 4;
  if (totalError === 3) return 3;
  if (totalError === 4) return 2;
  if (totalError === 5) return 1;
  return 0;
}

function hasBttsOrCleanSheetBonus(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
): boolean {
  // Both teams scored in both prediction and reality
  if (predHome > 0 && predAway > 0 && realHome > 0 && realAway > 0) return true;

  // Same clean sheet side in both prediction and reality
  if (predHome === 0 && realHome === 0) return true;
  if (predAway === 0 && realAway === 0) return true;

  return false;
}

function classifyType(breakdown: BreakdownItem[]): ScoringResult["type"] {
  const rules = breakdown.map((b) => b.rule);
  if (rules.includes("Perfect prediction")) return "exact";
  if (rules.includes("Correct match result")) return "correct";
  if (breakdown.some((b) => b.pts > 0)) return "partial";
  return "miss";
}

function toResult(breakdown: BreakdownItem[]): ScoringResult {
  const total = breakdown.reduce((s, b) => s + b.pts, 0);
  return { total, breakdown, points: total, type: classifyType(breakdown) };
}

// ─── Core match scoring (group & knockout base) ────────────────

function coreScore(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
): BreakdownItem[] {
  const breakdown: BreakdownItem[] = [];

  const isExact = predHome === realHome && predAway === realAway;
  if (isExact) {
    return [{ rule: "Perfect prediction", pts: POINTS.EXACT_SCORE }];
  }

  const predictedOutcome = outcome(predHome, predAway);
  const actualOutcome = outcome(realHome, realAway);
  const isCorrectOutcome = predictedOutcome === actualOutcome;
  const totalError =
    Math.abs(predHome - realHome) + Math.abs(predAway - realAway);

  if (isCorrectOutcome) {
    breakdown.push({
      rule: "Correct match result",
      pts: POINTS.CORRECT_RESULT,
    });
    const bonus = goalAccuracyBonus(totalError);
    if (bonus > 0) {
      breakdown.push({
        rule: `Goal accuracy bonus (off by ${totalError})`,
        pts: bonus,
      });
    }
  } else {
    // Draw/win mismatch: only reward if off by exactly 1 goal total
    const isDrawWinMismatch = predictedOutcome === 0 || actualOutcome === 0;
    if (isDrawWinMismatch && totalError === 1) {
      breakdown.push({ rule: "Draw/win close-score bonus", pts: 5 });
    }
  }

  if (hasBttsOrCleanSheetBonus(predHome, predAway, realHome, realAway)) {
    breakdown.push({
      rule: "Both teams scored / clean sheet bonus",
      pts: POINTS.BTTS_OR_CLEAN_SHEET,
    });
  }

  return breakdown;
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Score a single match prediction.
 *
 * For knockout matches, pass `options.predQualifier` (user's pick) and
 * `options.realQualifier` (from matches.qualifier) to award the +10 bonus.
 */
export function scoreMatch(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  isKnockout = false,
  options: ScoringOptions = {},
): ScoringResult {
  const breakdown = coreScore(predHome, predAway, realHome, realAway);

  if (isKnockout) {
    const { predQualifier = null, realQualifier = null } = options;
    if (predQualifier && realQualifier && predQualifier === realQualifier) {
      breakdown.push({
        rule: "Correct advancing team (knockout)",
        pts: POINTS.KNOCKOUT_QUALIFIER,
      });
    }
  }

  return toResult(breakdown);
}

export function formatPoints(pts: number): string {
  return pts > 0 ? `+${pts}` : `${pts}`;
}

// ─── Scoring reference (used in UI rules pages) ────────────────

export const SCORING_REFERENCE = {
  groupAndKnockout: [
    {
      pts: 25,
      label: "Perfect prediction",
      note: "Exact scoreline. No other bonuses are added.",
    },
    {
      pts: 10,
      label: "Correct match result",
      note: "Right home win, draw, or away win when the score is not exact.",
    },
    {
      pts: "1–5" as const,
      label: "Goal accuracy bonus",
      note: "Only with a correct result: off by 1→+5, 2→+4, 3→+3, 4→+2, 5→+1 total goals.",
    },
    {
      pts: 5,
      label: "Draw/win close miss",
      note: "One side predicted a draw, the other had a winner — only if off by exactly 1 goal total.",
    },
    {
      pts: 3,
      label: "Both teams scored / clean sheet",
      note: "Both teams scored in prediction and reality, or the same team kept a clean sheet. Added on any non-exact prediction.",
    },
  ],
  knockoutSupplement: [
    {
      pts: 10,
      label: "Correct advancing team",
      note: "The team that advances to the next round, regardless of the scoreline result. Covers penalty shootout outcomes.",
    },
    {
      pts: 35,
      label: "Knockout maximum per match",
      note: "Exact score (25) + correct advancing team (10).",
    },
  ],
  groupQualifierBonus: [
    {
      pts: 1,
      label: "Per team correctly predicted to reach R32",
      note: "Awarded once after the group stage ends, for each team in your original bracket that qualified.",
    },
  ],
} as const;
