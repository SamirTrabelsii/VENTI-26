// src/app/live-bracket/page.tsx
import Nav from '@/components/Nav'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { GET as getLiveMatches } from '@/app/api/matches/live/route'
import { buildLiveBracketFixtures } from '@/lib/live-bracket'
import LiveBracketClient from './LiveBracketClient'

export const dynamic = 'force-dynamic'

export default async function LiveBracketPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let profile: any = null
    let bracketPicks: any[] = []
    if (user) {
        const [{ data: profileData }, { data: picksData }] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('live_ko_picks').select('*').eq('user_id', user.id),
        ])
        profile = profileData
        bracketPicks = picksData || []
    }

    const dbMatches = await fetchAllRows(
        supabase.from('matches').select('id, home_team, away_team, home_score, away_score, penalty_home_score, penalty_away_score, went_to_penalties, kickoff, status, qualifier')
    )

    let apiMatches: any[] = []
    try {
        const liveRes = await getLiveMatches()
        const liveData = await liveRes.json()
        apiMatches = liveData.matches || []
    } catch {
        apiMatches = []
    }

    const fixtures = buildLiveBracketFixtures(apiMatches, dbMatches)

    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials={profile?.avatar_initials ?? 'PL'} displayName={profile?.display_name} isGuest={!user} />
            <LiveBracketClient
                currentUserId={user?.id ?? null}
                displayName={profile?.display_name ?? 'Player'}
                initialFixtures={fixtures}
                initialPicks={bracketPicks}
            />
        </div>
    )
}
