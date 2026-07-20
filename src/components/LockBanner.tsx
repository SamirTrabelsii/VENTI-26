"use client";

import { useEffect, useState } from "react";
import { getTournamentPhase, TOURNAMENT_LOCK } from "@/lib/wc2026-data";

export default function LockBanner() {
  const [phase, setPhase] = useState(getTournamentPhase());
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const currentPhase = getTournamentPhase();
      setPhase(currentPhase);

      if (currentPhase !== "PRE_TOURNAMENT") {
        setTimeLeft("");
        return;
      }

      const diff = new Date(TOURNAMENT_LOCK).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft("");
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      setTimeLeft(`${d}d ${h}h ${m}m`);
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  let bgColor = "var(--surface2)";
  let borderColor = "var(--border)";
  let message = "";
  let icon = "clock";

  if (phase === "PRE_TOURNAMENT") {
    message =
      "Original predictions open. All group scores and original bracket picks lock at opening kickoff: " +
      timeLeft;
    bgColor = "rgba(212, 168, 67, 0.1)";
    borderColor = "var(--gold)";
    icon = "open";
  } else if (phase === "KNOCKOUT_OPEN") {
    message =
      "Original predictions are locked. Live knockout predictions open match-by-match as soon as each real fixture is known.";
    bgColor = "rgba(212, 168, 67, 0.1)";
    borderColor = "var(--gold)";
    icon = "live";
  } else {
    message = "All tournament predictions are locked.";
    bgColor = "rgba(200, 57, 43, 0.1)";
    borderColor = "rgba(200, 57, 43, 0.3)";
    icon = "locked";
  }

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        padding: "12px 20px",
        borderRadius: 12,
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: "var(--cream)",
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--gold)",
          minWidth: 46,
        }}
      >
        {icon}
      </span>
      <span>{message}</span>
    </div>
  );
}
