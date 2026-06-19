-- ═══════════════════════════════════════════════════════
-- Constellations of Us — Supabase SQL Setup
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ── 1. CARDS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS cards (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    poem         TEXT NOT NULL,
    description  TEXT,
    image_url    TEXT,
    display_date TEXT,
    hearts       INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,        -- NULL = published immediately
    created_by   UUID,               -- Supabase auth user ID of admin
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. REACTIONS TABLE ──────────────────────────────────
-- Tracks individual reactions so users can only react once
CREATE TABLE IF NOT EXISTS reactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_identifier TEXT NOT NULL,   -- auth user ID or anon UUID
    reaction_type   TEXT NOT NULL DEFAULT 'heart' CHECK (reaction_type IN ('heart')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(card_id, user_identifier, reaction_type)  -- one reaction per user per card
);

-- ── 3. COMMENTS TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id    UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL,        -- Supabase auth user ID
    author     TEXT NOT NULL,        -- display name
    body       TEXT NOT NULL,
    parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,  -- NULL = top-level
    reply_to   TEXT,                 -- @name of the person being replied to
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Run these if upgrading an existing database:
-- ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
-- ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to TEXT;

-- ── 4. INDEXES ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cards_scheduled_at   ON cards(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_cards_created_at     ON cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_card_id    ON reactions(card_id);
CREATE INDEX IF NOT EXISTS idx_comments_card_id     ON comments(card_id);

-- ── 5. ROW LEVEL SECURITY ────────────────────────────────
-- All reads/writes go through our Laravel API using the SERVICE KEY,
-- so RLS blocks direct client access but allows the backend.

ALTER TABLE cards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (our Laravel backend uses service key)
-- No additional policies needed for backend-only access.

-- ── 6. UPDATED_AT TRIGGER ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cards_updated_at ON cards;
CREATE TRIGGER cards_updated_at
    BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 7. HELPER VIEW (admin use) ───────────────────────────
CREATE OR REPLACE VIEW cards_with_reactions AS
SELECT
    c.*,
    COUNT(r.id) FILTER (WHERE r.reaction_type = 'heart') AS heart_count,
    COUNT(cm.id) AS comment_count
FROM cards c
LEFT JOIN reactions r  ON r.card_id = c.id
LEFT JOIN comments  cm ON cm.card_id = c.id
GROUP BY c.id;

-- ── 8. CONVERSATIONS TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. CONVERSATION PARTICIPANTS ─────────────────────────
CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    last_read_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- ── 10. MESSAGES TABLE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL,
    sender_name     TEXT NOT NULL,
    sender_avatar   TEXT,
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_id         ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_id ON conversation_participants(user_id);

ALTER TABLE conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;

-- RLS policy so Supabase Realtime works with the user's JWT
CREATE POLICY "participants can read messages" ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
          AND cp.user_id = auth.uid()
    )
);

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ─────────────────────────────────────────────────────────
-- DONE! Tables created. Next steps:
-- 1. Register your admin account via POST /api/auth/register
-- 2. Get the user_id from Supabase Auth dashboard
-- 3. Call POST /api/auth/set-admin with X-Admin-Setup-Key header
-- ─────────────────────────────────────────────────────────
