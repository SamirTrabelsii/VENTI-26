import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateAllUsers } from "@/app/api/admin/recalculate/route";

export const maxDuration = 15; // Vercel Cron might need time to recalculate if lots of updates
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Basic Cron Security (Vercel standard)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;

  try {
    const syncRes = await fetch(`${baseUrl}/api/admin/force-sync`, {
      method: "POST",
      headers: {
        "x-scoring-secret": process.env.SCORING_SECRET ?? "",
      },
    });

    const data = await syncRes.json();

    return NextResponse.json({
      success: true,
      message: "Cron triggered force-sync successfully",
      syncResult: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Cron trigger failed", details: error.message },
      { status: 500 },
    );
  }
}
