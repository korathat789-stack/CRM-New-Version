import { createClient } from "@supabase/supabase-js";

// Service-role client. SERVER-ONLY trusted code (e.g. inviting users, admin
// tasks that must bypass RLS). Never import this into a Client Component.
// Throws if the service role key is not configured.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL for admin client."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
