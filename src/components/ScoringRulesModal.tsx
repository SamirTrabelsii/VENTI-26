'use client'
import { useState } from 'react'
import { SCORING_REFERENCE } from '@/lib/scoring'

export default function ScoringRulesModal({ customTrigger }: { customTrigger?: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)

    if (!isOpen) {
        if (customTrigger) {
            return <div onClick={() => setIsOpen(true)}>{customTrigger}</div>
        }
        return (
            <button
                id="scoring-rules-trigger"
                onClick={() => setIsOpen(true)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(212,168,67,0.12) 0%, rgba(212,168,67,0.04) 100%)',
                    border: '1px solid var(--border-gold)',
                    color: 'var(--gold)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                }}
            >
                <span style={{ fontSize: 16 }}>📐</span>
                How Scoring Works
                <span style={{ fontSize: 11, opacity: 0.7 }}>→</span>
            </button>
        )
    }

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
            }}
        >
            {/* Backdrop */}
            <div
                onClick={() => setIsOpen(false)}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(8px)',
                }}
            />

            {/* Modal */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 640,
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 20,
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                }}
            >
                {/* Gold accent bar */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, var(--gold), var(--gold-light), var(--gold))',
                    borderRadius: '20px 20px 0 0',
                }} />

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px', borderBottom: '1px solid var(--border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>📐</span>
                        <div>
                            <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--cream)', lineHeight: 1 }}>
                                Scoring Rules
                            </h2>
                            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                How your predictions earn points
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'var(--surface2)', border: '1px solid var(--border)',
                            color: 'var(--muted)', fontSize: 16, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Section 1: Match Predictions */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                            color: 'var(--green-bright)', padding: '3px 10px', borderRadius: 10,
                            background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.22)',
                        }}>
                            Match Predictions
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Group Stage & Knockout
                        </span>
                    </div>

                    {SCORING_REFERENCE.groupAndKnockout.map((r, i) => (
                        <div key={r.label} style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '12px 0',
                            borderBottom: i < SCORING_REFERENCE.groupAndKnockout.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}>
                            <div style={{
                                minWidth: 56, height: 44, borderRadius: 10,
                                background: typeof r.pts === 'number' && r.pts >= 25
                                    ? 'linear-gradient(135deg, rgba(212,168,67,0.18), rgba(212,168,67,0.06))'
                                    : 'var(--surface2)',
                                border: typeof r.pts === 'number' && r.pts >= 25
                                    ? '1px solid var(--border-gold)' : '1px solid var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{
                                    fontFamily: 'Bebas Neue', fontSize: typeof r.pts === 'number' ? 26 : 20,
                                    color: typeof r.pts === 'number' && r.pts >= 25 ? 'var(--gold)' : 'var(--cream)',
                                }}>
                                    +{r.pts}
                                </span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cream)' }}>{r.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{r.note}</div>
                            </div>
                        </div>
                    ))}

                    {/* Worked examples */}
                    <div style={{
                        marginTop: 16, padding: '14px 16px', borderRadius: 12,
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                    }}>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>
                            💡 Worked Examples
                        </p>
                        {[
                            { pred: '2-1', real: '2-1', pts: '+25', note: 'Exact score' },
                            { pred: '3-1', real: '2-0', pts: '+15', note: 'Outcome + goal diff' },
                            { pred: '3-0', real: '3-1', pts: '+13', note: 'Outcome + home goals (3)' },
                            { pred: '2-1', real: '2-3', pts: '+2', note: 'Home team goals (2)' },
                            { pred: '1-1', real: '0-0', pts: '+10', note: 'Correct draw' },
                        ].map((ex, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '5px 0', fontSize: 12,
                            }}>
                                <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--dim)', minWidth: 42 }}>{ex.pred}</span>
                                <span style={{ color: 'var(--muted)', fontSize: 10 }}>vs</span>
                                <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--dim)', minWidth: 42 }}>{ex.real}</span>
                                <span style={{ color: 'var(--muted)' }}>→</span>
                                <span style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: 'var(--gold)', minWidth: 36 }}>{ex.pts}</span>
                                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{ex.note}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section 2: Knockout Supplement */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                            color: '#e05c4a', padding: '3px 10px', borderRadius: 10,
                            background: 'rgba(224,92,74,0.10)', border: '1px solid rgba(224,92,74,0.22)',
                        }}>
                            Knockout Bonus
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Extra points for penalty shootouts
                        </span>
                    </div>

                    {SCORING_REFERENCE.knockoutSupplement.map((r, i) => (
                        <div key={r.label} style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '10px 0',
                            borderBottom: i < SCORING_REFERENCE.knockoutSupplement.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}>
                            <div style={{
                                minWidth: 56, height: 44, borderRadius: 10,
                                background: 'rgba(224,92,74,0.08)',
                                border: '1px solid rgba(224,92,74,0.18)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{ fontFamily: 'Bebas Neue', fontSize: 26, color: '#e05c4a' }}>+{r.pts}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cream)' }}>{r.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{r.note}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Section 3: Original Prediction Multipliers */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                            color: 'var(--blue-accent)', padding: '3px 10px', borderRadius: 10,
                            background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.22)',
                        }}>
                            Original Multipliers
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Pre-tournament bracket bonus
                        </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 14, lineHeight: 1.6 }}>
                        If your <strong style={{ color: 'var(--cream)' }}>original locked prediction</strong> before the tournament is correct, 
                        points are multiplied based on the round. The further the round, the bigger the reward!
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                        {SCORING_REFERENCE.originalMultipliers.map(m => (
                            <div key={m.round} style={{
                                textAlign: 'center', padding: '12px 8px', borderRadius: 12,
                                background: 'var(--surface2)', border: '1px solid var(--border)',
                            }}>
                                <div style={{
                                    fontFamily: 'Bebas Neue', fontSize: 28,
                                    color: m.multiplier >= 4 ? 'var(--gold)' : 'var(--cream)',
                                }}>
                                    ×{m.multiplier}
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginTop: 2, letterSpacing: 0.5 }}>
                                    {m.round}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section 4: Bracket Bonuses */}
                <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                            color: '#a855f7', padding: '3px 10px', borderRadius: 10,
                            background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.22)',
                        }}>
                            Bracket Bonuses
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Points for correct team picks
                        </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 14, lineHeight: 1.6 }}>
                        Earn bonus points when teams you predicted in your <strong style={{ color: 'var(--cream)' }}>original bracket</strong> actually 
                        advance to each round. Points increase the further they go!
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {SCORING_REFERENCE.bracketBonuses.map(b => (
                            <div key={b.label} style={{
                                padding: '10px 12px', borderRadius: 10,
                                background: b.pts >= 32 ? 'linear-gradient(135deg, rgba(212,168,67,0.12), rgba(212,168,67,0.04))' : 'var(--surface2)',
                                border: b.pts >= 32 ? '1px solid var(--border-gold)' : '1px solid var(--border)',
                                display: 'flex', alignItems: 'center', gap: 10,
                            }}>
                                <span style={{
                                    fontFamily: 'Bebas Neue', fontSize: 22,
                                    color: b.pts >= 16 ? 'var(--gold)' : 'var(--cream)',
                                    minWidth: 32,
                                }}>
                                    +{b.pts}
                                </span>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--cream)' }}>{b.label}</div>
                                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{b.note}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
