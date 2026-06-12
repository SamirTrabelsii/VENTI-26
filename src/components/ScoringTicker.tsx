'use client'
import { useState } from 'react'
import InlineScoringPanel from './InlineScoringPanel'

export default function ScoringTicker() {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div style={{ marginBottom: 24 }}>
            {/* The Ticker Bar */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className="relative overflow-hidden cursor-pointer transition-all hover:brightness-110"
                style={{ 
                    background: 'var(--surface)', 
                    border: '1px solid var(--border)', 
                    borderRadius: isExpanded ? '18px 18px 0 0' : 18,
                    borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                }}
            >
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1, zIndex: 10 }}>
                    <span style={{ fontSize: 16 }}>📐</span>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)' }}>
                        Scoring
                    </span>
                    <div className="hidden sm:block" style={{ width: 1, height: 14, background: 'var(--border)' }} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px 16px', flexWrap: 'wrap', fontSize: 12, color: 'var(--cream)' }}>
                        <span>Exact Score: <strong style={{ color: 'var(--gold)' }}>+25</strong></span>
                        <span className="hidden sm:inline" style={{ color: 'var(--muted)' }}>•</span>
                        <span>Correct Outcome: <strong style={{ color: 'var(--gold)' }}>+10</strong></span>
                        <span className="hidden sm:inline" style={{ color: 'var(--muted)' }}>•</span>
                        <span>Goal Diff: <strong style={{ color: 'var(--gold)' }}>+5</strong></span>
                        <span className="hidden sm:inline" style={{ color: 'var(--muted)' }}>•</span>
                        <span>Team Goals: <strong style={{ color: 'var(--gold)' }}>+N</strong></span>
                    </div>
                </div>

                <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
                    {isExpanded ? 'HIDE' : 'FULL RULES'}
                    <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>▼</span>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div style={{ 
                    animation: 'slideDown 0.2s ease-out forwards',
                    transformOrigin: 'top'
                }}>
                    <InlineScoringPanel style={{ borderRadius: '0 0 18px 18px', borderTop: '1px dashed var(--border)' }} />
                </div>
            )}
            
            <style jsx>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: scaleY(0.95); }
                    to { opacity: 1; transform: scaleY(1); }
                }
            `}</style>
        </div>
    )
}
