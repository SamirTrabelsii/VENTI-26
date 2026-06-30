// src/components/FAQSection.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FAQItem {
    question: string
    answer: React.ReactNode
    category: string
}

const FAQ_ITEMS: FAQItem[] = [
    // ── GETTING STARTED ──────────────────────────────────────────────────────
    {
        category: 'Getting Started',
        question: 'How do I start predicting?',
        answer: (
            <>
                Head to the <Link href="/predict" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Predict</Link> page.
                You&apos;ll find all 72 group stage matches — enter a score for each one.
                Once the knockout phase begins, the{' '}
                <Link href="/live-bracket" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Live Bracket</Link>{' '}
                opens for you to predict each knockout match as the teams become known.
                Hit <em>Save All Changes</em> to lock in your picks.
            </>
        ),
    },
    {
        category: 'Getting Started',
        question: 'Do I need to predict every match?',
        answer: (
            <>
                No, but you only score points for matches you predicted. Unpredicted matches score{' '}
                <strong style={{ color: '#e05c4a' }}>0 points</strong> — so the more you predict, the better your chances on the leaderboard.
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
                        All group stage predictions freeze when the first World Cup match kicks off.
                        After this point, group stage predictions are closed permanently.
                    </li>
                    <li>
                        <strong style={{ color: '#38bdf8' }}>⚡ Live Knockout Lock — per match, at kick-off</strong><br />
                        Once real knockout fixtures are known, the Live Bracket opens.
                        Each knockout match can be predicted until that match kicks off.
                    </li>
                </ul>
            </>
        ),
    },
    {
        category: 'Predictions & Locking',
        question: 'Can I change a prediction after saving it?',
        answer: (
            <>
                Before the opening kickoff, you can update group stage predictions freely.
                After that, group predictions are closed permanently.
                Knockout matches can be predicted in the Live Bracket once their real fixture is known, up until that match kicks off.
            </>
        ),
    },

    // ── SCORING ──────────────────────────────────────────────────────────────
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
                        { rule: 'Correct match result (not exact)', pts: '+10', color: 'var(--cream)' },
                        { rule: 'Goal accuracy with correct result (off by 1 / 2 / 3 / 4 / 5)', pts: '+5 / +4 / +3 / +2 / +1', color: '#5b9fff' },
                        { rule: 'Draw vs win/loss mismatch, off by exactly 1 goal total', pts: '+5', color: 'var(--dim)' },
                        { rule: 'Both teams scored or same team clean sheet bonus', pts: '+3', color: '#10b981' },
                        { rule: 'Correct advancing team in knockout matches', pts: '+10', color: '#e05c4a' },
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
        question: 'How does the knockout qualifier bonus work?',
        answer: (
            <>
                In knockout matches, in addition to your score prediction, you also pick which team advances.
                If you predict the correct team to go through — even if the match goes to a penalty shootout —
                you earn <strong style={{ color: '#e05c4a' }}>+10 bonus points</strong>.
                <br /><br />
                This means the maximum per knockout match is{' '}
                <strong style={{ color: 'var(--gold)' }}>35 points</strong>: exact score (25) + correct qualifier (10).
                <br /><br />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    The qualifier bonus covers penalty outcomes — so if you predict a 1-1 draw and the match ends 1-1 after 120 minutes
                    but your team wins on penalties, you get the exact score points (25) plus the +10 if you picked the right team to advance.
                </span>
            </>
        ),
    },
    {
        category: 'Scoring',
        question: 'What is the maximum score per match?',
        answer: (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 48, color: 'var(--cream)', lineHeight: 1 }}>25</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Group Stage</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Exact scoreline</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'linear-gradient(135deg, rgba(212,168,67,0.08), transparent)', borderRadius: 12, border: '1px solid var(--border-gold)' }}>
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 48, color: 'var(--gold)', lineHeight: 1 }}>35</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Knockout</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Exact score + correct qualifier</div>
                </div>
            </div>
        ),
    },

    // ── PLATFORM ─────────────────────────────────────────────────────────────
    {
        category: 'Platform',
        question: 'Where can I see my full statistics and badges?',
        answer: (
            <>
                Visit the <Link href="/profile" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Palmares Room</Link> (Profile page).
                It shows your total points, exact score count, result accuracy, best streak, your <em>Prediction DNA</em> profile, badge collection, and the full scoring history match by match.
            </>
        ),
    },
    {
        category: 'Platform',
        question: 'How does the live leaderboard work?',
        answer: (
            <>
                Leaderboards update in real-time as match results come in.
                Each group you join has its own leaderboard.
                Points accumulate across the entire tournament — group stage and knockout rounds all count toward your total.
                Your rank in each group is shown on the{' '}
                <Link href="/home" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Home</Link> page.
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
                You don&apos;t need to refresh — the live match section on the home page updates in real time.
            </>
        ),
    },
    {
        category: 'Platform',
        question: 'Can I see the full schedule of matches?',
        answer: (
            <>
                Yes — visit the{' '}
                <Link href="/fixtures" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Fixtures</Link>{' '}
                page for the complete match schedule across all groups and knockout rounds,
                including kick-off times (GMT+1), venues, and cities.
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 3, height: 22, borderRadius: 2, background: 'var(--gold)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--cream)', letterSpacing: 1 }}>
                        Frequently Asked Questions
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['all', ...CATEGORIES] as const).map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setOpenIndex(null) }}
                            style={{
                                padding: '5px 14px', borderRadius: 20, border: '1px solid',
                                borderColor: activeCategory === cat ? 'var(--gold)' : 'var(--border)',
                                background: activeCategory === cat ? 'rgba(212,168,67,0.12)' : 'var(--surface)',
                                color: activeCategory === cat ? 'var(--gold)' : 'var(--muted)',
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
                            }}
                        >
                            {cat === 'all' ? '✦ All' : `${CATEGORY_ICONS[cat] ?? ''} ${cat}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* FAQ accordion */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map((item) => {
                    const globalIndex = FAQ_ITEMS.indexOf(item)
                    const isOpen = openIndex === globalIndex

                    return (
                        <div
                            key={globalIndex}
                            style={{
                                background: isOpen ? 'rgba(212,168,67,0.04)' : 'var(--surface)',
                                border: `1px solid ${isOpen ? 'rgba(212,168,67,0.28)' : 'var(--border)'}`,
                                borderRadius: 14, overflow: 'hidden',
                                transition: 'border-color 0.2s, background 0.2s',
                            }}
                        >
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
                                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                                        color: isOpen ? 'var(--gold)' : 'var(--muted)',
                                        padding: '2px 8px', borderRadius: 8,
                                        background: isOpen ? 'rgba(212,168,67,0.12)' : 'var(--surface2)',
                                        border: `1px solid ${isOpen ? 'rgba(212,168,67,0.3)' : 'var(--border)'}`,
                                        flexShrink: 0, transition: 'all 0.2s',
                                    }}>
                                        {CATEGORY_ICONS[item.category]} {item.category}
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: isOpen ? 'var(--cream)' : 'var(--dim)', transition: 'color 0.2s' }}>
                                        {item.question}
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: 18, color: isOpen ? 'var(--gold)' : 'var(--muted)',
                                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.25s, color 0.2s',
                                    flexShrink: 0, lineHeight: 1,
                                }}>+</span>
                            </button>

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