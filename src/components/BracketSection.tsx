'use client'

import { usePredictions } from './PredictionContext'
import KnockoutMatchCard from './KnockoutMatchCard'
import { GROUPS, GROUP_MATCHES, R32_SLOTS, getTeam, getFlagUrl } from '@/lib/wc2026-data'

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

export default function BracketSection() {
    const { groupScores, bracketPicks, setBracketPick } = usePredictions()

    // Base R32 slots derived from group stage predictions
    const r32Slots = buildR32Slots(computeGroupStandings(groupScores))

    // Build slots dynamically
    const getSlotsForRound = (round: Round): Slot[] => {
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

            const sf0_winner = sf0_pick?.team_code
            const sf1_winner = sf1_pick?.team_code

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
                home: bracketPicks['sf_0']?.team_code ?? 'TBD',
                away: bracketPicks['sf_1']?.team_code ?? 'TBD'
            }]
        }

        const slots: Slot[] = []
        for (let i = 0; i < config.slots; i++) {
            const homePickKey = `${prevRound.key}_${i * 2}`
            const awayPickKey = `${prevRound.key}_${i * 2 + 1}`
            slots.push({
                home: bracketPicks[homePickKey]?.team_code ?? 'TBD',
                away: bracketPicks[awayPickKey]?.team_code ?? 'TBD',
            })
        }
        return slots
    }

    const handleChange = (round: Round, slotIndex: number, homeScore: number | '', awayScore: number | '', advancingTeam: string | null) => {
        let adv = advancingTeam
        if (!adv) {
            if (typeof homeScore === 'number' && typeof awayScore === 'number') {
                if (homeScore > awayScore) {
                    const slots = getSlotsForRound(round)
                    adv = slots[slotIndex].home
                } else if (awayScore > homeScore) {
                    const slots = getSlotsForRound(round)
                    adv = slots[slotIndex].away
                }
            }
        }

        setBracketPick(`${round}_${slotIndex}`, {
            team_code: adv || '',
            home_score: homeScore,
            away_score: awayScore
        })
    }

    const RoundColumn = ({ round, indices }: { round: Round, indices: number[] }) => {
        const slots = getSlotsForRound(round)
        const label = ROUND_CONFIG.find(r => r.key === round)?.label
        
        return (
            <div style={{ display: 'flex', flexDirection: 'column', width: 300, flexShrink: 0 }}>
                <div style={{
                    textAlign: 'center', padding: '6px 4px 10px',
                    fontSize: 10, fontWeight: 600,
                    letterSpacing: 1.5, textTransform: 'uppercase',
                    color: 'var(--muted)',
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 10,
                }}>
                    {label}
                </div>
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-around', flex: 1, gap: 16,
                }}>
                    {indices.map(i => {
                        const slot = slots[i]
                        const pickData = bracketPicks[`${round}_${i}`]
                        return (
                            <div key={i} style={{ position: 'relative' }}>
                                <KnockoutMatchCard
                                    matchId={`${round}_${i}`}
                                    homeCode={slot?.home ?? 'TBD'}
                                    awayCode={slot?.away ?? 'TBD'}
                                    homeScore={pickData?.home_score ?? ''}
                                    awayScore={pickData?.away_score ?? ''}
                                    advancingCode={pickData?.team_code || null}
                                    onChange={(_, h, a, adv) => handleChange(round, i, h, a, adv)}
                                />
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    const champCode = bracketPicks['final_0']?.team_code
    const championTeam = champCode && champCode !== 'TBD' ? getTeam(champCode) : null

    return (
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', marginTop: 40 }}>
            <div style={{ overflowX: 'auto', paddingBottom: 60 }}>
                <div style={{ display: 'flex', gap: 24, minWidth: 2800, padding: '0 20px', alignItems: 'stretch' }}>
                    
                    {/* LEFT WING */}
                    <RoundColumn round="r32" indices={[0,1,2,3,4,5,6,7]} />
                    <RoundColumn round="r16" indices={[0,1,2,3]} />
                    <RoundColumn round="qf" indices={[0,1]} />
                    <RoundColumn round="sf" indices={[0]} />

                    {/* CENTER (Final, Champion, Third Place) */}
                    <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
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
                                        <img src={getFlagUrl(championTeam.code)} alt={championTeam.code} style={{ width: 90, height: 65, borderRadius: 6 }} />
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
                            <RoundColumn round="final" indices={[0]} />
                        </div>

                        {/* Third Place Match */}
                        <div style={{ width: '100%', marginTop: 20 }}>
                            <RoundColumn round="third_place" indices={[0]} />
                        </div>
                    </div>

                    {/* RIGHT WING (Reverse Order) */}
                    <RoundColumn round="sf" indices={[1]} />
                    <RoundColumn round="qf" indices={[2,3]} />
                    <RoundColumn round="r16" indices={[4,5,6,7]} />
                    <RoundColumn round="r32" indices={[8,9,10,11,12,13,14,15]} />
                    
                </div>
            </div>
        </div>
    )
}
