import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SECRET_ROLE_KEY;

const supabase = createClient(url, key);

async function run() {
    console.log("Fetching auth users...");
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
        console.error("Error fetching auth users:", authError);
    } else {
        console.log(`Auth Users Count: ${users.length}`);
    }
    
    // Let's also check if there is a 'profiles' table
    const { count: profilesCount, error: pError } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    console.log(`Profiles Count: ${profilesCount} | error: ${pError?.message || 'none'}`);
}

run();
