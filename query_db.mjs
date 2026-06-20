import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SECRET_ROLE_KEY;

if (!url || !key) {
    console.error("Missing SUPABASE URL or KEY");
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    const { data: groups, error: gError } = await supabase.from('groups').select('*');
    if (gError) console.error("Groups error:", gError);
    else console.log("Groups:", groups);

    const { data: scores, error: sError } = await supabase.from('scores').select('*').limit(20);
    if (sError) console.error("Scores error:", sError);
    else console.log("Scores sample:", scores);
}

run();
