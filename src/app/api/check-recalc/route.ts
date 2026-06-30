import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/pagination'
import { scoreMatch } from '@/lib/scoring'

export async function GET() {
    const supabase = createAdminClient()

    const { data: scores } = await supabase.from('scores').select('*').eq('total_points', 304)
    if (!scores || scores.length === 0) return NextResponse.json({ error: 'Score 304 not found' })

    const user_id = scores[0].user_id

    const [matches, predictions] = await Promise.all([
        fetchAllRows(supabase.from('matches').select('*').eq('status', 'finished')),
        fetchAllRows(supabase.from('predictions').select('*').eq('user_id', user_id)),
    ])

    const finishedMatches = (matches || [])
        .filter((m: any) => m.home_score !== null && m.away_score !== null)
        .sort((a: any, b: any) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

    let matchesBreakdown = []
    let total = 0

    for (const match of finishedMatches) {
        const isKnockout = match.stage ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage) : false
        let prediction = predictions?.find(p => p.match_id === match.id)
        
        if (prediction && typeof prediction.home_score === 'number' && typeof prediction.away_score === 'number') {
            const predHome = prediction.home_score
            const predAway = prediction.away_score

            const options = {
                predQualifier: prediction.qualifier_pick || prediction.qualifier || prediction.team_code || null,
                realQualifier: match.qualifier || null,
            }

            const res = scoreMatch(predHome, predAway, match.home_score, match.away_score, isKnockout, options)
            total += res.total

            if (res.total > 0) {
                matchesBreakdown.push({
                    match: `${match.home_team} vs ${match.away_team}`,
                    actualScore: `${match.home_score}-${match.away_score}`,
                    prediction: `${predHome}-${predAway}`,
                    points: res.total,
                })
            }
        }
    }

    return NextResponse.json({ total, breakdown: matchesBreakdown })
}
