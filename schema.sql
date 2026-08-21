-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PostgreSQL Production Database Schema
-- VERSION: 1.0.0
-- ============================================================
--
-- هذا الملف هو الأساس الكامل للنظام.
--
-- لا توجد حسابات تجريبية.
-- لا توجد أرصدة تجريبية.
--
-- أول حساب حقيقي يتم تسجيله يحصل تلقائياً على OWNER.
-- جميع الحسابات التالية USER.
--
-- الصلاحيات الحقيقية تُفرض من Backend.
-- ============================================================

BEGIN;

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'user_role'
    ) THEN
        CREATE TYPE user_role AS ENUM (
            'owner',
            'admin',
            'moderator',
            'user'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'account_status'
    ) THEN
        CREATE TYPE account_status AS ENUM (
            'pending',
            'active',
            'suspended',
            'banned',
            'deleted'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'gender_type'
    ) THEN
        CREATE TYPE gender_type AS ENUM (
            'male',
            'female',
            'other',
            'unspecified'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'room_role'
    ) THEN
        CREATE TYPE room_role AS ENUM (
            'owner',
            'admin',
            'moderator',
            'member'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'message_type'
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
        SELECT 1 FROM pg_type WHERE typname = 'gift_rarity'
    ) THEN
        CREATE TYPE gift_rarity AS ENUM (
            'classic',
            'premium',
            'epic',
            'legendary',
            'mythic',
            'eternal'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'wallet_transaction_type'
    ) THEN
        CREATE TYPE wallet_transaction_type AS ENUM (
            'purchase',
            'gift_sent',
            'gift_received',
            'transfer_sent',
            'transfer_received',
            'level_reward',
            'vip_reward',
            'admin_credit',
            'admin_debit',
            'refund',
            'adjustment'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'report_status'
    ) THEN
        CREATE TYPE report_status AS ENUM (
            'open',
            'reviewing',
            'resolved',
            'rejected'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'notification_type'
    ) THEN
        CREATE TYPE notification_type AS ENUM (
            'system',
            'message',
            'gift',
            'coins',
            'level',
            'vip',
            'badge',
            'follow',
            'friend',
            'room',
            'moderation'
        );
    END IF;

