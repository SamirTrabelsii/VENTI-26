import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
    const db = createAdminClient()
    const { data: groups } = await db.from('groups').select('*');
    const { data: scores } = await db.from('scores').select('*').limit(20);
    const { data: members } = await db.from('group_members').select('*').limit(20);

    return NextResponse.json({
        groups,
        scores,
        members
    })
}
