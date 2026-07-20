"use client";
import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userId: string) => void;
  title?: string;
  subtitle?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  title,
  subtitle,
}: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const [supabase] = useState(() => createClient());

  if (!isOpen) return null;

  const toEmail = (u: string) =>
    `${u
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")}@venti26.app`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const email = toEmail(username);

    let loggedInUserId: string | null = null;

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: username.trim() },
          emailRedirectTo: undefined,
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already")) {
          setError("Username already taken. Try logging in instead.");
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      loggedInUserId = signInData.user?.id || null;
    } else {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("invalid")) {
          setError("Wrong username or password.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }
      loggedInUserId = data.user?.id || null;
    }

    setLoading(false);
    if (loggedInUserId) {
      onSuccess(loggedInUserId);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    color: "var(--cream)",
    fontFamily: "DM Sans, sans-serif",
    transition: "border-color 0.2s",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-[400px] bg-[var(--surface)] border border-[var(--border)] rounded-[20px] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface2)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors z-10"
        >
          ✕
        </button>

        {/* Top gold bar */}
        <div
          style={{
            height: 3,
            background:
              "linear-gradient(90deg, var(--gold), var(--gold-light), var(--gold))",
          }}
        />

        <div className="pt-8 px-6 text-center">
          <h2 className="text-2xl font-display tracking-wider text-cream mb-2">
            {title || "SAVE PREDICTIONS"}
          </h2>
          <p className="text-sm text-dim mb-6">
            {subtitle ||
              "Create a free account to save your picks and join the leaderboard."}
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", padding: "0 20px", gap: 4 }}>
          {(["signup", "login"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
                background: mode === m ? "var(--surface3)" : "transparent",
                color: mode === m ? "var(--cream)" : "var(--muted)",
                transition: "all 0.2s",
              }}
            >
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px 24px 28px" }}>
          <div style={{ marginBottom: 18 }}>
            <label className="block text-[11px] font-semibold tracking-[1.5px] uppercase text-muted mb-1.5">
              Username
            </label>
            <input
              type="text"
              placeholder="e.g. maradona10"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              required
              autoComplete="username"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="block text-[11px] font-semibold tracking-[1.5px] uppercase text-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder={
                mode === "signup"
                  ? "Create a password (min 6 chars)"
                  : "Your password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              style={inputStyle}
            />
          </div>

          {error && (
            <div className="mb-[18px] p-[10px_14px] rounded-[10px] bg-[#c8392b1f] border border-[#c8392b40] text-[#e05c4a] text-[13px]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 12,
              background: loading ? "var(--gold-dim)" : "var(--gold)",
              color: "#0a0a0a",
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {loading
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
                ? "Sign In & Save →"
                : "Create Account & Save →"}
          </button>
        </form>
      </div>
    </div>
  );
}