END
$$;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username VARCHAR(30) NOT NULL,

    email VARCHAR(255),

    phone VARCHAR(30),

    password_hash TEXT NOT NULL,

    role user_role NOT NULL DEFAULT 'user',

    status account_status NOT NULL DEFAULT 'pending',

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,

    is_online BOOLEAN NOT NULL DEFAULT FALSE,

    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT users_username_length
        CHECK (
            char_length(username) BETWEEN 3 AND 30
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

CREATE INDEX IF NOT EXISTS users_role_idx
ON users(role);

CREATE INDEX IF NOT EXISTS users_status_idx
ON users(status);

CREATE INDEX IF NOT EXISTS users_created_idx
ON users(created_at DESC);

-- ============================================================
-- FIRST ACCOUNT = OWNER
--
-- يتم استخدام advisory transaction lock لمنع السباق
-- إذا سجل أكثر من مستخدم في نفس اللحظة.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_first_user_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    PERFORM pg_advisory_xact_lock(
        hashtext('afendina_first_owner_lock')
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

DROP TRIGGER IF EXISTS trg_assign_first_user_owner
ON users;

CREATE TRIGGER trg_assign_first_user_owner

BEFORE INSERT ON users

FOR EACH ROW

EXECUTE FUNCTION assign_first_user_owner();

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

    profile_frame_url TEXT,

    profile_effect_url TEXT,

    gender gender_type NOT NULL DEFAULT 'unspecified',

    birth_date DATE,

    country VARCHAR(100),

    city VARCHAR(100),

    website_url TEXT,

    profile_color VARCHAR(30),

    profile_theme VARCHAR(50)
        NOT NULL DEFAULT 'dark-luxury',

    show_online_status BOOLEAN
        NOT NULL DEFAULT TRUE,

    show_last_seen BOOLEAN
        NOT NULL DEFAULT TRUE,

    show_age BOOLEAN
        NOT NULL DEFAULT FALSE,

    show_gifts BOOLEAN
        NOT NULL DEFAULT TRUE,

    show_badges BOOLEAN
        NOT NULL DEFAULT TRUE,

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

    total_messages BIGINT NOT NULL DEFAULT 0,

    total_posts BIGINT NOT NULL DEFAULT 0,

    total_likes BIGINT NOT NULL DEFAULT 0,

    followers_count BIGINT NOT NULL DEFAULT 0,

    following_count BIGINT NOT NULL DEFAULT 0,

    friends_count BIGINT NOT NULL DEFAULT 0,

    gifts_sent_count BIGINT NOT NULL DEFAULT 0,

    gifts_received_count BIGINT NOT NULL DEFAULT 0,

    coins_earned BIGINT NOT NULL DEFAULT 0,

    coins_spent BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_stats_level_positive
        CHECK (level >= 1),

    CONSTRAINT user_stats_xp_positive
        CHECK (xp >= 0),

    CONSTRAINT user_stats_messages_positive
        CHECK (total_messages >= 0),

    CONSTRAINT user_stats_posts_positive
        CHECK (total_posts >= 0),

    CONSTRAINT user_stats_likes_positive
        CHECK (total_likes >= 0)
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

    CONSTRAINT wallets_balance_nonnegative
        CHECK (balance >= 0),

    CONSTRAINT wallets_earned_nonnegative
        CHECK (lifetime_earned >= 0),

    CONSTRAINT wallets_spent_nonnegative
        CHECK (lifetime_spent >= 0)
);

-- ============================================================
-- USER AUTO DEPENDENCIES
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_dependencies()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    INSERT INTO profiles (
        user_id,
        display_name
    )

    VALUES (
        NEW.id,
        NEW.username
    )

    ON CONFLICT (user_id)
    DO NOTHING;

    INSERT INTO user_stats (
        user_id
    )

    VALUES (
        NEW.id
    )

    ON CONFLICT (user_id)
    DO NOTHING;

    INSERT INTO wallets (
        user_id
    )

    VALUES (
        NEW.id
    )

    ON CONFLICT (user_id)
    DO NOTHING;

    RETURN NEW;

END;
$$;

DROP TRIGGER IF EXISTS trg_create_user_dependencies
ON users;

CREATE TRIGGER trg_create_user_dependencies

AFTER INSERT ON users

FOR EACH ROW

EXECUTE FUNCTION create_user_dependencies();

-- ============================================================
-- LEVELS
-- ============================================================

CREATE TABLE IF NOT EXISTS levels (

    id SERIAL PRIMARY KEY,

    level_number INTEGER NOT NULL UNIQUE,

    xp_required BIGINT NOT NULL,

    title VARCHAR(100) NOT NULL,

    reward_coins BIGINT NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT levels_number_positive
        CHECK (level_number >= 1),

    CONSTRAINT levels_xp_nonnegative
        CHECK (xp_required >= 0),

    CONSTRAINT levels_reward_nonnegative
        CHECK (reward_coins >= 0)
);

CREATE INDEX IF NOT EXISTS levels_xp_idx
ON levels(xp_required);

-- ============================================================
-- LEVEL REWARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS level_rewards (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    level_id INTEGER NOT NULL
        REFERENCES levels(id)
        ON DELETE CASCADE,

    reward_type VARCHAR(40) NOT NULL,

    reward_reference UUID,

    quantity INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT level_rewards_quantity_positive
        CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS level_rewards_level_idx
ON level_rewards(level_id);

-- ============================================================
-- LEVEL REWARD CLAIMS
--
-- تمنع استلام مكافأة المستوى أكثر من مرة.
-- ============================================================

CREATE TABLE IF NOT EXISTS level_reward_claims (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    level_id INTEGER NOT NULL
        REFERENCES levels(id)
        ON DELETE CASCADE,

    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, level_id)
);

CREATE INDEX IF NOT EXISTS level_reward_claims_user_idx
ON level_reward_claims(user_id);

-- ============================================================
-- BADGES
-- ============================================================

CREATE TABLE IF NOT EXISTS badges (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(60) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    description VARCHAR(500),

    icon_url TEXT,

    image_url TEXT,

    animation_url TEXT,

    rarity gift_rarity NOT NULL DEFAULT 'premium',

    sort_order INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS badges_rarity_idx
ON badges(rarity);

-- ============================================================
-- USER BADGES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_badges (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    badge_id UUID NOT NULL
        REFERENCES badges(id)
        ON DELETE CASCADE,

    is_featured BOOLEAN NOT NULL DEFAULT FALSE,

    awarded_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS user_badges_user_idx
ON user_badges(user_id);

-- ============================================================
-- VIP PLANS
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_plans (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    description TEXT,

    duration_days INTEGER NOT NULL,

    price_coins BIGINT NOT NULL DEFAULT 0,

    badge_id UUID
        REFERENCES badges(id)
        ON DELETE SET NULL,

    color VARCHAR(30),

    priority INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT vip_duration_positive
        CHECK (duration_days > 0),

    CONSTRAINT vip_price_nonnegative
        CHECK (price_coins >= 0)
);

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

    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_vip_dates_valid
        CHECK (expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS user_vip_user_idx
ON user_vip(user_id);

CREATE INDEX IF NOT EXISTS user_vip_active_idx
ON user_vip(is_active, expires_at);

-- ============================================================
-- VIP BENEFITS
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_benefits (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vip_plan_id UUID NOT NULL
        REFERENCES vip_plans(id)
        ON DELETE CASCADE,

    benefit_code VARCHAR(80) NOT NULL,

    benefit_value JSONB NOT NULL DEFAULT '{}'::jsonb,

    UNIQUE(vip_plan_id, benefit_code)
);

-- ============================================================
-- GIFTS
-- ============================================================

CREATE TABLE IF NOT EXISTS gifts (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(80) NOT NULL UNIQUE,

    name VARCHAR(120) NOT NULL,

    description VARCHAR(500),

    rarity gift_rarity NOT NULL DEFAULT 'classic',

    price_coins BIGINT NOT NULL,

    image_url TEXT NOT NULL,

    thumbnail_url TEXT,

    preview_url TEXT,

    animation_url TEXT,

    sound_url TEXT,

    category VARCHAR(60),

    sort_order INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    is_featured BOOLEAN NOT NULL DEFAULT FALSE,

    is_limited BOOLEAN NOT NULL DEFAULT FALSE,

    stock BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT gifts_price_positive
        CHECK (price_coins > 0),

    CONSTRAINT gifts_stock_valid
        CHECK (
            stock IS NULL
            OR stock >= 0
        )
);

CREATE INDEX IF NOT EXISTS gifts_rarity_idx
ON gifts(rarity);

CREATE INDEX IF NOT EXISTS gifts_category_idx
ON gifts(category);

CREATE INDEX IF NOT EXISTS gifts_active_idx
ON gifts(is_active);

CREATE INDEX IF NOT EXISTS gifts_featured_idx
ON gifts(is_featured);

-- ============================================================
-- GIFT EFFECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS gift_effects (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    gift_id UUID NOT NULL
        REFERENCES gifts(id)
        ON DELETE CASCADE,

    effect_type VARCHAR(50) NOT NULL,

    duration_ms INTEGER,

    effect_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    sort_order INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT gift_effects_duration_valid
        CHECK (
            duration_ms IS NULL
            OR duration_ms > 0
        )
);

CREATE INDEX IF NOT EXISTS gift_effects_gift_idx
ON gift_effects(gift_id);

-- ============================================================
-- USER GIFT INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS gift_inventory (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    gift_id UUID NOT NULL
        REFERENCES gifts(id)
        ON DELETE RESTRICT,

    quantity BIGINT NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, gift_id),

    CONSTRAINT gift_inventory_quantity_nonnegative
        CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS gift_inventory_user_idx
ON gift_inventory(user_id);

-- ============================================================
-- GIFT TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS gift_transactions (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    receiver_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    gift_id UUID NOT NULL
        REFERENCES gifts(id)
        ON DELETE RESTRICT,

    quantity INTEGER NOT NULL DEFAULT 1,

    unit_price BIGINT NOT NULL,

    total_price BIGINT NOT NULL,

    message_id UUID,

    room_id UUID,

    note VARCHAR(300),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT gift_quantity_positive
        CHECK (quantity > 0),

    CONSTRAINT gift_unit_price_positive
        CHECK (unit_price > 0),

    CONSTRAINT gift_total_price_valid
        CHECK (
            total_price = unit_price * quantity
        ),

    CONSTRAINT gift_no_self
        CHECK (
            sender_id <> receiver_id
        )
);

CREATE INDEX IF NOT EXISTS gift_transactions_sender_idx
ON gift_transactions(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gift_transactions_receiver_idx
ON gift_transactions(receiver_id, created_at DESC);

-- ============================================================
-- ROOMS
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    name VARCHAR(120) NOT NULL,

    slug VARCHAR(150) NOT NULL UNIQUE,

    description VARCHAR(500),

    avatar_url TEXT,

    cover_url TEXT,

    is_public BOOLEAN NOT NULL DEFAULT TRUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    max_members INTEGER NOT NULL DEFAULT 100,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NO
