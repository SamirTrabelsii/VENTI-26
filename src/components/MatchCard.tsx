'use client'
import { useState } from 'react'
import type { Prediction } from '@/types'
import type { MatchData } from '@/lib/wc2026-data'
import { getTeam } from '@/lib/wc2026-data'
import { createClient } from '@/lib/supabase/client'
import TeamFlag from '@/components/TeamFlag'

interface Props {
    match: MatchData
    prediction?: Prediction
    userId: string
    localHome?: number | ''
    localAway?: number | ''
    onChange?: (home: number | '', away: number | '') => void
    onSaved?: (matchId: string, home: number | '', away: number | '') => void
    hideSaveButton?: boolean
    disabled?: boolean
}



export default function MatchCard({ match, prediction, userId, onSaved, localHome, localAway, onChange, hideSaveButton, disabled = false }: Props) {
    const defaultHome = prediction?.home_score ?? ''
    const defaultAway = prediction?.away_score ?? ''
    const home = localHome !== undefined ? localHome : defaultHome
    const away = localAway !== undefined ? localAway : defaultAway

    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(!!prediction)
    const [supabase] = useState(() => createClient())

    const handleHome = (v: number | '') => { 
        if (disabled) return
        if (onChange) onChange(v, away)
        setDirty(true); setSaved(false) 
    }
    const handleAway = (v: number | '') => { 
        if (disabled) return
        if (onChange) onChange(home, v)
        setDirty(true); setSaved(false) 
    }

    const save = async () => {
        if (home === '' || away === '') return
        setSaving(true)
        await supabase.from('predictions').upsert({
            user_id: userId, match_id: match.id,
            home_score: home, away_score: away,
        })
        setSaving(false)
        setSaved(true)
        setDirty(false)
        onSaved?.(match.id, home, away)
    }

    const kickoff = new Date(match.kickoff)
    const dateStr = kickoff.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Africa/Tunis' })
    const timeStr = kickoff.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Tunis' })
    return (
        <div
            style={{
                background: 'var(--surface)',
                border: `1px solid ${saved ? 'rgba(34,197,94,0.3)' : dirty ? 'rgba(212,168,67,0.3)' : 'var(--border)'}`,
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 14,
                transition: 'border-color 0.2s',
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 18px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid var(--border)',
                fontSize: 11, color: 'var(--muted)',
            }}>
                <span style={{ fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Group {match.group_label} · Match {match.match_number} · {dateStr} {timeStr} GMT+1
                    {prediction && !prediction.is_repredicted && (
                        <span style={{ background: 'rgba(212,168,67,0.15)', color: 'var(--gold)', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>
                            🔒 ORIGINAL
                        </span>
                    )}
                    {prediction && prediction.is_repredicted && (
                        <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>
                            LIVE
                        </span>
                    )}
                </span>
                <span>{match.venue}, {match.city}</span>
            </div>

            {/* Score row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 18px' }}>

                {/* Home team */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <TeamFlag teamCode={match.home_team} size={40} />
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{getTeam(match.home_team)?.name || match.home_team}</div>
                    </div>
                </div>

                {/* Score inputs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={20}
                        value={home === '' ? '' : home}
                        placeholder="–"
                        disabled={disabled}
                        onChange={e => {
                            const raw = e.target.value
                            if (raw === '') { handleHome(''); return }
                            const n = parseInt(raw, 10)
                            if (!isNaN(n) && n >= 0 && n <= 20) handleHome(n)
                        }}
                        onFocus={e => e.target.select()}
                        className="bg-surface2 rounded-xl text-cream font-display text-3xl md:text-[38px] w-[52px] h-[56px] md:w-[72px] md:h-[72px] text-center outline-none"
                        style={{
                            borderWidth: 2,
                            borderStyle: 'solid',
                            borderColor: (home !== '' && home > 0) ? 'var(--gold)' : 'var(--border)',
                            color: (home !== '' && home > 0) ? 'var(--gold)' : 'var(--cream)',
                            opacity: disabled ? 0.45 : 1,
                            cursor: disabled ? 'not-allowed' : 'text',
                            MozAppearance: 'textfield',
                            WebkitAppearance: 'none',
                        }}
                    />

                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--muted)' }}>—</span>

                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={20}
                        value={away === '' ? '' : away}
                        placeholder="–"
                        disabled={disabled}
                        onChange={e => {
                            const raw = e.target.value
                            if (raw === '') { handleAway(''); return }
                            const n = parseInt(raw, 10)
                            if (!isNaN(n) && n >= 0 && n <= 20) handleAway(n)
                        }}
                        onFocus={e => e.target.select()}
                        className="bg-surface2 rounded-xl text-cream font-display text-3xl md:text-[38px] w-[52px] h-[56px] md:w-[72px] md:h-[72px] text-center outline-none"
                        style={{
                            borderWidth: 2,
                            borderStyle: 'solid',
                            borderColor: (away !== '' && away > 0) ? 'var(--gold)' : 'var(--border)',
                            color: (away !== '' && away > 0) ? 'var(--gold)' : 'var(--cream)',
                            opacity: disabled ? 0.45 : 1,
                            cursor: disabled ? 'not-allowed' : 'text',
                            MozAppearance: 'textfield',
                            WebkitAppearance: 'none',
                        }}
                    />
                </div>

                {/* Away team */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row-reverse' }}>
                    <TeamFlag teamCode={match.away_team} size={40} />
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{getTeam(match.away_team)?.name || match.away_team}</div>
                    </div>
                </div>
            </div>

            {/* Footer — save button only shown when dirty */}
            {!hideSaveButton && (dirty || saved) && (
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                    padding: '0 18px 14px', gap: 10,
                }}>
                    {saved && !dirty && (
                        <span style={{ fontSize: 12, color: 'var(--green-bright)' }}>✓ Saved</span>
                    )}
                    {dirty && (
                        <button
                            onClick={save}
                            disabled={saving}
                            style={{
                                padding: '8px 22px',
                                borderRadius: 10,
                                background: 'var(--gold)',
                                color: '#0a0a0a',
                                border: 'none',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: 'DM Sans, sans-serif',
                            }}
                        >
                            {saving ? 'Saving…' : 'Save →'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
