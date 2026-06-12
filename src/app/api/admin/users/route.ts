import { NextResponse } from 'next/server'
import { createAdminClient, verifyAdmin } from '@/lib/supabase/admin'
import { randomBytes } from 'crypto'

function generateTemporaryPassword() {
    return `Venti26-${randomBytes(4).toString('hex')}-${randomBytes(3).toString('hex')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
// List all registered users with their stats
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
    const admin = await verifyAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const db = createAdminClient()

    // All profiles
    const { data: profiles } = await db
        .from('profiles')
        .select('id, email, display_name, avatar_initials, avatar_color, created_at')
        .order('created_at', { ascending: false })

    if (!profiles) return NextResponse.json({ users: [] })

    // Prediction counts per user
    const { data: allPreds } = await db.from('predictions').select('user_id')
    const predCounts = new Map<string, number>()
    allPreds?.forEach(p => predCounts.set(p.user_id, (predCounts.get(p.user_id) ?? 0) + 1))

    // Bracket counts per user
    const { data: allBracket } = await db.from('bracket_picks').select('user_id')
    const bracketCounts = new Map<string, number>()
    allBracket?.forEach(p => bracketCounts.set(p.user_id, (bracketCounts.get(p.user_id) ?? 0) + 1))

    // Scores per user (best score across groups)
    const { data: allScores } = await db
        .from('scores')
        .select('user_id, total_points, exact_scores, correct_results, streak')

    const scoreMap = new Map<string, { total_points: number; exact_scores: number; correct_results: number; streak: number }>()
    allScores?.forEach(s => {
        const existing = scoreMap.get(s.user_id)
        if (!existing || s.total_points > existing.total_points) {
            scoreMap.set(s.user_id, {
                total_points: s.total_points,
                exact_scores: s.exact_scores,
                correct_results: s.correct_results,
                streak: s.streak,
            })
        }
    })

    // Group memberships per user
    const { data: allMembers } = await db.from('group_members').select('user_id, group_id')
    const groupCounts = new Map<string, number>()
    allMembers?.forEach(m => groupCounts.set(m.user_id, (groupCounts.get(m.user_id) ?? 0) + 1))

    const users = profiles.map(p => ({
        ...p,
        predictions: predCounts.get(p.id) ?? 0,
        bracket_picks: bracketCounts.get(p.id) ?? 0,
        groups: groupCounts.get(p.id) ?? 0,
        score: scoreMap.get(p.id) ?? null,
    }))

    return NextResponse.json({ users })
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users?id=<user_id>
// Delete a user and all their data (cascading)
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
    const admin = await verifyAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    if (!userId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })

    // Don't let admin delete themselves
    if (userId === admin.id) {
        return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    const db = createAdminClient()

    // Delete from auth (cascades to profiles -> predictions, scores, etc.)
    const { error } = await db.auth.admin.deleteUser(userId)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: userId })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users   { action: 'reset' | 'reset_password', user_id: '...' }
// Reset a user's predictions/bracket/scores, or issue a temporary password
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    const admin = await verifyAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { action, user_id, display_name } = body

    if (!['reset', 'reset_password'].includes(action) || !user_id) {
        return NextResponse.json({ error: 'Invalid action or missing user_id' }, { status: 400 })
    }

    const db = createAdminClient()

    if (action === 'reset_password') {
        const temporaryPassword = display_name 
            ? (display_name.length < 6 ? display_name.padEnd(6, '123456') : display_name) 
            : generateTemporaryPassword()
        const { error } = await db.auth.admin.updateUserById(user_id, {
            password: temporaryPassword,
        })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            user_id,
            temporary_password: temporaryPassword,
        })
    }

    const results: string[] = []

    // Delete predictions
    const { data: deletedPreds } = await db
        .from('predictions')
        .delete()
        .eq('user_id', user_id)
        .select('id')
    results.push(`Deleted ${deletedPreds?.length ?? 0} predictions`)

    // Delete bracket picks
    const { data: deletedBracket } = await db
        .from('bracket_picks')
        .delete()
        .eq('user_id', user_id)
        .select('id')
    results.push(`Deleted ${deletedBracket?.length ?? 0} bracket picks`)

    // Reset scores
    const { data: deletedScores } = await db
        .from('scores')
        .delete()
        .eq('user_id', user_id)
        .select('user_id')
    results.push(`Deleted ${deletedScores?.length ?? 0} score entries`)

    return NextResponse.json({ success: true, user_id, results })
}
