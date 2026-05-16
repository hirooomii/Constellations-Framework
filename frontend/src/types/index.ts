export type UserRole = 'admin' | 'registered' | 'guest';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
}

export interface Card {
  id: string;
  title: string;
  poem: string;
  description: string | null;
  image_url: string | null;
  display_date: string | null;
  hearts: number;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reaction {
  counts: { heart?: number };
  mine: string[];  // reaction types the current user has made
}

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface ApiError {
  error: string;
}
