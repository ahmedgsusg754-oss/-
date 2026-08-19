-- =========================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PostgreSQL Database Schema
-- =========================================================
-- قاعدة بيانات حقيقية للمشروع.
--
-- لا يتم إنشاء:
--   مستخدمين وهميين
--   منشورات وهمية
--   رسائل وهمية
--   أرصدة وهمية
--   بيانات تجريبية
--
-- أول حساب حقيقي يتم إنشاؤه يحصل على owner.
-- الحسابات التالية تحصل على user.
-- =========================================================


BEGIN;


-- =========================================================
-- EXTENSIONS
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username VARCHAR(30) NOT NULL,
    email VARCHAR(320) NOT NULL,
    password_hash TEXT NOT NULL,

    display_name VARCHAR(80) NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (role IN ('owner', 'admin', 'moderator', 'user')),

    avatar_url TEXT,
    cover_url TEXT,
    bio VARCHAR(500),

    birth_date DATE,

    gender VARCHAR(30),

    country VARCHAR(100),
    city VARCHAR(100),

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,

    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_username_length
        CHECK (char_length(username) BETWEEN 3 AND 30),

    CONSTRAINT users_email_length
        CHECK (char_length(email) BETWEEN 5 AND 320),

    CONSTRAINT users_display_name_length
        CHECK (char_length(display_name) BETWEEN 1 AND 80)
);


-- =========================================================
-- UNIQUE USER DATA
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS
users_username_unique_idx
ON users (LOWER(username));


CREATE UNIQUE INDEX IF NOT EXISTS
users_email_unique_idx
ON users (LOWER(email));


-- لا يمكن وجود أكثر من Owner واحد.
CREATE UNIQUE INDEX IF NOT EXISTS
users_single_owner_idx
ON users (role)
WHERE role = 'owner';


-- =========================================================
-- FIRST USER = OWNER
-- =========================================================
-- يتم استخدام advisory transaction lock لمنع race condition
-- إذا حاول حسابان التسجيل في نفس اللحظة.

CREATE OR REPLACE FUNCTION assign_first_user_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            'afendina:first-user-owner',
            0
        )
    );

    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE role = 'owner'
    ) THEN

        NEW.role := 'owner';

    ELSE

        NEW.role := 'user';

    END IF;

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS
users_first_owner_trigger
ON users;


CREATE TRIGGER
users_first_owner_trigger
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_first_user_owner();


-- =========================================================
-- USER SESSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL,

    ip_address INET,
    user_agent TEXT,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    revoked_at TIMESTAMPTZ
);


CREATE UNIQUE INDEX IF NOT EXISTS
user_sessions_token_hash_idx
ON user_sessions(token_hash);


CREATE INDEX IF NOT EXISTS
user_sessions_user_idx
ON user_sessions(user_id);


CREATE INDEX IF NOT EXISTS
user_sessions_expiry_idx
ON user_sessions(expires_at);


-- =========================================================
-- PASSWORD RESET TOKENS
-- =========================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE UNIQUE INDEX IF NOT EXISTS
password_reset_token_hash_idx
ON password_reset_tokens(token_hash);


-- =========================================================
-- POSTS
-- =========================================================

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    content TEXT,

    visibility VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (
            visibility IN (
                'public',
                'followers',
                'private'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT posts_content_or_media
        CHECK (
            content IS NOT NULL
            OR EXISTS (
                SELECT 1
            )
        )
);


CREATE INDEX IF NOT EXISTS
posts_user_created_idx
ON posts(user_id, created_at DESC);


CREATE INDEX IF NOT EXISTS
posts_created_idx
ON posts(created_at DESC);


-- =========================================================
-- POST MEDIA
-- =========================================================

CREATE TABLE IF NOT EXISTS post_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    media_url TEXT NOT NULL,

    media_type VARCHAR(30) NOT NULL,

    mime_type VARCHAR(100),

    file_size BIGINT,

    width INTEGER,

    height INTEGER,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
post_media_post_idx
ON post_media(post_id);


-- =========================================================
-- POST LIKES
-- =========================================================

CREATE TABLE IF NOT EXISTS post_likes (
    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY(post_id, user_id)
);


-- =========================================================
-- POST COMMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    parent_comment_id UUID
        REFERENCES post_comments(id)
        ON DELETE CASCADE,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ
);


CREATE INDEX IF NOT EXISTS
post_comments_post_idx
ON post_comments(post_id, created_at);


-- =========================================================
-- FOLLOWERS
-- =========================================================

CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    following_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY(
        follower_id,
        following_id
    ),

    CONSTRAINT follows_no_self_follow
        CHECK (
            follower_id <> following_id
        )
);


CREATE INDEX IF NOT EXISTS
follows_following_idx
ON follows(following_id);


-- =========================================================
-- BLOCKS
-- =========================================================

CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    blocked_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY(
        blocker_id,
        blocked_id
    ),

    CONSTRAINT blocks_no_self_block
        CHECK (
            blocker_id <> blocked_id
        )
);


-- =========================================================
-- CONVERSATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    type VARCHAR(20) NOT NULL DEFAULT 'direct'
        CHECK (
            type IN (
                'direct',
                'group'
            )
        ),

    name VARCHAR(100),

    avatar_url TEXT,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- CONVERSATION MEMBERS
