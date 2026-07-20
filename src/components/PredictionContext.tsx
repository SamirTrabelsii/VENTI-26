// src/components/PredictionContext.tsx
"use client";
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useRef,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Prediction } from "@/types";
import AuthModal from "@/components/AuthModal";
import { isGlobalLockPassed, isGroupMatchStarted } from "@/lib/wc2026-data";

const GUEST_STORAGE_KEY = "venti26_guest_predictions";

interface PredictionContextType {
  groupScores: Record<string, { home: number | ""; away: number | "" }>;
  setGroupScore: (
    matchId: string,
    home: number | "",
    away: number | "",
  ) => void;
  saveAll: () => Promise<void>;
  saving: boolean;
  hasUnsavedChanges: boolean;
  isLocked: boolean;
}

const PredictionContext = createContext<PredictionContextType | null>(null);

export function usePredictions() {
  const ctx = useContext(PredictionContext);
  if (!ctx)
    throw new Error("usePredictions must be used within a PredictionProvider");
  return ctx;
}

export function PredictionProvider({
  userId,
  initialPredictions,
  isUnlocked,
  children,
}: {
  userId?: string | null;
  initialPredictions: Prediction[];
  isUnlocked?: boolean;
  children: ReactNode;
}) {
  const [supabase] = React.useState(() => createClient());
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [groupScores, setGroupScores] = useState<
    Record<string, { home: number | ""; away: number | "" }>
  >(() => {
    const init: Record<string, { home: number | ""; away: number | "" }> = {};
    initialPredictions.forEach((p) => {
      init[p.match_id] = { home: p.home_score ?? "", away: p.away_score ?? "" };
    });
    return init;
  });
  const groupScoresRef = useRef(groupScores);

  React.useEffect(() => {
    groupScoresRef.current = groupScores;
  }, [groupScores]);

  // Hydrate guest predictions from localStorage on mount (Guest Mode)
  React.useEffect(() => {
    if (!userId) {
      try {
        const stored = localStorage.getItem(GUEST_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.groupScores) setGroupScores(parsed.groupScores);
          if (parsed.hasUnsavedChanges)
            setHasUnsavedChanges(parsed.hasUnsavedChanges);
        }
      } catch (e) {
        console.error("Failed to parse guest predictions", e);
      }
    }
  }, [userId]);

  // Migrate guest predictions to authenticated user
  React.useEffect(() => {
    if (userId) {
      try {
        const stored = localStorage.getItem(GUEST_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.groupScores) {
            setGroupScores((prev) => ({ ...prev, ...parsed.groupScores }));
            setHasUnsavedChanges(true);
            localStorage.removeItem(GUEST_STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error("Failed to migrate guest predictions", e);
      }
    }
  }, [userId]);

  // Persist guest predictions to localStorage whenever they change
  React.useEffect(() => {
    if (!userId) {
      localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({ groupScores, hasUnsavedChanges }),
      );
    }
  }, [userId, groupScores, hasUnsavedChanges]);

  // Compute personalized lock: globally locked UNLESS admin has unlocked this specific user
  const isLocked = isGlobalLockPassed() && !isUnlocked;

  const setGroupScore = useCallback(
    (matchId: string, home: number | "", away: number | "") => {
      if (isLocked) return;
      if (isGroupMatchStarted(matchId)) return;

      setHasUnsavedChanges(true);
      setGroupScores((prev) => {
        const next = { ...prev, [matchId]: { home, away } };
        groupScoresRef.current = next;
        return next;
      });
    },
    [isLocked],
  );

  const saveAll = async () => {
    if (!userId) {
      setIsAuthModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      const currentGroupScores = groupScoresRef.current;

      const groupUpserts = Object.keys(currentGroupScores)
        .filter((matchId) => {
          const s = currentGroupScores[matchId];
          if (isGroupMatchStarted(matchId)) return false;
          return (
            s &&
            s.home !== null &&
            s.home !== undefined &&
            (s.home as unknown) !== "" &&
            s.away !== null &&
            s.away !== undefined &&
            (s.away as unknown) !== ""
          );
        })
        .map((matchId) => ({
          user_id: userId,
          match_id: matchId,
          home_score: Number(currentGroupScores[matchId].home),
          away_score: Number(currentGroupScores[matchId].away),
        }));

      if (groupUpserts.length > 0) {
        const { error } = await supabase
          .from("predictions")
          .upsert(groupUpserts, { onConflict: "user_id,match_id" });
        if (error) {
          console.error(
            "[SaveAll] Group prediction error:",
            error.message,
            error.code,
            error.details,
          );
          throw new Error(`Group prediction error: ${error.message}`);
        }
      }

      setHasUnsavedChanges(false);
      router.refresh();
    } catch (err) {
      console.error("[SaveAll] Error saving predictions:", err);
      alert(
        "An error occurred while saving your predictions. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <PredictionContext.Provider
      value={{
        groupScores,
        setGroupScore,
        saveAll,
        saving,
        hasUnsavedChanges,
        isLocked,
      }}
    >
      {children}

      {/* Global Sticky Save Button */}
      <div
        style={{
          position: "fixed",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          gap: 16,
          alignItems: "center",
          padding: "12px 24px",
          background: "rgba(20,20,20,0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid var(--border-gold)",
          borderRadius: 50,
          boxShadow:
            "0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,67,0.1)",
          transition: "opacity 0.3s, transform 0.3s",
          opacity: hasUnsavedChanges ? 1 : 0,
          pointerEvents: hasUnsavedChanges ? "auto" : "none",
        }}
      >
        <div style={{ color: "var(--cream)", fontSize: 14, fontWeight: 500 }}>
          You have unsaved predictions
        </div>
        <button
          onClick={saveAll}
          disabled={saving}
          style={{
            background: "var(--gold)",
            color: "#0a0a0a",
            border: "none",
            padding: "10px 24px",
            borderRadius: 30,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 4px 15px rgba(212,168,67,0.4)",
          }}
        >
          {saving ? "Saving..." : "Save All Changes"}
        </button>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          window.location.reload();
        }}
      />
    </PredictionContext.Provider>
  );
}
