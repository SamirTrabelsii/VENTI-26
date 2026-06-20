'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FAQItem {
    question: string
    answer: React.ReactNode
    category: string
}

const FAQ_ITEMS: FAQItem[] = [
    // ── GETTING STARTED ──────────────────────────────────────────────────────────
    {
        category: 'Getting Started',
        question: 'How do I start predicting?',
        answer: (
            <>
                Head to the <Link href="/predict" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Predict</Link> page.
                You&apos;ll find all 72 group stage matches — enter a score for each one using the dropdown selectors.
                Don&apos;t forget to also fill in your <strong style={{ color: 'var(--cream)' }}>Tournament Bracket</strong> (knockout rounds) — that&apos;s where the biggest points are.
                Hit <em>Save All Changes</em> to lock in your picks.
            </>
        ),
    },
    {
        category: 'Getting Started',
        question: 'Do I need to predict every match?',
        answer: (
            <>
                No, but you only score points for matches you predicted. Unpredicted matches score <strong style={{ color: '#e05c4a' }}>0 points</strong> — so the more you predict, the better your chances on the leaderboard.
                We recommend predicting <strong style={{ color: 'var(--cream)' }}>all 72 group stage matches</strong> before the tournament starts to maximise your score potential.
            </>
        ),
    },
    {
        category: 'Getting Started',
        question: 'How do I join or create a group?',
        answer: (
            <>
                Go to <Link href="/groups" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Groups</Link>.
                Create your own private mini-league and share the invite code with friends, or paste a code you received to join an existing group.
                Each group has its own live leaderboard — you can be in multiple groups at the same time.
            </>
        ),
    },

    // ── PREDICTIONS & LOCKING ─────────────────────────────────────────────────
    {
        category: 'Predictions & Locking',
        question: 'When do my predictions lock?',
        answer: (
            <>
                There are <strong style={{ color: 'var(--cream)' }}>two lock types</strong>:
                <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 2, color: 'var(--dim)' }}>
                    <li>
                        <strong style={{ color: 'var(--gold)' }}>🔒 Opening Kickoff Lock — June 11</strong><br />
                        Your full bracket and all group stage predictions freeze when the first World Cup match kicks off.
                        This locks in your <em>original predictions</em> for bracket bonuses and multipliers.
                    </li>
                    <li>
                        <strong style={{ color: '#38bdf8' }}>⚡ Live Knockout Lock — per match, at kick-off</strong><br />
                        Once real knockout fixtures are known, the Live Bracket opens with empty score inputs.
                        Each known knockout match can be re-predicted until that match starts.
                    </li>
                </ul>
            </>
        ),
    },
    {
        category: 'Predictions & Locking',
        question: 'What is the difference between "Original" and "Live" predictions?',
        answer: (
            <>
                <strong style={{ color: 'var(--gold)' }}>Original</strong> predictions are those you submitted before the opening kickoff lock on June 11.
                They earn <strong style={{ color: 'var(--gold)' }}>knockout multipliers</strong> (×1.5 up to ×5) and can also earn <strong style={{ color: 'var(--gold)' }}>bracket bonuses</strong>.<br /><br />
                <strong style={{ color: '#38bdf8' }}>Live</strong> predictions are knockout updates you make after real knockout fixtures are known, before each match kicks off.
                They score using the standard point rules but <strong style={{ color: '#e05c4a' }}>do not</strong> receive multipliers or bracket bonuses.
                Live predictions are shown with a blue <em>LIVE</em> badge on match cards.
            </>
        ),
    },
    {
        category: 'Predictions & Locking',
        question: 'Can I change a prediction after saving it?',
        answer: (
            <>
                Before the opening kickoff, you can update original group predictions and your original bracket.
                After that, group predictions are closed permanently. Knockout matches can only be re-predicted in the Live Bracket once their real fixture is known, and only until that match kicks off.
            </>
        ),
    },

    // ── SCORING ──────────────────────────────────────────────────────────────────
    {
        category: 'Scoring',
        question: 'How are points calculated for a match?',
        answer: (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>What you got right</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>Points</th>
                    </tr>
                </thead>
                <tbody>
                    {[
                        { rule: 'Perfect exact scoreline', pts: '+25', color: 'var(--gold)' },
                        { rule: 'Correct match result', pts: '+10', color: 'var(--cream)' },
                        { rule: 'Goal accuracy with correct result (off by 1 / 2 / 3 / 4 / 5)', pts: '+5 / +4 / +3 / +2 / +1', color: '#5b9fff' },
                        { rule: 'Draw vs win/loss mismatch, off by exactly 1', pts: '+5', color: 'var(--dim)' },
                        { rule: 'BTTS or same-team clean sheet bonus', pts: '+3', color: '#10b981' },
                        { rule: 'Correct advancing team in knockout matches', pts: '+5', color: '#e05c4a' },
                    ].map(row => (
                        <tr key={row.rule} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 8px', color: 'var(--dim)', lineHeight: 1.4 }}>{row.rule}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'Bebas Neue', fontSize: 18, color: row.color }}>{row.pts}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        ),
    },
    {
        category: 'Scoring',
        question: 'What are knockout multipliers?',
        answer: (
            <>
                If you used your <strong style={{ color: 'var(--gold)' }}>original (pre-lock) prediction</strong> for a knockout match <em>and</em> the teams you predicted match the real fixture, your score for that match is multiplied:
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 12 }}>
                    {[
                        { round: 'R32', mult: '×1.5' },
                        { round: 'R16', mult: '×2' },
                        { round: 'QF', mult: '×3' },
                        { round: 'SF', mult: '×4' },
                        { round: 'Final', mult: '×5' },
                    ].map(m => (
                        <div key={m.round} style={{ textAlign: 'center', padding: '10px 4px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--gold)' }}>{m.mult}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{m.round}</div>
                        </div>
                    ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                    If you predicted the wrong teams in that match slot, you score <strong style={{ color: '#e05c4a' }}>0 points</strong> for that original knockout match prediction.
                    If you re-predicted (live update), you score normally <strong>without</strong> the multiplier.
                </p>
            </>
        ),
    },
    {
        category: 'Scoring',
        question: 'What are bracket bonuses?',
        answer: (
            <>
                Separate from match scoring, your <strong style={{ color: 'var(--cream)' }}>original tournament bracket</strong> earns bonus points each time one of your predicted teams advances to the next round:
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 12 }}>
                    {[
                        { label: 'R32', pts: '+1' },
                        { label: 'R16', pts: '+2' },
                        { label: 'QF', pts: '+4' },
                        { label: 'SF', pts: '+8' },
                        { label: 'Final', pts: '+16' },
                        { label: 'Champion', pts: '+32' },
                    ].map(b => (
                        <div key={b.label} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: '#5b9fff' }}>{b.pts}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{b.label}</div>
                        </div>
                    ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                    These bonuses are calculated automatically after each knockout stage completes.
                    Correctly predicting the champion is the biggest single bonus at <strong style={{ color: '#5b9fff' }}>+32 pts</strong>.
                </p>
            </>
        ),
    },

    // ── PLATFORM ─────────────────────────────────────────────────────────────────
    {
        category: 'Platform',
        question: 'Where can I see my full statistics and badges?',
        answer: (
            <>
                Visit the <Link href="/profile" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Palmares Room</Link> (Profile page).
                It shows your total points, exact score count, result accuracy, best streak, your <em>Prediction DNA</em> profile, badge collection, and the full scoring formula.
            </>
        ),
    },
    {
        category: 'Platform',
        question: 'How does the live leaderboard work?',
        answer: (
            <>
                Leaderboards are updated in real-time as match results come in.
                Each group you join has its own leaderboard.
                Points are accumulated across the entire tournament — group stage + knockout rounds + bracket bonuses all count toward your total.
                Your rank in each group is shown on the <Link href="/dashboard" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Dashboard</Link>.
            </>
        ),
    },
    {
        category: 'Platform',
        question: 'How are live scores and match results updated?',
        answer: (
            <>
                The platform pulls live data during matches and updates match statuses automatically.
                Finished matches trigger the scoring engine which calculates and saves points for all predictions.
                You don&apos;t need to refresh — the live match section on the dashboard updates in real time.
            </>
        ),
    },
    {
        category: 'Platform',
        question: 'Can I see the full schedule of matches?',
        answer: (
            <>
                Yes — visit the <Link href="/fixtures" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Fixtures</Link> page for the complete match schedule across all groups and knockout rounds, including kick-off times (GMT+1), venues, and cities.
            </>
        ),
    },
]

const CATEGORIES = Array.from(new Set(FAQ_ITEMS.map(f => f.category)))

const CATEGORY_ICONS: Record<string, string> = {
    'Getting Started': '🚀',
    'Predictions & Locking': '🔒',
    'Scoring': '📐',
    'Platform': '⚙️',
}

export default function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null)
    const [activeCategory, setActiveCategory] = useState<string>('all')

    const filtered = activeCategory === 'all'
        ? FAQ_ITEMS
        : FAQ_ITEMS.filter(f => f.category === activeCategory)

    return (
        <div style={{ marginTop: 52 }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 22, flexWrap: 'wrap', gap: 12,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 3, height: 22, borderRadius: 2, background: 'var(--gold)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--cream)', letterSpacing: 1 }}>
                        Frequently Asked Questions
                    </span>
                </div>

                {/* Category filter pills */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['all', ...CATEGORIES] as const).map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setOpenIndex(null) }}
                            style={{
                                padding: '5px 14px', borderRadius: 20,
                                border: '1px solid',
                                borderColor: activeCategory === cat ? 'var(--gold)' : 'var(--border)',
                                background: activeCategory === cat ? 'rgba(212,168,67,0.12)' : 'var(--surface)',
                                color: activeCategory === cat ? 'var(--gold)' : 'var(--muted)',
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'DM Sans, sans-serif',
                                transition: 'all 0.15s',
                            }}
                        >
                            {cat === 'all' ? '✦ All' : `${CATEGORY_ICONS[cat] ?? ''} ${cat}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* FAQ accordion */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map((item, i) => {
                    const globalIndex = FAQ_ITEMS.indexOf(item)
                    const isOpen = openIndex === globalIndex

                    return (
                        <div
                            key={globalIndex}
                            style={{
                                background: isOpen ? 'rgba(212,168,67,0.04)' : 'var(--surface)',
                                border: `1px solid ${isOpen ? 'rgba(212,168,67,0.28)' : 'var(--border)'}`,
                                borderRadius: 14,
                                overflow: 'hidden',
                                transition: 'border-color 0.2s, background 0.2s',
                            }}
                        >
                            {/* Question row */}
                            <button
                                onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center',
                                    justifyContent: 'space-between', gap: 16,
                                    padding: '16px 20px', background: 'transparent',
                                    border: 'none', cursor: 'pointer', textAlign: 'left',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                    <span style={{
                                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                                        textTransform: 'uppercase',
                                        color: isOpen ? 'var(--gold)' : 'var(--muted)',
                                        padding: '2px 8px', borderRadius: 8,
                                        background: isOpen ? 'rgba(212,168,67,0.12)' : 'var(--surface2)',
                                        border: `1px solid ${isOpen ? 'rgba(212,168,67,0.3)' : 'var(--border)'}`,
                                        flexShrink: 0,
                                        transition: 'all 0.2s',
                                    }}>
                                        {CATEGORY_ICONS[item.category]} {item.category}
                                    </span>
                                    <span style={{
                                        fontSize: 14, fontWeight: 600,
                                        color: isOpen ? 'var(--cream)' : 'var(--dim)',
                                        transition: 'color 0.2s',
                                    }}>
                                        {item.question}
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: 18, color: isOpen ? 'var(--gold)' : 'var(--muted)',
                                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.25s, color 0.2s',
                                    flexShrink: 0, lineHeight: 1,
                                }}>
                                    +
                                </span>
                            </button>

                            {/* Answer panel */}
                            {isOpen && (
                                <div style={{
                                    padding: '0 20px 18px 20px',
                                    borderTop: '1px solid rgba(212,168,67,0.15)',
                                    paddingTop: 16,
                                    fontSize: 13, color: 'var(--dim)', lineHeight: 1.8,
                                }}>
                                    {item.answer}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Footer note */}
            <div style={{
                marginTop: 18, padding: '12px 18px', borderRadius: 10,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 10,
            }}>
                <span style={{ fontSize: 16 }}>💡</span>
                <span>
                    For the full scoring breakdown and badge details, visit the{' '}
                    <Link href="/profile" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>
                        Palmares Room →
                    </Link>
                </span>
            </div>
        </div>
    )
}
