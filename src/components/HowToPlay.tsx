"use client";
import { useState } from "react";

export default function HowToPlay() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "transparent",
          border: "none",
          color: "var(--cream)",
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>📖</span>
          <span>How to Play & Prediction Rules</span>
        </div>
        <span
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            padding: "0 20px 20px",
            color: "var(--muted)",
            fontSize: 14,
            lineHeight: 1.6,
            borderTop: "1px solid var(--border)",
            marginTop: 4,
            paddingTop: 16,
          }}
        >
          <p style={{ marginBottom: 12 }}>
            Welcome to the <strong>World Cup 2026 Prediction Bracket!</strong>{" "}
            Here is how the tournament locking works:
          </p>
          <ul
            style={{
              paddingLeft: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <li>
              <strong>1. Original Predictions:</strong> Before the opening
              kickoff, predict every group-stage score and complete your
              original knockout bracket. Your bracket is built from your
              predicted group standings.
            </li>
            <li>
              <strong>2. Opening Kickoff Lock:</strong> As soon as the first
              World Cup match starts, all original group predictions and
              original bracket picks are <strong>hard-locked</strong>. No
              group-stage edits are supported after this point.
            </li>
            <li>
              <strong>3. Live Bracket:</strong> When real knockout fixtures
              become known, the Live Bracket opens with empty score inputs. You
              can re-predict known knockout matches using the real teams from
              the running competition.
            </li>
            <li>
              <strong>4. Per-Match Knockout Lock:</strong> Each live knockout
              prediction locks at that match&apos;s kickoff. Original bracket
              bonuses still come only from the bracket you locked before the
              tournament began.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
