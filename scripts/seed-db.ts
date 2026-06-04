import { createClient } from '@supabase/supabase-js'
import { GROUP_MATCHES } from '../src/lib/wc2026-data'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SECRET_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seed() {
  console.log(`Seeding ${GROUP_MATCHES.length} matches...`)
  
  const { data, error } = await supabase
    .from('matches')
    .upsert(
      GROUP_MATCHES.map(m => ({
        id: m.id,
        group_label: m.group_label,
        match_number: m.match_number,
        home_team: m.home_team,
        away_team: m.away_team,
        home_flag: m.home_flag,
        away_flag: m.away_flag,
        kickoff: m.kickoff,
        venue: m.venue,
        city: m.city,
        status: 'upcoming'
      }))
    )

  if (error) {
    console.error('Error seeding matches:', error)
  } else {
    console.log('Successfully seeded matches!')
  }
}

seed()
