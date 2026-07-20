"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  // We use email = username@venti26.app internally so Supabase is happy
  // The user only ever sees and types a username
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

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: username.trim() },
          emailRedirectTo: undefined,
        },
      });

      if (signUpError) {
        // If user already exists, suggest login
        if (signUpError.message.toLowerCase().includes("already")) {
          setError("Username already taken. Try logging in instead.");
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      // Auto sign in right after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
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
    }

    router.push("/home");
    router.refresh();
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

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: "var(--muted)",
    marginBottom: 6,
    display: "block",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "var(--black)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(212,168,67,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Grid texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.025,
          backgroundImage:
            "linear-gradient(var(--cream) 1px, transparent 1px), linear-gradient(90deg, var(--cream) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1
            style={{
              fontFamily: "Bebas Neue, sans-serif",
              fontSize: 64,
              letterSpacing: 4,
              color: "var(--gold)",
              lineHeight: 1,
            }}
          >
            VENTI<span style={{ color: "var(--cream)", opacity: 0.25 }}>·</span>
            26
          </h1>
          <p style={{ fontSize: 13, marginTop: 8, color: "var(--dim)" }}>
            The ultimate World Cup 2026 prediction platform
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {/* Top gold bar */}
          <div
            style={{
              height: 3,
              background:
                "linear-gradient(90deg, var(--gold), var(--gold-light), var(--gold))",
            }}
          />

          {/* Mode toggle */}
          <div
            style={{
              display: "flex",
              padding: "16px 20px 0",
              gap: 4,
              background: "var(--surface)",
            }}
          >
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
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
                  transition: "all 0.2s",
                  background: mode === m ? "var(--surface3)" : "transparent",
                  color: mode === m ? "var(--cream)" : "var(--muted)",
                  letterSpacing: 0.5,
                }}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: "24px 24px 28px" }}>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                placeholder="e.g. maradona10"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                required
                autoComplete="username"
                style={inputStyle}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border-gold)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              />
              {mode === "signup" && (
                <p
                  style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}
                >
                  Letters, numbers, _ and - only. Min 3 characters.
                </p>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Password</label>
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
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border-gold)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  marginBottom: 18,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(200,57,43,0.12)",
                  border: "1px solid rgba(200,57,43,0.25)",
                  color: "#e05c4a",
                  fontSize: 13,
                }}
              >
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
                fontFamily: "DM Sans, sans-serif",
                letterSpacing: 0.5,
                transition: "all 0.2s",
              }}
            >
              {loading
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Sign In →"
                  : "Create Account & Play →"}
            </button>

            {/* Switch mode hint */}
            <p
              style={{
                textAlign: "center",
                marginTop: 16,
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--gold)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "DM Sans, sans-serif",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </p>
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            marginTop: 20,
            color: "var(--muted)",
          }}
        >
          Free to play · No email verification required · No credit card
        </p>
      </div>
    </div>
  );
}
