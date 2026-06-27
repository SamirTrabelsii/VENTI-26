import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import FixturesClient from './FixturesClient'

export default async function FixturesPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    let profile = null
    let preds: any[] = []
    let liveKoPicks: any[] = []

    if (user) {
        const { data: profileData } = await supabase
            .from('profiles').select('*').eq('id', user.id).single()
        profile = profileData

        const [{ data: predsData }, { data: koPicksData }] = await Promise.all([
            supabase.from('predictions').select('*').eq('user_id', user.id),
            supabase.from('live_ko_picks').select('*').eq('user_id', user.id),
        ])
        preds = predsData || []
        liveKoPicks = koPicksData || []
    }

    // Fetch DB matches to know status and scores of finished/live games
    const { data: dbMatches } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score, kickoff, home_team, away_team, qualifier, stage')

    const displayName = profile?.display_name ?? profile?.email ?? 'Player'

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={displayName} isGuest={!user} />
            
            <div style={{ paddingTop: 100 }}>
                <FixturesClient 
                    predictions={preds ?? []} 
                    dbMatches={dbMatches ?? []} 
                    liveKoPicks={liveKoPicks}
                />
            </div>
        </div>
    )
}
