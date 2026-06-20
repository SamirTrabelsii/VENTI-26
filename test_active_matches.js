const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
let url = '';
let key = '';

envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_SECRET_ROLE_KEY=')) key = line.split('=')[1].trim();
});

async function run() {
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    
    const query = `status=eq.live,and(status.eq.upcoming,kickoff.lte.${twoHoursFromNow},kickoff.gte.${fourHoursAgo})`;
    const res = await fetch(`${url}/rest/v1/matches?select=*&or=(${encodeURIComponent(query)})`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const matches = await res.json();
    console.log("Active matches for leaderboard:", matches.map(m => m.id));
}

run();
