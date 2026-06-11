import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { scoreMatch } from '@/lib/scoring'
import { fetchAllRows } from '@/lib/supabase/pagination'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/scoring
// Triggered after a match finishes. Scores every prediction for that match
// and increments each player's score row in every group they belong to.
//
// Body:  { match_id: string }
// Header: x-scoring-secret: <SCORING_SECRET env var>
//
// In production call this from:
//   • A Supabase Database Webhook on matches (status → 'finished')
//   • A cron job that polls finished matches
//   • Manual curl after entering the result
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    const supabase = await createClient()

    // Auth guard
    const secret = request.headers.get('x-scoring-secret')
    if (secret !== process.env.SCORING_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { match_id } = body

    if (!match_id) {
        return NextResponse.json({ error: 'match_id required' }, { status: 400 })
    }

    // ── 1. Load the finished match ─────────────────────────────────────────────
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
        return NextResponse.json({ error: 'Match has no scores yet' }, { status: 400 })
    }

    // Determine if this is a knockout match.
    // Your matches table should have a `stage` column — adjust the value check
    // to match whatever string you store ('knockout', 'R16', 'QF', etc.)
    const isKnockout = match.stage
        ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage)
        : false

    // For knockout draws, the match row should have a `qualifier` column
    // containing the team code that actually advanced (e.g. 'BRA').
    // If your schema doesn't have this yet, it will safely be null.
    const realQualifier: string | null = match.qualifier ?? null

    // ── 2. Load live predictions for this match ───────────────────────────────
    // If your predictions table has a qualifier_pick column, select it too.
    // Also select original scores and is_repredicted flag
    const predictions = await fetchAllRows(
        supabase
            .from('predictions')
            .select('user_id, home_score, away_score, qualifier_pick, original_home_score, original_away_score, is_repredicted')
            .eq('match_id', match_id)
    )

    // ── 2b. Load bracket picks for this match if it's a knockout ──────────────
    let bracketPicks: any[] = []
    let multiplier = 1
    if (isKnockout && match.id.includes('_')) {
        const [round, numStr] = match.id.split('_')
        const slot_index = parseInt(numStr) - 1
        
        // Determine multiplier
        if (round === 'r32') multiplier = 1.5
        else if (round === 'r16') multiplier = 2
        else if (round === 'qf') multiplier = 3
        else if (round === 'sf') multiplier = 4
        else if (round === 'final') multiplier = 5
        
        const bp = await fetchAllRows(
            supabase
                .from('bracket_picks')
                .select('user_id, team_code, home_score, away_score, predicted_home_team, predicted_away_team')
                .eq('round', round)
        )
            
        bracketPicks = bp || []
    }

    // Collect all users who have either a prediction or a bracket pick
    const allUserIds = new Set<string>()
    predictions?.forEach(p => allUserIds.add(p.user_id))
    bracketPicks?.forEach(bp => allUserIds.add(bp.user_id))

    if (allUserIds.size === 0) {
        return NextResponse.json({ message: 'No predictions for this match', processed: 0 })
    }

    const [roundStr, numStr] = match.id.split('_')
    const slot_index = parseInt(numStr) - 1

    // ── 3. Score every prediction ─────────────────────────────────────────────
    const results = Array.from(allUserIds).map(userId => {
        const p = predictions?.find(x => x.user_id === userId)
        
        let predHome = p?.home_score
        let predAway = p?.away_score
        let predQualifier: string | null = p?.qualifier_pick ?? null
        let isRepredicted = p?.is_repredicted ?? false
        let isFixtureCorrect = true

        // If knockout match, derive original prediction from bracket_picks if they didn't repredict
        if (isKnockout) {
            // Find the specific bracket pick row for this match (e.g. r16_1 -> round: 'r16', slot_index: 0)
            const matchPick = bracketPicks.find(bp => bp.user_id === userId && bp.slot_index === slot_index)

            if (!isRepredicted) {
                // Use original scores from bracket_picks if they didn't repredict
                if (matchPick && typeof matchPick.home_score === 'number' && typeof matchPick.away_score === 'number') {
                    predHome = matchPick.home_score
                    predAway = matchPick.away_score
                }
            }

            // Check fixture validity based on the original prediction
            if (matchPick && matchPick.predicted_home_team && matchPick.predicted_away_team) {
                const userPickedHome = matchPick.predicted_home_team
                const userPickedAway = matchPick.predicted_away_team
                // Check against real teams
                if (userPickedHome !== match.home_team || userPickedAway !== match.away_team) {
                    isFixtureCorrect = false
                }
            } else {
                isFixtureCorrect = false
            }
        } else {
            // Group match
            if (!isRepredicted && typeof p?.original_home_score === 'number' && typeof p?.original_away_score === 'number') {
                predHome = p.original_home_score
                predAway = p.original_away_score
            }
        }

        // If we still don't have scores, they didn't predict
        if (typeof predHome !== 'number' || typeof predAway !== 'number') {
            return null
        }

        const result = scoreMatch(
            predHome,
            predAway,
            match.home_score,
            match.away_score,
            isKnockout,
            {
                predQualifier,
                realQualifier,
                isRepredicted,
                multiplier,
                isFixtureCorrect
            }
        )
        return {
            user_id: userId,
            points: result.total,
            breakdown: result.breakdown,
            isExact: result.type === 'exact',
            isCorrect: ['exact', 'correct', 'goal_diff'].includes(result.type),
        }
    }).filter(r => r !== null)
    const userIds = results.map(r => r.user_id)

    // Need to handle userIds potentially being larger than max IN clause size
    // So we'll fetch all group_members and filter, or batch it. 
    // Since we want to ensure we don't hit 1000 row limits, fetching all memberships 
    // for all involved users in batches is best.
    const memberships = []
    const batchSize = 100
    for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize)
        const batchMemberships = await fetchAllRows(
            supabase
                .from('group_members')
                .select('user_id, group_id')
                .in('user_id', batch)
        )
        memberships.push(...batchMemberships)
    }

    if (!memberships || memberships.length === 0) {
        return NextResponse.json({ message: 'No group memberships found', processed: 0 })
    }

    // ── 5. Update scores table — one row per (user, group) ───────────────────
    const errors: string[] = []
    let processed = 0

    for (const membership of memberships) {
        const userResult = results.find(r => r.user_id === membership.user_id)
        if (!userResult) continue

        const { data: existing } = await supabase
            .from('scores')
            .select('total_points, exact_scores, correct_results, streak')
            .eq('user_id', membership.user_id)
            .eq('group_id', membership.group_id)
            .single()

        if (existing) {
            // Increment the existing row
            const newStreak = userResult.isCorrect ? existing.streak + 1 : 0

            const { error } = await supabase
                .from('scores')
                .update({
                    total_points: existing.total_points + userResult.points,
                    exact_scores: existing.exact_scores + (userResult.isExact ? 1 : 0),
                    correct_results: existing.correct_results + (userResult.isCorrect ? 1 : 0),
                    streak: newStreak,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', membership.user_id)
                .eq('group_id', membership.group_id)

            if (error) {
                errors.push(`update ${membership.user_id}/${membership.group_id}: ${error.message}`)
            } else {
                processed++
            }
        } else {
            // First score row for this user in this group
            const { error } = await supabase
                .from('scores')
                .insert({
                    user_id: membership.user_id,
                    group_id: membership.group_id,
                    total_points: userResult.points,
                    exact_scores: userResult.isExact ? 1 : 0,
                    correct_results: userResult.isCorrect ? 1 : 0,
                    streak: userResult.isCorrect ? 1 : 0,
                })

            if (error) {
                errors.push(`insert ${membership.user_id}/${membership.group_id}: ${error.message}`)
            } else {
                processed++
            }
        }
    }

    // ── 6. Return summary ─────────────────────────────────────────────────────
    return NextResponse.json({
        match_id,
        is_knockout: isKnockout,
        real_qualifier: realQualifier,
        predictions_found: predictions?.length ?? 0,
        processed,
        score_breakdown: results.map(r => ({
            user_id: r.user_id,
            points: r.points,
            breakdown: r.breakdown,
        })),
        errors: errors.length > 0 ? errors : undefined,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/scoring?match_id=xxx
// Returns the scoring breakdown for any match — great for debugging and
// for showing users exactly how their points were calculated.
// ─────────────────────────────────────────────────────────────────────────────

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

    if (!match) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const predictions = await fetchAllRows(
        supabase
            .from('predictions')
            .select('user_id, home_score, away_score, qualifier_pick, profile:profiles(display_name)')
            .eq('match_id', match_id)
    )

    if (!predictions) {
        return NextResponse.json({ error: 'Could not load predictions' }, { status: 500 })
    }

    const isKnockout = match.stage
        ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage)
        : false

    const realQualifier: string | null = match.qualifier ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breakdown = predictions.map((p: any) => {
        const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
        const name = profile?.display_name ?? p.user_id

        if (match.status === 'finished' && match.home_score !== null) {
            const result = scoreMatch(
                p.home_score,
                p.away_score,
                match.home_score,
                match.away_score,
                isKnockout,
                {
                    predQualifier: p.qualifier_pick ?? null,
                    realQualifier,
                }
            )
            return {
                user: name,
                predicted: `${p.home_score}–${p.away_score}`,
                qualifier_pick: p.qualifier_pick ?? null,
                actual: `${match.home_score}–${match.away_score}`,
                real_qualifier: realQualifier,
                total_points: result.total,
                type: result.type,
                breakdown: result.breakdown,
            }
        }

        return {
            user: name,
            predicted: `${p.home_score}–${p.away_score}`,
            actual: match.status === 'upcoming' ? 'Not played yet' : 'Live',
            total_points: null,
            breakdown: [],
        }
    })

    return NextResponse.json({
        match_id,
        status: match.status,
        is_knockout: isKnockout,
        result: match.status === 'finished' ? `${match.home_score}–${match.away_score}` : null,
        real_qualifier: realQualifier,
        breakdown,
    })
}