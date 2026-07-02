// src/app/api/matches/live/route.ts
import { NextResponse } from 'next/server'

export const maxDuration = 9

let cachedMatches: any[] = []
let cacheTimestamp = 0
const CACHE_TTL_MS = 30_000

const NAME_TO_CODE: Record<string, string> = {
    'Mexico': 'MEX', 'South Africa': 'RSA', 'Korea Republic': 'KOR', 'South Korea': 'KOR',
    'Czechia': 'CZE', 'Czech Republic': 'CZE', 'Canada': 'CAN', 'Bosnia-Herzegovina': 'BIH',
    'Bosnia and Herzegovina': 'BIH', 'United States': 'USA', 'Paraguay': 'PAR', 'Qatar': 'QAT',
    'Switzerland': 'SUI', 'Brazil': 'BRA', 'Morocco': 'MAR', 'Haiti': 'HAI', 'Scotland': 'SCO',
    'Australia': 'AUS', 'Turkey': 'TUR', 'Germany': 'GER', 'Curaçao': 'CUW', 'Netherlands': 'NED',
    'Japan': 'JPN', 'Ivory Coast': 'CIV', "Côte d'Ivoire": 'CIV', 'Ecuador': 'ECU',
    'Sweden': 'SWE', 'Tunisia': 'TUN', 'Spain': 'ESP', 'Cape Verde Islands': 'CPV', 'Cape Verde': 'CPV',
    'Belgium': 'BEL', 'Egypt': 'EGY', 'Saudi Arabia': 'KSA', 'Uruguay': 'URU',
    'Iran': 'IRN', 'New Zealand': 'NZL', 'France': 'FRA', 'Senegal': 'SEN', 'Iraq': 'IRQ',
    'Norway': 'NOR', 'Argentina': 'ARG', 'Algeria': 'ALG', 'Austria': 'AUT', 'Jordan': 'JOR',
    'Portugal': 'POR', 'DR Congo': 'COD', 'Democratic Republic of the Congo': 'COD',
    'Uzbekistan': 'UZB', 'Colombia': 'COL', 'England': 'ENG', 'Croatia': 'CRO',
    'Ghana': 'GHA', 'Panama': 'PAN',
}

function hasScorePair(score: any) {
    return score?.home !== null && score?.home !== undefined
        && score?.away !== null && score?.away !== undefined
}

function sameScore(a: any, b: any) {
    return hasScorePair(a) && hasScorePair(b) && a.home === b.home && a.away === b.away
}

function addScores(a: any, b: any) {
    return { home: a.home + b.home, away: a.away + b.away }
}

// Returns the score after 120 minutes, with penalty data kept separately.
function extractLiveScore(m: any) {
    const wentToPenalties = m.score?.penalties?.home !== null && m.score?.penalties?.home !== undefined
    const regularTime = m.score?.regularTime
    const extraTime = m.score?.extraTime
    const fullTime = m.score?.fullTime

    let scoreHome: number | null = null
    let scoreAway: number | null = null

    if (hasScorePair(extraTime) && hasScorePair(regularTime)) {
        const combined = addScores(regularTime, extraTime)
        if (sameScore(fullTime, combined) || sameScore(fullTime, extraTime)) {
            scoreHome = fullTime.home
            scoreAway = fullTime.away
        } else if (extraTime.home >= regularTime.home && extraTime.away >= regularTime.away) {
            scoreHome = extraTime.home
            scoreAway = extraTime.away
        } else {
            scoreHome = combined.home
            scoreAway = combined.away
        }
    } else if (hasScorePair(fullTime)) {
        scoreHome = fullTime.home
        scoreAway = fullTime.away
    } else if (hasScorePair(regularTime)) {
        scoreHome = regularTime.home
        scoreAway = regularTime.away
    }

    return {
        fullTime: { home: scoreHome, away: scoreAway },
        halfTime: { home: m.score?.halfTime?.home ?? null, away: m.score?.halfTime?.away ?? null },
        penalties: wentToPenalties
            ? { home: m.score.penalties.home, away: m.score.penalties.away }
            : null,
        went_to_penalties: wentToPenalties,
    }
}

