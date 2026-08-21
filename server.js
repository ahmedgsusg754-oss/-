-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PostgreSQL Database Schema
-- VERSION: 1.0.0
--
-- مهم جداً:
-- هذا الملف لا ينشئ:
-- - مستخدمين تجريبيين
-- - حسابات وهمية
-- - غرف وهمية
-- - أرصدة Coins للمستخدمين
-- - رسائل أو منشورات وهمية
--
-- أول حساب يتم تسجيله يصبح Owner تلقائياً بواسطة Trigger
-- داخل قاعدة البيانات.
--
-- شراء الغرفة = 50,000 Coins
-- أعلى سعر هدية = 200,000 Coins
-- المكافأة اليومية تبدأ من Level 5
-- الشارات الخاصة لا تُباع في المتجر.
-- ============================================================

BEGIN;

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'user_status'
    ) THEN
        CREATE TYPE user_status AS ENUM (
            'pending',
            'active',
            'suspended',
            'banned',
            'deleted'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'gender_type'
    ) THEN
        CREATE TYPE gender_type AS ENUM (
            'male',
            'female',
            'other',
            'unspecified'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'room_member_role'
    ) THEN
        CREATE TYPE room_member_role AS ENUM (
            'owner',
            'admin',
            'moderator',
            'member'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'message_type'
    ) THEN
        CREATE TYPE message_type AS ENUM (
            'text',
            'image',
            'video',
            'audio',
            'file',
            'gift',
            'system'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'report_status'
    ) THEN
        CREATE TYPE report_status AS ENUM (
            'pending',
            'reviewing',
            'resolved',
            'rejected'
        );
    END IF;

END $$;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username VARCHAR(30) NOT NULL,

    email VARCHAR(255),

    phone VARCHAR(30),

    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL DEFAULT 'user',

    status user_status NOT NULL DEFAULT 'pending',

    gender gender_type NOT NULL DEFAULT 'unspecified',

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,

    is_online BOOLEAN NOT NULL DEFAULT FALSE,

    last_seen_at TIMESTAMPTZ,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT users_username_length
        CHECK (
            char_length(username) BETWEEN 3 AND 30
        ),

    CONSTRAINT users_role_valid
        CHECK (
            role IN (
                'owner',
                'admin',
                'moderator',
                'user'
            )
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
ON users (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
ON users (LOWER(email))
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
ON users (phone)
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_status_idx
ON users(status);

CREATE INDEX IF NOT EXISTS users_created_at_idx
ON users(created_at);

-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    display_name VARCHAR(80),

    bio VARCHAR(500),

    avatar_url TEXT,

    cover_url TEXT,

    country VARCHAR(100),

    city VARCHAR(100),

    website_url TEXT,

    birth_date DATE,

    profile_color VARCHAR(30),

    profile_frame VARCHAR(100),

    profile_effect VARCHAR(100),

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,

    show_online_status BOOLEAN NOT NULL DEFAULT TRUE,

    show_last_seen BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER STATS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    level INTEGER NOT NULL DEFAULT 1,

    xp BIGINT NOT NULL DEFAULT 0,

    posts_count INTEGER NOT NULL DEFAULT 0,

    comments_count INTEGER NOT NULL DEFAULT 0,

    messages_count BIGINT NOT NULL DEFAULT 0,

    gifts_sent_count BIGINT NOT NULL DEFAULT 0,

    gifts_received_count BIGINT NOT NULL DEFAULT 0,

    coins_spent BIGINT NOT NULL DEFAULT 0,

    rooms_owned INTEGER NOT NULL DEFAULT 0,

    rooms_joined INTEGER NOT NULL DEFAULT 0,

    followers_count INTEGER NOT NULL DEFAULT 0,

    following_count INTEGER NOT NULL DEFAULT 0,

    reputation BIGINT NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_stats_level_positive
        CHECK (level >= 1),

    CONSTRAINT user_stats_xp_positive
        CHECK (xp >= 0)
);

-- ============================================================
-- WALLETS
-- ============================================================

CREATE TABLE IF NOT EXISTS wallets (
    user_id UUID PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    balance BIGINT NOT NULL DEFAULT 0,

    lifetime_earned BIGINT NOT NULL DEFAULT 0,

    lifetime_spent BIGINT NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT wallets_balance_positive
        CHECK (balance >= 0),

    CONSTRAINT wallets_lifetime_earned_positive
        CHECK (lifetime_earned >= 0),

    CONSTRAINT wallets_lifetime_spent_positive
        CHECK (lifetime_spent >= 0)
);

-- ============================================================
-- LEVELS
-- ============================================================

CREATE TABLE IF NOT EXISTS levels (
    level_number INTEGER PRIMARY KEY,

    title VARCHAR(100) NOT NULL,

    xp_required BIGINT NOT NULL,

    reward_coins BIGINT NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT levels_number_positive
        CHECK (level_number >= 1),

    CONSTRAINT levels_xp_positive
        CHECK (xp_required >= 0),

    CONSTRAINT levels_reward_positive
        CHECK (reward_coins >= 0)
);

-- ============================================================
-- LEVEL REWARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS level_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    level_number INTEGER NOT NULL
        REFERENCES levels(level_number)
        ON DELETE CASCADE,

    reward_type VARCHAR(50) NOT NULL,

    reward_value JSONB NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS level_rewards_level_idx
ON level_rewards(level_number);

-- ============================================================
-- LEVEL REWARD CLAIMS
-- ============================================================

CREATE TABLE IF NOT EXISTS level_reward_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    level_number INTEGER NOT NULL
        REFERENCES levels(level_number)
        ON DELETE RESTRICT,

    reward_id UUID
        REFERENCES level_rewards(id)
        ON DELETE SET NULL,

    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        user_id,
        level_number,
        reward_id
    )
);

