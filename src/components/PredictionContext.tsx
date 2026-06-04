'use client'
import React, { createContext, useContext, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Prediction, BracketPick } from '@/types'

export type BracketPickData = { team_code: string, home_score: number | '', away_score: number | '' }

interface PredictionContextType {
    groupScores: Record<string, { home: number | '', away: number | '' }>
    setGroupScore: (matchId: string, home: number | '', away: number | '') => void
    bracketPicks: Record<string, BracketPickData>
    setBracketPick: (key: string, data: BracketPickData) => void
    saveAll: () => Promise<void>
    saving: boolean
    hasUnsavedChanges: boolean
}

const PredictionContext = createContext<PredictionContextType | null>(null)

export function usePredictions() {
    const ctx = useContext(PredictionContext)
    if (!ctx) throw new Error('usePredictions must be used within a PredictionProvider')
    return ctx
}

export function PredictionProvider({ 
    userId, 
    initialPredictions, 
    initialBracketPicks,
    children 
}: { 
    userId: string
    initialPredictions: Prediction[]
    initialBracketPicks: BracketPick[]
    children: ReactNode 
}) {
    const supabase = createClient()
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    const [groupScores, setGroupScores] = useState<Record<string, { home: number | '', away: number | '' }>>(() => {
        const init: Record<string, { home: number | '', away: number | '' }> = {}
        initialPredictions.forEach(p => {
            init[p.match_id] = { home: p.home_score, away: p.away_score }
        })
        return init
    })

    const [bracketPicks, setBracketPicks] = useState<Record<string, BracketPickData>>(() => {
        const init: Record<string, BracketPickData> = {}
        initialBracketPicks.forEach(b => {
            init[`${b.round}_${b.slot_index}`] = {
                team_code: b.team_code,
                home_score: b.home_score ?? '',
                away_score: b.away_score ?? ''
            }
        })
        return init
    })

    const setGroupScore = (matchId: string, home: number | '', away: number | '') => {
        setGroupScores(prev => ({ ...prev, [matchId]: { home, away } }))
        setHasUnsavedChanges(true)
    }

    const setBracketPick = (key: string, data: BracketPickData) => {
        setBracketPicks(prev => ({ ...prev, [key]: data }))
        setHasUnsavedChanges(true)
    }

    const saveAll = async () => {
        setSaving(true)
        try {
            // 1. Prepare Group Predictions Upsert
            const groupUpserts = Object.keys(groupScores)
                .filter(matchId => {
                    const s = groupScores[matchId]
                    return (
                        s &&
                        s.home !== null &&
                        s.home !== undefined &&
                        (s.home as unknown) !== '' &&
                        s.away !== null &&
                        s.away !== undefined &&
                        (s.away as unknown) !== ''
                    )
                })
                .map(matchId => ({
                    user_id: userId,
                    match_id: matchId,
                    home_score: Number(groupScores[matchId].home),
                    away_score: Number(groupScores[matchId].away),
                }))

            // 2. Prepare Bracket Picks Upsert
            const bracketUpserts = Object.keys(bracketPicks)
                .filter(key => bracketPicks[key].team_code !== '')
                .map(key => {
                    // Split on the LAST underscore to handle keys like "third_place_0"
                    const lastUnderscore = key.lastIndexOf('_')
                    const round = key.substring(0, lastUnderscore)
                    const slot = key.substring(lastUnderscore + 1)
                    return {
                        user_id: userId,
                        round,
                        slot_index: parseInt(slot, 10),
                        team_code: bracketPicks[key].team_code,
                        home_score: bracketPicks[key].home_score === '' ? null : bracketPicks[key].home_score,
                        away_score: bracketPicks[key].away_score === '' ? null : bracketPicks[key].away_score,
                    }
                })

            // Fire both upserts
            console.log('[SaveAll] Group upserts:', groupUpserts.length, 'Bracket upserts:', bracketUpserts.length)
            
            if (groupUpserts.length > 0) {
                const { error } = await supabase.from('predictions').upsert(groupUpserts, { onConflict: 'user_id,match_id' })
                if (error) {
                    console.error('[SaveAll] Group prediction error:', error.message, error.code, error.details)
                    throw new Error(`Group prediction error: ${error.message}`)
                }
            }
            if (bracketUpserts.length > 0) {
                console.log('[SaveAll] Bracket rounds:', bracketUpserts.map(b => b.round + '_' + b.slot_index))
                
                // Delete existing picks first, then insert fresh ones (avoids RLS conflicts with upsert)
                const { error: delError } = await supabase
                    .from('bracket_picks')
                    .delete()
                    .eq('user_id', userId)
                if (delError) {
                    console.error('[SaveAll] Bracket delete error:', delError.message, delError.code)
                    throw new Error(`Bracket delete error: ${delError.message}`)
                }
                
                const { error: insError } = await supabase
                    .from('bracket_picks')
                    .insert(bracketUpserts)
                if (insError) {
                    console.error('[SaveAll] Bracket insert error:', insError.message, insError.code, insError.details)
                    throw new Error(`Bracket insert error: ${insError.message}`)
                }
                else console.log('[SaveAll] Bracket picks saved successfully:', bracketUpserts.length, 'picks')
            }

            setHasUnsavedChanges(false)
            router.refresh()
        } catch (err) {
            console.error('[SaveAll] Error saving predictions:', err)
            alert('An error occurred while saving your predictions. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <PredictionContext.Provider value={{
            groupScores, setGroupScore,
            bracketPicks, setBracketPick,
            saveAll, saving, hasUnsavedChanges
        }}>
            {children}

            {/* Global Sticky Save Button */}
            <div style={{
                position: 'fixed',
                bottom: 40,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                padding: '12px 24px',
                background: 'rgba(20,20,20,0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-gold)',
                borderRadius: 50,
                boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,67,0.1)',
                transition: 'opacity 0.3s, transform 0.3s',
                opacity: hasUnsavedChanges ? 1 : 0,
                pointerEvents: hasUnsavedChanges ? 'auto' : 'none',
            }}>
                <div style={{ color: 'var(--cream)', fontSize: 14, fontWeight: 500 }}>
                    You have unsaved predictions
                </div>
                <button
                    onClick={saveAll}
                    disabled={saving}
                    style={{
                        background: 'var(--gold)',
                        color: '#0a0a0a',
                        border: 'none',
                        padding: '10px 24px',
                        borderRadius: 30,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(212,168,67,0.4)',
                    }}
                >
                    {saving ? 'Saving...' : 'Save All Changes'}
                </button>
            </div>
        </PredictionContext.Provider>
    )
}