export async function GET() {
    if (cachedMatches.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
        return NextResponse.json({ matches: cachedMatches, cached: true })
    }

    try {
        const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY ?? '' },
            signal: AbortSignal.timeout(4500),
        })

        if (res.ok) {
            const data = await res.json()
            const matches = (data.matches || []).map((m: any) => {
                const homeCode = NAME_TO_CODE[m.homeTeam?.name] || m.homeTeam?.tla || 'TBD'
                const awayCode = NAME_TO_CODE[m.awayTeam?.name] || m.awayTeam?.tla || 'TBD'

                let status = m.status
                if (m.status === 'TIMED' || m.status === 'SCHEDULED') status = 'SCHEDULED'
                else if (m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'HALFTIME') status = 'IN_PLAY'
                else if (m.status === 'FINISHED') status = 'FINISHED'

                const scoreData = extractLiveScore(m)

                return {
                    id: m.id,
                    utcDate: m.utcDate,
                    status,
                    minute: m.minute ?? null,
                    stage: m.stage,
                    group: m.group,
                    homeTeam: {
                        name: m.homeTeam?.name ?? homeCode,
                        shortName: homeCode,
                        tla: homeCode,
                        crest: m.homeTeam?.crest ?? '',
                    },
                    awayTeam: {
                        name: m.awayTeam?.name ?? awayCode,
                        shortName: awayCode,
                        tla: awayCode,
                        crest: m.awayTeam?.crest ?? '',
                    },
                    score: scoreData,
                    qualifier: m.score?.winner === 'HOME_TEAM' ? homeCode
                        : m.score?.winner === 'AWAY_TEAM' ? awayCode
                            : null,
                    goals: [],
                    _homeCode: homeCode,
                    _awayCode: awayCode,
                }
            })

            cachedMatches = matches
            cacheTimestamp = Date.now()
            return NextResponse.json({ matches, source: 'football-data.org' })
        }
        console.warn(`[Live API] football-data.org returned ${res.status}`)
    } catch (err: any) {
        console.warn(`[Live API] football-data.org failed: ${err.message}`)
    }

    // ── Fallback: worldcup26.ir ───────────────────────────────────────────────
    try {
        const res = await fetch('https://worldcup26.ir/get/games', {
            signal: AbortSignal.timeout(3500),
        })
        if (res.ok) {
            const data = await res.json()
            const games = data.games || data
            const matches = games.map((g: any) => {
                let status = 'SCHEDULED'
                if (g.finished === 'TRUE' || g.finished === true || g.time_elapsed === 'finished') status = 'FINISHED'
                else if (g.time_elapsed && g.time_elapsed !== 'notstarted' && g.time_elapsed !== 'finished') status = 'IN_PLAY'

                const homeCode = NAME_TO_CODE[g.home_team_name_en] || 'TBD'
                const awayCode = NAME_TO_CODE[g.away_team_name_en] || 'TBD'

                return {
                    id: parseInt(g.id),
                    utcDate: '',
                    status,
                    minute: status === 'IN_PLAY' ? (parseInt(g.time_elapsed) || null) : null,
                    stage: g.type === 'group' ? 'GROUP_STAGE' : g.type?.toUpperCase(),
                    group: g.type === 'group' ? `GROUP_${g.group}` : undefined,
                    homeTeam: { name: g.home_team_name_en || 'TBD', shortName: homeCode, tla: homeCode, crest: '' },
                    awayTeam: { name: g.away_team_name_en || 'TBD', shortName: awayCode, tla: awayCode, crest: '' },
                    score: {
                        fullTime: {
                            home: status === 'SCHEDULED' ? null : (parseInt(g.home_score) || 0),
                            away: status === 'SCHEDULED' ? null : (parseInt(g.away_score) || 0),
                        },
                        halfTime: { home: null, away: null },
                        penalties: null,
                        went_to_penalties: false,
                    },
                    qualifier: null,
                    goals: [],
                    _homeCode: homeCode,
                    _awayCode: awayCode,
                }
            })

            cachedMatches = matches
            cacheTimestamp = Date.now()
            return NextResponse.json({ matches, source: 'worldcup26.ir' })
        }
    } catch (err: any) {
        console.warn(`[Live API] worldcup26.ir also failed: ${err.message}`)
    }

    if (cachedMatches.length > 0) {
        return NextResponse.json({ matches: cachedMatches, stale: true })
    }

    return NextResponse.json({ error: 'All APIs unavailable', matches: [] }, { status: 502 })
}
