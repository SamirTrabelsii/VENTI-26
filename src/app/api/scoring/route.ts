import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { scoreMatch } from '@/lib/scoring'

// POST /api/scoring
// Called after a match finishes to recompute all scores for every group.
// In production, trigger this from a Supabase webhook or cron job.
// Body: { match_id: string }
export async function POST(request: Request) {
    const supabase = await createClient()

    // Only allow service-role or admin calls in production.
    // For now we check a simple secret header.
    const secret = request.headers.get('x-scoring-secret')
    if (secret !== process.env.SCORING_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { match_id } = await request.json()
    if (!match_id) {
        return NextResponse.json({ error: 'match_id required' }, { status: 400 })
    }

    // 1. Fetch the finished match with actual scores
    const { data: match, error: matchErr } = await supabase
        .from('matches')
        .select('*')
        .eq('id', match_id)
        .single()

    if (matchErr || !match) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    if (match.status !== 'finished') {
        return NextResponse.json({ error: 'Match not finished yet' }, { status: 400 })
    }

    if (match.home_score === null || match.away_score === null) {
        return NextResponse.json({ error: 'Match has no scores' }, { status: 400 })
    }

    // 2. Fetch all predictions for this match
    const { data: predictions } = await supabase
        .from('predictions')
        .select('user_id, home_score, away_score')
        .eq('match_id', match_id)

    if (!predictions || predictions.length === 0) {
        return NextResponse.json({ message: 'No predictions for this match' })
    }

    // 3. Score each prediction
    const results = predictions.map(p => ({
        user_id: p.user_id,
        result: scoreMatch(p.home_score, p.away_score, match.home_score, match.away_score),
    }))

    // 4. Fetch all groups so we can update scores per group
    const userIds = results.map(r => r.user_id)

    const { data: memberships } = await supabase
        .from('group_members')
        .select('user_id, group_id')
        .in('user_id', userIds)

    if (!memberships || memberships.length === 0) {
        return NextResponse.json({ message: 'No group memberships found' })
    }

    // 5. Build upsert payload: for each (user, group) combo, add the points
    const updates: Array<{
        user_id: string
        group_id: string
        points: number
        exact: boolean
        correct: boolean
    }> = []

    for (const m of memberships) {
        const result = results.find(r => r.user_id === m.user_id)
        if (!result) continue
        
        const type = result.result.type
        const isCorrectResult = type === 'correct' || type === 'exact' || type === 'goal_diff'
        
        updates.push({
            user_id: m.user_id,
            group_id: m.group_id,
            points: result.result.points,
            exact: type === 'exact',
            correct: isCorrectResult,
        })
    }

    // 6. Upsert scores — increment existing row or create new
    const errors: string[] = []

    for (const u of updates) {
        // Fetch current score row
        const { data: existing } = await supabase
            .from('scores')
            .select('*')
            .eq('user_id', u.user_id)
            .eq('group_id', u.group_id)
            .single()

        if (existing) {
            // Increment
            const { error } = await supabase
                .from('scores')
                .update({
                    total_points: existing.total_points + u.points,
                    exact_scores: existing.exact_scores + (u.exact ? 1 : 0),
                    correct_results: existing.correct_results + (u.correct ? 1 : 0),
                    streak: u.correct ? existing.streak + 1 : 0,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', u.user_id)
                .eq('group_id', u.group_id)

            if (error) errors.push(`${u.user_id}/${u.group_id}: ${error.message}`)
        } else {
            // Insert fresh row
            const { error } = await supabase
                .from('scores')
                .insert({
                    user_id: u.user_id,
                    group_id: u.group_id,
                    total_points: u.points,
                    exact_scores: u.exact ? 1 : 0,
                    correct_results: u.correct ? 1 : 0,
                    streak: u.correct ? 1 : 0,
                })

            if (error) errors.push(`${u.user_id}/${u.group_id}: ${error.message}`)
        }
    }

    return NextResponse.json({
        match_id,
        processed: updates.length,
        errors: errors.length > 0 ? errors : undefined,
    })
}

// GET /api/scoring?match_id=xxx
// Returns the scoring breakdown for a given match (useful for debugging)
export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const match_id = searchParams.get('match_id')
    if (!match_id) {
        return NextResponse.json({ error: 'match_id required' }, { status: 400 })
    }

    const { data: match } = await supabase
        .from('matches')
        .select('*')
        .eq('id', match_id)
        .single()

    const { data: predictions } = await supabase
        .from('predictions')
        .select('user_id, home_score, away_score, profile:profiles(display_name)')
        .eq('match_id', match_id)

    if (!match || !predictions) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // If match is finished, show each prediction's score
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breakdown = predictions.map((p: any) => {
        const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
        if (match.status === 'finished' && match.home_score !== null) {
            const result = scoreMatch(p.home_score, p.away_score, match.home_score, match.away_score)
            return {
                user: profile?.display_name ?? p.user_id,
                predicted: `${p.home_score}–${p.away_score}`,
                actual: `${match.home_score}–${match.away_score}`,
                points: result.points,
                type: result.type,
            }
        }
        return {
            user: profile?.display_name ?? p.user_id,
            predicted: `${p.home_score}–${p.away_score}`,
            actual: match.status === 'upcoming' ? 'Not played yet' : 'Live',
            points: null,
            type: null,
        }
    })

    return NextResponse.json({ match_id, status: match.status, breakdown })
}