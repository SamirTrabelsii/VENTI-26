import { NextResponse } from "next/server";
import { createAdminClient, verifyAdmin } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/predictions?match_id=xxx   or   ?user_id=xxx
// Browse all predictions, optionally filtered
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("match_id");
  const userId = searchParams.get("user_id");

  const db = createAdminClient();

  let query = db
    .from("predictions")
    .select(
      "id, user_id, match_id, home_score, away_score, created_at, updated_at, profile:profiles(display_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (matchId) query = query.eq("match_id", matchId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const predictions = (data ?? []).map((p: Record<string, unknown>) => {
    const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
    return { ...p, profile };
  });

  return NextResponse.json({ predictions });
}
