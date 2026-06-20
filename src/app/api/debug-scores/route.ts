import { NextResponse } from 'next/server'
import { scoreMatch } from '@/lib/scoring'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/pagination'

export async function GET() {
    const db = createAdminClient()

    const [matches, predictions, existingScores] = await Promise.all([
        fetchAllRows(db.from('matches').select('*').eq('status', 'finished')),
        fetchAllRows(db.from('predictions').select('*').eq('user_id', '52af8c71-b9b5-4036-9617-bf7ba212e70b')),
        fetchAllRows(db.from('scores').select('*').eq('user_id', '52af8c71-b9b5-4036-9617-bf7ba212e70b'))
    ])

    const out: any = []
    let total = 0
    for (const m of matches) {
        const p = predictions.find((x: any) => x.match_id === m.id)
        if (!p) continue
        
        const isKnockout = m.stage ? !['group', 'group_stage', 'GROUP_STAGE'].includes(m.stage) : false
        
        const effHome = !p.is_repredicted && typeof p.original_home_score === 'number' ? p.original_home_score : p.home_score
        const effAway = !p.is_repredicted && typeof p.original_away_score === 'number' ? p.original_away_score : p.away_score
        
        const isFixCor = !isKnockout || !p.predicted_home_team || !p.predicted_away_team || (p.predicted_home_team === m.home_team && p.predicted_away_team === m.away_team)
        
        const res = scoreMatch(effHome, effAway, m.home_score, m.away_score, isKnockout, {
            predQualifier: p.qualifier || p.qualifier_pick || p.team_code,
            realQualifier: m.qualifier,
            isRepredicted: !!p.is_repredicted,
            multiplier: m.multiplier || 1,
            isFixtureCorrect: isFixCor
        })
        
        const profRes = scoreMatch(effHome, effAway, m.home_score, m.away_score, isKnockout, {
            predQualifier: p.qualifier,
            realQualifier: m.qualifier,
            isRepredicted: !!p.is_repredicted,
            multiplier: m.multiplier ?? 1,
            isFixtureCorrect: isFixCor
        })
        
        out.push({ match: m.id, backend: res.total, profile: profRes.total, realHome: m.home_score, realAway: m.away_score, predHome: effHome, predAway: effAway })
        total += res.total
    }

    return NextResponse.json({ total, matches: out, scores: existingScores })
}
