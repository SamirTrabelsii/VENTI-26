import { NextResponse } from "next/server";
import { createAdminClient, verifyAdmin } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/groups
// List all groups with member details
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();

  const { data: groups } = await db
    .from("groups")
    .select("*, creator:profiles!groups_created_by_fkey(display_name, email)")
    .order("created_at", { ascending: false });

  if (!groups) return NextResponse.json({ groups: [] });

  // Enrich each group with member count + member list
  const enriched = await Promise.all(
    groups.map(async (g) => {
      const { data: members } = await db
        .from("group_members")
        .select("user_id, joined_at, profile:profiles(display_name, email)")
        .eq("group_id", g.id)
        .order("joined_at", { ascending: true });

      const { data: scores } = await db
        .from("scores")
        .select("user_id, total_points")
        .eq("group_id", g.id)
        .order("total_points", { ascending: false });

      const creator = Array.isArray(g.creator) ? g.creator[0] : g.creator;

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        invite_code: g.invite_code,
        created_at: g.created_at,
        created_by: creator?.display_name ?? creator?.email ?? g.created_by,
        member_count: members?.length ?? 0,
        members: (members ?? []).map((m) => {
          const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          const score = scores?.find((s) => s.user_id === m.user_id);
          return {
            user_id: m.user_id,
            display_name: profile?.display_name ?? "?",
            email: profile?.email ?? "",
            joined_at: m.joined_at,
            total_points: score?.total_points ?? 0,
          };
        }),
      };
    }),
  );

  return NextResponse.json({ groups: enriched });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/groups?id=<group_id>
// Delete a group and all its members and score entries
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("id");
  if (!groupId)
    return NextResponse.json({ error: "Missing group id" }, { status: 400 });

  const db = createAdminClient();

  // 1. Delete group members
  await db.from("group_members").delete().eq("group_id", groupId);

  // 2. Delete group scores
  await db.from("scores").delete().eq("group_id", groupId);

  // 3. Delete the group
  const { error } = await db.from("groups").delete().eq("id", groupId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: groupId });
}
