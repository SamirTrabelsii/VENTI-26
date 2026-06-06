import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreMatch } from '@/lib/scoring'
import { getTeam, GROUP_MATCHES } from '@/lib/wc2026-data'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    
    // 1. Find the local match
    const localMatch = GROUP_MATCHES.find(m => m.id === id)
    if (!localMatch) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    const supabase = await createClient()

    // 2. Fetch match status from our DB to get actual score (if finished or live)
    // If it's not in our DB as finished/live, we can't reliably score it.
    const { data: dbMatch } = await supabase
        .from('matches')
        .select('home_score, away_score, status')
        .eq('id', id)
        .single()

    // If match hasn't started or we have no score, return empty leaderboard
    if (!dbMatch || (dbMatch.status !== 'finished' && dbMatch.status !== 'live') || dbMatch.home_score === null || dbMatch.away_score === null) {
        return NextResponse.json({ leaderboard: [], status: dbMatch?.status ?? 'upcoming' })
    }

    const actualHome = dbMatch.home_score
    const actualAway = dbMatch.away_score

    // 3. Fetch all predictions for this match
    const { data: predictions } = await supabase
        .from('predictions')
        .select('home_score, away_score, user_id, profile:profiles(display_name, avatar_initials, avatar_color)')
        .eq('match_id', id)

    if (!predictions || predictions.length === 0) {
        return NextResponse.json({ leaderboard: [], status: dbMatch.status })
    }

    // 4. Calculate points for each prediction
    const results = predictions.map(p => {
        const scoreResult = scoreMatch(p.home_score, p.away_score, actualHome, actualAway, false)
        const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
        return {
            user_id: p.user_id,
            display_name: profile?.display_name ?? 'Unknown',
            avatar_initials: profile?.avatar_initials ?? '??',
            avatar_color: profile?.avatar_color ?? '#cccccc',
            predicted_home: p.home_score,
            predicted_away: p.away_score,
            points: scoreResult.total,
            isExact: scoreResult.type === 'exact',
        }
    })

    // 5. Sort by points desc, then return top 5
    results.sort((a, b) => b.points - a.points)
    const top5 = results.slice(0, 5)

    return NextResponse.json({ leaderboard: top5, status: dbMatch.status })
}
