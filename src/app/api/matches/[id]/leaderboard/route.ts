import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { scoreMatch } from '@/lib/scoring'
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'

export const maxDuration = 9

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

// Team name → code for live API matching
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

function getKnockoutPickSlot(matchId: string): { round: string; slotIndex: number } | null {
    if (matchId === 'final') return { round: 'final', slotIndex: 0 }
    if (matchId === 'third_place') return { round: 'third_place', slotIndex: 0 }
    const match = matchId.match(/^([a-z0-9]+)_(\d+)$/)
    if (!match) return null
    return { round: match[1], slotIndex: Number(match[2]) - 1 }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    // 1. Find the local match definition
    const localMatch = ALL_MATCHES.find(m => m.id === id)
    if (!localMatch) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    const isKnockout = KNOCKOUT_MATCHES.some(m => m.id === id)

    const supabase = await createClient()

    // 2. Fetch match from DB
    const { data: dbMatch } = await supabase
        .from('matches')
        .select('home_team, away_team, home_score, away_score, status, qualifier')
        .eq('id', id)
        .single()

    let effectiveHomeScore: number | null = dbMatch?.home_score ?? null
    let effectiveAwayScore: number | null = dbMatch?.away_score ?? null
    let effectiveStatus = dbMatch?.status ?? 'upcoming'

    // ── For LIVE matches: supplement DB score with fresh API data ───────────────
    // The DB cron only runs every minute; during a live game the DB score can lag
    // or be stale (e.g. 0-0 while real score is 2-1). We fetch from the live API
    // and use it if the match is actually in play.
    if (effectiveStatus === 'live' || effectiveStatus === 'finished') {
        try {
            const liveRes = await fetch(
                new URL('/api/matches/live', request.url).toString(),
                { signal: AbortSignal.timeout(4000) }
            )
            if (liveRes.ok) {
                const liveData = await liveRes.json()
                const liveMatches: any[] = liveData.matches || []

                // Match by home + away team codes
                const liveMatch = liveMatches.find(m =>
                    (m._homeCode === localMatch.home_team && m._awayCode === localMatch.away_team) ||
                    (NAME_TO_CODE[m.homeTeam?.name] === localMatch.home_team && NAME_TO_CODE[m.awayTeam?.name] === localMatch.away_team)
                )

                if (liveMatch && liveMatch.status !== 'SCHEDULED') {
                    const apiHome = liveMatch.score?.fullTime?.home
                    const apiAway = liveMatch.score?.fullTime?.away

                    // Only override if the API actually has real scores (not null)
                    if (typeof apiHome === 'number' && typeof apiAway === 'number') {
                        effectiveHomeScore = apiHome
                        effectiveAwayScore = apiAway
                    }

                    if (liveMatch.status === 'IN_PLAY' || liveMatch.status === 'PAUSED') {
                        effectiveStatus = 'live'
                    } else if (liveMatch.status === 'FINISHED') {
                        effectiveStatus = 'finished'
                    }
                }
            }
        } catch {
            // If live API fails, fall back to DB scores (already set above)
        }
    }

    const hasScore =
        (effectiveStatus === 'finished' || effectiveStatus === 'live') &&
        typeof effectiveHomeScore === 'number' &&
        typeof effectiveAwayScore === 'number'

    if (isKnockout) {
        const slot = getKnockoutPickSlot(id)
        if (!slot) return NextResponse.json({ error: 'Unsupported knockout match id' }, { status: 400 })

        const bracketPicks = await fetchAllRows(
            supabase
                .from('bracket_picks')
                .select('home_score, away_score, team_code, predicted_home_team, predicted_away_team, is_repredicted, user_id, profile:profiles(display_name, avatar_initials, avatar_color)')
                .eq('round', slot.round)
                .eq('slot_index', slot.slotIndex)
                .not('home_score', 'is', null)
                .not('away_score', 'is', null)
        )

        const leaderboard = (bracketPicks ?? []).map(p => {
            const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
            const isFixtureCorrect = !hasScore || !p.predicted_home_team || !p.predicted_away_team
                ? true
                : p.predicted_home_team === dbMatch?.home_team && p.predicted_away_team === dbMatch?.away_team
            const scoreResult = hasScore
                ? scoreMatch(
                    p.home_score,
                    p.away_score,
                    effectiveHomeScore!,
                    effectiveAwayScore!,
                    true,
                    {
                        predQualifier: p.team_code,
                        realQualifier: dbMatch?.qualifier ?? null,
                        isRepredicted: p.is_repredicted ?? false,
                        isFixtureCorrect,
                    }
                )
                : null

            return {
                user_id: p.user_id,
                display_name: profile?.display_name ?? 'Unknown',
                avatar_initials: profile?.avatar_initials ?? '??',
                avatar_color: profile?.avatar_color ?? '#cccccc',
                predicted_home: p.home_score,
                predicted_away: p.away_score,
                points: scoreResult?.total ?? null,
                isExact: scoreResult?.type === 'exact',
            }
        })

        leaderboard.sort((a, b) => {
            if (hasScore) return (b.points ?? 0) - (a.points ?? 0) || a.display_name.localeCompare(b.display_name)
            return a.display_name.localeCompare(b.display_name)
        })

        return NextResponse.json({
            leaderboard,
            status: effectiveStatus,
            liveScore: hasScore ? { home: effectiveHomeScore, away: effectiveAwayScore } : null,
            total: leaderboard.length,
            hasScore,
        })
    }

    // 3. Fetch all group-stage predictions for this match
    const predictions = await fetchAllRows(
        supabase
            .from('predictions')
            .select('home_score, away_score, user_id, profile:profiles(display_name, avatar_initials, avatar_color)')
            .eq('match_id', id)
    )

    // 4. Calculate points using the LIVE-SUPPLEMENTED score
    const leaderboard = (predictions ?? []).map(p => {
        const scoreResult = hasScore
            ? scoreMatch(p.home_score, p.away_score, effectiveHomeScore!, effectiveAwayScore!, false)
            : null
        const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
        return {
            user_id: p.user_id,
            display_name: profile?.display_name ?? 'Unknown',
            avatar_initials: profile?.avatar_initials ?? '??',
            avatar_color: profile?.avatar_color ?? '#cccccc',
            predicted_home: p.home_score,
            predicted_away: p.away_score,
            points: scoreResult?.total ?? null,
            isExact: scoreResult?.type === 'exact',
            breakdown: scoreResult?.breakdown ?? [],
        }
    })

    leaderboard.sort((a, b) => {
        if (hasScore) return (b.points ?? 0) - (a.points ?? 0) || a.display_name.localeCompare(b.display_name)
        return a.display_name.localeCompare(b.display_name)
    })

    return NextResponse.json({
        leaderboard,
        status: effectiveStatus,
        liveScore: hasScore ? { home: effectiveHomeScore, away: effectiveAwayScore } : null,
        total: leaderboard.length,
        hasScore,
    })
}
