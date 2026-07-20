import { NextResponse } from "next/server";
import { scoreMatch } from "@/lib/scoring";
import { createAdminClient, verifyAdmin } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { evaluateBadges } from "@/lib/badges";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/recalculate
// Recomputes every user's total from scratch by replaying all finished matches
// through the scoring engine, then overwrites every (user, group) score row
// with the freshly computed values. This guarantees all pages show the same
// number.
//
// Also callable internally from the scoring POST endpoint after each match.
// ─────────────────────────────────────────────────────────────────────────────

function isKnockoutMatch(match: any) {
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

function matchIdForPick(pick: any) {
  if (pick.round === "final" || pick.round === "third_place") return pick.round;
  return `${pick.round}_${pick.slot_index + 1}`;
}

export interface RecalcResult {
  user_id: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
}

/**
 * Core recalculation logic — exported so the scoring POST endpoint can call it
 * for a subset of users without going through HTTP.
 */
export async function recalculateAllUsers(userIdFilter?: string[]): Promise<{
  results: RecalcResult[];
  finished_matches: number;
  users_processed: number;
  rows_updated: number;
  errors: string[];
}> {
  const db = createAdminClient();

  const [matches, predictions, liveKoPicks, memberships, existingScores] =
    await Promise.all([
      fetchAllRows(db.from("matches").select("*").eq("status", "finished")),
      fetchAllRows(db.from("predictions").select("*")),
      fetchAllRows(db.from("live_ko_picks").select("*")),
      fetchAllRows(db.from("group_members").select("user_id, group_id")),
      fetchAllRows(db.from("scores").select("user_id, group_id")),
    ]);

  const finishedMatches = matches
    .filter((m: any) => m.home_score !== null && m.away_score !== null)
    .sort(
      (a: any, b: any) =>
        new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
    );

  // Build prediction lookup: user_id:match_id -> prediction
  const predictionByUserMatch = new Map<string, any>();
  for (const p of predictions)
    predictionByUserMatch.set(`${p.user_id}:${p.match_id}`, p);
  const liveKoByUserMatch = new Map<string, any>();
  for (const bp of liveKoPicks) {
    const mId = matchIdForPick(bp);
    liveKoByUserMatch.set(`${bp.user_id}:${mId}`, {
      ...bp,
      match_id: mId,
      qualifier_pick: bp.team_code,
      is_live_ko_pick: true,
    });
  }

  // Build set of all users who are group members
  const membershipsByUser = new Map<string, string[]>();
  for (const m of memberships) {
    const arr = membershipsByUser.get(m.user_id) ?? [];
    arr.push(m.group_id);
    membershipsByUser.set(m.user_id, arr);
  }
  // Also ensure users who have score rows but no membership are included
  for (const s of existingScores) {
    if (!membershipsByUser.has(s.user_id)) {
      membershipsByUser.set(s.user_id, []);
    }
    const arr = membershipsByUser.get(s.user_id)!;
    if (!arr.includes(s.group_id)) {
      arr.push(s.group_id);
    }
  }

  // Determine which users to process
  const targetUserIds = userIdFilter
    ? userIdFilter.filter((uid) => membershipsByUser.has(uid))
    : Array.from(membershipsByUser.keys());

  // Compute match-based totals per user
  const userTotals = new Map<
    string,
    {
      total_points: number;
      exact_scores: number;
      correct_results: number;
      streak: number;
    }
  >();

  for (const userId of targetUserIds) {
    let total_points = 0;
    let exact_scores = 0;
    let correct_results = 0;
    let streak = 0;

    for (const match of finishedMatches) {
      const isKnockout = isKnockoutMatch(match);
      const prediction = isKnockout
        ? liveKoByUserMatch.get(`${userId}:${match.id}`)
        : predictionByUserMatch.get(`${userId}:${match.id}`);

      if (!prediction) {
        // Missed prediction — break streak
        streak = 0;
        continue;
      }

      const predHome = prediction.home_score;
      const predAway = prediction.away_score;

      if (typeof predHome !== "number" || typeof predAway !== "number") {
        streak = 0;
        continue;
      }

      const options = {
        predQualifier:
          prediction.qualifier_pick ||
          prediction.qualifier ||
          prediction.team_code ||
          null,
        realQualifier: isKnockout ? inferQualifier(match) : null,
      };

      const result = scoreMatch(
        predHome,
        predAway,
        match.home_score,
        match.away_score,
        isKnockout,
        options,
      );

      total_points += result.total;

      if (result.type === "exact") {
        exact_scores++;
      }

      if (result.type === "correct") {
        correct_results++;
      }

      if (["exact", "correct"].includes(result.type)) {
        streak++;
      } else {
        streak = 0;
      }
    }

    userTotals.set(userId, {
      total_points,
      exact_scores,
      correct_results,
      streak,
    });
  }

  // ── Badge Evaluation ──────────────────────────────────────────────────
  const badgeUpserts: Array<{ user_id: string; badge_id: string }> = [];

  for (const userId of targetUserIds) {
    const userPreds = predictions.filter((p: any) => p.user_id === userId);
    const userBracket = liveKoPicks.filter((bp: any) => bp.user_id === userId);

    try {
      const earned = evaluateBadges({
        userId,
        predictions: userPreds,
        allPredictions: predictions,
        bracketPicks: userBracket,
        finishedMatches,
        allFinishedMatches: finishedMatches,
      });

      for (const badgeId of earned) {
        badgeUpserts.push({ user_id: userId, badge_id: badgeId });
      }
    } catch (e) {
      // Badge evaluation should never block scoring
      console.error(`Badge eval error for ${userId}:`, e);
    }
  }

  // Upsert badges in batches
  if (badgeUpserts.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < badgeUpserts.length; i += batchSize) {
      const batch = badgeUpserts.slice(i, i + batchSize);
      await db
        .from("user_badges")
        .upsert(batch, { onConflict: "user_id,badge_id" })
        .then(() => {});
    }
  }

  // Write results to DB — update every (user, group) row
  const errors: string[] = [];
  let rows_updated = 0;
  const results: RecalcResult[] = [];

  for (const userId of targetUserIds) {
    const totals = userTotals.get(userId)!;
    const groupIds = membershipsByUser.get(userId) ?? [];

    results.push({
      user_id: userId,
      total_points: totals.total_points,
      exact_scores: totals.exact_scores,
      correct_results: totals.correct_results,
    });

    for (const groupId of groupIds) {
      const { error } = await db.from("scores").upsert(
        {
          user_id: userId,
          group_id: groupId,
          total_points: totals.total_points,
          exact_scores: totals.exact_scores,
          correct_results: totals.correct_results,
          streak: totals.streak,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,group_id",
        },
      );

      if (error) {
        errors.push(`upsert ${userId}/${groupId}: ${error.message}`);
      } else {
        rows_updated++;
      }
    }
  }

  return {
    results,
    finished_matches: finishedMatches.length,
    users_processed: targetUserIds.length,
    rows_updated,
    errors,
  };
}

export async function POST(request: Request) {
  const isInternal =
    request.headers.get("x-scoring-secret") === process.env.SCORING_SECRET;
  if (!isInternal) {
    const admin = await verifyAdmin();
    if (!admin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let userIdFilter: string[] | undefined;
  try {
    const body = await request.json();
    if (body.user_ids && Array.isArray(body.user_ids)) {
      userIdFilter = body.user_ids;
    }
  } catch {
    // No body or invalid JSON — recalculate all users
  }

  const result = await recalculateAllUsers(userIdFilter);

  return NextResponse.json(
    {
      success: true,
      ...result,
    },
    {
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
