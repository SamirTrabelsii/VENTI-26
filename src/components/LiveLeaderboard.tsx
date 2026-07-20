"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Score } from "@/types";
import { getRobohashUrl } from "@/lib/wc2026-data";

interface Props {
  groupId: string;
  currentUserId: string;
  initialScores?: Score[];
}

export default function LiveLeaderboard({
  groupId,
  currentUserId,
  initialScores = [],
}: Props) {
  const [scores, setScores] = useState<Score[]>(initialScores);
  const scoresRef = useRef<Score[]>(initialScores);
  const [prevScores, setPrevScores] = useState<Record<string, number>>({});
  const [justUpdated, setJustUpdated] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/groups/${groupId}/scores`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = await res.json();
      const freshScores = data.scores ?? [];
      const changed = freshScores.find((fresh: Score) => {
        const old = scoresRef.current.find((s) => s.user_id === fresh.user_id);
        return old && old.total_points !== fresh.total_points;
      });

      if (changed) {
        const old = scoresRef.current.find(
          (s) => s.user_id === changed.user_id,
        );
        if (old)
          setPrevScores((p) => ({ ...p, [changed.user_id]: old.total_points }));
        setJustUpdated(changed.user_id);
        setTimeout(() => setJustUpdated(null), 3000);
      }

      scoresRef.current = freshScores;
      setScores(freshScores);
    };
    load();
    const refreshInterval = setInterval(load, 60_000);

    const channel = supabase
      .channel(`scores-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [groupId, supabase]);

  const RANK_COLORS = ["#d4a843", "#b0b8c8", "#cd7f32"];

  if (scores.length === 0) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          No scores yet — predict matches to appear here!
        </p>
        <a
          href="/predict"
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "10px 24px",
            borderRadius: 10,
            background: "var(--gold)",
            color: "#0a0a0a",
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Start Predicting →
        </a>
      </div>
    );
  }

  const myRankIndex = scores.findIndex((s) => s.user_id === currentUserId);
  const myRank = myRankIndex + 1;
  const top5 = scores.slice(0, 5);

  // Check if the current user needs to be pinned at the bottom
  const showMeAtBottom = myRankIndex >= 5;

  const renderRow = (s: Score, idx: number, actualRank: number) => {
    const isMe = s.user_id === currentUserId;
    const rankColor =
      actualRank <= 3 ? RANK_COLORS[actualRank - 1] : "var(--muted)";
    const profile = s.profile;
    const displayName = profile?.display_name ?? profile?.email ?? "Player";
    const prevPts = prevScores[s.user_id];
    const gained =
      justUpdated === s.user_id && prevPts !== undefined
        ? s.total_points - prevPts
        : null;

    return (
      <div
        key={s.user_id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          background: isMe ? "rgba(212,168,67,0.04)" : "transparent",
          transition: "background 0.3s",
          position: "relative",
        }}
      >
        {/* Flash overlay when score updates */}
        {justUpdated === s.user_id && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(212,168,67,0.08)",
              animation: "flashFade 3s ease forwards",
              pointerEvents: "none",
            }}
          />
        )}
        <style>{`@keyframes flashFade { 0%{opacity:1} 100%{opacity:0} }`}</style>

        {/* Rank */}
        <span
          style={{
            fontFamily: "Bebas Neue",
            fontSize: 22,
            width: 28,
            textAlign: "center",
            flexShrink: 0,
            color: rankColor,
          }}
        >
          {actualRank}
        </span>

        {/* Robohash avatar */}
        <img
          src={getRobohashUrl(displayName, 60)}
          alt={displayName}
          width={36}
          height={36}
          style={{
            borderRadius: "50%",
            flexShrink: 0,
            border: isMe ? "2px solid var(--gold)" : "2px solid var(--border)",
          }}
        />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 500,
              fontSize: 14,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
            {isMe && (
              <span
                style={{ marginLeft: 6, fontSize: 11, color: "var(--gold)" }}
              >
                👈 You
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {s.exact_scores} exact · {s.correct_results} correct
            {s.streak > 0 && (
              <span style={{ marginLeft: 6, color: "#e05c4a" }}>
                🔥 {s.streak} streak
              </span>
            )}
          </div>
        </div>

        {/* Points */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "Bebas Neue",
              fontSize: 28,
              color: isMe ? "var(--gold)" : "var(--cream)",
            }}
          >
            {s.total_points}
          </div>
          {gained !== null && gained > 0 && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--green-bright)",
                animation: "slideUp 0.4s ease",
              }}
            >
              <style>{`@keyframes slideUp { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }`}</style>
              +{gained}
            </div>
          )}
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--muted)",
            }}
          >
            pts
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {top5.map((s, i) => renderRow(s, i, i + 1))}

      {showMeAtBottom && (
        <>
          <div
            style={{
              padding: "10px 0",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 12,
              letterSpacing: 2,
              background: "var(--surface2)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            • • •
          </div>
          {renderRow(scores[myRankIndex], myRankIndex, myRank)}
        </>
      )}
    </div>
  );
}
