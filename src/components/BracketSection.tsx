'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { usePredictions } from './PredictionContext'
import KnockoutMatchCard from './KnockoutMatchCard'
import { GROUPS, GROUP_MATCHES, R32_SLOTS, KNOCKOUT_MATCHES, getTeam, getTournamentPhase, isGlobalLockPassed } from '@/lib/wc2026-data'
import { useRealTournament } from '@/lib/useRealTournament'
import TeamFlag from '@/components/TeamFlag'

type Round = 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final' | 'champion'
interface Slot { home: string; away: string }

const ROUND_CONFIG: { key: Round; label: string; slots: number }[] = [
    { key: 'r32', label: 'Round of 32', slots: 16 },
    { key: 'r16', label: 'Round of 16', slots: 8 },
    { key: 'qf', label: 'Quarter-finals', slots: 4 },
    { key: 'sf', label: 'Semi-finals', slots: 2 },
    { key: 'third_place', label: '3rd Place', slots: 1 },
    { key: 'final', label: 'Final', slots: 1 },
    { key: 'champion', label: 'Champion', slots: 1 },
]

function computeGroupStandings(
    groupScores: Record<string, { home: number | '', away: number | '' }>
): { groupStandings: Record<string, string[]>, thirdPlaceRanking: string[] } {
    const groupStandings: Record<string, string[]> = {}

    GROUPS.forEach(g => {
        const matches = GROUP_MATCHES.filter(m => m.group_label === g)
        const teams = Array.from(new Set(matches.flatMap(m => [m.home_team, m.away_team])))
        const pts: Record<string, number> = {}
        const gd: Record<string, number> = {}
        const gf: Record<string, number> = {}
        teams.forEach(t => { pts[t] = 0; gd[t] = 0; gf[t] = 0 })

        matches.forEach(m => {
            const pred = groupScores[m.id]
            if (!pred) return
            const h = pred.home, a = pred.away
            if (typeof h !== 'number' || typeof a !== 'number') return
            
            gf[m.home_team] += h; gf[m.away_team] += a
            gd[m.home_team] += h - a; gd[m.away_team] += a - h
            if (h > a) { pts[m.home_team] += 3 }
            else if (h === a) { pts[m.home_team] += 1; pts[m.away_team] += 1 }
            else { pts[m.away_team] += 3 }
        })

        const ranked = [...teams].sort((a, b) =>
            pts[b] - pts[a] || gd[b] - gd[a] || gf[b] - gf[a] || a.localeCompare(b)
        )
        groupStandings[g] = ranked
    })

    const thirdPlaced = GROUPS.map(g => groupStandings[g]?.[2]).filter(Boolean) as string[]
    const allStats: Record<string, { pts: number, gd: number, gf: number }> = {}
    GROUPS.forEach(g => {
        const matches = GROUP_MATCHES.filter(m => m.group_label === g)
        const teams = Array.from(new Set(matches.flatMap(m => [m.home_team, m.away_team])))
        teams.forEach(t => { allStats[t] = { pts: 0, gd: 0, gf: 0 } })
        matches.forEach(m => {
            const pred = groupScores[m.id]
            if (!pred) return
            const h = pred.home, a = pred.away
            if (typeof h !== 'number' || typeof a !== 'number') return

            allStats[m.home_team].gf += h; allStats[m.away_team].gf += a
            allStats[m.home_team].gd += h - a; allStats[m.away_team].gd += a - h
            if (h > a) { allStats[m.home_team].pts += 3 }
            else if (h === a) { allStats[m.home_team].pts += 1; allStats[m.away_team].pts += 1 }
            else { allStats[m.away_team].pts += 3 }
        })
    })

    thirdPlaced.sort((a, b) => {
        const sa = allStats[a], sb = allStats[b]
        return sb.pts - sa.pts || sb.gd - sa.gd || sb.gf - sa.gf || a.localeCompare(b)
    })

    return { groupStandings, thirdPlaceRanking: thirdPlaced }
}

