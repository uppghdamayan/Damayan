import { createBrowserClient } from '@supabase/ssr';

// Browser talks to Supabase through our own domain (see next.config.ts
// rewrites) so networks that filter *.supabase.co directly don't block login.
// Falls back to the direct URL when no proxy is configured (e.g. local dev).
const SUPABASE_BROWSER_URL =
  process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

export const createSupabaseClient = () =>
  createBrowserClient(
    SUPABASE_BROWSER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
