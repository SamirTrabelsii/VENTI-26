import { NextResponse } from "next/server";
import { createAdminClient, verifyAdmin } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/stats
// Platform overview statistics
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();

  const [
    { count: userCount },
    { count: predictionCount },
    { count: groupCount },
    { count: bracketCount },
    { data: matchStatuses },
    { data: recentUsers },
    { data: recentPredictions },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }),
    db.from("predictions").select("*", { count: "exact", head: true }),
    db.from("groups").select("*", { count: "exact", head: true }),
    db.from("bracket_picks").select("*", { count: "exact", head: true }),
    db.from("matches").select("id, status"),
    db
      .from("profiles")
      .select("id, display_name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("predictions")
      .select(
        "id, user_id, match_id, home_score, away_score, created_at, profile:profiles(display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const statusCounts = { upcoming: 0, live: 0, finished: 0 };
  matchStatuses?.forEach((m) => {
    if (m.status in statusCounts)
      statusCounts[m.status as keyof typeof statusCounts]++;
  });

  // Users who completed all predictions
  const { data: predCounts } = await db.from("predictions").select("user_id");

  const perUser = new Map<string, number>();
  predCounts?.forEach((p) =>
    perUser.set(p.user_id, (perUser.get(p.user_id) ?? 0) + 1),
  );
  const usersCompleted = Array.from(perUser.values()).filter(
    (c) => c >= 72,
  ).length;

  return NextResponse.json({
    users: userCount ?? 0,
    predictions: predictionCount ?? 0,
    groups: groupCount ?? 0,
    bracketPicks: bracketCount ?? 0,
    matches: statusCounts,
    usersCompleted,
    recentUsers: recentUsers ?? [],
    recentPredictions: (recentPredictions ?? []).map(
      (p: Record<string, unknown>) => {
        const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
        return { ...p, profile };
      },
    ),
  });
}
