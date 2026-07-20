// src/app/api/admin/force-sync/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from "@/lib/wc2026-data";

export const maxDuration = 30;

function stageForGroupLabel(groupLabel: string): string {
  const knockoutLabels = ["R32", "R16", "QF", "SF", "3RD", "FINAL"];
  return knockoutLabels.includes(groupLabel) ? groupLabel : "group_stage";
}

function hasScorePair(score: any) {
  return (
    score?.home !== null &&
    score?.home !== undefined &&
    score?.away !== null &&
    score?.away !== undefined
  );
}

function sameScore(a: any, b: any) {
  return (
    hasScorePair(a) && hasScorePair(b) && a.home === b.home && a.away === b.away
  );
}

function addScores(a: any, b: any) {
  return { home: a.home + b.home, away: a.away + b.away };
}

function extractScore(apiM: any) {
  const wentToPenalties =
    apiM.score?.penalties?.home !== null &&
    apiM.score?.penalties?.home !== undefined;
  const regularTime = apiM.score?.regularTime;
  const extraTime = apiM.score?.extraTime;
  const fullTime = apiM.score?.fullTime;

  let scoreHome: number | null = null;
  let scoreAway: number | null = null;

  if (hasScorePair(extraTime) && hasScorePair(regularTime)) {
    const combined = addScores(regularTime, extraTime);
    if (sameScore(fullTime, combined) || sameScore(fullTime, extraTime)) {
      scoreHome = fullTime.home;
      scoreAway = fullTime.away;
    } else if (
      extraTime.home >= regularTime.home &&
      extraTime.away >= regularTime.away
    ) {
      scoreHome = extraTime.home;
      scoreAway = extraTime.away;
    } else {
      scoreHome = combined.home;
      scoreAway = combined.away;
    }
  } else if (hasScorePair(fullTime)) {
    scoreHome = fullTime.home;
    scoreAway = fullTime.away;
  } else if (hasScorePair(regularTime)) {
    scoreHome = regularTime.home;
    scoreAway = regularTime.away;
  }

  return {
    home_score: scoreHome,
    away_score: scoreAway,
    penalty_home_score: wentToPenalties ? apiM.score.penalties.home : null,
    penalty_away_score: wentToPenalties ? apiM.score.penalties.away : null,
    went_to_penalties: wentToPenalties,
  };
}

