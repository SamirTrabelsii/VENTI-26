'use client'
import { useState, useEffect } from 'react'
import { SCORING_REFERENCE } from '@/lib/scoring'

export default function ScoringRulesDrawer({ customTrigger }: { customTrigger?: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    return (
        <>
            {/* TRIGGER */}
            {customTrigger ? (
                <div onClick={() => setIsOpen(true)} className="cursor-pointer inline-block">
                    {customTrigger}
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-50 flex items-center gap-2 group hover:scale-105 transition-all duration-300"
                    style={{
                        padding: '12px 24px',
                        borderRadius: '100px',
                        background: 'linear-gradient(135deg, rgba(212,168,67,0.15) 0%, rgba(212,168,67,0.05) 100%)',
                        border: '1px solid var(--border-gold)',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(212,168,67,0.2)',
                        backdropFilter: 'blur(10px)',
                        color: 'var(--gold)',
                        fontWeight: 700,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        fontSize: 12,
                        cursor: 'pointer'
                    }}
                >
                    <span style={{ fontSize: 18 }} className="group-hover:-rotate-12 transition-transform duration-300">📐</span>
                    Scoring Rules
                </button>
            )}

            {/* SLIDE OVER DRAWER */}
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex justify-end" style={{ pointerEvents: isOpen ? 'auto' : 'none' }}>
                    
                    {/* Backdrop */}
                    <div 
                        onClick={() => setIsOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        style={{ animation: 'fadeIn 0.3s ease forwards' }}
                    />

                    {/* Drawer Panel */}
                    <div 
                        className="relative w-full max-w-md h-full flex flex-col bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl overflow-hidden"
                        style={{ animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-[var(--border)] bg-black/20 backdrop-blur-md sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🏆</span>
                                <div>
                                    <h2 className="font-display text-2xl text-cream leading-none tracking-wide">Points Formula</h2>
                                    <p className="text-[11px] text-muted mt-1 uppercase tracking-wider">How to earn points</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto pb-10" style={{ scrollbarWidth: 'thin' }}>
                            
                            {/* Section 1 */}
                            <div className="p-6 border-b border-[var(--border)] relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-3xl" />
                                <h3 className="text-[10px] font-bold tracking-[2px] uppercase text-green-bright mb-5 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-bright" /> Match Predictions
                                </h3>
                                
                                <div className="flex flex-col gap-4 relative z-10">
                                    {SCORING_REFERENCE.groupAndKnockout.map((r, i) => (
                                        <div key={r.label} className="flex items-start gap-4">
                                            <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{
                                                background: typeof r.pts === 'number' && r.pts >= 25 ? 'linear-gradient(135deg, rgba(212,168,67,0.15), transparent)' : 'var(--surface2)',
                                                border: typeof r.pts === 'number' && r.pts >= 25 ? '1px solid var(--border-gold)' : '1px solid var(--border)'
                                            }}>
                                                <span className={`font-display text-2xl ${typeof r.pts === 'number' && r.pts >= 25 ? 'text-gold' : 'text-cream'}`}>
                                                    +{r.pts}
                                                </span>
                                            </div>
                                            <div className="pt-1">
                                                <div className="text-sm font-semibold text-cream">{r.label}</div>
                                                <div className="text-[11px] text-muted mt-1 leading-relaxed">{r.note}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 2 */}
                            <div className="p-6 border-b border-[var(--border)]">
                                <h3 className="text-[10px] font-bold tracking-[2px] uppercase text-[#e05c4a] mb-5 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#e05c4a]" /> Knockout Bonus
                                </h3>
                                
                                <div className="flex flex-col gap-4">
                                    {SCORING_REFERENCE.knockoutSupplement.map((r) => (
                                        <div key={r.label} className="flex items-start gap-4">
                                            <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-[#e05c4a]/10 border border-[#e05c4a]/20">
                                                <span className="font-display text-2xl text-[#e05c4a]">+{r.pts}</span>
                                            </div>
                                            <div className="pt-1">
                                                <div className="text-sm font-semibold text-cream">{r.label}</div>
                                                <div className="text-[11px] text-muted mt-1 leading-relaxed">{r.note}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 3 */}
                            <div className="p-6 border-b border-[var(--border)] bg-black/20">
                                <h3 className="text-[10px] font-bold tracking-[2px] uppercase text-blue-accent mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-accent" /> Original Bracket Multipliers
                                </h3>
                                <p className="text-[11px] text-dim leading-relaxed mb-5">
                                    If your locked bracket prediction matches the real game, points are multiplied.
                                </p>
                                
                                <div className="grid grid-cols-5 gap-2">
                                    {SCORING_REFERENCE.originalMultipliers.map(m => (
                                        <div key={m.round} className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--surface2)] border border-[var(--border)]">
                                            <span className={`font-display text-xl ${m.multiplier >= 4 ? 'text-gold' : 'text-cream'}`}>×{m.multiplier}</span>
                                            <span className="text-[9px] font-bold text-muted mt-1">{m.round}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 4 */}
                            <div className="p-6">
                                <h3 className="text-[10px] font-bold tracking-[2px] uppercase text-[#a855f7] mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" /> Bracket Progression
                                </h3>
                                <p className="text-[11px] text-dim leading-relaxed mb-5">
                                    Earn bonus points when teams from your bracket advance.
                                </p>
                                
                                <div className="grid grid-cols-1 gap-2">
                                    {SCORING_REFERENCE.bracketBonuses.map(b => (
                                        <div key={b.label} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)]">
                                            <span className={`font-display text-xl w-10 text-center ${b.pts >= 16 ? 'text-gold' : 'text-cream'}`}>+{b.pts}</span>
                                            <div className="flex-1">
                                                <div className="text-xs font-semibold text-cream">{b.label}</div>
                                                <div className="text-[10px] text-muted">{b.note}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </>
    )
}
