import { createSupabaseClient } from './supabase/client';

const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase = createSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  });

  if (options.body instanceof FormData) {
    headers.delete('Content-Type');
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Force redirect to login on session expiry or unauthorized
      if (typeof window !== 'undefined') {
        supabase.auth.signOut().then(() => {
          window.location.href = '/login';
        });
      }
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
