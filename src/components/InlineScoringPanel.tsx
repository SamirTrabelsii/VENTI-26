'use client'
import { SCORING_REFERENCE } from '@/lib/scoring'
import ScoringRulesModal from './ScoringRulesModal'

export default function InlineScoringPanel({ className = '', style = {} }: { className?: string, style?: React.CSSProperties }) {
    return (
        <div className={`relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-2xl ${className}`} style={style}>
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ background: 'radial-gradient(circle at bottom right, var(--gold), transparent 80%)' }} />
            <div className="relative z-10">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-4">
                    <span className="text-base">📐</span>
                    <span className="text-[11px] font-semibold tracking-[1.5px] uppercase text-cream">Points Formula</span>
                    <div className="ml-auto">
                        <ScoringRulesModal customTrigger={
                            <span className="text-xs text-gold cursor-pointer hover:underline">Full details →</span>
                        } />
                    </div>
                </div>

                {/* Group rules */}
                <div className="grid grid-cols-2 md:grid-cols-4 border-b border-[var(--border)]">
                    {SCORING_REFERENCE.groupAndKnockout.map((r, i) => (
                        <div key={r.label} className="p-4 text-center border-r border-b md:border-b-0 border-[var(--border)]" style={{
                            background: typeof r.pts === 'number' && r.pts === 25 ? 'rgba(212,168,67,0.04)' : 'transparent',
                        }}>
                            <div style={{ fontFamily: 'Bebas Neue', fontSize: typeof r.pts === 'number' ? 36 : 28, color: typeof r.pts === 'number' && r.pts === 25 ? 'var(--gold)' : 'var(--cream)', lineHeight: 1 }}>+{r.pts}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cream)', marginTop: 4 }}>{r.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{r.note}</div>
                        </div>
                    ))}
                </div>

                {/* Knockout supplement */}
                <div style={{ padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#e05c4a', padding: '2px 8px', borderRadius: 10, background: 'rgba(224,92,74,0.10)', border: '1px solid rgba(224,92,74,0.22)' }}>
                        Knockout
                    </span>
                    {SCORING_REFERENCE.knockoutSupplement.map((r, i) => (
                        <span key={r.label} style={{ fontSize: 12, color: i === 1 ? 'var(--gold)' : 'var(--dim)' }}>
                            <strong style={{ color: '#e05c4a' }}>+{r.pts}</strong> {r.label}
                            {i === 0 && <span style={{ color: 'var(--muted)', margin: '0 8px' }}>·</span>}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
