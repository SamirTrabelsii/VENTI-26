import React from 'react'

export default function Loading() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--black)',
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
        }}>
            {/* Background glow */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(212,168,67,0.12) 0%, transparent 70%)',
            }} />

            <div style={{ textAlign: 'center', position: 'relative' }}>
                <div style={{
                    width: 48,
                    height: 48,
                    border: '3px solid var(--border)',
                    borderTopColor: 'var(--gold)',
                    borderRadius: '50%',
                    margin: '0 auto 20px',
                    animation: 'spin 1s linear infinite'
                }} />
                
                <h2 style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontSize: 32,
                    letterSpacing: 2,
                    color: 'var(--gold)',
                    margin: 0,
                }}>
                    LOADING...
                </h2>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Preparing the pitch
                </p>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}} />
        </div>
    )
}
