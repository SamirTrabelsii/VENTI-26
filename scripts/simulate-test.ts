/**
 * simulate-test.ts — CLI test simulation
 *
 * Usage:
 *   npx tsx scripts/simulate-test.ts [match_count]
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, VITE_SUPABASE_SECRET_ROLE_KEY
 * Load them via:  set -a && source .env.local && set +a
 * Or on Windows:  $env loaded by dotenv inline
 */

import { createClient } from '@supabase/supabase-js'
import { scoreMatch } from '../src/lib/scoring'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SECRET_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and VITE_SUPABASE_SECRET_ROLE_KEY')
    process.exit(1)
}

const db = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

const FAKE_RESULTS = [
    { id: 'a1', home: 2, away: 1 },
    { id: 'a2', home: 0, away: 0 },
    { id: 'a3', home: 1, away: 3 },
    { id: 'a4', home: 2, away: 2 },
    { id: 'a5', home: 1, away: 0 },
    { id: 'a6', home: 3, away: 1 },
]

function randomScore(): number {
    const weights = [25, 30, 25, 12, 5, 3]
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i]
        if (r <= 0) return i
    }
    return 1
}

async function main() {
    const count = Math.min(6, Math.max(1, parseInt(process.argv[2] ?? '3')))
    console.log(`\n🧪 Simulating ${count} match(es)...\n`)

    // 1. Get all users
    const { data: users } = await db.from('profiles').select('id, display_name')
    if (!users || users.length === 0) {
        console.error('❌ No users registered')
        process.exit(1)
    }
    console.log(`👥 Found ${users.length} user(s)`)

    const testMatches = FAKE_RESULTS.slice(0, count)

    // 2. Set match results
    for (const fm of testMatches) {
        await db.from('matches').update({
            home_score: fm.home, away_score: fm.away, status: 'finished'
        }).eq('id', fm.id)
        console.log(`⚽ ${fm.id} → ${fm.home}-${fm.away} (finished)`)
    }

    // 3. Generate random predictions
    let predsCreated = 0
    for (const user of users) {
        for (const fm of testMatches) {
            await db.from('predictions').upsert({
                user_id: user.id,
                match_id: fm.id,
                home_score: randomScore(),
                away_score: randomScore(),
            }, { onConflict: 'user_id,match_id' })
            predsCreated++
        }
    }
    console.log(`🎯 Created ${predsCreated} predictions`)

    // 4. Score each match
    let scored = 0
    for (const fm of testMatches) {
        const { data: match } = await db.from('matches').select('*').eq('id', fm.id).single()
        if (!match) continue

        const { data: preds } = await db.from('predictions')
            .select('user_id, home_score, away_score').eq('match_id', fm.id)
        if (!preds) continue

        const results = preds.map(p => {
            const r = scoreMatch(p.home_score, p.away_score, match.home_score, match.away_score)
            return { user_id: p.user_id, points: r.total, isExact: r.type === 'exact', isCorrect: ['exact', 'correct', 'goal_diff'].includes(r.type) }
        })

        const userIds = results.map(r => r.user_id)
        const { data: memberships } = await db.from('group_members').select('user_id, group_id').in('user_id', userIds)

        if (!memberships || memberships.length === 0) {
            console.log(`⚠️  ${fm.id}: No group memberships — leaderboard won't update`)
            continue
        }

        for (const m of memberships) {
            const ur = results.find(r => r.user_id === m.user_id)
            if (!ur) continue

            const { data: existing } = await db.from('scores')
                .select('total_points, exact_scores, correct_results, streak')
                .eq('user_id', m.user_id).eq('group_id', m.group_id).single()

            if (existing) {
                await db.from('scores').update({
                    total_points: existing.total_points + ur.points,
                    exact_scores: existing.exact_scores + (ur.isExact ? 1 : 0),
                    correct_results: existing.correct_results + (ur.isCorrect ? 1 : 0),
                    streak: ur.isCorrect ? existing.streak + 1 : 0,
                }).eq('user_id', m.user_id).eq('group_id', m.group_id)
            } else {
                await db.from('scores').insert({
                    user_id: m.user_id, group_id: m.group_id,
                    total_points: ur.points, exact_scores: ur.isExact ? 1 : 0,
                    correct_results: ur.isCorrect ? 1 : 0, streak: ur.isCorrect ? 1 : 0,
                })
            }
            scored++
        }
        console.log(`📊 Scored ${fm.id}: ${preds.length} predictions`)
    }

    console.log(`\n✅ Done! ${testMatches.length} matches, ${predsCreated} predictions, ${scored} score entries\n`)
}

main().catch(console.error)
