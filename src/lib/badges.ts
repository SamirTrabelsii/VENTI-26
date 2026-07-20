// Badge Evaluation Engine for Venti 26
// Evaluates which badges each user has earned based on their prediction data.

import { GROUP_MATCHES, KNOCKOUT_MATCHES } from "@/lib/wc2026-data";
import { scoreMatch } from "@/lib/scoring";

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];
const TOTAL_MATCHES = 104;
const GROUP_STAGE_MATCHES = 72;

export interface BadgeDefinition {
  id: string;
  icon: string;
  label: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "diamond" | "crown" | "lightning";
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "completionist",
    icon: "🥉",
    label: "Completionist",
    description: "Predict every World Cup match before the tournament kickoff.",
    tier: "bronze",
  },
  {
    id: "sharpshooter",
    icon: "🥈",
    label: "Sharpshooter",
    description: "Predict 5 exact scores.",
    tier: "silver",
  },
  {
    id: "match_predictor",
    icon: "🥈",
    label: "Match Predictor",
    description: "Predict 25 match outcomes correctly.",
    tier: "silver",
  },
  {
    id: "hot_streak",
    icon: "🥈",
    label: "Hot Streak",
    description: "Predict 5 consecutive match outcomes correctly.",
    tier: "silver",
  },
  {
    id: "group_master",
    icon: "🥇",
    label: "Group Master",
    description: "Correctly predict all matches of a single World Cup group.",
    tier: "gold",
  },
  {
    id: "lone_wolf",
    icon: "🥇",
    label: "Lone Wolf",
    description: "Be the only player to predict the exact score of a match.",
    tier: "gold",
  },
  {
    id: "consistency_king",
    icon: "🥇",
    label: "Consistency King",
    description:
      "Maintain a prediction accuracy above 50% after finishing the groups phase.",
    tier: "gold",
  },
  {
    id: "deadly_accuracy",
    icon: "💎",
    label: "Deadly Accuracy",
    description: "Predict 3 exact scores in 3 consecutive match slots.",
    tier: "diamond",
  },
  {
    id: "r32_oracle",
    icon: "💎",
    label: "Round of 32 Oracle",
    description:
      "Correctly predict all teams qualifying for the Round of 32 from original prediction.",
    tier: "diamond",
  },
  {
    id: "time_traveler",
    icon: "💎",
    label: "Time Traveler",
    description:
      "Correctly predict both finalists and the World Cup winner before kickoff.",
    tier: "diamond",
  },
  {
    id: "final_visionary",
    icon: "👑",
    label: "Final Visionary",
    description: "Correctly predict both finalists from original prediction.",
    tier: "crown",
  },
  {
    id: "world_champion",
    icon: "👑",
    label: "World Champion",
    description:
      "Correctly predict the World Cup winner from original prediction.",
    tier: "crown",
  },
  {
    id: "knockout_master",
    icon: "👑",
    label: "Knockout Master",
    description:
      "Correctly predict every knockout-stage match using the live bracket.",
    tier: "crown",
  },
  {
    id: "perfect_bracket",
    icon: "⚡",
    label: "Perfect Bracket",
    description:
      "Correctly predict every knockout-stage match from original prediction.",
    tier: "lightning",
  },
];

function isKnockoutMatch(match: any) {
  return ["R32", "R16", "QF", "SF", "3RD", "FINAL"].includes(match.group_label);
}

function outcome(home: number, away: number): 1 | 0 | -1 {
  if (home > away) return 1;
  if (home < away) return -1;
  return 0;
}

interface EvalContext {
  userId: string;
  predictions: any[]; // user's predictions
  allPredictions: any[]; // ALL users' predictions (for lone_wolf)
  bracketPicks: any[]; // user's bracket picks
  finishedMatches: any[]; // sorted chronologically
  allFinishedMatches: any[]; // all finished (same, just alias for clarity)
}

/**
 * Evaluate all badges for a single user.
 * Returns a Set of badge IDs the user has earned.
 */
