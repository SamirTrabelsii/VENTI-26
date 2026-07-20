// src/lib/fresh-scores.ts
//
// Computes per-user score totals from raw prediction data.
// Single source of truth for leaderboard and profile calculations.
//
// Scoring rules (see scoring.ts for full breakdown):
//   Group stage  : coreScore only
//   Knockout     : coreScore + +10 if correct qualifier (team_code vs matches.qualifier)

import { scoreMatch } from "@/lib/scoring";

export interface FreshScoreTotals {
  total_points: number;
  exact_scores: number;
  correct_results: number;
  streak: number;
}

function isKnockoutMatch(match: any): boolean {
  if (["R32", "R16", "QF", "SF", "3RD", "FINAL"].includes(match.group_label))
    return true;
  return match.stage
    ? !["group", "group_stage", "GROUP_STAGE"].includes(match.stage)
    : false;
}

function inferQualifier(match: any): string | null {
  if (match.qualifier) return match.qualifier;
  if (
    match.went_to_penalties &&
    typeof match.penalty_home_score === "number" &&
    typeof match.penalty_away_score === "number"
  ) {
    if (match.penalty_home_score > match.penalty_away_score)
      return match.home_team ?? null;
    if (match.penalty_away_score > match.penalty_home_score)
      return match.away_team ?? null;
  }
  if (
    typeof match.home_score === "number" &&
    typeof match.away_score === "number"
  ) {
    if (match.home_score > match.away_score) return match.home_team ?? null;
    if (match.away_score > match.home_score) return match.away_team ?? null;
  }
  return null;
}

// ── Bracket pick helpers ───────────────────────────────────────────────────────

export function matchIdForPick(pick: any): string {
  if (pick.round === "final" || pick.round === "third_place") return pick.round;
  return `${pick.round}_${pick.slot_index + 1}`;
}

export function normalizeBracketPickForScoring(pick: any) {
  return {
    ...pick,
    match_id: matchIdForPick(pick),
    // team_code is the user's qualifier pick — used for the +10 knockout bonus
    qualifier_pick: pick.team_code,
  };
}

// ── Main scoring function ──────────────────────────────────────────────────────

export function computeFreshScores(
  userIds: string[],
  finishedMatches: any[],
  predictions: any[], // from `predictions` table (group stage)
  bracketPicks: any[], // from `live_ko_picks` table (knockout)
): Map<string, FreshScoreTotals> {
  // Build a single lookup: "userId:matchId" → prediction row
  const predByUserMatch = new Map<string, any>();
  for (const p of predictions) {
    predByUserMatch.set(`${p.user_id}:${p.match_id}`, p);
  }
  for (const bp of bracketPicks) {
    const normalized = normalizeBracketPickForScoring(bp);
    predByUserMatch.set(
      `${normalized.user_id}:${normalized.match_id}`,
      normalized,
    );
  }

  const totals = new Map<string, FreshScoreTotals>();

  for (const userId of userIds) {
    let total_points = 0;
    let exact_scores = 0;
    let correct_results = 0;
    let streak = 0;

    for (const match of finishedMatches) {
      const prediction = predByUserMatch.get(`${userId}:${match.id}`);

      if (!prediction) {
        streak = 0;
        continue;
      }

      const predHome = prediction.home_score;
      const predAway = prediction.away_score;

      if (typeof predHome !== "number" || typeof predAway !== "number") {
        streak = 0;
        continue;
      }

      const isKnockout = isKnockoutMatch(match);

      const result = scoreMatch(
        predHome,
        predAway,
        match.home_score,
        match.away_score,
        isKnockout,
        {
          predQualifier:
            prediction.qualifier_pick ?? prediction.team_code ?? null,
          realQualifier: isKnockout ? inferQualifier(match) : null,
        },
      );

      total_points += result.total;

      if (result.type === "exact") {
        exact_scores++;
        streak++;
      } else if (result.type === "correct") {
        correct_results++;
        streak++;
      } else {
        // partial or miss — streak resets, no correct_results increment
        streak = 0;
      }
    }

    totals.set(userId, { total_points, exact_scores, correct_results, streak });
  }

  return totals;
}
