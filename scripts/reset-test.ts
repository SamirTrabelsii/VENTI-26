/**
 * reset-test.ts — CLI test data cleanup
 *
 * Usage:
 *   npx tsx scripts/reset-test.ts          # partial reset (test matches only)
 *   npx tsx scripts/reset-test.ts --full   # full reset (everything)
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, VITE_SUPABASE_SECRET_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SECRET_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and VITE_SUPABASE_SECRET_ROLE_KEY')
    process.exit(1)
}

const db = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_MATCH_IDS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']

async function main() {
    const isFull = process.argv.includes('--full')

    console.log(`\n🧹 Running ${isFull ? 'FULL' : 'partial'} reset...\n`)

    if (isFull) {
        // Reset ALL matches
        const { error: matchErr } = await db
            .from('matches')
            .update({ home_score: null, away_score: null, status: 'upcoming', minute: null })
            .neq('id', '__never__')

        if (matchErr) console.log(`⚠️  Match reset error: ${matchErr.message}`)
        else console.log('✅ All matches reset to upcoming')

        // Delete ALL predictions
        const { data: p } = await db.from('predictions').delete()
            .neq('id', '00000000-0000-0000-0000-000000000000').select('id')
        console.log(`✅ Deleted ${p?.length ?? 0} predictions`)

        // Delete ALL scores
        const { data: s } = await db.from('scores').delete()
            .neq('user_id', '00000000-0000-0000-0000-000000000000').select('user_id')
        console.log(`✅ Deleted ${s?.length ?? 0} score entries`)

    } else {
        // Reset test matches only
        const { error: matchErr } = await db
            .from('matches')
            .update({ home_score: null, away_score: null, status: 'upcoming', minute: null })
            .in('id', TEST_MATCH_IDS)

        if (matchErr) console.log(`⚠️  Match reset error: ${matchErr.message}`)
        else console.log(`✅ Reset ${TEST_MATCH_IDS.length} test matches`)

        // Delete test predictions
        const { data: p } = await db.from('predictions').delete()
            .in('match_id', TEST_MATCH_IDS).select('id')
        console.log(`✅ Deleted ${p?.length ?? 0} test predictions`)

        // Reset all scores
        const { data: s } = await db.from('scores').delete()
            .neq('user_id', '00000000-0000-0000-0000-000000000000').select('user_id')
        console.log(`✅ Reset ${s?.length ?? 0} score entries`)
    }

    console.log('\n✅ Reset complete!\n')
}

main().catch(console.error)