CREATE INDEX IF NOT EXISTS level_reward_claims_user_idx
ON level_reward_claims(user_id);

-- ============================================================
-- BADGES
-- ============================================================

CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(100) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    description VARCHAR(500),

    icon_url TEXT,

    rarity VARCHAR(50),

    level_required INTEGER,

    is_special BOOLEAN NOT NULL DEFAULT FALSE,

    is_purchasable BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT badge_purchase_rule
        CHECK (
            is_special = TRUE
            OR is_purchasable = FALSE
            OR is_purchasable = TRUE
        )
);

CREATE INDEX IF NOT EXISTS badges_level_idx
ON badges(level_required);

-- ============================================================
-- USER BADGES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_badges (
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    badge_id UUID NOT NULL
        REFERENCES badges(id)
        ON DELETE CASCADE,

    awarded_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        badge_id
    )
);

CREATE INDEX IF NOT EXISTS user_badges_user_idx
ON user_badges(user_id);

-- ============================================================
-- VIP PLANS
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(100) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    description VARCHAR(500),

    price_coins BIGINT NOT NULL,

    duration_days INTEGER NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT vip_price_positive
        CHECK (price_coins > 0),

    CONSTRAINT vip_duration_positive
        CHECK (duration_days > 0)
);

-- ============================================================
-- VIP BENEFITS
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vip_plan_id UUID NOT NULL
        REFERENCES vip_plans(id)
        ON DELETE CASCADE,

    benefit_code VARCHAR(100) NOT NULL,

    benefit_value JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vip_benefits_plan_idx
ON vip_benefits(vip_plan_id);

-- ============================================================
-- USER VIP
-- ============================================================

CREATE TABLE IF NOT EXISTS user_vip (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    vip_plan_id UUID NOT NULL
        REFERENCES vip_plans(id)
        ON DELETE RESTRICT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_vip_user_idx
ON user_vip(user_id);

CREATE INDEX IF NOT EXISTS user_vip_active_idx
ON user_vip(user_id, is_active);

-- ============================================================
-- GIFTS
-- ============================================================

CREATE TABLE IF NOT EXISTS gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(100) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    description VARCHAR(500),

    image_url TEXT,

    animation_url TEXT,

    category VARCHAR(100),

    price_coins BIGINT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    is_limited BOOLEAN NOT NULL DEFAULT FALSE,

    stock BIGINT,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT gifts_price_positive
        CHECK (
            price_coins > 0
            AND price_coins <= 200000
        ),

    CONSTRAINT gifts_stock_valid
        CHECK (
            (
                is_limited = FALSE
                AND stock IS NULL
            )
            OR
            (
                is_limited = TRUE
                AND stock IS NOT NULL
                AND stock >= 0
            )
        )
);

