import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { scoreMatch } from '@/lib/scoring'
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

function getKnockoutPickSlot(matchId: string): { round: string; slotIndex: number } | null {
    if (matchId === 'final') return { round: 'final', slotIndex: 0 }
    if (matchId === 'third_place') return { round: 'third_place', slotIndex: 0 }

    const match = matchId.match(/^([a-z0-9]+)_(\d+)$/)
    if (!match) return null

    return {
        round: match[1],
        slotIndex: Number(match[2]) - 1,
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    
    // 1. Find the local match
    const localMatch = ALL_MATCHES.find(m => m.id === id)
    if (!localMatch) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    const isKnockout = KNOCKOUT_MATCHES.some(m => m.id === id)

    const supabase = await createClient()

    // 2. Fetch match status from our DB to get actual score (if finished or live)
    const { data: dbMatch } = await supabase
        .from('matches')
        .select('home_team, away_team, home_score, away_score, status, qualifier')
        .eq('id', id)
        .single()

    const hasScore =
        !!dbMatch &&
        (dbMatch.status === 'finished' || dbMatch.status === 'live') &&
        typeof dbMatch.home_score === 'number' &&
        typeof dbMatch.away_score === 'number'

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
                : p.predicted_home_team === dbMatch.home_team && p.predicted_away_team === dbMatch.away_team
            const scoreResult = hasScore
                ? scoreMatch(
                    p.home_score,
                    p.away_score,
                    dbMatch.home_score,
                    dbMatch.away_score,
                    true,
                    {
                        predQualifier: p.team_code,
                        realQualifier: dbMatch.qualifier ?? null,
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
            status: dbMatch?.status ?? 'upcoming',
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

    // 4. Calculate points when the match has a live/finished score.
    const leaderboard = (predictions ?? []).map(p => {
        const scoreResult = hasScore
            ? scoreMatch(p.home_score, p.away_score, dbMatch.home_score, dbMatch.away_score, false)
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
        }
    })

    // 5. Sort by points when available, otherwise alphabetically.
    leaderboard.sort((a, b) => {
        if (hasScore) return (b.points ?? 0) - (a.points ?? 0) || a.display_name.localeCompare(b.display_name)
        return a.display_name.localeCompare(b.display_name)
    })

    return NextResponse.json({
        leaderboard,
        status: dbMatch?.status ?? 'upcoming',
        total: leaderboard.length,
        hasScore,
    })
}
