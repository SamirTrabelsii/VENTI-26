import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SECRET_ROLE_KEY;

if (!url || !key) {
    console.error("Missing SUPABASE URL or KEY");
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    console.log("Fetching stats...");
    
    // Using head to get count without fetching rows
    const { count: usersCount, error: err1 } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: scoresUsersCount, error: err4 } = await supabase.from('scores').select('*', { count: 'exact', head: true });
    const { count: predictionsCount, error: err2 } = await supabase.from('predictions').select('*', { count: 'exact', head: true });
    const { count: groupsCount, error: err3 } = await supabase.from('groups').select('*', { count: 'exact', head: true });
    
    console.log(`Users (from users table): ${usersCount} | error: ${err1?.message || 'none'}`);
    console.log(`Users (from scores table): ${scoresUsersCount} | error: ${err4?.message || 'none'}`);
    console.log(`Predictions: ${predictionsCount} | error: ${err2?.message || 'none'}`);
    console.log(`Groups: ${groupsCount} | error: ${err3?.message || 'none'}`);
}

run();
