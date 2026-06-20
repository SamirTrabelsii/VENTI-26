import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from '@/lib/wc2026-data'

export const maxDuration = 30 // Allow more time for full db update

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization')
    const secretHeader = request.headers.get('x-scoring-secret')
    
    // Quick auth check
    if (secretHeader !== process.env.SCORING_SECRET) {
        if (!authHeader || !authHeader.includes('Bearer')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    const supabase = createAdminClient()
    
    // 1. Fetch from football-data.org
    let apiMatches: any[] = []
    try {
        const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY ?? '' },
        })
        if (!res.ok) throw new Error('football-data.org returned ' + res.status)
        const data = await res.json()
        apiMatches = data.matches || []
    } catch (e: any) {
        return NextResponse.json({ error: 'Failed to fetch API', details: e.message }, { status: 500 })
    }

    const updates: any[] = []
    let updatedCount = 0

    // 2. Map Group Matches
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    
    for (const g of groups) {
        const apiGroup = apiMatches.filter(m => m.stage === 'GROUP_STAGE' && m.group === `GROUP_${g}`)
        // Sort chronologically
        apiGroup.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
        
        const localGroup = GROUP_MATCHES.filter(m => m.group_label === g)
        localGroup.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

        for (let i = 0; i < Math.min(apiGroup.length, localGroup.length); i++) {
            const apiM = apiGroup[i]
            const localM = localGroup[i]

            let status = apiM.status
            if (apiM.status === 'TIMED' || apiM.status === 'SCHEDULED') status = 'upcoming'
            else if (apiM.status === 'IN_PLAY' || apiM.status === 'PAUSED' || apiM.status === 'HALFTIME') status = 'live'
            else if (apiM.status === 'FINISHED') status = 'finished'

            const { api_id, ...restLocalM } = localM
            updates.push({
                ...restLocalM,
                id: localM.id,
                home_team: apiM.homeTeam?.tla || localM.home_team,
                away_team: apiM.awayTeam?.tla || localM.away_team,
                home_score: apiM.score?.fullTime?.home ?? null,
                away_score: apiM.score?.fullTime?.away ?? null,
                status: status,
                kickoff: apiM.utcDate,
            })
        }
    }

    // 3. Map Knockout Matches (just chronological for now)
    const apiKnockouts = apiMatches.filter(m => m.stage !== 'GROUP_STAGE')
    apiKnockouts.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    
    const localKnockouts = [...KNOCKOUT_MATCHES]
    localKnockouts.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

    for (let i = 0; i < Math.min(apiKnockouts.length, localKnockouts.length); i++) {
        const apiM = apiKnockouts[i]
        const localM = localKnockouts[i]

        let status = apiM.status
        if (apiM.status === 'TIMED' || apiM.status === 'SCHEDULED') status = 'upcoming'
        else if (apiM.status === 'IN_PLAY' || apiM.status === 'PAUSED' || apiM.status === 'HALFTIME') status = 'live'
        else if (apiM.status === 'FINISHED') status = 'finished'

        const { api_id, ...restLocalM } = localM
        updates.push({
            ...restLocalM,
            id: localM.id,
            home_team: apiM.homeTeam?.tla || localM.home_team,
            away_team: apiM.awayTeam?.tla || localM.away_team,
            home_score: apiM.score?.fullTime?.home ?? null,
            away_score: apiM.score?.fullTime?.away ?? null,
            status: status,
            kickoff: apiM.utcDate,
        })
    }

    // 4. Update the Database!
    const batchSize = 20
    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize)
        // Upsert by id
        const { error } = await supabase.from('matches').upsert(batch, { onConflict: 'id' })
        if (error) {
            console.error('Batch error:', error)
            return NextResponse.json({ error: 'DB Update Failed', details: error }, { status: 500 })
        }
        updatedCount += batch.length
    }

    // 5. Trigger Recalculate
    const baseUrl = new URL(request.url).origin
    await fetch(`${baseUrl}/api/admin/recalculate`, { 
        method: 'POST', 
        headers: { 'x-scoring-secret': process.env.SCORING_SECRET ?? '' } 
    }).catch(() => {})

    return NextResponse.json({ success: true, updatedCount, updates })
}
