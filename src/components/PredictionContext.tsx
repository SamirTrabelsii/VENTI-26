'use client'
import React, { createContext, useContext, useState, ReactNode, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Prediction, BracketPick as RawBracketPick } from '@/types'
import AuthModal from '@/components/AuthModal'
import { isGlobalLockPassed, isGroupMatchStarted } from '@/lib/wc2026-data'

const GUEST_STORAGE_KEY = 'venti26_guest_predictions'

export interface BracketPick {
    team_code: string
    home_score?: number | ''
    away_score?: number | ''
    predicted_home_team?: string
    predicted_away_team?: string
    original_team_code?: string
    is_repredicted?: boolean
}

export type BracketPickData = { 
    team_code: string, 
    home_score: number | '', 
    away_score: number | '',
    predicted_home_team?: string,
    predicted_away_team?: string,
    original_team_code?: string,
    is_repredicted?: boolean
}

interface PredictionContextType {
    groupScores: Record<string, { home: number | '', away: number | '', original_home: number | '', original_away: number | '', is_repredicted: boolean }>
    setGroupScore: (matchId: string, home: number | '', away: number | '') => void
    bracketPicks: Record<string, BracketPickData>
    setBracketPick: (key: string, data: BracketPickData) => void
    saveAll: () => Promise<void>
    saving: boolean
    hasUnsavedChanges: boolean
    isLocked: boolean
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
    isUnlocked,
    children 
}: { 
    userId?: string | null
    initialPredictions: Prediction[]
    initialBracketPicks: BracketPick[]
    isUnlocked?: boolean
    children: ReactNode 
}) {
    const [supabase] = React.useState(() => createClient())
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

    const [groupScores, setGroupScores] = useState<Record<string, { home: number | '', away: number | '', original_home: number | '', original_away: number | '', is_repredicted: boolean }>>(() => {
        const init: Record<string, { home: number | '', away: number | '', original_home: number | '', original_away: number | '', is_repredicted: boolean }> = {}
        initialPredictions.forEach(p => {
            init[p.match_id] = { 
                home: p.home_score ?? '', 
                away: p.away_score ?? '',
                original_home: (p as any).original_home_score ?? '',
                original_away: (p as any).original_away_score ?? '',
                is_repredicted: (p as any).is_repredicted ?? false
            }
        })
        return init
    })
    const groupScoresRef = useRef(groupScores)

    const [bracketPicks, setBracketPicks] = useState<Record<string, BracketPickData>>(() => {
        const init: Record<string, BracketPickData> = {}
        initialBracketPicks.forEach((b: any) => {
            init[`${b.round}_${b.slot_index}`] = {
                team_code: b.team_code,
                home_score: b.home_score ?? '',
                away_score: b.away_score ?? '',
                predicted_home_team: b.predicted_home_team,
                predicted_away_team: b.predicted_away_team,
                original_team_code: b.original_team_code,
                is_repredicted: b.is_repredicted
            }
        })
        return init
    })

    React.useEffect(() => {
        groupScoresRef.current = groupScores
    }, [groupScores])

    // Hydrate guest predictions from localStorage on mount (Guest Mode)
    React.useEffect(() => {
        if (!userId) {
            try {
                const stored = localStorage.getItem(GUEST_STORAGE_KEY)
                if (stored) {
                    const parsed = JSON.parse(stored)
                    if (parsed.groupScores) setGroupScores(parsed.groupScores)
                    if (parsed.bracketPicks) setBracketPicks(parsed.bracketPicks)
                    if (parsed.hasUnsavedChanges) setHasUnsavedChanges(parsed.hasUnsavedChanges)
                }
            } catch (e) {
                console.error('Failed to parse guest predictions', e)
            }
        }
    }, [userId])

    // Migrate guest predictions to authenticated user
    React.useEffect(() => {
        if (userId) {
            try {
                const stored = localStorage.getItem(GUEST_STORAGE_KEY)
                if (stored) {
                    const parsed = JSON.parse(stored)
                    if (parsed.groupScores || parsed.bracketPicks) {
                        console.log('[Migration] Migrating guest predictions to user account...')
                        setGroupScores(prev => ({ ...prev, ...parsed.groupScores }))
                        setBracketPicks(prev => ({ ...prev, ...parsed.bracketPicks }))
                        setHasUnsavedChanges(true)
                        localStorage.removeItem(GUEST_STORAGE_KEY)
                        
                        // We do not auto-save here because the state update needs to flush first.
                        // The user will see 'Save All Changes' glowing, or we could trigger a save timeout.
                        // Let's trigger a save after a short delay so the state is applied.
                        setTimeout(() => {
                            // We can't easily call saveAll() here because it might capture old state,
                            // but setting hasUnsavedChanges=true is perfectly fine. The user clicks Save.
                        }, 500)
                    }
                }
            } catch (e) {
                console.error('Failed to migrate guest predictions', e)
            }
        }
    }, [userId])

    // Persist guest predictions to localStorage whenever they change
    React.useEffect(() => {
        if (!userId) {
            localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({
                groupScores,
                bracketPicks,
                hasUnsavedChanges
            }))
        }
    }, [userId, groupScores, bracketPicks, hasUnsavedChanges])

    // Compute personalized lock: globally locked UNLESS admin has unlocked this specific user
    const isLocked = isGlobalLockPassed() && !isUnlocked

    const setGroupScore = useCallback((matchId: string, home: number | '', away: number | '') => {
        if (isLocked) return
        // Even if globally unlocked, don't allow editing matches whose kickoff has passed
        if (isGroupMatchStarted(matchId)) return

        setHasUnsavedChanges(true)

        setGroupScores(prev => {
            const existing = prev[matchId]
            const next = {
                ...prev,
                [matchId]: {
                    home,
                    away,
                    original_home: home,
                    original_away: away,
                    is_repredicted: existing?.is_repredicted ?? false,
                }
            }

            groupScoresRef.current = next
            return next
        })
    }, [])

    const setBracketPick = (key: string, data: BracketPickData) => {
        setBracketPicks(prev => ({ ...prev, [key]: data }))
        setHasUnsavedChanges(true)
    }

    const saveAll = async () => {
        if (!userId) {
            setIsAuthModalOpen(true)
            return
        }

        setSaving(true)
        try {
            // 1. Prepare Group Predictions Upsert
            const currentGroupScores = groupScoresRef.current

            const groupUpserts = Object.keys(currentGroupScores)
                .filter(matchId => {
                    const s = currentGroupScores[matchId]
                    // Skip matches whose kickoff has passed — backend would reject anyway
                    if (isGroupMatchStarted(matchId)) return false
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
                    home_score: Number(currentGroupScores[matchId].home),
                    away_score: Number(currentGroupScores[matchId].away),
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
                        predicted_home_team: bracketPicks[key].predicted_home_team,
                        predicted_away_team: bracketPicks[key].predicted_away_team,
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
            saveAll, saving, hasUnsavedChanges,
            isLocked
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

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onSuccess={(newUserId) => {
                    setIsAuthModalOpen(false)
                    // Reload the page so the server re-fetches as the authenticated user.
                    // Guest predictions are already in localStorage and the migration
                    // useEffect will merge them into state on reload.
                    window.location.reload()
                }}
            />
        </PredictionContext.Provider>
    )
}
