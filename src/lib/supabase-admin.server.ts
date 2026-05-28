/**
 * Tolerant server-side Supabase client.
 *
 * Prefers the service-role key when available (bypasses RLS), but for the
 * permissive demo RLS we accept the publishable key as a fallback so the
 * server routes work even without the service-role key being set.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function build() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!key ? ["SUPABASE_PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    throw new Error(`[supabase-admin] missing env: ${missing.join(", ")}`);
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cached: ReturnType<typeof build> | undefined;
export const supabaseAdmin = new Proxy({} as ReturnType<typeof build>, {
  get(_t, prop, recv) {
    if (!cached) cached = build();
    return Reflect.get(cached, prop, recv);
  },
});