CREATE INDEX IF NOT EXISTS gifts_active_sort_idx
ON gifts(is_active, sort_order, price_coins);

-- ============================================================
-- GIFT EFFECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS gift_effects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    gift_id UUID NOT NULL
        REFERENCES gifts(id)
        ON DELETE CASCADE,

    effect_type VARCHAR(100) NOT NULL,

    effect_config JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gift_effects_gift_idx
ON gift_effects(gift_id);

-- ============================================================
-- GIFT INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS gift_inventory (
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    gift_id UUID NOT NULL
        REFERENCES gifts(id)
        ON DELETE CASCADE,

    quantity BIGINT NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        gift_id
    ),

    CONSTRAINT gift_inventory_quantity
        CHECK (quantity >= 0)
);

-- ============================================================
-- ROOMS
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    name VARCHAR(100) NOT NULL,

    slug VARCHAR(120) NOT NULL UNIQUE,

    description VARCHAR(1000),

    avatar_url TEXT,

    cover_url TEXT,

    is_public BOOLEAN NOT NULL DEFAULT TRUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    max_members INTEGER NOT NULL DEFAULT 100,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rooms_name_valid
        CHECK (
            char_length(trim(name)) >= 2
        ),

    CONSTRAINT rooms_max_members_valid
        CHECK (
            max_members > 0
        )
);

CREATE INDEX IF NOT EXISTS rooms_owner_idx
ON rooms(owner_id);

CREATE INDEX IF NOT EXISTS rooms_active_idx
ON rooms(is_active);

-- ============================================================
-- ROOM MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_members (
    room_id UUID NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role room_member_role NOT NULL DEFAULT 'member',

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_seen_at TIMESTAMPTZ,

    muted_until TIMESTAMPTZ,

    PRIMARY KEY (
        room_id,
        user_id
    )
);

CREATE INDEX IF NOT EXISTS room_members_user_idx
ON room_members(user_id);

-- ============================================================
-- CONVERSATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    type VARCHAR(30) NOT NULL DEFAULT 'private',

    title VARCHAR(150),

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONVERSATION MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_read_at TIMESTAMPTZ,

    PRIMARY KEY (
        conversation_id,
        user_id
    )
);

CREATE INDEX IF NOT EXISTS conversation_members_user_idx
ON conversation_members(user_id);

-- ============================================================
-- MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    conversation_id UUID
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    room_id UUID
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    sender_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    type message_type NOT NULL DEFAULT 'text',

    body TEXT,

    media_url TEXT,

    reply_to_id UUID
        REFERENCES messages(id)
        ON DELETE SET NULL,

    gift_transaction_id UUID,

    is_edited BOOLEAN NOT NULL DEFAULT FALSE,

    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT messages_destination
        CHECK (
            conversation_id IS NOT NULL
            OR room_id IS NOT NULL
        )
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx
ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS messages_room_idx
ON messages(room_id, created_at);

CREATE INDEX IF NOT EXISTS messages_sender_idx
ON messages(sender_id);

-- ============================================================
-- POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    body TEXT,

    media_url TEXT,

    visibility VARCHAR(30) NOT NULL DEFAULT 'public',

    comments_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    likes_count BIGINT NOT NULL DEFAULT 0,

    comments_count BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_user_idx
ON posts(user_id, created_at DESC);

-- ============================================================
-- COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    parent_id UUID
        REFERENCES comments(id)
        ON DELETE CASCADE,

    body TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_post_idx
ON comments(post_id, created_at);

-- ============================================================
-- POST LIKES
-- ============================================================

CREATE TABLE IF NOT EXISTS post_likes (
    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
