const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=')
    if (k && v) acc[k.trim()] = v.join('=').trim()
    return acc
}, {})

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.VITE_SUPABASE_SECRET_ROLE_KEY
)

async function testFetchAll() {
    const query = supabase.from('predictions').select('*')
    
    // First await
    const res1 = await query.range(0, 999)
    console.log('First query returned:', res1.data?.length)
    
    // Second await
    const res2 = await query.range(1000, 1999)
    console.log('Second query returned:', res2.data?.length)
    
    // Are they the same?
    if (res1.data && res2.data && res1.data.length > 0 && res2.data.length > 0) {
        console.log('Is first item same?', res1.data[0].id === res2.data[0].id)
    }
}

testFetchAll().catch(console.error)