export function evaluateBadges(ctx: EvalContext): Set<string> {
  const earned = new Set<string>();

  // ── 🥉 Completionist ──
  // Predicted every match before kickoff
  if (ctx.predictions.length + ctx.bracketPicks.length >= TOTAL_MATCHES) {
    earned.add("completionist");
  }

  // Build per-match scoring results for this user
  const matchResults: Array<{
    matchId: string;
    groupLabel: string;
    type: string;
    isExact: boolean;
    isCorrectOutcome: boolean;
    total: number;
  }> = [];

  for (const match of ctx.finishedMatches) {
    const pred = ctx.predictions.find((p) => p.match_id === match.id);
    if (
      !pred ||
      typeof pred.home_score !== "number" ||
      typeof pred.away_score !== "number"
    ) {
      matchResults.push({
        matchId: match.id,
        groupLabel: match.group_label,
        type: "miss",
        isExact: false,
        isCorrectOutcome: false,
        total: 0,
      });
      continue;
    }

    const ko = isKnockoutMatch(match);
    const result = scoreMatch(
      pred.home_score,
      pred.away_score,
      match.home_score,
      match.away_score,
      ko,
      {
        predQualifier: pred.qualifier_pick || pred.qualifier || null,
        realQualifier: match.qualifier || null,
      },
    );

    const isCorrectOutcome =
      outcome(pred.home_score, pred.away_score) ===
      outcome(match.home_score, match.away_score);

    matchResults.push({
      matchId: match.id,
      groupLabel: match.group_label,
      type: result.type,
      isExact: result.type === "exact",
      isCorrectOutcome,
      total: result.total,
    });
  }

  const exactCount = matchResults.filter((r) => r.isExact).length;
  const correctOutcomeCount = matchResults.filter(
    (r) => r.isCorrectOutcome,
  ).length;

  // ── 🥈 Sharpshooter ──
  if (exactCount >= 5) {
    earned.add("sharpshooter");
  }

  // ── 🥈 Match Predictor ──
  if (correctOutcomeCount >= 25) {
    earned.add("match_predictor");
  }

  // ── 🥈 Hot Streak ──
  let maxStreak = 0;
  let currentStreak = 0;
  for (const r of matchResults) {
    if (r.isCorrectOutcome) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }
  if (maxStreak >= 5) {
    earned.add("hot_streak");
  }

  // ── 🥇 Group Master ──
  const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  for (const g of groups) {
    const groupMatches = matchResults.filter((r) => r.groupLabel === g);
    const finishedGroupMatches = ctx.finishedMatches.filter(
      (m) => m.group_label === g,
    );
    // A group has 6 matches; only evaluate if all 6 are finished
    if (finishedGroupMatches.length === 6 && groupMatches.length === 6) {
      const allCorrect = groupMatches.every((r) => r.isCorrectOutcome);
      if (allCorrect) {
        earned.add("group_master");
        break; // Only need one group
      }
    }
  }

  // ── 🥇 Lone Wolf ──
  // For each finished match, check if exactly one user got the exact score
  for (const match of ctx.finishedMatches) {
    if (match.home_score === null || match.away_score === null) continue;
    // Find all predictions for this match that are exact
    const exactPreds = ctx.allPredictions.filter(
      (p) =>
        p.match_id === match.id &&
        p.home_score === match.home_score &&
        p.away_score === match.away_score,
    );
    if (exactPreds.length === 1 && exactPreds[0].user_id === ctx.userId) {
      earned.add("lone_wolf");
      break;
    }
  }

  // ── 🥇 Consistency King ──
  // After group stage (72 matches finished), accuracy > 50%
  const groupStageFinished = ctx.finishedMatches.filter(
    (m) => !isKnockoutMatch(m),
  );
  if (groupStageFinished.length >= GROUP_STAGE_MATCHES) {
    const groupResults = matchResults.filter(
      (r) => !isKnockoutMatch({ group_label: r.groupLabel }),
    );
    const groupCorrect = groupResults.filter((r) => r.isCorrectOutcome).length;
    if (groupResults.length > 0 && groupCorrect / groupResults.length > 0.5) {
      earned.add("consistency_king");
    }
  }

  // ── 💎 Deadly Accuracy ──
  // 3 exact scores in 3 consecutive match slots
  for (let i = 0; i <= matchResults.length - 3; i++) {
    if (
      matchResults[i].isExact &&
      matchResults[i + 1].isExact &&
      matchResults[i + 2].isExact
    ) {
      earned.add("deadly_accuracy");
      break;
    }
  }

  // ── 💎 Round of 32 Oracle ──
  // This requires checking if the user's original bracket picks for R32
  // match the actual teams that qualified. We need the actual R32 matches.
  const r32Matches = ctx.finishedMatches.filter((m) => m.group_label === "R32");
  if (r32Matches.length === 16) {
    // Get all actual R32 team codes
    const actualR32Teams = new Set<string>();
    for (const m of r32Matches) {
      actualR32Teams.add(m.home_team);
      actualR32Teams.add(m.away_team);
    }
    // Get user's bracket picks for R32
    const r32Picks = ctx.bracketPicks.filter((bp) => bp.round === "r32");
    if (r32Picks.length >= 32) {
      const pickedTeams = new Set(r32Picks.map((bp) => bp.team_code));
      const allMatch = [...actualR32Teams].every((t) => pickedTeams.has(t));
      if (allMatch && pickedTeams.size === actualR32Teams.size) {
        earned.add("r32_oracle");
      }
    }
  }

  // ── 👑 World Champion ──
  const championPick = ctx.bracketPicks.find((bp) => bp.round === "champion");
  const finalMatch = ctx.finishedMatches.find((m) => m.group_label === "FINAL");
  if (championPick && finalMatch && finalMatch.home_score !== null) {
    // Determine actual winner
    const actualWinner =
      finalMatch.home_score > finalMatch.away_score
        ? finalMatch.home_team
        : finalMatch.away_score > finalMatch.home_score
          ? finalMatch.away_team
          : finalMatch.qualifier || null;
    if (actualWinner && championPick.team_code === actualWinner) {
      earned.add("world_champion");
    }
  }

  // ── 👑 Final Visionary ──
  const finalPicks = ctx.bracketPicks.filter((bp) => bp.round === "final");
  if (finalMatch && finalPicks.length >= 2) {
    const pickedFinalists = new Set(finalPicks.map((bp) => bp.team_code));
    const actualFinalists = new Set([
      finalMatch.home_team,
      finalMatch.away_team,
    ]);
    if ([...actualFinalists].every((t) => pickedFinalists.has(t))) {
      earned.add("final_visionary");
    }
  }

  // ── 💎 Time Traveler ──
  // Both finalists + winner correct from original prediction
  if (earned.has("final_visionary") && earned.has("world_champion")) {
    earned.add("time_traveler");
  }

  // ── 👑 Knockout Master ──
  // All knockout matches correctly predicted (outcome) using live bracket
  const koMatches = matchResults.filter((r) =>
    isKnockoutMatch({ group_label: r.groupLabel }),
  );
  const finishedKoMatches = ctx.finishedMatches.filter((m) =>
    isKnockoutMatch(m),
  );
  if (finishedKoMatches.length >= 32 && koMatches.length >= 32) {
    const allKoCorrect = koMatches.every((r) => r.isCorrectOutcome);
    if (allKoCorrect) {
      earned.add("knockout_master");
    }
  }

  // ── ⚡ Perfect Bracket ──
  // All knockout matches from original prediction are exact
  if (finishedKoMatches.length >= 32) {
    let allOriginalKoExact = true;
    for (const match of finishedKoMatches) {
      const pred = ctx.predictions.find((p) => p.match_id === match.id);
      if (!pred || pred.is_repredicted) {
        allOriginalKoExact = false;
        break;
      }
      if (
        pred.home_score !== match.home_score ||
        pred.away_score !== match.away_score
      ) {
        allOriginalKoExact = false;
        break;
      }
    }
    if (allOriginalKoExact) {
      earned.add("perfect_bracket");
    }
  }

  return earned;
}

