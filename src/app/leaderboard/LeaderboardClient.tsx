"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  getRobohashUrl,
  GROUP_MATCHES,
  KNOCKOUT_MATCHES,
} from "@/lib/wc2026-data";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { scoreMatch } from "@/lib/scoring";

const TOTAL_MATCHES = 104;
const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];
const isKnockout = (groupLabel: string) =>
  ["R32", "R16", "QF", "SF", "3RD", "FINAL"].includes(groupLabel);

export interface LeaderboardUser {
  id: string;
  display_name: string;
  avatar_initials: string;
  avatar_color: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  streak: number;
  group_preds: number;
  bracket_preds: number;
  total_preds: number;
}

export interface LeaderboardScope {
  key: string;
  type: "phase" | "round" | "group";
  title: string;
  short_title: string;
  subtitle: React.ReactNode;
  match_count: number;
  finished_count: number;
  users: LeaderboardUser[];
}

interface LeaderboardClientProps {
  initialLeaderboard: LeaderboardUser[];
  leaderboardScopes?: LeaderboardScope[];
  initialLiveMatches?: any[];
  initialScoredMatchIds?: string[];
  livePredictions?: any[];
  currentUserId?: string;
}

export default function LeaderboardClient({
  initialLeaderboard,
  leaderboardScopes = [],
  initialLiveMatches = [],
  initialScoredMatchIds = [],
  livePredictions = [],
  currentUserId,
}: LeaderboardClientProps) {
  const router = useRouter();
  const [currentLeaderboard, setCurrentLeaderboard] =
    useState<LeaderboardUser[]>(initialLeaderboard);
  const [liveMatches, setLiveMatches] = useState<any[]>(initialLiveMatches);
  const [activeMode, setActiveMode] = useState<
    "overall" | "group-stage" | "knockout" | "round" | "group"
  >("overall");
  const [activeRoundKey, setActiveRoundKey] = useState("gw1");
  const [activeGroupKey, setActiveGroupKey] = useState("group-a");
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCurrentLeaderboard(initialLeaderboard);
    setLiveMatches(initialLiveMatches);
  }, [initialLeaderboard, initialLiveMatches]);

  const [liveApiMatches, setLiveApiMatches] = useState<any[]>([]);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch("/api/matches/live", { cache: "no-store" });
        const data = await res.json();
        if (data.matches) setLiveApiMatches(data.matches);
      } catch {}
    };
    fetchLive();
    const interval = setInterval(fetchLive, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel("leaderboard_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores" },
        () => {
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          if (
            payload.new.status === "live" ||
            payload.new.status === "finished"
          )
            scheduleRefresh();
          setLiveMatches((prev) => {
            const matchIdx = prev.findIndex((m) => m.id === payload.new.id);
            if (payload.new.status === "live") {
              if (matchIdx >= 0) {
                const newArr = [...prev];
                newArr[matchIdx] = payload.new;
                return newArr;
              } else {
                return [...prev, payload.new];
              }
            } else {
              // If it's no longer live, remove it from live array
              return prev.filter((m) => m.id !== payload.new.id);
            }
          });
        },
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const dynamicLeaderboard = useMemo(() => {
    const scoredMatchIds = new Set(initialScoredMatchIds);
    const mapped = currentLeaderboard.map((user) => {
      let liveBonus = 0;
      let pendingFinishedBonus = 0;
      let exactBonus = 0;
      let correctBonus = 0;

      // Add temporary points from the external API. In-play points get a
      // live label; full-time points waiting for the DB sync only affect
      // the displayed total so the leaderboard matches profile totals.
      for (const match of liveMatches) {
        const staticMatch = ALL_MATCHES.find((m) => m.id === match.id);
        if (!staticMatch) continue;

        const apiMatch = liveApiMatches.find(
          (l) =>
            l.homeTeam?.tla === match.home_team &&
            l.awayTeam?.tla === match.away_team,
        );

        const isInPlay =
          apiMatch?.status === "IN_PLAY" || apiMatch?.status === "PAUSED";
        const isPendingFinished = apiMatch?.status === "FINISHED";
        if (!isInPlay && !isPendingFinished) continue;
        if (isPendingFinished && scoredMatchIds.has(match.id)) continue;

        const hScore = apiMatch.score?.fullTime?.home;
        const aScore = apiMatch.score?.fullTime?.away;

        if (typeof hScore !== "number" || typeof aScore !== "number") continue;

        const pred = livePredictions.find(
          (p) => p.user_id === user.id && p.match_id === match.id,
        );
        if (pred) {
          const ko = isKnockout(staticMatch.group_label);

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

          if (isInPlay) liveBonus += result.total;
          else pendingFinishedBonus += result.total;

          if (result.type === "exact") exactBonus += 1;
          if (result.type === "correct") correctBonus += 1;
        }
      }

      return {
        ...user,
        display_points: user.total_points + liveBonus + pendingFinishedBonus,
        live_bonus: liveBonus,
        dynamic_streak: user.streak,
        dynamic_exact: user.exact_scores + exactBonus,
        dynamic_correct: user.correct_results + correctBonus,
      };
    });
    mapped.sort(
      (a, b) =>
        b.display_points - a.display_points ||
        b.dynamic_exact - a.dynamic_exact ||
        b.dynamic_correct - a.dynamic_correct ||
        a.display_name.localeCompare(b.display_name),
    );
    return mapped;
  }, [
    currentLeaderboard,
    liveMatches,
    initialScoredMatchIds,
    livePredictions,
    liveApiMatches,
  ]);

  const top3 = dynamicLeaderboard.slice(0, 3);
  const rest = dynamicLeaderboard.slice(3);
  const podiumLayout = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd
  const phaseScopes = leaderboardScopes.filter(
    (scope) => scope.type === "phase",
  );
  const roundScopes = leaderboardScopes.filter(
    (scope) => scope.type === "round",
  );
  const groupScopes = leaderboardScopes.filter(
    (scope) => scope.type === "group",
  );
  const activeScope =
    activeMode === "group-stage"
      ? phaseScopes.find((scope) => scope.key === "group-stage")
      : activeMode === "knockout"
        ? phaseScopes.find((scope) => scope.key === "knockout")
        : activeMode === "round"
          ? (roundScopes.find((scope) => scope.key === activeRoundKey) ??
            roundScopes[0])
          : activeMode === "group"
            ? (groupScopes.find((scope) => scope.key === activeGroupKey) ??
              groupScopes[0])
            : null;
  const scopedUsers = activeScope?.users ?? [];
  const scopedTop3 = scopedUsers.slice(0, 3);
  const scopedRest = scopedUsers.slice(3);
  const scopedPodium = [scopedTop3[1], scopedTop3[0], scopedTop3[2]];

  const modeButton = (
    mode: "overall" | "group-stage" | "knockout" | "round" | "group",
    label: string,
  ) => (
    <button
      onClick={() => setActiveMode(mode)}
      style={{
        flex: "0 0 auto",
        minWidth: mode === "group" ? 148 : mode === "group-stage" ? 128 : 92,
        padding: "10px 16px",
        borderRadius: 10,
        border: "none",
        background: activeMode === mode ? "var(--surface3)" : "transparent",
        color: activeMode === mode ? "var(--cream)" : "var(--muted)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );

  const scopeButton = (scope: LeaderboardScope) => {
    const activeKey = scope.type === "round" ? activeRoundKey : activeGroupKey;
    const isActive = activeKey === scope.key;
    return (
      <button
        key={scope.key}
        onClick={() =>
          scope.type === "round"
            ? setActiveRoundKey(scope.key)
            : setActiveGroupKey(scope.key)
        }
        style={{
          minWidth: scope.type === "group" ? 48 : 74,
          padding: "10px 13px",
          borderRadius: 12,
          border: `1px solid ${isActive ? "var(--gold)" : "var(--border)"}`,
          background: isActive ? "rgba(212,168,67,0.12)" : "var(--surface2)",
          color: isActive ? "var(--gold)" : "var(--dim)",
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {scope.short_title}
      </button>
    );
  };

  return (
    <>
      <style>{`
                @media (max-width: 640px) {
                    .hide-on-mobile { display: none !important; }
                    .podium-container { transform: scale(0.85); margin-bottom: 20px !important; }
                    .scope-podium { transform: scale(0.92); transform-origin: top center; }
                    .scope-mobile-stats { display: block !important; }
                    .leaderboard-filter-card { padding: 10px !important; }
                    .leaderboard-mode-tabs { justify-content: flex-start !important; }
                    .leaderboard-scope-tabs { justify-content: flex-start !important; }
                }
            `}</style>

      <div
        className="leaderboard-filter-card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 28,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 12,
          alignItems: "center",
        }}
      >
        <div
          className="leaderboard-mode-tabs"
          style={{
            display: "flex",
            gap: 4,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 5,
            justifyContent: "center",
            maxWidth: "100%",
            overflowX: "auto",
          }}
        >
          {modeButton("overall", "Overall")}
          {modeButton("group-stage", "Group Stage")}
          {modeButton("knockout", "Knockout")}
          {modeButton("round", "Rounds")}
          {modeButton("group", "Tournament Groups")}
        </div>

        {activeMode === "round" && (
          <div
            className="leaderboard-scope-tabs"
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 2,
              justifyContent: "center",
              maxWidth: "100%",
            }}
          >
            {roundScopes.map(scopeButton)}
          </div>
        )}
        {activeMode === "group" && (
          <div
            className="leaderboard-scope-tabs"
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 2,
              justifyContent: "center",
              maxWidth: "100%",
            }}
          >
            {groupScopes.map(scopeButton)}
          </div>
        )}
      </div>

      {activeMode !== "overall" && activeScope && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--gold)",
                    textTransform: "uppercase",
                    letterSpacing: 1.4,
                    marginBottom: 6,
                  }}
                >
                  {activeScope.type === "phase"
                    ? "Phase Ranking"
                    : activeScope.type === "round"
                      ? "Round Ranking"
                      : "Tournament Group Ranking"}
                </div>
                <h2
                  style={{
                    fontFamily: "Bebas Neue",
                    fontSize: 40,
                    color: "var(--cream)",
                    margin: 0,
                    lineHeight: 1,
                  }}
                >
                  {activeScope.title}
                </h2>
                <div
                  style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}
                >
                  {activeScope.subtitle}
                </div>
              </div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  textAlign: "right",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontFamily: "Bebas Neue",
                    color: "var(--gold)",
                    lineHeight: 1,
                  }}
                >
                  {activeScope.finished_count}/{activeScope.match_count}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Matches
                </div>
              </div>
            </div>
          </div>

          {activeScope.finished_count === 0 ? (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 18,
                padding: "42px 20px",
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 14,
              }}
            >
              No completed matches in this scope yet.
            </div>
          ) : (
            <>
              {scopedTop3.length > 0 && (
                <div
                  className="scope-podium"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-end",
                    gap: 14,
                    marginBottom: 34,
                  }}
                >
                  {scopedPodium.map((user, i) => {
                    if (!user) return null;
                    const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
                    const height = rank === 1 ? 174 : rank === 2 ? 142 : 128;
                    const color =
                      rank === 1
                        ? "var(--gold)"
                        : rank === 2
                          ? "#C0C0C0"
                          : "#CD7F32";
                    const isMe = currentUserId && user.id === currentUserId;

                    return (
                      <div
                        key={user.id}
                        onClick={() => router.push(`/profile?id=${user.id}`)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          width: 124,
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            marginBottom: -18,
                            zIndex: 2,
                          }}
                        >
                          <img
                            src={getRobohashUrl(
                              user.display_name,
                              rank === 1 ? 86 : 72,
                            )}
                            alt={user.display_name}
                            style={{
                              width: rank === 1 ? 86 : 72,
                              height: rank === 1 ? 86 : 72,
                              borderRadius: "50%",
                              border: `3px solid ${color}`,
                              background: user.avatar_color,
                              objectFit: "cover",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              bottom: -5,
                              left: "50%",
                              transform: "translateX(-50%)",
                              background: color,
                              color: "#000",
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 900,
                              fontSize: 15,
                            }}
                          >
                            {rank}
                          </div>
                          {isMe && (
                            <div
                              style={{
                                position: "absolute",
                                top: -9,
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "var(--gold)",
                                color: "#000",
                                fontSize: 9,
                                padding: "2px 7px",
                                borderRadius: 8,
                                fontWeight: 900,
                              }}
                            >
                              YOU
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height,
                            background: isMe
                              ? "rgba(212,168,67,0.1)"
                              : "var(--surface2)",
                            borderTop: `1px solid ${color}`,
                            borderRight: `1px solid ${color}`,
                            borderLeft: `1px solid ${color}`,
                            borderTopLeftRadius: 14,
                            borderTopRightRadius: 14,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            padding: "30px 8px 0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: "var(--cream)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              width: "100%",
                              textAlign: "center",
                            }}
                          >
                            {user.display_name}
                          </div>
                          <div
                            style={{
                              fontSize: 30,
                              fontFamily: "Bebas Neue",
                              color,
                              marginTop: 3,
                              lineHeight: 1,
                            }}
                          >
                            {user.total_points}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--muted)",
                              textTransform: "uppercase",
                              letterSpacing: 1,
                            }}
                          >
                            PTS
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 5,
                              marginTop: 8,
                              justifyContent: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                background: "rgba(212,168,67,0.12)",
                                color: "var(--gold)",
                                padding: "2px 6px",
                                borderRadius: 8,
                                fontWeight: 900,
                              }}
                            >
                              {user.exact_scores} EX
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                background: "var(--surface3)",
                                color: "var(--cream)",
                                padding: "2px 6px",
                                borderRadius: 8,
                                fontWeight: 900,
                              }}
                            >
                              {user.correct_results} CR
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 18,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--surface2)",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  <div style={{ width: 42, textAlign: "center" }}>Rank</div>
                  <div style={{ flex: 1, paddingLeft: 14 }}>Player</div>
                  <div
                    className="hide-on-mobile"
                    style={{ width: 90, textAlign: "center" }}
                  >
                    Stats
                  </div>
                  <div style={{ width: 92, textAlign: "right" }}>Points</div>
                </div>
                {scopedRest.map((row, index) => {
                  const isMe = currentUserId && row.id === currentUserId;
                  return (
                    <div
                      key={row.id}
                      onClick={() => router.push(`/profile?id=${row.id}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "15px 18px",
                        borderBottom: "1px solid var(--border)",
                        background: isMe
                          ? "rgba(212,168,67,0.06)"
                          : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          textAlign: "center",
                          fontFamily: "Bebas Neue",
                          fontSize: 22,
                          color: "var(--muted)",
                        }}
                      >
                        {index + 4}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          paddingLeft: 14,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          minWidth: 0,
                        }}
                      >
                        <img
                          src={getRobohashUrl(row.display_name, 52)}
                          alt={row.display_name}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: row.avatar_color,
                            border: "2px solid var(--border)",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: isMe ? "var(--gold)" : "var(--cream)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {row.display_name}
                          </div>
                          <div
                            className="scope-mobile-stats"
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              marginTop: 2,
                              display: "none",
                            }}
                          >
                            {row.exact_scores} EX · {row.correct_results} CR
                          </div>
                        </div>
                      </div>
                      <div
                        className="hide-on-mobile"
                        style={{
                          width: 90,
                          display: "flex",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            background: "rgba(212,168,67,0.1)",
                            color: "var(--gold)",
                            padding: "2px 7px",
                            borderRadius: 10,
                            fontWeight: 800,
                          }}
                        >
                          {row.exact_scores} EX
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            background: "var(--surface3)",
                            color: "var(--cream)",
                            padding: "2px 7px",
                            borderRadius: 10,
                            fontWeight: 800,
                          }}
                        >
                          {row.correct_results} CR
                        </span>
                      </div>
                      <div
                        style={{
                          width: 92,
                          textAlign: "right",
                          fontFamily: "Bebas Neue",
                          fontSize: 28,
                          color:
                            row.total_points > 0
                              ? "var(--cream)"
                              : "var(--muted)",
                          lineHeight: 1,
                        }}
                      >
                        {row.total_points}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Top 3 Podium */}
      {activeMode === "overall" && top3.length > 0 && (
        <div
          className="podium-container"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            gap: 16,
            marginBottom: 60,
            marginTop: 20,
          }}
        >
          {podiumLayout.map((user, i) => {
            if (!user) return null;
            const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
            const height = rank === 1 ? 204 : rank === 2 ? 164 : 144;
            const color =
              rank === 1 ? "var(--gold)" : rank === 2 ? "#C0C0C0" : "#CD7F32";
            const isMe = currentUserId && user.id === currentUserId;

            return (
              <div
                key={user.id}
                onClick={() => router.push(`/profile?id=${user.id}`)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 130,
                  cursor: "pointer",
                  transform: "translateY(0)",
                  transition: "transform 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "translateY(-10px)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                <div
                  style={{
                    position: "relative",
                    marginBottom: -20,
                    zIndex: 10,
                  }}
                >
                  <img
                    src={getRobohashUrl(
                      user.display_name,
                      rank === 1 ? 100 : 80,
                    )}
                    style={{
                      width: rank === 1 ? 100 : 80,
                      height: rank === 1 ? 100 : 80,
                      borderRadius: "50%",
                      border: `4px solid ${color}`,
                      background: user.avatar_color,
                      objectFit: "cover",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: -5,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: color,
                      color: "#000",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      fontSize: 18,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    }}
                  >
                    {rank}
                  </div>
                  {isMe && (
                    <div
                      style={{
                        position: "absolute",
                        top: -10,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "var(--gold)",
                        color: "#000",
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 8,
                        fontWeight: 800,
                      }}
                    >
                      YOU
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: height,
                    background: isMe
                      ? "rgba(212,168,67,0.1)"
                      : "var(--surface2)",
                    borderTop: `1px solid ${color}`,
                    borderRight: `1px solid ${color}`,
                    borderLeft: `1px solid ${color}`,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 35,
                    boxShadow:
                      rank === 1
                        ? "0 -10px 40px rgba(212,168,67,0.15)"
                        : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--cream)",
                      textAlign: "center",
                      padding: "0 8px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      width: "100%",
                    }}
                  >
                    {user.display_name}
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontFamily: "Bebas Neue",
                      color: color,
                      marginTop: 4,
                      lineHeight: 1,
                    }}
                  >
                    {user.display_points}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginTop: 4,
                      display: "flex",
                      gap: 4,
                      alignItems: "center",
                    }}
                  >
                    {user.live_bonus > 0 && (
                      <span
                        style={{ color: "var(--gold)", fontWeight: "bold" }}
                      >
                        +{user.live_bonus} live
                      </span>
                    )}
                    PTS
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 10,
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        background: "rgba(212,168,67,0.12)",
                        color: "var(--gold)",
                        padding: "3px 8px",
                        borderRadius: 10,
                        fontWeight: 800,
                      }}
                    >
                      {user.dynamic_exact} EX
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        background: "var(--surface3)",
                        color: "var(--cream)",
                        padding: "3px 8px",
                        borderRadius: 10,
                        fontWeight: 800,
                      }}
                    >
                      {user.dynamic_correct} CR
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: activeMode === "overall" ? "block" : "none",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface2)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          <div style={{ width: 40, textAlign: "center" }}>Rank</div>
          <div style={{ flex: 1, paddingLeft: 16 }}>Player</div>
          <div
            className="hide-on-mobile"
            style={{ width: 130, textAlign: "center" }}
          >
            Progress
          </div>
          <div
            className="hide-on-mobile"
            style={{ width: 80, textAlign: "center" }}
          >
            Stats
          </div>
          <div style={{ width: 100, textAlign: "right" }}>Total Pts</div>
        </div>

        {/* Rows */}
        {rest.length === 0 && top3.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 15,
            }}
          >
            No users have signed up yet.
          </div>
        ) : (
          rest.map((row: any, index) => {
            const isMe = currentUserId && row.id === currentUserId;
            const progressPct = Math.round(
              (row.total_preds / TOTAL_MATCHES) * 100,
            );
            const actualRank = index + 4; // Because we sliced 3

            return (
              <div
                key={row.id}
                onClick={() => router.push(`/profile?id=${row.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                  background: isMe ? "rgba(212,168,67,0.06)" : "transparent",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isMe)
                    e.currentTarget.style.background = "var(--surface2)";
                  e.currentTarget.style.transform = "scale(1.01)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isMe
                    ? "rgba(212,168,67,0.06)"
                    : "transparent";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {/* Rank */}
                <div
                  style={{
                    width: 40,
                    textAlign: "center",
                    fontFamily: "Bebas Neue",
                    fontSize: 24,
                    color: "var(--muted)",
                  }}
                >
                  {actualRank}
                </div>

                {/* Player */}
                <div
                  style={{
                    flex: 1,
                    paddingLeft: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <img
                    src={getRobohashUrl(row.display_name, 60)}
                    alt={row.display_name}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: row.avatar_color,
                      flexShrink: 0,
                      objectFit: "cover",
                      border: "2px solid var(--border)",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: isMe ? "var(--gold)" : "var(--cream)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {row.display_name}
                      {isMe && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            background: "var(--gold)",
                            color: "#000",
                            borderRadius: 6,
                            fontWeight: 800,
                          }}
                        >
                          YOU
                        </span>
                      )}
                    </div>
                    {row.dynamic_streak > 0 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#ff6b6b",
                          marginTop: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontWeight: 600,
                        }}
                      >
                        🔥 {row.dynamic_streak} Streak
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div
                  className="hide-on-mobile"
                  style={{
                    width: 130,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      borderRadius: 3,
                      background: "var(--surface3)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 3,
                        background:
                          progressPct === 100
                            ? "var(--green-bright)"
                            : progressPct > 0
                              ? "var(--gold)"
                              : "transparent",
                        width: `${progressPct}%`,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color:
                        progressPct === 100
                          ? "var(--green-bright)"
                          : progressPct > 0
                            ? "var(--gold)"
                            : "var(--muted)",
                      letterSpacing: 0.5,
                    }}
                  >
                    {progressPct === 100
                      ? "Complete"
                      : progressPct > 0
                        ? `${row.total_preds}/${TOTAL_MATCHES}`
                        : "Not started"}
                  </div>
                </div>

                {/* Stats */}
                <div
                  className="hide-on-mobile"
                  style={{
                    width: 80,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      background: "rgba(212,168,67,0.1)",
                      color: "var(--gold)",
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontWeight: 600,
                    }}
                  >
                    {row.dynamic_exact} EX
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      background: "var(--surface3)",
                      color: "var(--cream)",
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontWeight: 600,
                    }}
                  >
                    {row.dynamic_correct} CR
                  </div>
                </div>

                {/* Total Points */}
                <div
                  style={{
                    width: 100,
                    textAlign: "right",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Bebas Neue",
                      fontSize: 32,
                      color:
                        row.display_points > 0
                          ? "var(--cream)"
                          : "var(--muted)",
                      lineHeight: 1,
                    }}
                  >
                    {row.display_points}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginTop: 4,
                      display: "flex",
                      gap: 4,
                      alignItems: "center",
                    }}
                  >
                    {row.live_bonus > 0 && (
                      <span
                        style={{ color: "var(--gold)", fontWeight: "bold" }}
                      >
                        +{row.live_bonus} live
                      </span>
                    )}
                    PTS
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
