// src/app/api/groups/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, description } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const { data: group, error } = await supabase
        .from('groups')
        .insert({ name, description, created_by: user.id })
        .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })

    return NextResponse.json({ group })
}

export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name, description, invite_code, created_at)')
        .eq('user_id', user.id)

    return NextResponse.json({ groups: data ?? [] })
}