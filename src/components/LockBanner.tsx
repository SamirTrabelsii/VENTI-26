'use client'

import { useEffect, useState } from 'react'
import { getTournamentPhase, TOURNAMENT_LOCK, KNOCKOUT_REOPEN, KNOCKOUT_FINAL_LOCK } from '@/lib/wc2026-data'

export default function LockBanner() {
    const [phase, setPhase] = useState(getTournamentPhase())
    const [timeLeft, setTimeLeft] = useState('')

    useEffect(() => {
        const timer = setInterval(() => {
            const currentPhase = getTournamentPhase()
            setPhase(currentPhase)

            let targetDate = new Date()
            if (currentPhase === 'PRE_TOURNAMENT') targetDate = new Date(TOURNAMENT_LOCK)
            else if (currentPhase === 'GROUP_STAGE_LOCKED') targetDate = new Date(KNOCKOUT_REOPEN)
            else if (currentPhase === 'KNOCKOUT_OPEN') targetDate = new Date(KNOCKOUT_FINAL_LOCK)
            
            if (currentPhase !== 'FINAL_LOCK') {
                const diff = targetDate.getTime() - new Date().getTime()
                if (diff > 0) {
                    const d = Math.floor(diff / (1000 * 60 * 60 * 24))
                    const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
                    const m = Math.floor((diff / 1000 / 60) % 60)
                    setTimeLeft(`${d}d ${h}h ${m}m`)
                } else {
                    setTimeLeft('')
                }
            }
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    let bgColor = 'var(--surface2)'
    let borderColor = 'var(--border)'
    let message = ''
    let icon = '🕒'

    if (phase === 'PRE_TOURNAMENT') {
        message = 'Predictions open! All group & bracket picks lock in: ' + timeLeft
        bgColor = 'rgba(212, 168, 67, 0.1)'
        borderColor = 'var(--gold)'
        icon = '🔓'
    } else if (phase === 'GROUP_STAGE_LOCKED') {
        message = 'Predictions Hard-Locked for Group Stage. Knockout bracket reopens in: ' + timeLeft
        bgColor = 'rgba(200, 57, 43, 0.1)'
        borderColor = 'rgba(200, 57, 43, 0.3)'
        icon = '🔒'
    } else if (phase === 'KNOCKOUT_OPEN') {
        message = 'Knockout Repredictions Open! Final lock in: ' + timeLeft
        bgColor = 'rgba(212, 168, 67, 0.1)'
        borderColor = 'var(--gold)'
        icon = '🔓'
    } else {
        message = 'Tournament Predictions Permanently Locked.'
        bgColor = 'rgba(200, 57, 43, 0.1)'
        borderColor = 'rgba(200, 57, 43, 0.3)'
        icon = '🔒'
    }

    return (
        <div style={{
            background: bgColor, border: `1px solid ${borderColor}`,
            padding: '12px 20px', borderRadius: 12, marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 12,
            color: 'var(--cream)', fontSize: 14, fontWeight: 500
        }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span>{message}</span>
        </div>
    )
}
