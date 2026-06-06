'use client'
import { useState } from 'react'

export default function HowToPlay() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            marginBottom: 24,
            overflow: 'hidden'
        }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--cream)',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>📖</span>
                    <span>How to Play & Prediction Rules</span>
                </div>
                <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                    ▼
                </span>
            </button>

            {isOpen && (
                <div style={{
                    padding: '0 20px 20px',
                    color: 'var(--muted)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    borderTop: '1px solid var(--border)',
                    marginTop: 4,
                    paddingTop: 16
                }}>
                    <p style={{ marginBottom: 12 }}>
                        Welcome to the <strong>World Cup 2026 Prediction Bracket!</strong> Here is how the tournament locking works:
                    </p>
                    <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <li>
                            <strong>1. Original Predictions (Before Kickoff):</strong> Predict all group stage match scores. The bracket will automatically populate based on your predicted standings. You must submit your complete bracket before the tournament starts.
                        </li>
                        <li>
                            <strong>2. Group Stage Lock:</strong> Once the first World Cup match begins, all group stage and bracket predictions are <strong>hard-locked</strong>.
                        </li>
                        <li>
                            <strong>3. Matchday 3 Reopen (Live Bracket):</strong> Once the final group stage matches (Matchday 3) begin, the Knockout Bracket unlocks! You can toggle between your <em>Original Predictions</em> and the <em>Live Bracket</em> to update your knockout picks based on the real-world qualifying teams.
                        </li>
                        <li>
                            <strong>4. Final Knockout Lock:</strong> Two hours before the Round of 32 begins, the Live Bracket permanently locks for the remainder of the tournament.
                        </li>
                    </ul>
                </div>
            )}
        </div>
    )
}
