import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/pagination";
import Nav from "@/components/Nav";
import {
  GROUP_MATCHES,
  KNOCKOUT_MATCHES,
  getFlagUrl,
  TEAMS,
} from "@/lib/wc2026-data";

export const revalidate = 600; // Cache 10 minutes

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];

function getMatchOutcome(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "HOME_WIN";
  if (homeScore < awayScore) return "AWAY_WIN";
  return "DRAW";
}

export default async function PulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = profileData;
  }

  // --- 1. Fetch All Data ---
  const [finalPicks, sfPicks, matchesData, allPreds] = await Promise.all([
    fetchAllRows(
      supabase.from("live_ko_picks").select("team_code").eq("round", "final"),
    ),
    fetchAllRows(
      supabase
        .from("live_ko_picks")
        .select("user_id, team_code")
        .eq("round", "qf"),
    ),
    supabase.from("matches").select("*"),
    fetchAllRows(
      supabase.from("predictions").select("match_id, home_score, away_score"),
    ),
  ]);

  const dbMatches = matchesData.data || [];

  // --- 2. Consensus Champions ---
  const winnerCounts: Record<string, number> = {};
  let totalWinnerPicks = 0;
  finalPicks.forEach((pick: any) => {
    if (pick.team_code) {
      winnerCounts[pick.team_code] = (winnerCounts[pick.team_code] || 0) + 1;
      totalWinnerPicks++;
    }
  });
  const topWinners = Object.entries(winnerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([team_code, count]) => ({
      team_code,
      percentage: Math.round((count / totalWinnerPicks) * 100),
      count,
      name: TEAMS.find((t) => t.code === team_code)?.name || team_code,
    }));

  // --- 3. Goal Expectancy & Most Lethal Attack ---
  let totalPreds = 0;
  const goalBuckets: Record<string, number> = {
    "0": 0,
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5+": 0,
  };
  let totalPredictedGoals = 0;

  const teamGoalsData: Record<
    string,
    { totalGoals: number; matchCount: number }
  > = {};
  const matchDict: Record<string, any> = {};
  ALL_MATCHES.forEach((m) => {
    matchDict[m.id] = m;
  });

  allPreds.forEach((p: any) => {
    totalPreds++;
    const goals = p.home_score + p.away_score;
    totalPredictedGoals += goals;
    if (goals >= 5) goalBuckets["5+"]++;
    else goalBuckets[String(goals)]++;

    const m = matchDict[p.match_id];
    if (m) {
      if (!teamGoalsData[m.home_team])
        teamGoalsData[m.home_team] = { totalGoals: 0, matchCount: 0 };
      teamGoalsData[m.home_team].totalGoals += p.home_score;
      teamGoalsData[m.home_team].matchCount += 1;

      if (!teamGoalsData[m.away_team])
        teamGoalsData[m.away_team] = { totalGoals: 0, matchCount: 0 };
      teamGoalsData[m.away_team].totalGoals += p.away_score;
      teamGoalsData[m.away_team].matchCount += 1;
    }
  });

  const avgPredictedGoals = totalPreds
    ? (totalPredictedGoals / totalPreds).toFixed(2)
    : "0.00";

  let totalRealGoals = 0;
  let finishedCount = 0;
  dbMatches
    .filter((m) => m.status === "finished")
    .forEach((m) => {
      if (
        typeof m.home_score === "number" &&
        typeof m.away_score === "number"
      ) {
        totalRealGoals += m.home_score + m.away_score;
        finishedCount++;
      }
    });
  const avgRealGoals = finishedCount
    ? (totalRealGoals / finishedCount).toFixed(2)
    : "0.00";

  // Histogram: compute max count across buckets for pixel-height scaling
  const bucketEntries = Object.entries(goalBuckets);
  const maxBucketCount = Math.max(...bucketEntries.map(([, c]) => c), 1);
  const MAX_BAR_PX = 120; // hard max height in pixels

  // Lethal Attack — predicted
  // Also compute actual goals from finished matches
  const teamActualGoals: Record<
    string,
    { totalGoals: number; matchCount: number }
  > = {};
  dbMatches
    .filter(
      (m) =>
        m.status === "finished" &&
        typeof m.home_score === "number" &&
        typeof m.away_score === "number",
    )
    .forEach((m) => {
      // Find the static match data to get team codes
      const staticMatch = ALL_MATCHES.find((sm) => sm.id === m.id);
      if (!staticMatch) return;
      if (!teamActualGoals[staticMatch.home_team])
        teamActualGoals[staticMatch.home_team] = {
          totalGoals: 0,
          matchCount: 0,
        };
      teamActualGoals[staticMatch.home_team].totalGoals += m.home_score;
      teamActualGoals[staticMatch.home_team].matchCount += 1;

      if (!teamActualGoals[staticMatch.away_team])
        teamActualGoals[staticMatch.away_team] = {
          totalGoals: 0,
          matchCount: 0,
        };
      teamActualGoals[staticMatch.away_team].totalGoals += m.away_score;
      teamActualGoals[staticMatch.away_team].matchCount += 1;
    });

  const lethalAttacks = Object.entries(teamGoalsData)
    .map(([teamCode, data]) => {
      const actual = teamActualGoals[teamCode];
      return {
        teamCode,
        avgGoals: data.matchCount > 0 ? data.totalGoals / data.matchCount : 0,
        actualAvg:
          actual && actual.matchCount > 0
            ? actual.totalGoals / actual.matchCount
            : null,
      };
    })
    .filter((t) => t.avgGoals > 0)
    .sort((a, b) => b.avgGoals - a.avgGoals)
    .slice(0, 5);

  // --- 4. Match-by-Match Analysis ---
  const matchAnalysis: any[] = [];
  const heatmap: {
    isCorrect: boolean;
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }[] = [];

  ALL_MATCHES.forEach((match) => {
    const preds = allPreds.filter((p: any) => p.match_id === match.id);
    if (preds.length === 0) return;

    let h = 0,
      d = 0,
      a = 0;
    let matchGoals = 0;
    let zeroZeroCount = 0;

    preds.forEach((p: any) => {
      const out = getMatchOutcome(p.home_score, p.away_score);
      if (out === "HOME_WIN") h++;
      else if (out === "DRAW") d++;
      else a++;
      matchGoals += p.home_score + p.away_score;
      if (p.home_score === 0 && p.away_score === 0) zeroZeroCount++;
    });

    const hp = (h / preds.length) * 100;
    const dp = (d / preds.length) * 100;
    const ap = (a / preds.length) * 100;

    const avgMatchGoals = matchGoals / preds.length;
    const zeroZeroPct = (zeroZeroCount / preds.length) * 100;

    const conviction = Math.max(hp, dp, ap);
    let convictionPick = "Draw";
    if (conviction === hp) convictionPick = match.home_team;
    if (conviction === ap) convictionPick = match.away_team;

    const diff =
      Math.abs(hp - 33.3) + Math.abs(dp - 33.3) + Math.abs(ap - 33.3);
    const polarizationScore = 100 - (diff / 133.3) * 100;

    let actualOutcomePct = null;
    const dbMatch = dbMatches.find((m) => m.id === match.id);
    const isFinished = dbMatch?.status === "finished";

    if (
      isFinished &&
      dbMatch.home_score !== null &&
      dbMatch.away_score !== null
    ) {
      const realOut = getMatchOutcome(dbMatch.home_score, dbMatch.away_score);
      if (realOut === "HOME_WIN") actualOutcomePct = hp;
      else if (realOut === "DRAW") actualOutcomePct = dp;
      else actualOutcomePct = ap;

      const mostPredictedOutcome =
        hp > dp && hp > ap
          ? "HOME_WIN"
          : ap > hp && ap > dp
            ? "AWAY_WIN"
            : "DRAW";
      heatmap.push({
        isCorrect: realOut === mostPredictedOutcome,
        matchId: match.id,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        homeScore: dbMatch.home_score,
        awayScore: dbMatch.away_score,
      });
    }

    matchAnalysis.push({
      match,
      totalPreds: preds.length,
      hp,
      dp,
      ap,
      conviction,
      convictionPick,
      polarizationScore,
      isFinished,
      actualOutcomePct,
      realHomeScore: dbMatch?.home_score,
      realAwayScore: dbMatch?.away_score,
      avgMatchGoals,
      zeroZeroPct,
    });
  });

  const upcomingAnalysis = matchAnalysis.filter(
    (m) => !m.isFinished && m.totalPreds > 0,
  );

  const highestConviction = [...upcomingAnalysis].sort(
    (a, b) => b.conviction - a.conviction,
  )[0];
  const mostPolarizing = [...upcomingAnalysis].sort(
    (a, b) => b.polarizationScore - a.polarizationScore,
  )[0];
  const goalFest = [...upcomingAnalysis].sort(
    (a, b) => b.avgMatchGoals - a.avgMatchGoals,
  )[0];
  const snoozeFest = [...upcomingAnalysis].sort(
    (a, b) => b.zeroZeroPct - a.zeroZeroPct,
  )[0];

  const finishedAnalysis = matchAnalysis.filter(
    (m) => m.isFinished && m.actualOutcomePct !== null,
  );
  const biggestUpset = [...finishedAnalysis].sort(
    (a, b) => a.actualOutcomePct - b.actualOutcomePct,
  )[0];

  // Podium helpers
  const podiumGold = topWinners[0];
  const podiumSilver = topWinners[1];
  const podiumBronze = topWinners[2];
  const runnerUps = topWinners.slice(3, 5);

  // --- Golden 4: Teams reaching the semis (= QF winners) ---
  // Each user picks 4 QF winners. We want: "What % of USERS have this team in their semis?"
  const sfUserTeams: Record<string, Set<string>> = {}; // team_code -> Set of user_ids
  const sfUniqueUsers = new Set<string>();
  sfPicks.forEach((pick: any) => {
    if (pick.team_code && pick.user_id) {
      sfUniqueUsers.add(pick.user_id);
      if (!sfUserTeams[pick.team_code]) sfUserTeams[pick.team_code] = new Set();
      sfUserTeams[pick.team_code].add(pick.user_id);
    }
  });
  const totalSfUsers = sfUniqueUsers.size;
  const golden4 = Object.entries(sfUserTeams)
    .map(([team_code, users]) => ({
      team_code,
      percentage:
        totalSfUsers > 0 ? Math.round((users.size / totalSfUsers) * 100) : 0,
      name: TEAMS.find((t) => t.code === team_code)?.name || team_code,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--black)",
        color: "var(--cream)",
      }}
    >
      <Nav initials={profile?.avatar_initials ?? "PL"} isGuest={!user} />

      <div
        className="resp-padding"
        style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 5% 60px" }}
      >
        <div style={{ marginBottom: 40 }}>
          <h1
            className="pulse-hero-title"
            style={{
              fontFamily: "Bebas Neue",
              fontSize: 64,
              color: "var(--cream)",
              letterSpacing: 1,
              lineHeight: 1,
            }}
          >
            PULSE <span style={{ color: "var(--gold)" }}>ANALYTICS</span>
          </h1>
          <p
            className="pulse-hero-sub"
            style={{ color: "var(--muted)", marginTop: 8, fontSize: 16 }}
          >
            Deep data insights derived from {totalPreds.toLocaleString()} global
            predictions.
          </p>
        </div>

        {/* ============================================= */}
        {/* ROW 0 — FULL-WIDTH PODIUM                     */}
        {/* ============================================= */}
        <div
          style={{
            background: "var(--surface2)",
            borderRadius: 20,
            padding: "32px 24px 24px",
            border: "1px solid var(--border)",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--dim)",
              textTransform: "uppercase",
              letterSpacing: 1.5,
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            Consensus Champions
          </h2>

          {topWinners.length >= 3 ? (
            <>
              {/* Podium: 2nd — 1st — 3rd */}
              <div
                className="pulse-podium"
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: 16,
                  marginBottom: 32,
                }}
              >
                {/* 2nd Place — Silver */}
                <div
                  className="pulse-podium-2"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: 140,
                  }}
                >
                  <div
                    className="pulse-podium-badge"
                    style={{ display: "none", color: "#c0c0c0" }}
                  >
                    2ND
                  </div>
                  <img
                    className="pulse-podium-img"
                    src={getFlagUrl(podiumSilver.team_code)}
                    alt={podiumSilver.team_code}
                    width={48}
                    height={36}
                    style={{
                      borderRadius: 6,
                      border: "2px solid #c0c0c0",
                      marginBottom: 12,
                    }}
                  />
                  <div className="pulse-podium-info">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--cream)",
                        textAlign: "center",
                        marginBottom: 4,
                      }}
                    >
                      {podiumSilver.name}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        fontFamily: "Bebas Neue",
                        color: "#c0c0c0",
                        letterSpacing: 1,
                        textAlign: "center",
                      }}
                    >
                      {podiumSilver.percentage}%
                    </div>
                  </div>
                  <div
                    className="pulse-podium-block"
                    style={{
                      width: "100%",
                      height: 80,
                      marginTop: 12,
                      background:
                        "linear-gradient(180deg, #c0c0c0 0%, #888 100%)",
                      borderRadius: "8px 8px 0 0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 32,
                      fontWeight: 800,
                      fontFamily: "Bebas Neue",
                      color: "rgba(0,0,0,0.5)",
                    }}
                  >
                    2
                  </div>
                </div>

                {/* 1st Place — Gold */}
                <div
                  className="pulse-podium-1"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: 160,
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 4 }}>🏆</div>
                  <img
                    className="pulse-podium-img"
                    src={getFlagUrl(podiumGold.team_code)}
                    alt={podiumGold.team_code}
                    width={56}
                    height={42}
                    style={{
                      borderRadius: 6,
                      border: "2px solid var(--gold)",
                      boxShadow: "0 0 20px rgba(212,175,55,0.4)",
                      marginBottom: 12,
                    }}
                  />
                  <div className="pulse-podium-info">
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--cream)",
                        textAlign: "center",
                        marginBottom: 4,
                      }}
                    >
                      {podiumGold.name}
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        fontFamily: "Bebas Neue",
                        color: "var(--gold)",
                        letterSpacing: 1,
                        textAlign: "center",
                      }}
                    >
                      {podiumGold.percentage}%
                    </div>
                  </div>
                  <div
                    className="pulse-podium-block"
                    style={{
                      width: "100%",
                      height: 120,
                      marginTop: 12,
                      background:
                        "linear-gradient(180deg, var(--gold) 0%, #a8860f 100%)",
                      borderRadius: "8px 8px 0 0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 40,
                      fontWeight: 800,
                      fontFamily: "Bebas Neue",
                      color: "rgba(0,0,0,0.4)",
                    }}
                  >
                    1
                  </div>
                </div>

                {/* 3rd Place — Bronze */}
                <div
                  className="pulse-podium-3"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: 140,
                  }}
                >
                  <div
                    className="pulse-podium-badge"
                    style={{ display: "none", color: "#cd7f32" }}
                  >
                    3RD
                  </div>
                  <img
                    className="pulse-podium-img"
                    src={getFlagUrl(podiumBronze.team_code)}
                    alt={podiumBronze.team_code}
                    width={48}
                    height={36}
                    style={{
                      borderRadius: 6,
                      border: "2px solid #cd7f32",
                      marginBottom: 12,
                    }}
                  />
                  <div className="pulse-podium-info">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--cream)",
                        textAlign: "center",
                        marginBottom: 4,
                      }}
                    >
                      {podiumBronze.name}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        fontFamily: "Bebas Neue",
                        color: "#cd7f32",
                        letterSpacing: 1,
                        textAlign: "center",
                      }}
                    >
                      {podiumBronze.percentage}%
                    </div>
                  </div>
                  <div
                    className="pulse-podium-block"
                    style={{
                      width: "100%",
                      height: 56,
                      marginTop: 12,
                      background:
                        "linear-gradient(180deg, #cd7f32 0%, #8b5b22 100%)",
                      borderRadius: "8px 8px 0 0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      fontWeight: 800,
                      fontFamily: "Bebas Neue",
                      color: "rgba(0,0,0,0.4)",
                    }}
                  >
                    3
                  </div>
                </div>
              </div>

              {/* Runner Ups: #4 and #5 */}
              {runnerUps.length > 0 && (
                <div
                  className="pulse-runnerups"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 32,
                    borderTop: "1px solid var(--border)",
                    paddingTop: 20,
                  }}
                >
                  {runnerUps.map((r, i) => (
                    <div
                      key={r.team_code}
                      className="pulse-runnerup-item"
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: "var(--dim)",
                        }}
                      >
                        #{i + 4}
                      </span>
                      <img
                        src={getFlagUrl(r.team_code)}
                        alt={r.team_code}
                        width={28}
                        height={20}
                        style={{
                          borderRadius: 4,
                          border: "1px solid var(--border)",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--cream)",
                        }}
                      >
                        {r.name}
                      </span>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          fontFamily: "Bebas Neue",
                          color: "var(--dim)",
                        }}
                      >
                        {r.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                color: "var(--muted)",
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              Not enough bracket predictions yet.
            </div>
          )}
        </div>

        {/* ============================================= */}
        {/* ROW 0.5 — GOLDEN 4 SEMIFINALISTS               */}
        {/* ============================================= */}
        {golden4.length > 0 && (
          <div
            style={{
              background: "var(--surface2)",
              borderRadius: 20,
              padding: "24px",
              border: "1px solid var(--border)",
              marginBottom: 24,
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--dim)",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Predicted Semifinalists
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "var(--muted)",
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              Percentage of users who have each team reaching the semi-finals.
            </p>

            <div
              className="pulse-golden4"
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {golden4.map((team, i) => (
                <div
                  key={team.team_code}
                  className="pulse-golden4-item"
                  style={{
                    width: 120,
                    background:
                      i < 4
                        ? "linear-gradient(145deg, rgba(212,168,67,0.12) 0%, var(--surface3) 100%)"
                        : "var(--surface3)",
                    borderRadius: 14,
                    padding: "16px 12px",
                    border:
                      i < 4
                        ? "1px solid rgba(212,168,67,0.2)"
                        : "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "center",
                  }}
                >
                  <img
                    src={getFlagUrl(team.team_code)}
                    alt={team.team_code}
                    width={40}
                    height={30}
                    style={{
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--cream)",
                      lineHeight: 1.2,
                    }}
                  >
                    {team.name}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      fontFamily: "Bebas Neue",
                      color: i < 4 ? "var(--gold)" : "var(--cream)",
                      letterSpacing: 1,
                    }}
                  >
                    {team.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================= */}
        {/* BENTO BOX GRID                                */}
        {/* ============================================= */}
        <div
          className="resp-bento-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
          }}
        >
          {/* --- ROW 1: STATS --- */}

          {/* GOAL EXPECTANCY (Fixed with pixel heights) */}
          <div
            style={{
              background: "var(--surface2)",
              borderRadius: 20,
              padding: 24,
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                }}
              >
                Goal Expectancy
              </h2>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: "var(--gold)",
                  }}
                >
                  {avgPredictedGoals}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Avg Predicted Goals
                </div>
                <div
                  style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}
                >
                  vs {avgRealGoals} Actual
                </div>
              </div>
            </div>

            {/* Bars rendered with pixel heights */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 8,
              }}
            >
              {bucketEntries.map(([label, count]) => {
                const barHeight = Math.max(
                  Math.round((count / maxBucketCount) * MAX_BAR_PX),
                  4,
                );
                const pct = totalPreds
                  ? Math.round((count / totalPreds) * 100)
                  : 0;
                const isHighlight = label === "2" || label === "3";
                return (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: pct > 0 ? "var(--cream)" : "var(--muted)",
                      }}
                    >
                      {pct}%
                    </div>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 36,
                        height: barHeight,
                        background: isHighlight
                          ? "var(--gold)"
                          : "var(--surface3)",
                        borderRadius: "4px 4px 0 0",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              {bucketEntries.map(([label]) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--dim)",
                    textAlign: "center",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 10,
                color: "var(--muted)",
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              Total Goals in Match
            </div>
          </div>

          {/* MOST LETHAL ATTACK */}
          <div
            className="pulse-bento-card"
            style={{
              background: "var(--surface2)",
              borderRadius: 20,
              padding: 24,
              border: "1px solid var(--border)",
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--dim)",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginBottom: 8,
              }}
            >
              Most Lethal Attack
            </h2>
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--gold)",
                  }}
                ></div>{" "}
                Predicted
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#10b981",
                  }}
                ></div>{" "}
                Actual
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {lethalAttacks.length > 0 ? (
                lethalAttacks.map((team, index) => (
                  <div
                    key={team.teamCode}
                    className="pulse-lethal-row"
                    style={{ display: "flex", alignItems: "center", gap: 16 }}
                  >
                    <div
                      style={{
                        width: 24,
                        fontSize: 16,
                        fontWeight: 800,
                        color: index === 0 ? "var(--gold)" : "var(--dim)",
                      }}
                    >
                      #{index + 1}
                    </div>
                    <img
                      src={getFlagUrl(team.teamCode)}
                      alt={team.teamCode}
                      width={32}
                      height={24}
                      style={{
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: "var(--cream)",
                          fontWeight: 600,
                          fontSize: 15,
                        }}
                      >
                        {TEAMS.find((t) => t.code === team.teamCode)?.name ||
                          team.teamCode}
                      </div>
                    </div>
                    <div
                      className="pulse-lethal-stats"
                      style={{ display: "flex", alignItems: "center", gap: 16 }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: index === 0 ? "var(--gold)" : "var(--cream)",
                            fontFamily: "Bebas Neue",
                            letterSpacing: 1,
                          }}
                        >
                          {team.avgGoals.toFixed(2)}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "var(--gold)",
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          Pred
                        </div>
                      </div>
                      <div
                        style={{
                          width: 1,
                          height: 28,
                          background: "var(--border)",
                        }}
                      ></div>
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color:
                              team.actualAvg !== null
                                ? "#10b981"
                                : "var(--dim)",
                            fontFamily: "Bebas Neue",
                            letterSpacing: 1,
                          }}
                        >
                          {team.actualAvg !== null
                            ? team.actualAvg.toFixed(2)
                            : "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "#10b981",
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          Actual
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    color: "var(--muted)",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  Not enough predictions yet.
                </div>
              )}
            </div>
          </div>

          {/* --- ROW 2: COMMUNITY PERFORMANCE --- */}

          {/* COMMUNITY PULSE HEATMAP */}
          <div
            className="pulse-bento-card"
            style={{
              background: "var(--surface2)",
              borderRadius: 20,
              padding: 24,
              border: "1px solid var(--border)",
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--dim)",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginBottom: 8,
              }}
            >
              Community Pulse
            </h2>
            <p
              style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}
            >
              A live heartbeat of the hivemind. Hover for match details.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignContent: "flex-start",
              }}
            >
              {heatmap.length > 0 ? (
                heatmap.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      background: h.isCorrect ? "#10b981" : "#e53935",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      opacity: 0.9,
                      cursor: "help",
                    }}
                    title={`Crowd ${h.isCorrect ? "✓ Correct" : "✗ Incorrect"}: ${h.homeTeam} ${h.homeScore} - ${h.awayScore} ${h.awayTeam}`}
                  />
                ))
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  No matches finished yet.
                </div>
              )}
            </div>

            {heatmap.length > 0 && (
              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTop: "1px solid var(--border)",
                  paddingTop: 16,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--dim)" }}>
                  Crowd Accuracy
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--cream)",
                    fontFamily: "Bebas Neue",
                    letterSpacing: 1,
                  }}
                >
                  {Math.round(
                    (heatmap.filter((h) => h.isCorrect).length /
                      heatmap.length) *
                      100,
                  )}
                  %
                </div>
              </div>
            )}
          </div>

          {/* HIGHEST CONVICTION PICK */}
          {highestConviction && (
            <div
              className="pulse-bento-card"
              style={{
                background: "var(--surface2)",
                borderRadius: 20,
                padding: 24,
                border: "1px solid var(--border)",
              }}
            >
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}
              >
                Highest Conviction
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  marginBottom: 24,
                }}
              >
                The upcoming match the crowd is most certain about.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={getFlagUrl(highestConviction.match.home_team)}
                    width={28}
                    height={20}
                    alt="home"
                  />
                  <span style={{ fontWeight: 600 }}>
                    {highestConviction.match.home_team}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>vs</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>
                    {highestConviction.match.away_team}
                  </span>
                  <img
                    src={getFlagUrl(highestConviction.match.away_team)}
                    width={28}
                    height={20}
                    alt="away"
                  />
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface3)",
                  borderRadius: 12,
                  padding: 16,
                  textAlign: "center",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: 40,
                    fontFamily: "Bebas Neue",
                    color: "var(--gold)",
                    lineHeight: 1,
                  }}
                >
                  {Math.round(highestConviction.conviction)}%
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--cream)",
                    marginTop: 8,
                  }}
                >
                  Pick {highestConviction.convictionPick} to Win
                </div>
              </div>
            </div>
          )}

          {/* --- ROW 3: MATCH HIGHLIGHTS --- */}

          {/* THE SNOOZEFEST (swapped to this row) */}
          {snoozeFest && (
            <div
              className="pulse-bento-card"
              style={{
                background:
                  "linear-gradient(145deg, #1c2e4a 0%, var(--surface2) 100%)",
                borderRadius: 20,
                padding: 24,
                border: "1px solid rgba(66, 165, 245, 0.3)",
              }}
            >
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#90caf9",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}
              >
                🧊 The Snoozefest
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  marginBottom: 20,
                }}
              >
                Highest percentage of 0-0 predictions.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={getFlagUrl(snoozeFest.match.home_team)}
                    width={28}
                    height={20}
                    alt="home"
                  />
                  <span style={{ fontWeight: 600 }}>
                    {snoozeFest.match.home_team}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>vs</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>
                    {snoozeFest.match.away_team}
                  </span>
                  <img
                    src={getFlagUrl(snoozeFest.match.away_team)}
                    width={28}
                    height={20}
                    alt="away"
                  />
                </div>
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontFamily: "Bebas Neue",
                  color: "var(--cream)",
                  lineHeight: 1,
                }}
              >
                {Math.round(snoozeFest.zeroZeroPct)}%{" "}
                <span
                  style={{
                    fontSize: 16,
                    color: "var(--dim)",
                    fontFamily: "Inter",
                  }}
                >
                  Predict 0-0
                </span>
              </div>
            </div>
          )}

          {/* THE GOAL FEST */}
          {goalFest && (
            <div
              className="pulse-bento-card"
              style={{
                background:
                  "linear-gradient(145deg, #4a1c1c 0%, var(--surface2) 100%)",
                borderRadius: 20,
                padding: 24,
                border: "1px solid rgba(229, 57, 53, 0.3)",
              }}
            >
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ff8a80",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}
              >
                🔥 The Goal Fest
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  marginBottom: 20,
                }}
              >
                Highest predicted average goals.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={getFlagUrl(goalFest.match.home_team)}
                    width={28}
                    height={20}
                    alt="home"
                  />
                  <span style={{ fontWeight: 600 }}>
                    {goalFest.match.home_team}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>vs</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>
                    {goalFest.match.away_team}
                  </span>
                  <img
                    src={getFlagUrl(goalFest.match.away_team)}
                    width={28}
                    height={20}
                    alt="away"
                  />
                </div>
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontFamily: "Bebas Neue",
                  color: "var(--cream)",
                  lineHeight: 1,
                }}
              >
                {goalFest.avgMatchGoals.toFixed(2)}{" "}
                <span
                  style={{
                    fontSize: 16,
                    color: "var(--dim)",
                    fontFamily: "Inter",
                  }}
                >
                  Goals/Game
                </span>
              </div>
            </div>
          )}

          {/* --- ROW 4: ANOMALIES --- */}

          {/* MOST POLARIZING MATCH (moved here) */}
          {mostPolarizing && (
            <div
              className="pulse-bento-card"
              style={{
                background: "var(--surface2)",
                borderRadius: 20,
                padding: 24,
                border: "1px solid var(--border)",
              }}
            >
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}
              >
                Most Polarizing
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  marginBottom: 24,
                }}
              >
                The most fiercely debated upcoming match.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={getFlagUrl(mostPolarizing.match.home_team)}
                    width={28}
                    height={20}
                    alt="home"
                  />
                  <span style={{ fontWeight: 600 }}>
                    {mostPolarizing.match.home_team}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>vs</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>
                    {mostPolarizing.match.away_team}
                  </span>
                  <img
                    src={getFlagUrl(mostPolarizing.match.away_team)}
                    width={28}
                    height={20}
                    alt="away"
                  />
                </div>
              </div>

              {/* Split Bar */}
              <div
                style={{
                  display: "flex",
                  height: 16,
                  borderRadius: 8,
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: `${mostPolarizing.hp}%`,
                    background: "var(--gold)",
                  }}
                ></div>
                <div
                  style={{
                    width: `${mostPolarizing.dp}%`,
                    background: "var(--dim)",
                  }}
                ></div>
                <div
                  style={{
                    width: `${mostPolarizing.ap}%`,
                    background: "#e53935",
                  }}
                ></div>
              </div>

              <div
                className="pulse-polar-bar"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span style={{ color: "var(--gold)" }}>
                  {Math.round(mostPolarizing.hp)}% H
                </span>
                <span style={{ color: "var(--dim)" }}>
                  {Math.round(mostPolarizing.dp)}% D
                </span>
                <span style={{ color: "#e53935" }}>
                  {Math.round(mostPolarizing.ap)}% A
                </span>
              </div>
            </div>
          )}

          {/* BIGGEST CROWD UPSET */}
          {biggestUpset && (
            <div
              className="pulse-bento-card pulse-bento-span-2"
              style={{
                background: "var(--surface2)",
                borderRadius: 20,
                padding: 24,
                border: "1px solid var(--border)",
              }}
            >
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}
              >
                Biggest Crowd Upset
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  marginBottom: 20,
                }}
              >
                The finished match that shocked the platform.
              </p>

              <div
                className="resp-upset-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  background: "var(--black)",
                  padding: "16px 24px",
                  borderRadius: 16,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <img
                    src={getFlagUrl(biggestUpset.match.home_team)}
                    width={32}
                    height={24}
                    alt="home"
                    style={{ borderRadius: 4 }}
                  />
                  <div
                    style={{
                      fontSize: 24,
                      fontFamily: "Bebas Neue",
                      color: "var(--cream)",
                      letterSpacing: 1,
                    }}
                  >
                    {biggestUpset.realHomeScore} - {biggestUpset.realAwayScore}
                  </div>
                  <img
                    src={getFlagUrl(biggestUpset.match.away_team)}
                    width={32}
                    height={24}
                    alt="away"
                    style={{ borderRadius: 4 }}
                  />
                </div>

                <div
                  style={{ width: 1, height: 40, background: "var(--border)" }}
                ></div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--dim)",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      letterSpacing: 1,
                    }}
                  >
                    Predicted By
                  </div>
                  <div
                    style={{ fontSize: 24, fontWeight: 800, color: "#e53935" }}
                  >
                    Only {Math.round(biggestUpset.actualOutcomePct)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
