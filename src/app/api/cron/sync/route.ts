import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// Name aliases: football-data.org team names → our local team codes
// ─────────────────────────────────────────────────────────────────────────────
const NAME_TO_CODE: Record<string, string> = {
    'Mexico': 'MEX',
    'South Africa': 'RSA',
    'Korea Republic': 'KOR',
    'South Korea': 'KOR',
    'Czechia': 'CZE',
    'Czech Republic': 'CZE',
    'Canada': 'CAN',
    'Bosnia-Herzegovina': 'BIH',
    'Bosnia and Herzegovina': 'BIH',
    'United States': 'USA',
    'Paraguay': 'PAR',
    'Qatar': 'QAT',
    'Switzerland': 'SUI',
    'Brazil': 'BRA',
    'Morocco': 'MAR',
    'Haiti': 'HAI',
    'Scotland': 'SCO',
    'Australia': 'AUS',
    'Turkey': 'TUR',
    'Germany': 'GER',
    'Curaçao': 'CUW',
    'Netherlands': 'NED',
    'Japan': 'JPN',
    'Ivory Coast': 'CIV',
    "Côte d'Ivoire": 'CIV',
    'Ecuador': 'ECU',
    'Sweden': 'SWE',
    'Tunisia': 'TUN',
    'Spain': 'ESP',
    'Cape Verde Islands': 'CPV',
    'Cape Verde': 'CPV',
    'Belgium': 'BEL',
    'Egypt': 'EGY',
    'Saudi Arabia': 'KSA',
    'Uruguay': 'URU',
    'Iran': 'IRN',
    'New Zealand': 'NZL',
    'France': 'FRA',
    'Senegal': 'SEN',
    'Iraq': 'IRQ',
    'Norway': 'NOR',
    'Argentina': 'ARG',
    'Algeria': 'ALG',
    'Austria': 'AUT',
    'Jordan': 'JOR',
    'Portugal': 'POR',
    'DR Congo': 'COD',
    'Democratic Republic of the Congo': 'COD',
    'Uzbekistan': 'UZB',
    'Colombia': 'COL',
    'England': 'ENG',
    'Croatia': 'CRO',
    'Ghana': 'GHA',
    'Panama': 'PAN',
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cron/sync
// Called every minute by Vercel cron. Fetches live match data from
// football-data.org (primary) then worldcup26.ir (fallback), and pushes
// updates to the Supabase `matches` table.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
    // Allow either a CRON_SECRET query param or Authorization header
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret') || request.headers.get('Authorization')?.replace('Bearer ', '')

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // ── 1. Load existing DB matches ─────────────────────────────────────────
    const { data: dbMatches, error: dbErr } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score, minute, home_team, away_team, kickoff')

    if (dbErr || !dbMatches) {
        return NextResponse.json({ error: `DB Error: ${dbErr?.message}` }, { status: 500 })
    }

    // ── 2. Fetch from football-data.org (primary) ────────────────────────────
    let apiMatches: any[] = []
    let apiSource = 'none'

    try {
        const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY ?? '' },
            signal: AbortSignal.timeout(15000),
        })
        if (res.ok) {
            const data = await res.json()
            apiMatches = data.matches || []
            apiSource = 'football-data.org'
        } else {
            console.warn(`[Sync] football-data.org returned ${res.status}`)
        }
    } catch (err: any) {
        console.warn(`[Sync] football-data.org failed: ${err.message}`)
    }

    // ── 3. Fallback: worldcup26.ir ───────────────────────────────────────────
    if (apiMatches.length === 0) {
        try {
            const res = await fetch('https://worldcup26.ir/get/games', {
                signal: AbortSignal.timeout(10000),
            })
            if (res.ok) {
                const data = await res.json()
                const games = data.games || data
                // Convert worldcup26.ir format to unified format
                apiMatches = games.map((g: any) => {
                    let status = 'SCHEDULED'
                    if (g.finished === 'TRUE' || g.finished === true || g.time_elapsed === 'finished') {
                        status = 'FINISHED'
                    } else if (g.time_elapsed && g.time_elapsed !== 'notstarted' && g.time_elapsed !== 'finished') {
                        status = 'IN_PLAY'
                    }
                    return {
                        _wcirId: parseInt(g.id),
                        homeTeam: { name: g.home_team_name_en || g.home_team_label },
                        awayTeam: { name: g.away_team_name_en || g.away_team_label },
                        status,
                        minute: status === 'IN_PLAY' ? (parseInt(g.time_elapsed) || null) : null,
                        score: {
                            fullTime: {
                                home: status === 'SCHEDULED' ? null : (parseInt(g.home_score) || 0),
                                away: status === 'SCHEDULED' ? null : (parseInt(g.away_score) || 0),
                            }
                        },
                    }
                })
                apiSource = 'worldcup26.ir'
            }
        } catch (err: any) {
            console.warn(`[Sync] worldcup26.ir also failed: ${err.message}`)
        }
    }

    if (apiMatches.length === 0) {
        return NextResponse.json({
            error: 'All APIs unavailable. DB unchanged.',
            source: apiSource,
        }, { status: 502 })
    }

    // ── 4. Match API results to DB rows ──────────────────────────────────────
    // Strategy: match by home_team code + away_team code (both in DB)
    // football-data.org uses team names → convert to codes first
    let updatedCount = 0
    const newlyFinished: string[] = []

    for (const dbMatch of dbMatches) {
        // Find the corresponding API match
        let apiMatch: any = null

        if (apiSource === 'football-data.org') {
            // Match by team codes via name→code lookup
            apiMatch = apiMatches.find((m: any) => {
                const homeCode = NAME_TO_CODE[m.homeTeam?.name] || m.homeTeam?.tla
                const awayCode = NAME_TO_CODE[m.awayTeam?.name] || m.awayTeam?.tla
                return homeCode === dbMatch.home_team && awayCode === dbMatch.away_team
            })
        } else {
            // worldcup26.ir: match by team name→code
            apiMatch = apiMatches.find((m: any) => {
                const homeCode = NAME_TO_CODE[m.homeTeam?.name]
                const awayCode = NAME_TO_CODE[m.awayTeam?.name]
                return homeCode === dbMatch.home_team && awayCode === dbMatch.away_team
            })
        }

        if (!apiMatch) continue

        // Determine status
        let status = 'upcoming'
        if (apiMatch.status === 'FINISHED') status = 'finished'
        else if (apiMatch.status === 'IN_PLAY' || apiMatch.status === 'PAUSED' || apiMatch.status === 'HALFTIME') status = 'live'

        // SAFETY: never revert a finished match to upcoming
        if (dbMatch.status === 'finished' && status === 'upcoming') continue

        // Determine minute
        let minute: number | null = null
        if (status === 'live') {
            minute = apiMatch.minute ?? null
        }

        // Determine scores
        const home_score = status === 'upcoming' ? null : (apiMatch.score?.fullTime?.home ?? null)
        const away_score = status === 'upcoming' ? null : (apiMatch.score?.fullTime?.away ?? null)

        // Only write if something actually changed
        const changed =
            dbMatch.status !== status ||
            dbMatch.home_score !== home_score ||
            dbMatch.away_score !== away_score ||
            dbMatch.minute !== minute

        if (!changed) continue

        const { error: updateErr } = await supabase
            .from('matches')
            .update({ status, home_score, away_score, minute })
            .eq('id', dbMatch.id)

        if (updateErr) {
            console.error(`[Sync] Failed to update match ${dbMatch.id}: ${updateErr.message}`)
            continue
        }

        updatedCount++

        // Track newly finished matches for scoring
        if (status === 'finished' && dbMatch.status !== 'finished') {
            newlyFinished.push(dbMatch.id)
        }
    }

    // ── 5. Trigger scoring for newly finished matches ────────────────────────
    const scoringResults: any[] = []
    for (const matchId of newlyFinished) {
        try {
            const scoringUrl = new URL('/api/scoring', request.url).toString()
            const r = await fetch(scoringUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-scoring-secret': process.env.SCORING_SECRET ?? '',
                },
                body: JSON.stringify({ match_id: matchId }),
            })
            const result = await r.json()
            scoringResults.push({ match_id: matchId, ...result })
        } catch (err: any) {
            scoringResults.push({ match_id: matchId, error: err.message })
        }
    }

    return NextResponse.json({
        success: true,
        source: apiSource,
        total_api_matches: apiMatches.length,
        updated: updatedCount,
        newly_finished: newlyFinished,
        scoring: scoringResults,
    })
}
