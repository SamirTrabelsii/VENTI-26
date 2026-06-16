const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.VITE_SUPABASE_SECRET_ROLE_KEY
)

async function check() {
  const { data, error } = await supabase.from('matches').select('*')
  if (error) console.error(error)
  const finished = data.filter(d => d.status === 'finished')
  console.log(`Total matches in DB: ${data.length}`)
  console.log(`Finished matches in DB: ${finished.length}`)
  if (finished.length > 0) {
    console.log('Sample finished match:', finished[0])
  }
}

check()
