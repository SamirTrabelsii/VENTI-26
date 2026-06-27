import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { scoreMatch } from '@/lib/scoring'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { roundSlotFromFixtureId } from '@/lib/live-bracket'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/scoring
// Triggered after a match finishes. Scores every prediction for that match
// and then does a full recalculation for all affected users to ensure
// all (user, group) rows have the exact same correct total.
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
    // Auth guard
    const secret = request.headers.get('x-scoring-secret')
    if (secret !== process.env.SCORING_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

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
    const isKnockout = match.stage
        ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage)
        : false

    const realQualifier: string | null = match.qualifier ?? null

    // ── 2. Load live predictions for this match ───────────────────────────────
    const predictions = await fetchAllRows(
        supabase
            .from('predictions')
            .select('user_id, home_score, away_score, qualifier_pick, original_home_score, original_away_score, is_repredicted')
            .eq('match_id', match_id)
    )

    // ── 2b. Load bracket picks for this match if it's a knockout ──────────────
    let liveKoPicks: any[] = []
    let multiplier = 1
    if (isKnockout) {
        const { round, slotIndex } = roundSlotFromFixtureId(match.id)

        // Determine multiplier
        if (round === 'r32') multiplier = 1.5
        else if (round === 'r16') multiplier = 2
        else if (round === 'qf') multiplier = 3
        else if (round === 'sf') multiplier = 4
        else if (round === 'final') multiplier = 5

        const bp = await fetchAllRows(
            supabase
                .from('live_ko_picks')
                .select('user_id, slot_index, team_code, home_score, away_score, predicted_home_team, predicted_away_team')
                .eq('round', round)
                .eq('slot_index', slotIndex)
        )

        liveKoPicks = bp || []
    }

    // Collect all users who have a scorable prediction source.
    const allUserIds = new Set<string>()
    if (isKnockout) {
        liveKoPicks?.forEach(bp => allUserIds.add(bp.user_id))
    } else {
        predictions?.forEach(p => allUserIds.add(p.user_id))
    }

    if (allUserIds.size === 0 && !isKnockout) {
        return NextResponse.json({ message: 'No predictions for this match', processed: 0 })
    }

    const slot_index = isKnockout ? roundSlotFromFixtureId(match.id).slotIndex : -1

    // ── 3. Score every prediction (for the response breakdown) ────────────────
    const results = Array.from(allUserIds).map(userId => {
        const p = isKnockout ? null : predictions?.find(x => x.user_id === userId)

        let predHome = p?.home_score
        let predAway = p?.away_score
        let predQualifier: string | null = p?.qualifier_pick ?? null
        let isRepredicted = p?.is_repredicted ?? false
        let isFixtureCorrect = true

        if (isKnockout) {
            const matchPick = liveKoPicks.find(bp => bp.user_id === userId && bp.slot_index === slot_index)
            predHome = matchPick?.home_score
            predAway = matchPick?.away_score
            predQualifier = matchPick?.team_code ?? null
            isRepredicted = false
            isFixtureCorrect = true
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

    // ── 5. Full recalculation for affected users ─────────────────────────────
    // Instead of incrementally adding points (which can drift if called twice,
    // or if a previous run partially failed), we recalculate from scratch for
    // all users who had a prediction on this match. This guarantees every
    // (user, group) row has the exact same correct total.
    const { recalculateAllUsers } = await import('@/app/api/admin/recalculate/route')
    const recalcResult = await recalculateAllUsers(isKnockout ? undefined : userIds)

    // ── 6. Return summary ─────────────────────────────────────────────────────
    return NextResponse.json({
        match_id,
        is_knockout: isKnockout,
        real_qualifier: realQualifier,
        predictions_found: predictions?.length ?? 0,
        processed: recalcResult.rows_updated,
        recalculation: {
            users_processed: recalcResult.users_processed,
            rows_updated: recalcResult.rows_updated,
            finished_matches: recalcResult.finished_matches,
        },
        score_breakdown: results.map(r => ({
            user_id: r.user_id,
            points: r.points,
            breakdown: r.breakdown,
        })),
        errors: recalcResult.errors.length > 0 ? recalcResult.errors : undefined,
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

    const predsData = await fetchAllRows(
        supabase
            .from('predictions')
            .select('user_id, home_score, away_score, qualifier_pick, profile:profiles(display_name)')
            .eq('match_id', match_id)
    )

    if (!predsData) {
        return NextResponse.json({ error: 'Could not load predictions' }, { status: 500 })
    }

    const isKnockoutGet = match.stage
        ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage)
        : false

    const realQualifierGet: string | null = match.qualifier ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breakdown = predsData.map((p: any) => {
        const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
        const name = profile?.display_name ?? p.user_id

        if (match.status === 'finished' && match.home_score !== null) {
            const result = scoreMatch(
                p.home_score,
                p.away_score,
                match.home_score,
                match.away_score,
                isKnockoutGet,
                {
                    predQualifier: p.qualifier_pick ?? null,
                    realQualifier: realQualifierGet,
                }
            )
            return {
                user: name,
                predicted: `${p.home_score}–${p.away_score}`,
                qualifier_pick: p.qualifier_pick ?? null,
                actual: `${match.home_score}–${match.away_score}`,
                real_qualifier: realQualifierGet,
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
        is_knockout: isKnockoutGet,
        result: match.status === 'finished' ? `${match.home_score}–${match.away_score}` : null,
        real_qualifier: realQualifierGet,
        breakdown,
    })
}
