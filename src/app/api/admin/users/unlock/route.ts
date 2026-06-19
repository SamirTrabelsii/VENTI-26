import { NextResponse } from 'next/server'
import { createAdminClient, verifyAdmin } from '@/lib/supabase/admin'

// POST /api/admin/users/unlock
export async function POST(request: Request) {
    const admin = await verifyAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { user_id, is_unlocked } = body

    if (!user_id || typeof is_unlocked !== 'boolean') {
        return NextResponse.json({ error: 'Missing user_id or is_unlocked' }, { status: 400 })
    }

    const db = createAdminClient()

    const { error } = await db
        .from('profiles')
        .update({ is_unlocked })
        .eq('id', user_id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user_id, is_unlocked })
}
