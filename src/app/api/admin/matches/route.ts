import { NextResponse } from 'next/server'
import { createAdminClient, verifyAdmin } from '@/lib/supabase/admin'
import { scoreMatch } from '@/lib/scoring'

function isKnockoutMatch(match: any) {
    if (['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(match.group_label)) return true
    return match.stage ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage) : false
}

function inferQualifier(match: any): string | null {
    if (match.qualifier) return match.qualifier
    if (match.went_to_penalties && typeof match.penalty_home_score === 'number' && typeof match.penalty_away_score === 'number') {
        if (match.penalty_home_score > match.penalty_away_score) return match.home_team ?? null
        if (match.penalty_away_score > match.penalty_home_score) return match.away_team ?? null
    }
    if (typeof match.home_score === 'number' && typeof match.away_score === 'number') {
        if (match.home_score > match.away_score) return match.home_team ?? null
        if (match.away_score > match.home_score) return match.away_team ?? null
    }
    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/matches
// List all matches with their current state
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
    const admin = await verifyAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const db = createAdminClient()

    const { data: matches } = await db
        .from('matches')
        .select('*')
        .order('kickoff', { ascending: true })

    // Count predictions per match
    const { data: allPreds } = await db.from('predictions').select('match_id')
    const predCounts = new Map<string, number>()
    allPreds?.forEach(p => predCounts.set(p.match_id, (predCounts.get(p.match_id) ?? 0) + 1))

    const enriched = (matches ?? []).map(m => ({
        ...m,
        prediction_count: predCounts.get(m.id) ?? 0,
    }))

    return NextResponse.json({ matches: enriched })
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/matches
// Update a match's result and status
// Body: { match_id, home_score, away_score, status?, qualifier? }
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
    const admin = await verifyAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { match_id, home_score, away_score, status, qualifier } = body

    if (!match_id) return NextResponse.json({ error: 'match_id required' }, { status: 400 })

    const db = createAdminClient()

    const update: Record<string, unknown> = {}
    if (typeof home_score === 'number') update.home_score = home_score
    if (typeof away_score === 'number') update.away_score = away_score
    if (status) update.status = status
    if (qualifier !== undefined) update.qualifier = qualifier

    const { data, error } = await db
        .from('matches')
        .update(update)
        .eq('id', match_id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ match: data })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/matches
// Trigger scoring for a finished match
// Body: { match_id }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    const admin = await verifyAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { match_id } = body

    if (!match_id) return NextResponse.json({ error: 'match_id required' }, { status: 400 })

    const db = createAdminClient()

    // Load the match
    const { data: match, error: matchErr } = await db
        .from('matches')
        .select('*')
        .eq('id', match_id)
        .single()

    if (matchErr || !match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.status !== 'finished') return NextResponse.json({ error: 'Match not finished yet' }, { status: 400 })
    if (match.home_score === null || match.away_score === null) {
        return NextResponse.json({ error: 'Match has no scores' }, { status: 400 })
    }

    const isKnockout = isKnockoutMatch(match)
    const realQualifier: string | null = isKnockout ? inferQualifier(match) : null

    // Load predictions
    const { data: predictions } = await db
        .from('predictions')
        .select('user_id, home_score, away_score, qualifier_pick')
        .eq('match_id', match_id)

    if (!predictions || predictions.length === 0) {
        return NextResponse.json({ message: 'No predictions for this match', processed: 0 })
    }

    // Score every prediction
    const results = predictions.map(p => {
        const result = scoreMatch(
            p.home_score, p.away_score,
            match.home_score, match.away_score,
            isKnockout,
            { predQualifier: p.qualifier_pick ?? null, realQualifier }
        )
        return {
            user_id: p.user_id,
            points: result.total,
            breakdown: result.breakdown,
            isExact: result.type === 'exact',
            isCorrect: result.type === 'correct',
            keepsStreak: result.type === 'exact' || result.type === 'correct',
        }
    })

    // Load group memberships
    const userIds = results.map(r => r.user_id)
    const { data: memberships } = await db
        .from('group_members')
        .select('user_id, group_id')
        .in('user_id', userIds)

    if (!memberships || memberships.length === 0) {
        return NextResponse.json({
            message: 'No group memberships — scores computed but not saved to leaderboard',
            results: results.map(r => ({ user_id: r.user_id, points: r.points })),
        })
    }

    // Update scores
    const errors: string[] = []
    let processed = 0

    for (const membership of memberships) {
        const userResult = results.find(r => r.user_id === membership.user_id)
        if (!userResult) continue

        const { data: existing } = await db
            .from('scores')
            .select('total_points, exact_scores, correct_results, streak')
            .eq('user_id', membership.user_id)
            .eq('group_id', membership.group_id)
            .single()

        if (existing) {
            const { error } = await db
                .from('scores')
                .update({
                    total_points: existing.total_points + userResult.points,
                    exact_scores: existing.exact_scores + (userResult.isExact ? 1 : 0),
                    correct_results: existing.correct_results + (userResult.isCorrect ? 1 : 0),
                    streak: userResult.keepsStreak ? existing.streak + 1 : 0,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', membership.user_id)
                .eq('group_id', membership.group_id)

            if (error) errors.push(`update ${membership.user_id}: ${error.message}`)
            else processed++
        } else {
            const { error } = await db
                .from('scores')
                .insert({
                    user_id: membership.user_id,
                    group_id: membership.group_id,
                    total_points: userResult.points,
                    exact_scores: userResult.isExact ? 1 : 0,
                    correct_results: userResult.isCorrect ? 1 : 0,
                    streak: userResult.keepsStreak ? 1 : 0,
                })

            if (error) errors.push(`insert ${membership.user_id}: ${error.message}`)
            else processed++
        }
    }

    return NextResponse.json({
        match_id,
        predictions_found: predictions.length,
        processed,
        score_breakdown: results.map(r => ({ user_id: r.user_id, points: r.points, breakdown: r.breakdown })),
        errors: errors.length > 0 ? errors : undefined,
    })
}