/**
 * Get progress data for UI display (how close to earning each badge).
 */
export function getBadgeProgress(
  ctx: Omit<EvalContext, "allPredictions">,
  earned: Set<string>,
): Record<string, { current: number; target: number }> {
  const progress: Record<string, { current: number; target: number }> = {};

  // Completionist
  progress.completionist = {
    current: ctx.predictions.length + ctx.bracketPicks.length,
    target: TOTAL_MATCHES,
  };

  // Build match results
  const matchResults: Array<{
    isExact: boolean;
    isCorrectOutcome: boolean;
    groupLabel: string;
  }> = [];
  for (const match of ctx.finishedMatches) {
    const pred = ctx.predictions.find((p) => p.match_id === match.id);
    if (!pred || typeof pred.home_score !== "number") {
      matchResults.push({
        isExact: false,
        isCorrectOutcome: false,
        groupLabel: match.group_label,
      });
      continue;
    }
    const ko = isKnockoutMatch(match);
    const result = scoreMatch(
      pred.home_score,
      pred.away_score,
      match.home_score,
      match.away_score,
      ko,
    );
    const isCorrectOutcome =
      outcome(pred.home_score, pred.away_score) ===
      outcome(match.home_score, match.away_score);
    matchResults.push({
      isExact: result.type === "exact",
      isCorrectOutcome,
      groupLabel: match.group_label,
    });
  }

  const exactCount = matchResults.filter((r) => r.isExact).length;
  const correctCount = matchResults.filter((r) => r.isCorrectOutcome).length;

  progress.sharpshooter = { current: exactCount, target: 5 };
  progress.match_predictor = { current: correctCount, target: 25 };

  // Hot Streak
  let maxStreak = 0,
    streak = 0;
  for (const r of matchResults) {
    if (r.isCorrectOutcome) {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else streak = 0;
  }
  progress.hot_streak = { current: maxStreak, target: 5 };

  // Group Master - best group performance
  let bestGroupCorrect = 0;
  for (const g of [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
  ]) {
    const gm = matchResults.filter((r) => r.groupLabel === g);
    const correct = gm.filter((r) => r.isCorrectOutcome).length;
    if (correct > bestGroupCorrect) bestGroupCorrect = correct;
  }
  progress.group_master = { current: bestGroupCorrect, target: 6 };

  // Lone Wolf - binary
  progress.lone_wolf = { current: 0, target: 1 };

  // Consistency King
  const groupResults = matchResults.filter(
    (r) => !isKnockoutMatch({ group_label: r.groupLabel }),
  );
  const groupCorrect = groupResults.filter((r) => r.isCorrectOutcome).length;
  const accuracy =
    groupResults.length > 0
      ? Math.round((groupCorrect / groupResults.length) * 100)
      : 0;
  progress.consistency_king = { current: accuracy, target: 50 };

  // Deadly Accuracy - best consecutive exact run
  let maxExactRun = 0,
    exactRun = 0;
  for (const r of matchResults) {
    if (r.isExact) {
      exactRun++;
      if (exactRun > maxExactRun) maxExactRun = exactRun;
    } else exactRun = 0;
  }
  progress.deadly_accuracy = { current: maxExactRun, target: 3 };

  // The rest are binary tournament-end badges
  progress.r32_oracle = { current: 0, target: 1 };
  progress.time_traveler = { current: 0, target: 1 };
  progress.final_visionary = { current: 0, target: 1 };
  progress.world_champion = { current: 0, target: 1 };
  progress.knockout_master = { current: 0, target: 1 };
  progress.perfect_bracket = { current: 0, target: 1 };

  // Enforce UI rules: complete ONLY if earned
  for (const id of Object.keys(progress)) {
    if (earned.has(id)) {
      progress[id].current = progress[id].target;
    } else if (progress[id].current >= progress[id].target) {
      progress[id].current = progress[id].target - 1;
    }
  }

  return progress;
}
