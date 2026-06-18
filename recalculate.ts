import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { scoreMatch } from './src/lib/scoring'
import { GROUP_MATCHES, KNOCKOUT_MATCHES } from './src/lib/wc2026-data'

const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc: any, line) => {
    const [k, ...v] = line.split('=')
    if (k && v) acc[k.trim()] = v.join('=').trim()
    return acc
}, {})

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.VITE_SUPABASE_SECRET_ROLE_KEY
)

async function fetchAll(table: string) {
    let allData: any[] = []
    let from = 0
    const limit = 1000
    while (true) {
        const { data, error } = await supabase.from(table).select('*').range(from, from + limit - 1)
        if (error) { console.error(error); break }
        if (!data || data.length === 0) break
        allData = allData.concat(data)
        if (data.length < limit) break
        from += limit
    }
    return allData
}

async function run() {
    console.log('Fetching all finished matches...')
    const { data: matches } = await supabase.from('matches').select('*').eq('status', 'finished')
    console.log(`Found ${matches?.length || 0} finished matches.`)

    console.log('Fetching all predictions...')
    const groupPredictions = await fetchAll('predictions')
    
    console.log('Fetching all bracket picks...')
    const bracketPicks = await fetchAll('bracket_picks')
    
    const normalizedBracketPicks = bracketPicks.map(bp => ({
        ...bp,
        match_id: `${bp.round}_${bp.slot_index + 1}`,
        is_repredicted: false
    }))
    
    const predictions = [...groupPredictions, ...normalizedBracketPicks]
    console.log(`Found ${predictions.length} total predictions.`)
    
    console.log('Fetching all group memberships...')
    const memberships = await fetchAll('group_members')

    const sortedMatches = (matches || []).sort((a, b) => {
        const ma = ALL_MATCHES.find(m => m.id === a.id)
        const mb = ALL_MATCHES.find(m => m.id === b.id)
        if (!ma || !mb) return 0
        return new Date(ma.kickoff).getTime() - new Date(mb.kickoff).getTime()
    })

    const userScores = new Map() // user_id -> { total: 0, exact: 0, correct: 0, currentStreak: 0, bestStreak: 0 }
    
    const allUserIds = new Set(predictions.map(p => p.user_id))
    for (const userId of allUserIds) {
        userScores.set(userId, { total: 0, exact: 0, correct: 0, currentStreak: 0, bestStreak: 0 })
    }

    for (const match of sortedMatches) {
        if (match.home_score === null || match.away_score === null) continue
        
        const isKnockout = match.stage ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage) : false

        for (const userId of allUserIds) {
            const p = predictions.find(pred => pred.match_id === match.id && pred.user_id === userId)
            const stats = userScores.get(userId)
            
            if (p && p.home_score !== null && p.away_score !== null) {
                // USE THE REAL SCORING ENGINE
                const res = scoreMatch(
                    p.home_score, 
                    p.away_score, 
                    match.home_score, 
                    match.away_score, 
                    isKnockout,
                    {
                        predQualifier: p.qualifier || null,
                        realQualifier: match.qualifier || null,
                        isRepredicted: p.is_repredicted,
                        multiplier: match.multiplier || 1,
                        isFixtureCorrect: true
                    }
                )
                
                stats.total += res.total
                if (res.type === 'exact') stats.exact++
                if (['correct', 'goal_diff'].includes(res.type)) stats.correct++
                if (['exact', 'correct', 'goal_diff'].includes(res.type)) {
                    stats.currentStreak++
                    if (stats.currentStreak > stats.bestStreak) stats.bestStreak = stats.currentStreak
                } else {
                    stats.currentStreak = 0
                }
            } else {
                // Missed prediction! Break streak
                stats.currentStreak = 0
            }
        }
    }

    console.log('\nWiping old scores table...')
    await supabase.from('scores').delete().neq('user_id', '00000000-0000-0000-0000-000000000000') // delete all

    console.log('Inserting fresh mathematical scores...')
    let inserted = 0
    for (const member of memberships) {
        const stats = userScores.get(member.user_id)
        if (!stats) continue

        await supabase.from('scores').insert({
            user_id: member.user_id,
            group_id: member.group_id,
            total_points: stats.total,
            exact_scores: stats.exact,
            correct_results: stats.correct,
            streak: stats.currentStreak
        })
        inserted++
    }

    console.log(`Done! Inserted ${inserted} mathematically verified score records using real engine.`)
}

run().catch(console.error)
