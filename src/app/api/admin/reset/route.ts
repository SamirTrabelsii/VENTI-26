import { NextResponse } from 'next/server'
import { createAdminClient, verifyAdmin } from '@/lib/supabase/admin'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/reset
// Resets test data:
//   - Reverts simulated matches (a1-a6) back to upcoming with null scores
//   - Deletes ALL predictions for those matches
//   - Resets ALL score entries to zero
//
// Body (optional): { full?: boolean }
//   If full=true, resets ALL matches + deletes ALL predictions + ALL scores
// ─────────────────────────────────────────────────────────────────────────────

const TEST_MATCH_IDS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']

export async function POST(request: Request) {
    const admin = await verifyAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const isFull = body.full === true

    const db = createAdminClient()
    const log: string[] = []

    if (isFull) {
        // ── Full reset — revert ALL matches + ALL predictions + ALL scores ──

        // Reset all matches
        const { error: matchErr } = await db
            .from('matches')
            .update({ home_score: null, away_score: null, status: 'upcoming', minute: null })
            .neq('id', '__never__')  // matches all rows

        if (matchErr) log.push(`⚠️ Match reset error: ${matchErr.message}`)
        else log.push('✅ All matches reset to upcoming')

        // Delete all predictions
        const { data: deletedPreds, error: predErr } = await db
            .from('predictions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000')
            .select('id')

        if (predErr) log.push(`⚠️ Predictions delete error: ${predErr.message}`)
        else log.push(`✅ Deleted ${deletedPreds?.length ?? 0} predictions`)

        // Delete all scores
        const { data: deletedScores, error: scoreErr } = await db
            .from('scores')
            .delete()
            .neq('user_id', '00000000-0000-0000-0000-000000000000')
            .select('user_id')

        if (scoreErr) log.push(`⚠️ Scores delete error: ${scoreErr.message}`)
        else log.push(`✅ Deleted ${deletedScores?.length ?? 0} score entries`)

    } else {
        // ── Partial reset — only test matches ──

        // Reset test matches
        const { error: matchErr } = await db
            .from('matches')
            .update({ home_score: null, away_score: null, status: 'upcoming', minute: null })
            .in('id', TEST_MATCH_IDS)

        if (matchErr) log.push(`⚠️ Match reset error: ${matchErr.message}`)
        else log.push(`✅ Reset ${TEST_MATCH_IDS.length} test matches`)

        // Delete predictions for test matches
        const { data: deletedPreds, error: predErr } = await db
            .from('predictions')
            .delete()
            .in('match_id', TEST_MATCH_IDS)
            .select('id')

        if (predErr) log.push(`⚠️ Predictions delete error: ${predErr.message}`)
        else log.push(`✅ Deleted ${deletedPreds?.length ?? 0} test predictions`)

        // Reset all scores (since they might be inaccurate now)
        const { data: deletedScores, error: scoreErr } = await db
            .from('scores')
            .delete()
            .neq('user_id', '00000000-0000-0000-0000-000000000000')
            .select('user_id')

        if (scoreErr) log.push(`⚠️ Scores reset error: ${scoreErr.message}`)
        else log.push(`✅ Reset ${deletedScores?.length ?? 0} score entries`)
    }

    return NextResponse.json({ success: true, mode: isFull ? 'full' : 'partial', log })
}