function buildR32Slots(data: { groupStandings: Record<string, string[]>, thirdPlaceRanking: string[] }): Slot[] {
    const { groupStandings, thirdPlaceRanking } = data
    const top8Thirds = thirdPlaceRanking.slice(0, 8)
    
    const unassignedThirds = [...top8Thirds]
    const pairs: Slot[] = R32_SLOTS.map(slot => {
        let home = slot[0]
        let away = slot[1]

        if (home.length === 2 && ['1', '2'].includes(home[0])) {
            const pos = parseInt(home[0]) - 1
            const grp = home[1]
            home = groupStandings[grp]?.[pos] ?? 'TBD'
        }

        if (away.length === 2 && ['1', '2'].includes(away[0])) {
            const pos = parseInt(away[0]) - 1
            const grp = away[1]
            away = groupStandings[grp]?.[pos] ?? 'TBD'
        }

        return { home, away }
    })

    pairs.forEach(pair => {
        if (pair.home === 'T3') pair.home = unassignedThirds.shift() ?? 'TBD'
        if (pair.away === 'T3') pair.away = unassignedThirds.shift() ?? 'TBD'
    })

    return pairs
}

function getKnockoutFixtureId(round: Round, slotIndex: number): string | null {
    if (round === 'champion') return null
    if (round === 'final') return 'final'
    if (round === 'third_place') return 'third_place'
    return `${round}_${slotIndex + 1}`
}

function hasKickoffPassed(round: Round, slotIndex: number) {
    const fixtureId = getKnockoutFixtureId(round, slotIndex)
    if (!fixtureId) return true

    const fixture = KNOCKOUT_MATCHES.find(m => m.id === fixtureId)
    if (!fixture) return false

    return new Date() >= new Date(fixture.kickoff)
}

function hasKnownFixture(slot?: Slot) {
    if (!slot) return false
    return !!getTeam(slot.home) && !!getTeam(slot.away)
}

interface RoundColumnProps {
    round: Round
    indices: number[]
    slots: Slot[]
    bracketPicks: Record<string, any>
    viewMode: 'live' | 'original'
    shouldUseFrozenOriginals: boolean
    realKnockoutResults: Record<string, string | null>
    canEditSlot: (round: Round, i: number, slot?: Slot) => boolean
    handleChange: (round: Round, i: number, h: number | '', a: number | '', adv: string | null) => void
}

