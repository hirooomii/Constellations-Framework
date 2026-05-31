import { AuthSession, Card, Comment, Reaction } from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ── Session helpers ────────────────────────────────────────────────────────
export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('constellation_session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveSession(session: AuthSession) {
  localStorage.setItem('constellation_session', JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem('constellation_session');
}

export function getAnonId(): string {
  let id = localStorage.getItem('constellation_anon_id');
  if (!id) {
    id = 'anon_' + crypto.randomUUID();
    localStorage.setItem('constellation_anon_id', id);
  }
  return id;
}

// ── Core fetch ─────────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = false
): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (auth && session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && session?.refresh_token) {
    const refreshed = await tryRefresh(session.refresh_token);
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed.access_token}`;
      const retry = await fetch(`${BASE}${path}`, { ...options, headers });
      if (!retry.ok) throw new Error((await retry.json()).error || 'Request failed');
      return retry.json();
    }
    clearSession();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function tryRefresh(refreshToken: string): Promise<AuthSession | null> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const session = await res.json();
    saveSession(session);
    return session;
  } catch { return null; }
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const auth = {
  async register(email: string, password: string, username: string, displayName: string) {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, display_name: displayName }),
    });
  },

  async login(email: string, password: string): Promise<AuthSession> {
    const session = await apiFetch<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveSession(session);
    return session;
  },

  logout() { clearSession(); },
  getSession,
  getUser: () => getSession()?.user ?? null,
};

// ── Profiles ───────────────────────────────────────────────────────────────
export const profiles = {
  get: (username: string) =>
    apiFetch<{ profile: any; cards: Card[] }>(`/profiles/${username}`),

  update: (data: { display_name?: string; bio?: string; avatar_url?: string }) =>
    apiFetch('/profiles', { method: 'PATCH', body: JSON.stringify(data) }, true),
};

// ── Cards ──────────────────────────────────────────────────────────────────
export const cards = {
  list: (): Promise<Card[]> =>
    apiFetch('/cards'),

  get: (id: string): Promise<Card> =>
    apiFetch(`/cards/${id}`),

  scheduledList: (): Promise<Card[]> =>
    apiFetch('/admin/cards/scheduled', {}, true),

  create: (data: Partial<Card>): Promise<Card> =>
    apiFetch('/cards', { method: 'POST', body: JSON.stringify(data) }, true),

  update: (id: string, data: Partial<Card>): Promise<Card> =>
    apiFetch(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, true),

  delete: (id: string): Promise<void> =>
    apiFetch(`/cards/${id}`, { method: 'DELETE' }, true),

  publishNow: (id: string): Promise<Card> =>
    apiFetch(`/cards/${id}/publish-now`, { method: 'PATCH' }, true),

  toggleComments: (id: string): Promise<Card> =>
    apiFetch(`/cards/${id}/toggle-comments`, { method: 'PATCH' }, true),
};

// ── Reactions ──────────────────────────────────────────────────────────────
export const REACTION_TYPES = [
  { type: 'touched',   emoji: '🌸', label: 'Touched'   },
  { type: 'magical',   emoji: '💫', label: 'Magical'   },
  { type: 'brilliant', emoji: '🌟', label: 'Brilliant' },
  { type: 'beautiful', emoji: '⭐', label: 'Beautiful' },
  { type: 'dreamy',    emoji: '🌙', label: 'Dreamy'    },
  { type: 'powerful',  emoji: '☄️', label: 'Powerful'  },
] as const;

export type ReactionType = typeof REACTION_TYPES[number]['type'];

export const reactions = {
  get: (cardId: string): Promise<Reaction> =>
    apiFetch(`/cards/${cardId}/reactions`),

  toggle: (cardId: string, reactionType: ReactionType) => {
    const session = getSession();
    const userIdentifier = session?.user?.id ?? getAnonId();
    const hasToken = !!session?.access_token;
    return apiFetch(
      `/cards/${cardId}/reactions`,
      {
        method: 'POST',
        body: JSON.stringify({ reaction_type: reactionType, user_identifier: userIdentifier }),
      },
      hasToken
    );
  },
};

// ── Comments ───────────────────────────────────────────────────────────────
export const comments = {
  list: (cardId: string): Promise<Comment[]> =>
    apiFetch(`/cards/${cardId}/comments`),

  post: (cardId: string, body: string): Promise<Comment> =>
    apiFetch(
      `/cards/${cardId}/comments`,
      { method: 'POST', body: JSON.stringify({ body }) },
      true
    ),

  delete: (commentId: string): Promise<void> =>
    apiFetch(`/admin/comments/${commentId}`, { method: 'DELETE' }, true),
};