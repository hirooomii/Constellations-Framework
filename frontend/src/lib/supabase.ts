import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createRealtimeClient(accessToken: string) {
  const client = createClient(supabaseUrl, supabaseAnon, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  client.realtime.setAuth(accessToken);
  return client;
}
