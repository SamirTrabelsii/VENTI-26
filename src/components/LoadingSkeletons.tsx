import React from 'react'

const shimmer = {
    background: 'linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
} as React.CSSProperties

const block = (w: string | number, h: number, radius = 6) => ({
    ...shimmer,
    width: w,
    height: h,
    borderRadius: radius,
    display: 'block',
    flexShrink: 0,
} as React.CSSProperties)

export function HomeSkeleton() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)', paddingTop: 64 }}>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0 }
                    100% { background-position: -200% 0 }
                }
            `}</style>

            {/* Hero */}
            <div style={{ padding: '48px 40px 36px', maxWidth: 1400, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <span style={block(120, 12)} />
                        <span style={block(280, 70, 4)} />
                        <span style={block(360, 16, 8)} />
                        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                            <span style={block(160, 44, 12)} />
                            <span style={block(120, 44, 12)} />
                        </div>
                    </div>
                    <span style={block(288, 200, 18)} />
                </div>
            </div>

            {/* Stat cards */}
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 40px 28px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                    {[1,2,3,4].map(i => (
                        <span key={i} style={block('100%', 88, 14)} />
                    ))}
                </div>
            </div>

            {/* Main grid */}
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 40px 60px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
                <span style={block('100%', 400, 18)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <span style={block('100%', 280, 18)} />
                    <span style={block('100%', 140, 18)} />
                </div>
            </div>
        </div>
    )
}

export function PredictPageSkeleton() {
    return (
        <div style={{ display: 'flex', paddingTop: 64, minHeight: '100vh', background: 'var(--black)' }}>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0 }
                    100% { background-position: -200% 0 }
                }
            `}</style>
            {/* Sidebar */}
            <div style={{ width: 230, flexShrink: 0, padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3,4,5,6].map(i => <span key={i} style={block('100%', 32, 8)} />)}
            </div>

            {/* Main */}
            <div style={{ flex: 1, padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <span style={block('100%', 60, 12)} />
                <span style={block('100%', 44, 12)} />
                {[1,2,3].map(i => (
                    <span key={i} style={block('100%', 110, 14)} />
                ))}
            </div>
        </div>
    )
}
