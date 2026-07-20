import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — requires Vercel Pro for >10s, on Hobby cron gets 60s

// ─────────────────────────────────────────────────────────────────────────────
// Name aliases: football-data.org team names → our local team codes
// ─────────────────────────────────────────────────────────────────────────────
const NAME_TO_CODE: Record<string, string> = {
  Mexico: "MEX",
  "South Africa": "RSA",
  "Korea Republic": "KOR",
  "South Korea": "KOR",
  Czechia: "CZE",
  "Czech Republic": "CZE",
  Canada: "CAN",
  "Bosnia-Herzegovina": "BIH",
  "Bosnia and Herzegovina": "BIH",
  "United States": "USA",
  Paraguay: "PAR",
  Qatar: "QAT",
  Switzerland: "SUI",
  Brazil: "BRA",
  Morocco: "MAR",
  Haiti: "HAI",
  Scotland: "SCO",
  Australia: "AUS",
  Turkey: "TUR",
  Germany: "GER",
  Curaçao: "CUW",
  Netherlands: "NED",
  Japan: "JPN",
  "Ivory Coast": "CIV",
  "Côte d'Ivoire": "CIV",
  Ecuador: "ECU",
  Sweden: "SWE",
  Tunisia: "TUN",
  Spain: "ESP",
  "Cape Verde Islands": "CPV",
  "Cape Verde": "CPV",
  Belgium: "BEL",
  Egypt: "EGY",
  "Saudi Arabia": "KSA",
  Uruguay: "URU",
  Iran: "IRN",
  "New Zealand": "NZL",
  France: "FRA",
  Senegal: "SEN",
  Iraq: "IRQ",
  Norway: "NOR",
  Argentina: "ARG",
  Algeria: "ALG",
  Austria: "AUT",
  Jordan: "JOR",
  Portugal: "POR",
  "DR Congo": "COD",
  "Democratic Republic of the Congo": "COD",
  Uzbekistan: "UZB",
  Colombia: "COL",
  England: "ENG",
  Croatia: "CRO",
  Ghana: "GHA",
  Panama: "PAN",
};

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

