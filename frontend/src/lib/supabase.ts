import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// For Realtime WebSocket subscriptions (messaging)
export function createRealtimeClient(accessToken: string) {
  const client = createClient(supabaseUrl, supabaseAnon, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  client.realtime.setAuth(accessToken);
  return client;
}

// Trigger OAuth redirect (Facebook, GitHub)
export async function signInWithProvider(provider: 'facebook' | 'github') {
  const client = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const scopes = provider === 'facebook' ? 'email,public_profile' : undefined;
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
      ...(scopes ? { scopes } : {}),
    },
  });
  if (error) throw new Error(error.message);
}

// Extract tokens from URL hash after OAuth redirect
export function extractOAuthTokens(): { access_token: string; refresh_token: string } | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.includes('access_token')) return null;
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const access_token = params.get('access_token');
  if (!access_token) return null;
  return { access_token, refresh_token: params.get('refresh_token') ?? '' };
}
