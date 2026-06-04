import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { match_id, home_score, away_score } = body

    if (typeof home_score !== 'number' || typeof away_score !== 'number') {
        return NextResponse.json({ error: 'Invalid scores' }, { status: 400 })
    }

    const { data, error } = await supabase.from('predictions').upsert({
        user_id: user.id, match_id, home_score, away_score,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ prediction: data })
}

export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
        .from('predictions').select('*').eq('user_id', user.id)

    return NextResponse.json({ predictions: data ?? [] })
}