function RoundColumn({
    round, indices, slots, bracketPicks, viewMode, shouldUseFrozenOriginals,
    realKnockoutResults, canEditSlot, handleChange
}: RoundColumnProps) {
    const label = ROUND_CONFIG.find(r => r.key === round)?.label
    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: 220, flexShrink: 0 }}>
            <div style={{
                textAlign: 'center', padding: '6px 4px 10px',
                fontSize: 10, fontWeight: 600,
                letterSpacing: 1.5, textTransform: 'uppercase',
                color: 'var(--muted)',
                borderBottom: '1px solid var(--border)',
            }}>
                {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', flex: 1, gap: 16 }}>
                {indices.map(i => {
                    const slot = slots[i]
                    const pickData = bracketPicks[`${round}_${i}`]
                    const isLiveReprediction = viewMode === 'live' && pickData?.is_repredicted
                    const visiblePickData = viewMode === 'live' && !isLiveReprediction ? undefined : pickData
                    const disabled = !canEditSlot(round, i, slot)
                    return (
                        <div key={i} style={{ position: 'relative' }}>
                            <KnockoutMatchCard
                                matchId={`${round}_${i}`}
                                homeCode={slot?.home ?? 'TBD'}
                                awayCode={slot?.away ?? 'TBD'}
                                homeScore={visiblePickData?.home_score ?? ''}
                                awayScore={visiblePickData?.away_score ?? ''}
                                advancingCode={viewMode === 'live' ? (isLiveReprediction ? pickData?.team_code ?? null : realKnockoutResults[`${round}_${i}`] || null) : viewMode === 'original' && shouldUseFrozenOriginals && pickData?.original_team_code ? pickData.original_team_code : pickData?.team_code || null}
                                disabled={disabled}
                                onChange={(_, h, a, adv) => handleChange(round, i, h, a, adv)}
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default function BracketSection() {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const savedScrollPos = useRef(0); // use ref so no re-render is triggered
    const { groupScores, bracketPicks, setBracketPick, isLocked } = usePredictions()
    const phase = getTournamentPhase()
    const [viewMode, setViewMode] = useState<'live' | 'original'>('original')
    const realState = useRealTournament()

    const shouldUseFrozenOriginals = isGlobalLockPassed()

    // If viewing original, construct a fake groupScores object using original_home/away
    const effectiveGroupScores = useMemo(() => {
        if (viewMode === 'live') {
            // Live bracket derives its base R32 from the REAL tournament standings, not user predictions!
            // We map realState to the format computeGroupStandings outputs
            return {
                groupStandings: realState.groupStandings,
                thirdPlaceRanking: realState.thirdPlaceRanking
            }
        }
        
        const original: typeof groupScores = {}
        for (const [id, s] of Object.entries(groupScores)) {
            original[id] = { 
                ...s, 
                home: shouldUseFrozenOriginals && (s as any).original_home !== '' ? (s as any).original_home : s.home,
                away: shouldUseFrozenOriginals && (s as any).original_away !== '' ? (s as any).original_away : s.away 
            }
        }
        return computeGroupStandings(original)
    }, [groupScores, viewMode, realState, shouldUseFrozenOriginals])

    // Base R32 slots derived from effective scores
    const r32Slots = useMemo(() => buildR32Slots(effectiveGroupScores), [effectiveGroupScores])

    // Build slots dynamically
    const getSlotsForRound = useCallback((round: Round): Slot[] => {
        if (round === 'r32') return r32Slots

        if (round === 'third_place') {
            // Third place is between the losers of the Semi Finals
            // Semi final 0 has home/away, the winner is in `sf_0`. team_code. The loser is the other one.
            const sf0_pick = bracketPicks['sf_0']
            const sf1_pick = bracketPicks['sf_1']
            
            // To get losers, we need to know who was playing in SF0 and SF1
            const qf0_pick = bracketPicks['qf_0']?.team_code
            const qf1_pick = bracketPicks['qf_1']?.team_code
            const sf0_home = qf0_pick && qf0_pick !== 'TBD' ? qf0_pick : 'TBD'
            const sf0_away = qf1_pick && qf1_pick !== 'TBD' ? qf1_pick : 'TBD'
            
            const qf2_pick = bracketPicks['qf_2']?.team_code
            const qf3_pick = bracketPicks['qf_3']?.team_code
            const sf1_home = qf2_pick && qf2_pick !== 'TBD' ? qf2_pick : 'TBD'
            const sf1_away = qf3_pick && qf3_pick !== 'TBD' ? qf3_pick : 'TBD'

            const sf0_winner = viewMode === 'live' ? realState.knockoutResults['sf_0'] : (viewMode === 'original' && shouldUseFrozenOriginals && sf0_pick?.original_team_code ? sf0_pick.original_team_code : sf0_pick?.team_code)
            const sf1_winner = viewMode === 'live' ? realState.knockoutResults['sf_1'] : (viewMode === 'original' && shouldUseFrozenOriginals && sf1_pick?.original_team_code ? sf1_pick.original_team_code : sf1_pick?.team_code)

            let third_home = 'TBD'
            if (sf0_winner === sf0_home) third_home = sf0_away
            else if (sf0_winner === sf0_away) third_home = sf0_home

            let third_away = 'TBD'
            if (sf1_winner === sf1_home) third_away = sf1_away
            else if (sf1_winner === sf1_away) third_away = sf1_home

            return [{ home: third_home, away: third_away }]
        }

        const config = ROUND_CONFIG.find(r => r.key === round)!
        const prevRound = ROUND_CONFIG[ROUND_CONFIG.findIndex(r => r.key === round) - 1]
        
        // Final derives from SF
        if (round === 'final') {
            return [{
                home: (viewMode === 'live' ? realState.knockoutResults['sf_0'] : (viewMode === 'original' && shouldUseFrozenOriginals && bracketPicks['sf_0']?.original_team_code ? bracketPicks['sf_0'].original_team_code : bracketPicks['sf_0']?.team_code)) ?? 'TBD',
                away: (viewMode === 'live' ? realState.knockoutResults['sf_1'] : (viewMode === 'original' && shouldUseFrozenOriginals && bracketPicks['sf_1']?.original_team_code ? bracketPicks['sf_1'].original_team_code : bracketPicks['sf_1']?.team_code)) ?? 'TBD'
            }]
        }

        return Array.from({ length: config.slots }).map((_, i) => {
            const matchIndex1 = i * 2
            const matchIndex2 = i * 2 + 1
            const p1 = bracketPicks[`${prevRound.key}_${matchIndex1}`]
            const p2 = bracketPicks[`${prevRound.key}_${matchIndex2}`]
            return {
                home: (viewMode === 'live' ? realState.knockoutResults[`${prevRound.key}_${matchIndex1}`] : (viewMode === 'original' && shouldUseFrozenOriginals && p1?.original_team_code ? p1.original_team_code : p1?.team_code)) ?? 'TBD',
                away: (viewMode === 'live' ? realState.knockoutResults[`${prevRound.key}_${matchIndex2}`] : (viewMode === 'original' && shouldUseFrozenOriginals && p2?.original_team_code ? p2.original_team_code : p2?.team_code)) ?? 'TBD'
            }
        })
    }, [r32Slots, bracketPicks, viewMode, realState, shouldUseFrozenOriginals])

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = savedScrollPos.current;
        }
    }, [bracketPicks]);

    const canEditSlot = useCallback((round: Round, slotIndex: number, slot?: Slot) => {
        if (viewMode === 'original') {
            // Original bracket is locked once tournament starts, even for unlocked users
            return phase === 'PRE_TOURNAMENT'
        }

        return phase === 'KNOCKOUT_OPEN' && hasKnownFixture(slot) && !hasKickoffPassed(round, slotIndex)
    }, [phase, viewMode, isLocked])

    const handleChange = (round: Round, slotIndex: number, homeScore: number | '', awayScore: number | '', advancingTeam: string | null) => {
        // Capture scroll position synchronously before state update
        if (scrollContainerRef.current) {
            savedScrollPos.current = scrollContainerRef.current.scrollLeft;
        }
        const slot = getSlotsForRound(round)[slotIndex]
        if (!canEditSlot(round, slotIndex, slot)) return;
        let adv = advancingTeam
        if (!adv) {
            if (typeof homeScore === 'number' && typeof awayScore === 'number') {
                if (homeScore > awayScore) {
                    adv = slot.home
                } else if (awayScore > homeScore) {
                    adv = slot.away
                }
            }
        }

        setBracketPick(`${round}_${slotIndex}`, {
            team_code: adv || '',
            home_score: homeScore,
            away_score: awayScore,
            predicted_home_team: getSlotsForRound(round)[slotIndex].home,
            predicted_away_team: getSlotsForRound(round)[slotIndex].away,
            original_team_code: bracketPicks[`${round}_${slotIndex}`]?.original_team_code,
            is_repredicted: viewMode === 'live',
        })
    }

    const champCodeRaw = bracketPicks['final_0']
    const champCode = viewMode === 'live' ? realState.knockoutResults['final_0'] : (viewMode === 'original' && shouldUseFrozenOriginals && champCodeRaw?.original_team_code ? champCodeRaw.original_team_code : champCodeRaw?.team_code)
    const championTeam = champCode && champCode !== 'TBD' ? getTeam(champCode) : null

    const colProps = {
        bracketPicks,
        viewMode,
        shouldUseFrozenOriginals,
        realKnockoutResults: realState.knockoutResults,
        canEditSlot,
        handleChange,
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', marginTop: 40 }}>
            {/* Toggle View Mode */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <div style={{ background: 'var(--surface2)', padding: 4, borderRadius: 12, display: 'flex', gap: 4, border: '1px solid var(--border)' }}>
                    <button 
                        onClick={() => setViewMode('live')}
                        style={{
                            padding: '8px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: viewMode === 'live' ? 'var(--gold)' : 'transparent',
                            color: viewMode === 'live' ? 'var(--black)' : 'var(--muted)',
                            fontWeight: 600, fontSize: 14, transition: 'all 0.2s'
                        }}
                    >
                        Live Bracket
                    </button>
                    <button 
                        onClick={() => setViewMode('original')}
                        style={{
                            padding: '8px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: viewMode === 'original' ? 'var(--gold)' : 'transparent',
                            color: viewMode === 'original' ? 'var(--black)' : 'var(--muted)',
                            fontWeight: 600, fontSize: 14, transition: 'all 0.2s'
                        }}
                    >
                        Original Predictions
                    </button>
                </div>
            </div>

            <div style={{
                maxWidth: 860,
                margin: '0 auto 24px',
                padding: '14px 18px',
                borderRadius: 12,
                border: '1px solid var(--border-gold)',
                background: 'rgba(212,168,67,0.08)',
                color: 'var(--dim)',
                fontSize: 13,
                lineHeight: 1.6,
                textAlign: 'center'
            }}>
                <strong style={{ color: 'var(--gold)' }}>
                    {viewMode === 'original' ? 'Original bracket' : 'Live bracket'}
                </strong>
                {' '}
                {viewMode === 'original'
                    ? 'locks at the opening kickoff and is used for original bracket bonuses. No edits are allowed after the tournament starts.'
                    : 'opens when real knockout fixtures are known. Each known match starts empty and can be re-predicted until that match kicks off.'}
            </div>

            <div ref={scrollContainerRef} style={{ overflowX: 'auto', paddingBottom: 60, WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'flex', gap: 16, minWidth: 2200, padding: '0 20px', alignItems: 'stretch' }}>
                    
                    {/* LEFT WING */}
                    <RoundColumn {...colProps} round="r32" indices={[0,1,2,3,4,5,6,7]} slots={getSlotsForRound('r32')} />
                    <RoundColumn {...colProps} round="r16" indices={[0,1,2,3]} slots={getSlotsForRound('r16')} />
                    <RoundColumn {...colProps} round="qf" indices={[0,1]} slots={getSlotsForRound('qf')} />
                    <RoundColumn {...colProps} round="sf" indices={[0]} slots={getSlotsForRound('sf')} />

                    {/* CENTER (Final, Champion, Third Place) */}
                    <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                        <div style={{
                            textAlign: 'center', padding: '6px 4px 10px', width: '100%',
                            fontSize: 10, fontWeight: 600,
                            letterSpacing: 1.5, textTransform: 'uppercase',
                            color: 'var(--gold)',
                            borderBottom: '1px solid var(--border-gold)',
                            marginBottom: 0,
                        }}>
                            🏆 CHAMPION
                        </div>
                        
                        {/* Champion Crown */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(212,168,67,0.14), rgba(212,168,67,0.04))',
                            border: '1px solid var(--border-gold)',
                            borderRadius: 14, padding: '30px 20px',
                            textAlign: 'center', width: '100%',
                            boxShadow: '0 10px 30px rgba(212,168,67,0.15)'
                        }}>
                            {championTeam ? (
                                <>
                                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                                        <TeamFlag teamCode={championTeam.code} size={90} style={{ height: 65, width: 'auto' }} />
                                    </div>
                                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 36, color: 'var(--cream)', lineHeight: 1 }}>
                                        {championTeam.name}
                                    </div>
                                </>
                            ) : (
                                <div style={{ fontSize: 16, color: 'var(--muted)', padding: '30px 0', fontFamily: 'Bebas Neue', letterSpacing: 1 }}>
                                    AWAITING FINAL
                                </div>
                            )}
                        </div>

                        {/* Final Match */}
                        <div style={{ width: '100%', marginTop: 20 }}>
                            <RoundColumn {...colProps} round="final" indices={[0]} slots={getSlotsForRound('final')} />
                        </div>

                        {/* Third Place Match */}
                        <div style={{ width: '100%', marginTop: 20 }}>
                            <RoundColumn {...colProps} round="third_place" indices={[0]} slots={getSlotsForRound('third_place')} />
                        </div>
                    </div>

                    {/* RIGHT WING (Reverse Order) */}
                    <RoundColumn {...colProps} round="sf" indices={[1]} slots={getSlotsForRound('sf')} />
                    <RoundColumn {...colProps} round="qf" indices={[2,3]} slots={getSlotsForRound('qf')} />
                    <RoundColumn {...colProps} round="r16" indices={[4,5,6,7]} slots={getSlotsForRound('r16')} />
                    <RoundColumn {...colProps} round="r32" indices={[8,9,10,11,12,13,14,15]} slots={getSlotsForRound('r32')} />
                    
                </div>
            </div>
        </div>
    )
}