function extractScore(apiMatch: any) {
  const wentToPenalties =
    apiMatch.score?.penalties?.home !== null &&
    apiMatch.score?.penalties?.home !== undefined;
  const regularTime = apiMatch.score?.regularTime;
  const extraTime = apiMatch.score?.extraTime;
  const fullTime = apiMatch.score?.fullTime;

  let home_score: number | null = null;
  let away_score: number | null = null;

  if (hasScorePair(extraTime) && hasScorePair(regularTime)) {
    const combined = addScores(regularTime, extraTime);
    if (sameScore(fullTime, combined) || sameScore(fullTime, extraTime)) {
      home_score = fullTime.home;
      away_score = fullTime.away;
    } else if (
      extraTime.home >= regularTime.home &&
      extraTime.away >= regularTime.away
    ) {
      home_score = extraTime.home;
      away_score = extraTime.away;
    } else {
      home_score = combined.home;
      away_score = combined.away;
    }
  } else if (hasScorePair(fullTime)) {
    home_score = fullTime.home;
    away_score = fullTime.away;
  } else if (hasScorePair(regularTime)) {
    home_score = regularTime.home;
    away_score = regularTime.away;
  }

  return {
    home_score,
    away_score,
    penalty_home_score: wentToPenalties ? apiMatch.score.penalties.home : null,
    penalty_away_score: wentToPenalties ? apiMatch.score.penalties.away : null,
    went_to_penalties: wentToPenalties,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cron/sync
// Called every minute by Vercel cron. Fetches live match data from
// football-data.org (primary) then worldcup26.ir (fallback), and pushes
// updates to the Supabase `matches` table.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  // Allow either a CRON_SECRET query param or Authorization header
  const { searchParams } = new URL(request.url);
  const secret =
    searchParams.get("secret") ||
    request.headers.get("Authorization")?.replace("Bearer ", "");

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // ── 1. Load existing DB matches ─────────────────────────────────────────
  const { data: dbMatches, error: dbErr } = await supabase
    .from("matches")
    .select(
      "id, status, home_score, away_score, penalty_home_score, penalty_away_score, went_to_penalties, minute, home_team, away_team, kickoff",
    );

  if (dbErr || !dbMatches) {
    return NextResponse.json(
      { error: `DB Error: ${dbErr?.message}` },
      { status: 500 },
    );
  }

  // ── 2. Fetch from football-data.org (primary) ────────────────────────────
  let apiMatches: any[] = [];
  let apiSource = "none";

  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      {
        headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY ?? "" },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (res.ok) {
      const data = await res.json();
      apiMatches = data.matches || [];
      apiSource = "football-data.org";
    } else {
      console.warn(`[Sync] football-data.org returned ${res.status}`);
    }
  } catch (err: any) {
    console.warn(`[Sync] football-data.org failed: ${err.message}`);
  }

  // ── 3. Fallback: worldcup26.ir ───────────────────────────────────────────
  if (apiMatches.length === 0) {
    try {
      const res = await fetch("https://worldcup26.ir/get/games", {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const games = data.games || data;
        // Convert worldcup26.ir format to unified format
        apiMatches = games.map((g: any) => {
          let status = "SCHEDULED";
          if (
            g.finished === "TRUE" ||
            g.finished === true ||
            g.time_elapsed === "finished"
          ) {
            status = "FINISHED";
          } else if (
            g.time_elapsed &&
            g.time_elapsed !== "notstarted" &&
            g.time_elapsed !== "finished"
          ) {
            status = "IN_PLAY";
          }
          return {
            _wcirId: parseInt(g.id),
            homeTeam: { name: g.home_team_name_en || g.home_team_label },
            awayTeam: { name: g.away_team_name_en || g.away_team_label },
            status,
            minute:
              status === "IN_PLAY" ? parseInt(g.time_elapsed) || null : null,
            score: {
              fullTime: {
                home:
                  status === "SCHEDULED" ? null : parseInt(g.home_score) || 0,
                away:
                  status === "SCHEDULED" ? null : parseInt(g.away_score) || 0,
              },
            },
          };
        });
        apiSource = "worldcup26.ir";
      }
    } catch (err: any) {
      console.warn(`[Sync] worldcup26.ir also failed: ${err.message}`);
    }
  }

  if (apiMatches.length === 0) {
    return NextResponse.json(
      {
        error: "All APIs unavailable. DB unchanged.",
        source: apiSource,
      },
      { status: 502 },
    );
  }

  // ── 4. Match API results to DB rows ──────────────────────────────────────
  // Strategy: match by home_team code + away_team code (both in DB)
  // football-data.org uses team names → convert to codes first
  let updatedCount = 0;
  const newlyFinished: string[] = [];

  for (const dbMatch of dbMatches) {
    // Find the corresponding API match
    let apiMatch: any = null;

    if (apiSource === "football-data.org") {
      // Match by team codes via name→code lookup
      apiMatch = apiMatches.find((m: any) => {
        const homeCode = NAME_TO_CODE[m.homeTeam?.name] || m.homeTeam?.tla;
        const awayCode = NAME_TO_CODE[m.awayTeam?.name] || m.awayTeam?.tla;
        return homeCode === dbMatch.home_team && awayCode === dbMatch.away_team;
      });
    } else {
      // worldcup26.ir: match by team name→code
      apiMatch = apiMatches.find((m: any) => {
        const homeCode = NAME_TO_CODE[m.homeTeam?.name];
        const awayCode = NAME_TO_CODE[m.awayTeam?.name];
        return homeCode === dbMatch.home_team && awayCode === dbMatch.away_team;
      });
    }

    if (!apiMatch) continue;

    // Determine status
    let status = "upcoming";
    if (apiMatch.status === "FINISHED") status = "finished";
    else if (
      apiMatch.status === "IN_PLAY" ||
      apiMatch.status === "PAUSED" ||
      apiMatch.status === "HALFTIME"
    )
      status = "live";

    // SAFETY: never revert a finished match to upcoming
    if (dbMatch.status === "finished" && status === "upcoming") continue;

    // Determine minute
    let minute: number | null = null;
    if (status === "live") {
      minute = apiMatch.minute ?? null;
    }

    // Determine scores
    const scoreData =
      status === "upcoming"
        ? {
            home_score: null,
            away_score: null,
            penalty_home_score: null,
            penalty_away_score: null,
            went_to_penalties: false,
          }
        : extractScore(apiMatch);

    // Only write if something actually changed
    const changed =
      dbMatch.status !== status ||
      dbMatch.home_score !== scoreData.home_score ||
      dbMatch.away_score !== scoreData.away_score ||
      dbMatch.penalty_home_score !== scoreData.penalty_home_score ||
      dbMatch.penalty_away_score !== scoreData.penalty_away_score ||
      dbMatch.went_to_penalties !== scoreData.went_to_penalties ||
      dbMatch.minute !== minute;

    if (!changed) continue;

    const { error: updateErr } = await supabase
      .from("matches")
      .update({ status, ...scoreData, minute })
      .eq("id", dbMatch.id);

    if (updateErr) {
      console.error(
        `[Sync] Failed to update match ${dbMatch.id}: ${updateErr.message}`,
      );
      continue;
    }

    updatedCount++;

    // Track newly finished matches for scoring
    if (status === "finished" && dbMatch.status !== "finished") {
      newlyFinished.push(dbMatch.id);
    }
  }

  // ── 5. Trigger scoring for newly finished matches ────────────────────────
  const scoringResults: any[] = [];
  for (const matchId of newlyFinished) {
    try {
      const scoringUrl = new URL("/api/scoring", request.url).toString();
      const r = await fetch(scoringUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-scoring-secret": process.env.SCORING_SECRET ?? "",
        },
        body: JSON.stringify({ match_id: matchId }),
      });
      const result = await r.json();
      scoringResults.push({ match_id: matchId, ...result });
    } catch (err: any) {
      scoringResults.push({ match_id: matchId, error: err.message });
    }
  }

  return NextResponse.json({
    success: true,
    source: apiSource,
    total_api_matches: apiMatches.length,
    updated: updatedCount,
    newly_finished: newlyFinished,
    scoring: scoringResults,
  });
}
