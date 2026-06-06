import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import FixturesClient from './FixturesClient'

export default async function FixturesPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

    // Fetch user predictions
    const { data: preds } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id)

    // Fetch DB matches to know status and scores of finished/live games
    const { data: dbMatches } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score')

    // Fetch REAL API fixtures to ensure 100% accurate calendar dates
    let apiMatches: any[] = []

    const displayName = profile?.display_name ?? profile?.email ?? 'Player'

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={displayName} />
            
            <div style={{ paddingTop: 100 }}>
                <FixturesClient 
                    predictions={preds ?? []} 
                    dbMatches={dbMatches ?? []} 
                    apiMatches={apiMatches}
                />
            </div>
        </div>
    )
}
