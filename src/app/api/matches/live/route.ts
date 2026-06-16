import { NextResponse } from 'next/server'

// In-memory cache to avoid hammering the API on every page render
let cachedMatches: any[] = []
let cacheTimestamp = 0
const CACHE_TTL_MS = 30_000 // 30 seconds

// football-data.org team name → local team code
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

export async function GET() {
    // Serve from cache if fresh
    if (cachedMatches.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
        return NextResponse.json({ matches: cachedMatches, cached: true })
    }

    // ── Try football-data.org first ───────────────────────────────────────────
    try {
        const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY ?? '' },
            signal: AbortSignal.timeout(12000),
        })

        if (res.ok) {
            const data = await res.json()
            const matches = (data.matches || []).map((m: any) => {
                const homeCode = NAME_TO_CODE[m.homeTeam?.name] || m.homeTeam?.tla || 'TBD'
                const awayCode = NAME_TO_CODE[m.awayTeam?.name] || m.awayTeam?.tla || 'TBD'

                // Map football-data status to our internal status
                let status = m.status
                if (m.status === 'TIMED' || m.status === 'SCHEDULED') status = 'SCHEDULED'
                else if (m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'HALFTIME') status = 'IN_PLAY'
                else if (m.status === 'FINISHED') status = 'FINISHED'

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
                    score: {
                        fullTime: {
                            home: m.score?.fullTime?.home ?? null,
                            away: m.score?.fullTime?.away ?? null,
                        },
                        halfTime: {
                            home: m.score?.halfTime?.home ?? null,
                            away: m.score?.halfTime?.away ?? null,
                        },
                    },
                    goals: [],
                    // Extra fields for FixturesClient to match by team codes
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
            signal: AbortSignal.timeout(8000),
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
                    },
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

    // ── Both APIs failed — serve stale cache if available ─────────────────────
    if (cachedMatches.length > 0) {
        return NextResponse.json({ matches: cachedMatches, stale: true })
    }

    return NextResponse.json({ error: 'All APIs unavailable', matches: [] }, { status: 502 })
}