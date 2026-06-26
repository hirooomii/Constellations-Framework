export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface User {
  id: string;
  email: string;
  role: 'guest' | 'registered' | 'admin';
  username?: string;
  display_name?: string;
  birthday?: string;
  avatar_url?: string;
  bio?: string;
  zodiac_sign?: string;      
  birthday_public?: boolean; 
}

export interface Card {
  id: string;
  title: string;
  poem: string;
  description?: string;
  image_url?: string;
  display_date?: string;
  hearts?: number;
  scheduled_at?: string | null;
  created_at?: string;
  author_id?: string;
  author_username?: string;
  author_display_name?: string;
  author_avatar_url?: string; 
  comments_enabled?: boolean;
  reaction_count?: number;
  reaction_counts?: Record<string, number>;
  last_edited_at?: string | null;
}

export interface Comment {
  id: string;
  card_id: string;
  user_id?: string;
  author: string;
  body: string;
  created_at: string;
  avatar_url?: string;
  parent_id?: string | null;
  reply_to?: string | null;
  replies?: Comment[];
}

export interface MessageReaction {
  count: number;
  mine: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string | null;
  body: string;
  created_at: string;
  parent_id?: string | null;
  reply_to_name?: string | null;
  reply_preview?: string | null;
  reactions?: Record<string, MessageReaction>;
}

export interface ConversationMember {
  user_id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string | null;
  other_user?: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  } | null;
  members?: ConversationMember[];
  last_message?: Message | null;
  unread_count: number;
}

export interface Reaction {
  counts: Record<string, number>;
  mine: string[];
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  birthday?: string;
  zodiac_sign?: string;
  birthday_public?: boolean;
  created_at?: string;
  followers_count?: number;
  following_count?: number;
}