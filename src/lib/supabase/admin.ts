import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client using the secret/service-role key. Used ONLY to call the two privileged review
 * functions (migration 002), after the caller has been authenticated and authorised.
 * The key has no NEXT_PUBLIC_ prefix, so it is never sent to the browser. Do not import this in client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("admin client not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
