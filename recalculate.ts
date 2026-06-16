import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { scoreMatch } from './src/lib/scoring'

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
    const predictions = await fetchAll('predictions')
    console.log(`Found ${predictions.length} total predictions.`)
    
    console.log('Fetching all group memberships...')
    const memberships = await fetchAll('group_members')

    const userScores = new Map() // user_id -> { total: 0, exact: 0, correct: 0, streak: 0 }

    for (const match of (matches || [])) {
        if (match.home_score === null || match.away_score === null) continue
        
        const isKnockout = match.stage ? !['group', 'group_stage', 'GROUP_STAGE'].includes(match.stage) : false

        for (const p of predictions) {
            if (p.match_id !== match.id) continue
            if (p.home_score === null || p.away_score === null) continue

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
            
            if (!userScores.has(p.user_id)) {
                userScores.set(p.user_id, { total: 0, exact: 0, correct: 0, streak: 0 })
            }
            
            const stats = userScores.get(p.user_id)
            stats.total += res.total
            if (res.type === 'exact') stats.exact++
            if (['exact', 'correct', 'goal_diff', 'partial'].includes(res.type)) {
                stats.correct++
                stats.streak++
            } else {
                stats.streak = 0
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
            streak: stats.streak
        })
        inserted++
    }

    console.log(`Done! Inserted ${inserted} mathematically verified score records using real engine.`)
}

run().catch(console.error)