-- =========================================================

CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (
            role IN (
                'owner',
                'admin',
                'member'
            )
        ),

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    left_at TIMESTAMPTZ,

    last_read_at TIMESTAMPTZ,

    PRIMARY KEY(
        conversation_id,
        user_id
    )
);


CREATE INDEX IF NOT EXISTS
conversation_members_user_idx
ON conversation_members(user_id);


-- =========================================================
-- MESSAGES
-- =========================================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    conversation_id UUID NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    sender_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    content TEXT,

    message_type VARCHAR(20) NOT NULL DEFAULT 'text'
        CHECK (
            message_type IN (
                'text',
                'image',
                'video',
                'audio',
                'file',
                'system'
            )
        ),

    reply_to_id UUID
        REFERENCES messages(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    edited_at TIMESTAMPTZ,

    deleted_at TIMESTAMPTZ
);


CREATE INDEX IF NOT EXISTS
messages_conversation_created_idx
ON messages(
    conversation_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
messages_sender_idx
ON messages(sender_id);


-- =========================================================
-- MESSAGE MEDIA
-- =========================================================

CREATE TABLE IF NOT EXISTS message_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    message_id UUID NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    media_url TEXT NOT NULL,

    mime_type VARCHAR(100),

    file_size BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- MESSAGE READS
-- =========================================================

CREATE TABLE IF NOT EXISTS message_reads (
    message_id UUID NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY(
        message_id,
        user_id
    )
);


-- =========================================================
-- NOTIFICATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    actor_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    type VARCHAR(50) NOT NULL,

    title VARCHAR(200),

    body TEXT,

    entity_type VARCHAR(50),

    entity_id UUID,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    read_at TIMESTAMPTZ
);


CREATE INDEX IF NOT EXISTS
notifications_user_created_idx
ON notifications(
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
notifications_unread_idx
ON notifications(
    user_id,
    is_read
);


-- =========================================================
-- GROUPS
-- =========================================================

CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    name VARCHAR(100) NOT NULL,

    description VARCHAR(1000),

    avatar_url TEXT,

    cover_url TEXT,

    visibility VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (
            visibility IN (
                'public',
                'private'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
groups_owner_idx
ON groups(owner_id);


-- =========================================================
-- GROUP MEMBERS
-- =========================================================

CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID NOT NULL
        REFERENCES groups(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (
            role IN (
                'owner',
                'admin',
                'moderator',
                'member'
            )
        ),

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY(
        group_id,
        user_id
    )
);


CREATE INDEX IF NOT EXISTS
group_members_user_idx
ON group_members(user_id);


-- =========================================================
-- REPORTS
-- =========================================================

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reporter_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reported_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    post_id UUID
        REFERENCES posts(id)
        ON DELETE SET NULL,

    message_id UUID
        REFERENCES messages(id)
        ON DELETE SET NULL,

    reason VARCHAR(100) NOT NULL,

    details TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'resolved',
                'rejected'
            )
        ),

    reviewed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
reports_status_idx
ON reports(status, created_at DESC);


-- =========================================================
-- USER SETTINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    profile_visibility VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (
            profile_visibility IN (
                'public',
                'private'
            )
        ),

    show_online_status BOOLEAN NOT NULL DEFAULT TRUE,

    allow_messages BOOLEAN NOT NULL DEFAULT TRUE,

    allow_notifications BOOLEAN NOT NULL DEFAULT TRUE,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- USER DEVICES
-- =========================================================

CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    device_name VARCHAR(100),

    device_type VARCHAR(50),

    push_token TEXT,

    last_active_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    revoked_at TIMESTAMPTZ
);


CREATE INDEX IF NOT EXISTS
user_devices_user_idx
ON user_devices(user_id);


-- =========================================================
-- AUDIT LOG
-- =========================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(50),

    entity_id UUID,

    ip_address INET,

    user_agent TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
audit_logs_actor_idx
ON audit_logs(actor_id, created_at DESC);


CREATE INDEX IF NOT EXISTS
audit_logs_created_idx
ON audit_logs(created_at DESC);


-- =========================================================
-- UPDATED_AT FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.updated_at := NOW();

    RETURN NEW;

END;
$$;


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

DROP TRIGGER IF EXISTS
users_updated_at_trigger
ON users;


CREATE TRIGGER
users_updated_at_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
posts_updated_at_trigger
ON posts;


CREATE TRIGGER
posts_updated_at_trigger
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
conversations_updated_at_trigger
ON conversations;


CREATE TRIGGER
conversations_updated_at_trigger
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
groups_updated_at_trigger
ON groups;


CREATE TRIGGER
groups_updated_at_trigger
BEFORE UPDATE ON groups
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
user_settings_updated_at_trigger
ON user_settings;


CREATE TRIGGER
user_settings_updated_at_trigger
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- BASIC INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS
users_role_idx
ON users(role);


CREATE INDEX IF NOT EXISTS
users_active_idx
ON users(is_active, is_banned);


CREATE INDEX IF NOT EXISTS
users_last_seen_idx
ON users(last_seen_at);


-- =========================================================
-- END
-- =========================================================

COMMIT;
