import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";

/**
 * Creates a Supabase client using the service_role key.
 * This bypasses Row Level Security — use only in admin API routes.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_SECRET_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or VITE_SUPABASE_SECRET_ROLE_KEY",
    );
  }

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Verify that the current request is from the admin user.
 * Returns the user if admin, null otherwise.
 */
export async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) {
    console.warn("ADMIN_USERNAME env var not set — admin access disabled");
    return null;
  }

  // Get the user's profile to check their username (display_name)
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.display_name.toLowerCase() !== adminUsername.toLowerCase()
  )
    return null;

  return user;
}
