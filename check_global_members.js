const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
let url = '';
let key = '';

envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_SECRET_ROLE_KEY=')) key = line.split('=')[1].trim();
});

async function run() {
    const res = await fetch(`${url}/rest/v1/group_members?group_id=eq.cc291d5e-0d65-4a6a-924d-a2cfa7b64e72`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const members = await res.json();
    console.log("Global group members count:", members.length);
}

run();
