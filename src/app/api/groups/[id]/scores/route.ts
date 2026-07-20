// src/app/api/groups/[id]/scores/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/pagination";
import {
  computeFreshScores,
  normalizeBracketPickForScoring,
} from "@/lib/fresh-scores";
import { scoreMatch } from "@/lib/scoring";
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from "@/lib/wc2026-data";

export const dynamic = "force-dynamic";

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];
const isKnockout = (groupLabel: string) =>
  ["R32", "R16", "QF", "SF", "3RD", "FINAL"].includes(groupLabel);

const TEAM_NAME_TO_CODE: Record<string, string> = {
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
  Curacao: "CUW",
  Netherlands: "NED",
  Japan: "JPN",
  "Ivory Coast": "CIV",
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

function isGroupStageLabel(groupLabel?: string | null) {
  return (
    !groupLabel ||
    !["R32", "R16", "QF", "SF", "3RD", "FINAL"].includes(groupLabel)
  );
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

function extractScoreAfterExtraTime(apiMatch: any) {
  const regularTime = apiMatch.score?.regularTime;
  const extraTime = apiMatch.score?.extraTime;
  const fullTime = apiMatch.score?.fullTime;

  if (hasScorePair(extraTime) && hasScorePair(regularTime)) {
    const combined = addScores(regularTime, extraTime);
    if (sameScore(fullTime, combined) || sameScore(fullTime, extraTime))
      return fullTime;
    if (
      extraTime.home >= regularTime.home &&
      extraTime.away >= regularTime.away
    )
      return extraTime;
    return combined;
  }
  if (hasScorePair(fullTime)) return fullTime;
  if (hasScorePair(regularTime)) return regularTime;
  return { home: null, away: null };
}

// Mirror of the same pattern used in leaderboard/page.tsx
async function fetchApiFinishedMatches(dbMatches: any[]): Promise<any[]> {
  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      {
        headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY ?? "" },
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      },
    );
    if (!res.ok) return [];

    const data = await res.json();
    const finished: any[] = [];

    for (const apiMatch of data.matches ?? []) {
      if (apiMatch.status !== "FINISHED") continue;

      const homeCode =
        TEAM_NAME_TO_CODE[apiMatch.homeTeam?.name] || apiMatch.homeTeam?.tla;
      const awayCode =
        TEAM_NAME_TO_CODE[apiMatch.awayTeam?.name] || apiMatch.awayTeam?.tla;
      const score = extractScoreAfterExtraTime(apiMatch);
      const homeScore = score.home;
      const awayScore = score.away;

      if (
        !homeCode ||
        !awayCode ||
        typeof homeScore !== "number" ||
        typeof awayScore !== "number"
      )
        continue;

      const dbMatch = dbMatches.find(
        (m: any) => m.home_team === homeCode && m.away_team === awayCode,
      );
      if (!dbMatch) {
        console.warn("[GroupScores] Finished API match has no DB match", {
          home: homeCode,
          away: awayCode,
          status: apiMatch.status,
        });
        continue;
      }

      const staticMatch = ALL_MATCHES.find((m) => m.id === dbMatch.id);
      if (!staticMatch) continue;
      const apiQualifier =
        apiMatch.score?.winner === "HOME_TEAM"
          ? homeCode
          : apiMatch.score?.winner === "AWAY_TEAM"
            ? awayCode
            : null;
      const wentToPenalties =
        apiMatch.score?.penalties?.home !== null &&
        apiMatch.score?.penalties?.home !== undefined;

      finished.push({
        ...staticMatch,
        home_team: dbMatch.home_team ?? homeCode,
        away_team: dbMatch.away_team ?? awayCode,
        stage:
          dbMatch?.stage ??
          (isGroupStageLabel(staticMatch.group_label)
            ? "group"
            : staticMatch.group_label),
        qualifier: dbMatch?.qualifier ?? apiQualifier ?? null,
        home_score: homeScore,
        away_score: awayScore,
        went_to_penalties: wentToPenalties,
        penalty_home_score: wentToPenalties
          ? apiMatch.score.penalties.home
          : (dbMatch.penalty_home_score ?? null),
        penalty_away_score: wentToPenalties
          ? apiMatch.score.penalties.away
          : (dbMatch.penalty_away_score ?? null),
        status: "finished",
      });
    }

    return finished;
  } catch {
    return [];
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: group } = await supabase
    .from("groups")
    .select("id")
    .eq("id", id)
    .single();

  if (!group)
    return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const members = await fetchAllRows(
    supabase
      .from("group_members")
      .select(
        "user_id, joined_at, profile:profiles(display_name, email, avatar_initials, avatar_color)",
      )
      .eq("group_id", id),
  );

  if (!members.some((m: any) => m.user_id === user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const memberIds = members.map((m: any) => m.user_id);
  if (memberIds.length === 0) {
    return NextResponse.json({
      scores: [],
      member_count: 0,
      members_preview: [],
    });
  }

  const [predictions, bracketPicks, matchesData, liveMatchesData] =
    await Promise.all([
      fetchAllRows(
        supabase.from("predictions").select("*").in("user_id", memberIds),
      ),
      fetchAllRows(
        supabase.from("live_ko_picks").select("*").in("user_id", memberIds),
      ),
      fetchAllRows(supabase.from("matches").select("*")),
      fetchAllRows(supabase.from("matches").select("*").eq("status", "live")),
    ]);

  // ── Build effective finished matches (DB + API, same as leaderboard) ──────
  const dbFinishedMatches = matchesData.filter(
    (m: any) =>
      m.status === "finished" && m.home_score !== null && m.away_score !== null,
  );

  const apiFinishedMatches = await fetchApiFinishedMatches(matchesData);
  const apiFinishedIds = new Set(apiFinishedMatches.map((m: any) => m.id));

  const effectiveFinishedMatches = [
    ...apiFinishedMatches,
    ...dbFinishedMatches.filter((m: any) => !apiFinishedIds.has(m.id)),
  ].sort(
    (a: any, b: any) =>
      new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
  );

  // ── Compute base scores from all finished matches ─────────────────────────
  const totals = computeFreshScores(
    memberIds,
    effectiveFinishedMatches,
    predictions,
    bracketPicks,
  );

  // ── Live bonus (IN_PLAY / PAUSED matches from external API) ───────────────
  let liveApiMatches: any[] = [];
  try {
    const liveRes = await fetch(
      new URL("/api/matches/live", request.url).toString(),
      { cache: "no-store", signal: AbortSignal.timeout(4000) },
    );
    if (liveRes.ok) {
      const liveData = await liveRes.json();
      liveApiMatches = liveData.matches ?? [];
    }
  } catch {
    liveApiMatches = [];
  }

  const liveMatchIds = new Set(liveMatchesData.map((m: any) => m.id));
  const effectiveFinishedIds = new Set(
    effectiveFinishedMatches.map((m: any) => m.id),
  );

  // Predictions for live matches only
  const livePredictions =
    liveMatchesData.length > 0
      ? [
          ...predictions.filter((p: any) => liveMatchIds.has(p.match_id)),
          ...bracketPicks
            .map(normalizeBracketPickForScoring)
            .filter((p: any) => liveMatchIds.has(p.match_id)),
        ]
      : [];

  const liveTotalsByUser = new Map<
    string,
    { points: number; exact: number; correct: number }
  >();

  for (const match of liveMatchesData) {
    const staticMatch = ALL_MATCHES.find((m) => m.id === match.id);
    if (!staticMatch) continue;

    // Skip if already counted in effectiveFinishedMatches
    if (effectiveFinishedIds.has(match.id)) continue;

    const effHome = match.home_team ?? staticMatch.home_team;
    const effAway = match.away_team ?? staticMatch.away_team;
    const apiMatch = liveApiMatches.find(
      (l) => l.homeTeam?.tla === effHome && l.awayTeam?.tla === effAway,
    );

    if (apiMatch?.status !== "IN_PLAY" && apiMatch?.status !== "PAUSED")
      continue;

    const hScore = apiMatch.score?.fullTime?.home;
    const aScore = apiMatch.score?.fullTime?.away;
    if (typeof hScore !== "number" || typeof aScore !== "number") continue;

    for (const pred of livePredictions.filter(
      (p: any) => p.match_id === match.id,
    )) {
      const ko = isKnockout(staticMatch.group_label);
      if (
        typeof pred.home_score !== "number" ||
        typeof pred.away_score !== "number"
      )
        continue;

      const result = scoreMatch(
        pred.home_score,
        pred.away_score,
        hScore,
        aScore,
        ko,
        {
          predQualifier: pred.qualifier_pick ?? pred.team_code ?? null,
          realQualifier: match.qualifier ?? staticMatch.qualifier ?? null,
        },
      );

      const current = liveTotalsByUser.get(pred.user_id) ?? {
        points: 0,
        exact: 0,
        correct: 0,
      };
      current.points += result.total;
      if (result.type === "exact") current.exact += 1;
      if (result.type === "correct") current.correct += 1;
      liveTotalsByUser.set(pred.user_id, current);
    }
  }

  // ── Build final scores array ───────────────────────────────────────────────
  const scores = members
    .map((m: any) => {
      const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      const total = totals.get(m.user_id);
      const liveTotal = liveTotalsByUser.get(m.user_id) ?? {
        points: 0,
        exact: 0,
        correct: 0,
      };
      const displayName = profile?.display_name ?? profile?.email ?? "Player";

      return {
        user_id: m.user_id,
        group_id: id,
        display_name: displayName,
        joined_at: m.joined_at,
        total_points: (total?.total_points ?? 0) + liveTotal.points,
        exact_scores: (total?.exact_scores ?? 0) + liveTotal.exact,
        correct_results: (total?.correct_results ?? 0) + liveTotal.correct,
        streak: total?.streak ?? 0,
        live_bonus: liveTotal.points,
        profile: {
          id: m.user_id,
          email: profile?.email ?? "",
          display_name: displayName,
          avatar_initials: profile?.avatar_initials ?? "PL",
          avatar_color: profile?.avatar_color ?? "#555",
          created_at: "",
        },
      };
    })
    .sort(
      (a, b) =>
        b.total_points - a.total_points ||
        b.exact_scores - a.exact_scores ||
        a.display_name.localeCompare(b.display_name),
    );

  return NextResponse.json(
    {
      scores,
      member_count: members.length,
      members_preview: scores
        .slice(0, 5)
        .map((s) => ({ display_name: s.display_name })),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