function mapStatus(apiStatus: string): string {
  if (apiStatus === "TIMED" || apiStatus === "SCHEDULED") return "upcoming";
  if (
    apiStatus === "IN_PLAY" ||
    apiStatus === "PAUSED" ||
    apiStatus === "HALFTIME"
  )
    return "live";
  if (apiStatus === "FINISHED") return "finished";
  return apiStatus;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-scoring-secret");

  if (secretHeader !== process.env.SCORING_SECRET) {
    if (!authHeader || !authHeader.includes("Bearer")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  let apiMatches: any[] = [];
  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      {
        headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY ?? "" },
      },
    );
    if (!res.ok) throw new Error("football-data.org returned " + res.status);
    const data = await res.json();
    apiMatches = data.matches || [];
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to fetch API", details: e.message },
      { status: 500 },
    );
  }

  // Pull current DB state — needed to resolve which static knockout slot
  // (r32_1, r32_2, ...) a given real team pairing currently occupies, since
  // team codes are the only stable identifier once fixtures are known.
  const { data: currentDbMatches } = await supabase
    .from("matches")
    .select("id, home_team, away_team, group_label");
  const dbMatchByTeams = new Map<string, string>(); // "HOME_AWAY" -> matches.id
  for (const m of currentDbMatches || []) {
    if (m.home_team && m.away_team) {
      dbMatchByTeams.set(`${m.home_team}_${m.away_team}`, m.id);
    }
  }

  const updates: any[] = [];
  const unmatched: string[] = [];

  // ── GROUP STAGE: match by group + home/away team code (always unique) ─────
  const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  for (const g of groups) {
    const apiGroup = apiMatches.filter(
      (m) => m.stage === "GROUP_STAGE" && m.group === `GROUP_${g}`,
    );
    const localGroup = GROUP_MATCHES.filter((m) => m.group_label === g);

    for (const apiM of apiGroup) {
      const homeCode = apiM.homeTeam?.tla;
      const awayCode = apiM.awayTeam?.tla;
      if (!homeCode || !awayCode) continue;

      // Find the local static match for this exact team pairing
      const localM =
        localGroup.find(
          (lm) => lm.home_team === homeCode && lm.away_team === awayCode,
        ) ??
        localGroup.find((lm) => {
          // Fallback: match might be stored reversed in static data — unlikely for groups but safe
          return lm.home_team === awayCode && lm.away_team === homeCode;
        });

      if (!localM) {
        unmatched.push(`group_${g}:${homeCode}_vs_${awayCode}`);
        continue;
      }

      const { api_id, ...restLocalM } = localM;
      const scoreData = extractScore(apiM);
      const status = mapStatus(apiM.status);

      updates.push({
        ...restLocalM,
        id: localM.id,
        home_team: homeCode,
        away_team: awayCode,
        ...scoreData,
        status,
        kickoff: apiM.utcDate,
        stage: stageForGroupLabel(localM.group_label),
      });
    }
  }

  // ── KNOCKOUT: match by team codes against current DB state first; if the
  // pairing is new (both teams just became known), fall back to finding the
  // static slot whose CURRENT db row has matching placeholder/TBD teams at
  // the same kickoff time + round. ──────────────────────────────────────────
  const apiKnockouts = apiMatches.filter((m) => m.stage !== "GROUP_STAGE");
  const localKnockouts = [...KNOCKOUT_MATCHES];
  const dbMatchById = new Map((currentDbMatches || []).map((m) => [m.id, m]));

  for (const apiM of apiKnockouts) {
    const homeCode = apiM.homeTeam?.tla;
    const awayCode = apiM.awayTeam?.tla;
    if (!homeCode || !awayCode) continue; // teams not yet known — skip until resolved

    // 1. Try exact match against current DB team pairing (handles re-sync
    //    of already-resolved fixtures, finished or upcoming).
    let localM = localKnockouts.find((lm) => {
      const dbRow = dbMatchById.get(lm.id);
      return (
        dbRow && dbRow.home_team === homeCode && dbRow.away_team === awayCode
      );
    });

    // 2. First time this pairing appears: find a knockout slot of the same
    //    round whose DB row still has unresolved/placeholder teams, and
    //    whose static kickoff time matches the API kickoff time (rounds
    //    keep static kickoff slots stable even before teams are known).
    if (!localM) {
      const apiKickoff = new Date(apiM.utcDate).getTime();
      localM = localKnockouts.find((lm) => {
        if (Math.abs(new Date(lm.kickoff).getTime() - apiKickoff) > 60_000)
          return false;
        const dbRow = dbMatchById.get(lm.id);
        // Only claim slots not already resolved to a DIFFERENT pairing
        if (dbRow && dbRow.home_team && dbRow.away_team) {
          const alreadyThisPairing =
            dbRow.home_team === homeCode && dbRow.away_team === awayCode;
          const looksResolved =
            !dbRow.home_team.includes(" ") && dbRow.home_team.length <= 4;
          if (looksResolved && !alreadyThisPairing) return false;
        }
        return true;
      });
    }

    if (!localM) {
      unmatched.push(`knockout:${homeCode}_vs_${awayCode}_at_${apiM.utcDate}`);
      continue;
    }

    const { api_id, ...restLocalM } = localM;
    const scoreData = extractScore(apiM);
    const status = mapStatus(apiM.status);

    let qualifier: string | null = null;
    if (status === "finished") {
      if (scoreData.went_to_penalties) {
        qualifier =
          scoreData.penalty_home_score! > scoreData.penalty_away_score!
            ? homeCode
            : awayCode;
      } else if (
        typeof scoreData.home_score === "number" &&
        typeof scoreData.away_score === "number"
      ) {
        if (scoreData.home_score > scoreData.away_score) qualifier = homeCode;
        else if (scoreData.away_score > scoreData.home_score)
          qualifier = awayCode;
      }
    }

    updates.push({
      ...restLocalM,
      id: localM.id,
      home_team: homeCode,
      away_team: awayCode,
      ...scoreData,
      status,
      kickoff: apiM.utcDate,
      stage: stageForGroupLabel(localM.group_label),
      qualifier,
    });
  }

  // ── Update the Database ──────────────────────────────────────────────────
  const batchSize = 20;
  let updatedCount = 0;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const { error } = await supabase
      .from("matches")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      console.error("Batch error:", error);
      return NextResponse.json(
        { error: "DB Update Failed", details: error },
        { status: 500 },
      );
    }
    updatedCount += batch.length;
  }

  const baseUrl = new URL(request.url).origin;
  await fetch(`${baseUrl}/api/admin/recalculate`, {
    method: "POST",
    headers: { "x-scoring-secret": process.env.SCORING_SECRET ?? "" },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    updatedCount,
    unmatched,
    updates,
  });
}
