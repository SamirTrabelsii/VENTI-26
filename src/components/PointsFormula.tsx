export default function PointsFormula() {
  const rows = [
    { event: 'Exact score',    pts: 20, note: 'Predict 2–1, result is 2–1' },
    { event: 'Correct result', pts: 10, note: 'Right winner/draw, wrong score' },
    { event: 'Goal difference',pts: 5,  note: 'Right margin, e.g. 2–0 vs 3–1' },
    { event: 'Correct goals',  pts: 1,  note: '+1 for each exact home/away goal' },
    { event: 'Round of 32',    pts: 10, note: 'Correct team advances' },
    { event: 'Round of 16',    pts: 15, note: 'Correct team advances' },
    { event: 'Quarter-final',  pts: 20, note: 'Correct team advances' },
    { event: 'Semi-final',     pts: 25, note: 'Correct team advances' },
    { event: 'Final pick',     pts: 30, note: 'Correct finalist' },
    { event: 'Champion 🏆',    pts: 50, note: 'World Cup winner' },
    { event: 'Early lock ⚡',   pts: 2,  note: 'Submit 24h before kickoff' },
  ]

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>📐</span>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
          textTransform: 'uppercase', color: 'var(--cream)',
        }}>
          Points Formula
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, color: 'var(--muted)',
        }}>
          UCL-inspired
        </span>
      </div>

      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '10px 20px',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
            background: r.pts === 50 ? 'rgba(212,168,67,0.04)' : 'transparent',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cream)' }}>
              {r.event}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
              {r.note}
            </div>
          </div>
          <div style={{
            fontFamily: 'Bebas Neue, sans-serif', fontSize: 24,
            color: r.pts >= 50 ? 'var(--gold)' : r.pts >= 20 ? 'var(--cream)' : 'var(--dim)',
            minWidth: 40, textAlign: 'right',
          }}>
            +{r.pts}
          </div>
        </div>
      ))}

      {/* Formula summary */}
      <div style={{
        padding: '12px 20px',
        background: 'rgba(212,168,67,0.06)',
        borderTop: '1px solid var(--border-gold)',
        fontSize: 11, color: 'var(--gold)',
        fontFamily: 'DM Mono, monospace',
      }}>
        MAX SCORE = 48×(20+2) + 16×10 + 8×15 + 4×20 + 2×25 + 1×30 + 1×50 = <strong>1,484 pts</strong>
      </div>
    </div>
  )
}