import { getTeam } from "@/lib/wc2026-data";
import TeamFlag from "@/components/TeamFlag";

interface KnockoutMatchCardProps {
  matchId: string;
  homeCode: string;
  awayCode: string;
  homeScore: number | "";
  awayScore: number | "";
  advancingCode: string | null;
  disabled?: boolean;
  onChange: (
    matchId: string,
    home: number | "",
    away: number | "",
    advancing: string | null,
  ) => void;
}

export default function KnockoutMatchCard({
  matchId,
  homeCode,
  awayCode,
  homeScore,
  awayScore,
  advancingCode,
  disabled = false,
  onChange,
}: KnockoutMatchCardProps) {
  const isTied =
    typeof homeScore === "number" &&
    typeof awayScore === "number" &&
    homeScore === awayScore;

  const handleHomeChange = (val: number | "") => {
    let newAdvancing = advancingCode;
    if (
      typeof val === "number" &&
      typeof awayScore === "number" &&
      val !== awayScore
    ) {
      newAdvancing = val > awayScore ? homeCode : awayCode;
    } else if (
      typeof val === "number" &&
      typeof awayScore === "number" &&
      val === awayScore
    ) {
      if (newAdvancing !== homeCode && newAdvancing !== awayCode) {
        newAdvancing = null;
      }
    } else {
      newAdvancing = null;
    }
    onChange(matchId, val, awayScore, newAdvancing);
  };

  const handleAwayChange = (val: number | "") => {
    let newAdvancing = advancingCode;
    if (
      typeof homeScore === "number" &&
      typeof val === "number" &&
      homeScore !== val
    ) {
      newAdvancing = homeScore > val ? homeCode : awayCode;
    } else if (
      typeof homeScore === "number" &&
      typeof val === "number" &&
      homeScore === val
    ) {
      if (newAdvancing !== homeCode && newAdvancing !== awayCode) {
        newAdvancing = null;
      }
    } else {
      newAdvancing = null;
    }
    onChange(matchId, homeScore, val, newAdvancing);
  };

  const isHomeTBD =
    homeCode === "TBD" ||
    homeCode.startsWith("1") ||
    homeCode.startsWith("2") ||
    homeCode === "T3";
  const isAwayTBD =
    awayCode === "TBD" ||
    awayCode.startsWith("1") ||
    awayCode.startsWith("2") ||
    awayCode === "T3";

  const homeTeam = isHomeTBD ? null : getTeam(homeCode);
  const awayTeam = isAwayTBD ? null : getTeam(awayCode);

  const selectStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "2px solid var(--border)",
    borderRadius: 10,
    color: "var(--cream)",
    fontFamily: "Bebas Neue, sans-serif",
    fontSize: 24,
    width: 44,
    height: 44,
    textAlign: "center",
    outline: "none",
    cursor: disabled || isHomeTBD || isAwayTBD ? "default" : "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    flexShrink: 0,
  };

  const teamRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
  };

  return (
    <div
      style={{
        background: "var(--surface2)",
        borderRadius: 12,
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      {/* Home team row */}
      <div
        style={{
          ...teamRowStyle,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {homeTeam ? (
          <TeamFlag teamCode={homeTeam.code} size={24} />
        ) : (
          <div
            style={{
              width: 24,
              height: 16,
              borderRadius: 2,
              background: "var(--surface3)",
              border: "1px solid var(--border)",
            }}
          />
        )}
        <div
          style={{
            flex: 1,
            fontFamily: "Bebas Neue",
            fontSize: 18,
            color: homeTeam ? "var(--cream)" : "var(--muted)",
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {homeTeam
            ? homeTeam.name
            : homeCode.startsWith("1") ||
                homeCode.startsWith("2") ||
                homeCode === "T3"
              ? homeCode
              : "TBD"}
        </div>

        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          value={homeScore === "" ? "" : homeScore}
          placeholder="–"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              handleHomeChange("");
              return;
            }
            const n = parseInt(raw, 10);
            if (!isNaN(n) && n >= 0 && n <= 20) handleHomeChange(n);
          }}
          onFocus={(e) => e.target.select()}
          disabled={disabled || isHomeTBD || isAwayTBD}
          style={{
            ...selectStyle,
            borderColor:
              homeScore !== "" && homeScore > 0
                ? "var(--gold)"
                : "var(--border)",
            color:
              homeScore !== "" && homeScore > 0
                ? "var(--gold)"
                : "var(--cream)",
            opacity: disabled || isHomeTBD || isAwayTBD ? 0.4 : 1,
            MozAppearance: "textfield",
            WebkitAppearance: "none",
          }}
        />
      </div>

      {/* Away team row */}
      <div style={teamRowStyle}>
        {awayTeam ? (
          <TeamFlag teamCode={awayTeam.code} size={24} />
        ) : (
          <div
            style={{
              width: 24,
              height: 16,
              borderRadius: 2,
              background: "var(--surface3)",
              border: "1px solid var(--border)",
            }}
          />
        )}
        <div
          style={{
            flex: 1,
            fontFamily: "Bebas Neue",
            fontSize: 18,
            color: awayTeam ? "var(--cream)" : "var(--muted)",
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {awayTeam
            ? awayTeam.name
            : awayCode.startsWith("1") ||
                awayCode.startsWith("2") ||
                awayCode === "T3"
              ? awayCode
              : "TBD"}
        </div>

        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          value={awayScore === "" ? "" : awayScore}
          placeholder="–"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              handleAwayChange("");
              return;
            }
            const n = parseInt(raw, 10);
            if (!isNaN(n) && n >= 0 && n <= 20) handleAwayChange(n);
          }}
          onFocus={(e) => e.target.select()}
          disabled={disabled || isHomeTBD || isAwayTBD}
          style={{
            ...selectStyle,
            borderColor:
              awayScore !== "" && awayScore > 0
                ? "var(--gold)"
                : "var(--border)",
            color:
              awayScore !== "" && awayScore > 0
                ? "var(--gold)"
                : "var(--cream)",
            opacity: disabled || isHomeTBD || isAwayTBD ? 0.4 : 1,
            MozAppearance: "textfield",
            WebkitAppearance: "none",
          }}
        />
      </div>

      {/* Tie-breaker UI */}
      {isTied && !isHomeTBD && !isAwayTBD && (
        <div
          style={{
            padding: "8px 10px",
            borderTop: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: "var(--gold)",
              textTransform: "uppercase",
              letterSpacing: 1.2,
              fontWeight: 600,
            }}
          >
            Advances on Penalties
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { code: homeCode, team: homeTeam },
              { code: awayCode, team: awayTeam },
            ].map(({ code, team }) => {
              const isSelected = advancingCode === code;
              return (
                <button
                  key={code}
                  onClick={() => {
                    if (!disabled)
                      onChange(
                        matchId,
                        homeScore as number,
                        awayScore as number,
                        code,
                      );
                  }}
                  disabled={disabled}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: isSelected
                      ? "1px solid var(--gold)"
                      : "1px solid var(--border)",
                    background: isSelected
                      ? "rgba(212,168,67,0.12)"
                      : "transparent",
                    color: isSelected ? "var(--gold)" : "var(--muted)",
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    transition: "all 0.15s ease",
                  }}
                >
                  {team && <TeamFlag teamCode={team.code} size={16} />}
                  {team?.name || code}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
