const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const envLines = envContent.split('\n');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envLines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('VITE_SUPABASE_SECRET_ROLE_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: preds, error: e1 } = await supabase.from('predictions').select('*').order('updated_at', { ascending: false }).limit(5);
    console.log('Recent predictions:', preds);
    
    const { data: matches, error: e2 } = await supabase.from('matches').select('id, status, kickoff, home_team, away_team');
    console.log('All match statuses:');
    matches.forEach(m => {
        if (m.status !== 'upcoming') console.log(m.id, m.status, m.kickoff);
    });
}

main();
