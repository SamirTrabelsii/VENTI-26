import { NextResponse } from "next/server";
import { createAdminClient, verifyAdmin } from "@/lib/supabase/admin";
import { scoreMatch } from "@/lib/scoring";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/simulate
// Simulates a few finished matches with fake results and random predictions
// for all registered users, then runs the scoring pipeline.
//
// Body (optional): { match_count?: number }  — default 3
//
// This uses Group A matches: a1, a2, a3, a4, a5, a6
// ─────────────────────────────────────────────────────────────────────────────

const FAKE_RESULTS: { id: string; home: number; away: number }[] = [
  { id: "a1", home: 2, away: 1 },
  { id: "a2", home: 0, away: 0 },
  { id: "a3", home: 1, away: 3 },
  { id: "a4", home: 2, away: 2 },
  { id: "a5", home: 1, away: 0 },
  { id: "a6", home: 3, away: 1 },
];

function randomScore(): number {
  // Weighted: 0-3 common, 4-5 rare
  const weights = [25, 30, 25, 12, 5, 3];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 1;
}

export async function POST(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const matchCount = Math.min(6, Math.max(1, body.match_count ?? 3));

  const db = createAdminClient();
  const log: string[] = [];

  // 1. Get all users
  const { data: allUsers } = await db
    .from("profiles")
    .select("id, display_name");
  if (!allUsers || allUsers.length === 0) {
    return NextResponse.json({ error: "No users registered" }, { status: 400 });
  }
  log.push(`Found ${allUsers.length} users`);

  const testMatches = FAKE_RESULTS.slice(0, matchCount);

  // 2. Set match results to finished
  for (const fm of testMatches) {
    const { error } = await db
      .from("matches")
      .update({ home_score: fm.home, away_score: fm.away, status: "finished" })
      .eq("id", fm.id);

    if (error) log.push(`⚠️ Failed to update match ${fm.id}: ${error.message}`);
    else log.push(`✅ Match ${fm.id} → ${fm.home}-${fm.away} (finished)`);
  }

  // 3. Generate random predictions for each user for each test match
  let predsCreated = 0;
  for (const user of allUsers) {
    for (const fm of testMatches) {
      const home = randomScore();
      const away = randomScore();
      const { error } = await db.from("predictions").upsert(
        {
          user_id: user.id,
          match_id: fm.id,
          home_score: home,
          away_score: away,
        },
        { onConflict: "user_id,match_id" },
      );

      if (!error) predsCreated++;
    }
  }
  log.push(`✅ Created/updated ${predsCreated} predictions`);

  // 4. Trigger scoring for each match
  let totalScored = 0;
  for (const fm of testMatches) {
    const { data: match } = await db
      .from("matches")
      .select("*")
      .eq("id", fm.id)
      .single();
    if (!match) continue;

    const { data: predictions } = await db
      .from("predictions")
      .select("user_id, home_score, away_score")
      .eq("match_id", fm.id);

    if (!predictions) continue;

    const results = predictions.map((p) => {
      const result = scoreMatch(
        p.home_score,
        p.away_score,
        match.home_score,
        match.away_score,
      );
      return {
        user_id: p.user_id,
        points: result.total,
        isExact: result.type === "exact",
        isCorrect: result.type === "correct",
        keepsStreak: result.type === "exact" || result.type === "correct",
      };
    });

    // Get group memberships
    const userIds = results.map((r) => r.user_id);
    const { data: memberships } = await db
      .from("group_members")
      .select("user_id, group_id")
      .in("user_id", userIds);

    if (!memberships || memberships.length === 0) {
      log.push(
        `⚠️ Match ${fm.id}: No group memberships found — scoring skipped for leaderboard`,
      );
      continue;
    }

    for (const membership of memberships) {
      const userResult = results.find((r) => r.user_id === membership.user_id);
      if (!userResult) continue;

      const { data: existing } = await db
        .from("scores")
        .select("total_points, exact_scores, correct_results, streak")
        .eq("user_id", membership.user_id)
        .eq("group_id", membership.group_id)
        .single();

      if (existing) {
        await db
          .from("scores")
          .update({
            total_points: existing.total_points + userResult.points,
            exact_scores: existing.exact_scores + (userResult.isExact ? 1 : 0),
            correct_results:
              existing.correct_results + (userResult.isCorrect ? 1 : 0),
            streak: userResult.keepsStreak ? existing.streak + 1 : 0,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", membership.user_id)
          .eq("group_id", membership.group_id);
      } else {
        await db.from("scores").insert({
          user_id: membership.user_id,
          group_id: membership.group_id,
          total_points: userResult.points,
          exact_scores: userResult.isExact ? 1 : 0,
          correct_results: userResult.isCorrect ? 1 : 0,
          streak: userResult.keepsStreak ? 1 : 0,
        });
      }
      totalScored++;
    }
    log.push(`✅ Scored match ${fm.id}: ${predictions.length} predictions`);
  }
  log.push(`✅ Updated ${totalScored} score entries`);

  return NextResponse.json({
    success: true,
    matches_simulated: testMatches.length,
    predictions_created: predsCreated,
    score_entries: totalScored,
    log,
  });
}
