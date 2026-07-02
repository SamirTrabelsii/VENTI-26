// src/app/api/scoring/route.ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { scoreMatch } from '@/lib/scoring'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { roundSlotFromFixtureId } from '@/lib/live-bracket'

function isKnockoutMatch(match: any) {
    if (['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'].includes(match.group_label)) return true
    return match.stage
        ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage)
        : false
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

    const isKnockout = isKnockoutMatch(match)

    const realQualifier: string | null = isKnockout ? inferQualifier(match) : null

    // ── 2. Load predictions for this match ────────────────────────────────────
    const predictions = await fetchAllRows(
        supabase
            .from('predictions')
            .select('user_id, home_score, away_score, qualifier_pick')
            .eq('match_id', match_id)
    )

    // ── 2b. Load live knockout picks if knockout match ─────────────────────────
    let liveKoPicks: any[] = []
    if (isKnockout) {
        const { round, slotIndex } = roundSlotFromFixtureId(match.id)
        liveKoPicks = await fetchAllRows(
            supabase
                .from('live_ko_picks')
                .select('user_id, slot_index, team_code, home_score, away_score')
                .eq('round', round)
                .eq('slot_index', slotIndex)
        ) || []
    }

    // Collect all users who have a scorable prediction
    const allUserIds = new Set<string>()
    if (isKnockout) {
        liveKoPicks.forEach(bp => allUserIds.add(bp.user_id))
    } else {
        predictions.forEach(p => allUserIds.add(p.user_id))
    }

    if (allUserIds.size === 0) {
        return NextResponse.json({ message: 'No predictions for this match', processed: 0 })
    }

    const slot_index = isKnockout ? roundSlotFromFixtureId(match.id).slotIndex : -1

    // ── 3. Score every prediction ──────────────────────────────────────────────
    const results = Array.from(allUserIds).map(userId => {
        let predHome: number | undefined
        let predAway: number | undefined
        let predQualifier: string | null = null

        if (isKnockout) {
            const pick = liveKoPicks.find(bp => bp.user_id === userId && bp.slot_index === slot_index)
            predHome = pick?.home_score
            predAway = pick?.away_score
            predQualifier = pick?.team_code ?? null
        } else {
            const p = predictions.find(x => x.user_id === userId)
            predHome = p?.home_score
            predAway = p?.away_score
            predQualifier = p?.qualifier_pick ?? null
        }

        if (typeof predHome !== 'number' || typeof predAway !== 'number') return null

        const result = scoreMatch(
            predHome,
            predAway,
            match.home_score,
            match.away_score,
            isKnockout,
            { predQualifier, realQualifier }
        )

        return {
            user_id: userId,
            points: result.total,
            breakdown: result.breakdown,
            isExact: result.type === 'exact',
            isCorrect: result.type === 'exact' || result.type === 'correct',
        }
    }).filter(r => r !== null)

    // ── 4. Full recalculation for affected users ───────────────────────────────
    const userIds = results.map(r => r!.user_id)
    const { recalculateAllUsers } = await import('@/app/api/admin/recalculate/route')
    const recalcResult = await recalculateAllUsers(isKnockout ? undefined : userIds)

    // ── 5. Return summary ──────────────────────────────────────────────────────
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
            user_id: r!.user_id,
            points: r!.points,
            breakdown: r!.breakdown,
        })),
        errors: recalcResult.errors.length > 0 ? recalcResult.errors : undefined,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/scoring?match_id=xxx
// Returns the scoring breakdown for any match — useful for debugging and
// showing users exactly how their points were calculated.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const match_id = searchParams.get('match_id')
    if (!match_id) return NextResponse.json({ error: 'match_id required' }, { status: 400 })

    const { data: match } = await supabase
        .from('matches').select('*').eq('id', match_id).single()

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    const predsData = await fetchAllRows(
        supabase
            .from('predictions')
            .select('user_id, home_score, away_score, qualifier_pick, profile:profiles(display_name)')
            .eq('match_id', match_id)
    )

    const isKnockout = isKnockoutMatch(match)

    const realQualifier: string | null = isKnockout ? inferQualifier(match) : null

    const breakdown = (predsData || []).map((p: any) => {
        const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
        const name = profile?.display_name ?? p.user_id

        if (match.status === 'finished' && match.home_score !== null) {
            const result = scoreMatch(
                p.home_score,
                p.away_score,
                match.home_score,
                match.away_score,
                isKnockout,
                { predQualifier: p.qualifier_pick ?? null, realQualifier }
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
