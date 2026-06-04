import { writeFileSync } from 'fs'
import { GROUP_MATCHES } from '../src/lib/wc2026-data'

const values = GROUP_MATCHES.map(m => {
  return `('${m.id}', '${m.group_label}', ${m.match_number}, '${m.home_team}', '${m.away_team}', '${m.home_flag}', '${m.away_flag}', '${m.kickoff}', '${m.venue.replace(/'/g, "''")}', '${m.city.replace(/'/g, "''")}')`
}).join(',\n')

const sql = `
-- Seed file for WC 2026 Matches
INSERT INTO matches (id, group_label, match_number, home_team, away_team, home_flag, away_flag, kickoff, venue, city)
VALUES
${values}
ON CONFLICT (id) DO NOTHING;
`

writeFileSync('supabase/seed.sql', sql.trim())
console.log('Generated supabase/seed.sql')
