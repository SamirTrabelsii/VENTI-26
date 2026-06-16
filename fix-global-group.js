const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=')
    if (k && v) acc[k.trim()] = v.join('=').trim()
    return acc
}, {})

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.VITE_SUPABASE_SECRET_ROLE_KEY
)

async function run() {
    // 1. Create a Global group
    const { data: globalGroup, error: groupErr } = await supabase
        .from('groups')
        .insert({
            name: 'Global Leaderboard',
            description: 'System group for all registered users',
            invite_code: 'GLOBAL',
            created_by: '00000000-0000-0000-0000-000000000000' // dummy or null if schema allows, actually let's just pick the first user
        })
        .select()
        .single()

    let groupId;
    if (groupErr) {
        // If it fails, maybe the group already exists or created_by must be valid
        console.log('Group creation failed, finding first user to act as creator...')
        const { data: users } = await supabase.from('profiles').select('id').limit(1)
        const creatorId = users[0].id
        const { data: g2, error: err2 } = await supabase
            .from('groups')
            .insert({
                name: 'Global Leaderboard',
                description: 'System group for all registered users',
                invite_code: 'GLOBAL26',
                created_by: creatorId
            })
            .select()
            .single()
        
        if (err2) {
            console.error('Failed again:', err2)
            // Just find an existing group if we really can't create one
            const { data: existing } = await supabase.from('groups').select('id').limit(1)
            groupId = existing[0].id
        } else {
            groupId = g2.id
        }
    } else {
        groupId = globalGroup.id
    }

    console.log('Using Group ID for Global:', groupId)

    // 2. Add all users to this group
    const { data: profiles } = await supabase.from('profiles').select('id')
    const membersToInsert = profiles.map(p => ({
        group_id: groupId,
        user_id: p.id,
        role: 'member'
    }))

    // Use upsert to avoid duplicate key errors if some are already members
    for (const m of membersToInsert) {
        await supabase.from('group_members').upsert(m, { onConflict: 'group_id,user_id' })
    }
    console.log(`Added ${membersToInsert.length} users to the Global group.`)
}

run().catch(console.error)
