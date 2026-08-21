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

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        post_id,
        user_id
    )
);

-- ============================================================
-- FOLLOWS
-- ============================================================

CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    following_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        follower_id,
        following_id
    ),

    CONSTRAINT follows_not_self
        CHECK (
            follower_id <> following_id
        )
);

-- ============================================================
-- FRIEND REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    receiver_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT friend_request_not_self
        CHECK (
            sender_id <> receiver_id
        )
);

CREATE INDEX IF NOT EXISTS friend_requests_receiver_idx
ON friend_requests(receiver_id, status);

-- ============================================================
-- BLOCKS
-- ============================================================

CREATE TABLE IF NOT EXISTS blocks (
    blocker_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    blocked_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        blocker_id,
        blocked_id
    ),

    CONSTRAINT blocks_not_self
        CHECK (
            blocker_id <> blocked_id
        )
);

-- ============================================================
-- WALLET TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    type VARCHAR(60) NOT NULL,

    amount BIGINT NOT NULL,

    balance_before BIGINT NOT NULL,

    balance_after BIGINT NOT NULL,

    reference_id UUID,

    reference_type VARCHAR(60),

    description VARCHAR(500),

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT wallet_transactions_amount_positive
        CHECK (amount > 0),

    CONSTRAINT wallet_transactions_balance_valid
        CHECK (
            balance_before >= 0
            AND balance_after >= 0
        )
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx
ON wallet_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_transactions_reference_idx
ON wallet_transactions(reference_id);

-- ============================================================
-- COIN TRANSFERS
-- ============================================================

CREATE TABLE IF NOT EXISTS coin_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    receiver_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    amount BIGINT NOT NULL,

    sender_balance_before BIGINT NOT NULL,

    sender_balance_after BIGINT NOT NULL,

    receiver_balance_before BIGINT NOT NULL,

    receiver_balance_after BIGINT NOT NULL,

    note VARCHAR(500),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT coin_transfer_positive
        CHECK (amount > 0),

    CONSTRAINT coin_transfer_not_self
        CHECK (
            sender_id <> receiver_id
        )
);

CREATE INDEX IF NOT EXISTS coin_transfers_sender_idx
ON coin_transfers(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coin_transfers_receiver_idx
ON coin_transfers(receiver_id, created_at DESC);

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

    quantity BIGINT NOT NULL,

    unit_price BIGINT NOT NULL,

    total_price BIGINT NOT NULL,

    conversation_id UUID
        REFERENCES conversations(id)
        ON DELETE SET NULL,

    room_id UUID
        REFERENCES rooms(id)
        ON DELETE SET NULL,

    note VARCHAR(500),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT gift_transaction_quantity
        CHECK (quantity > 0),

    CONSTRAINT gift_transaction_unit_price
        CHECK (
            unit_price > 0
            AND unit_price <= 200000
        ),

    CONSTRAINT gift_transaction_total_price
        CHECK (total_price > 0),

    CONSTRAINT gift_transaction_not_self
        CHECK (
            sender_id <> receiver_id
        )
);

CREATE INDEX IF NOT EXISTS gift_transactions_sender_idx
ON gift_transactions(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gift_transactions_receiver_idx
ON gift_transactions(receiver_id, created_at DESC);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(60) NOT NULL,

    title VARCHAR(200) NOT NULL,

    body VARCHAR(1000),

    data JSONB,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reporter_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    reported_user_id UUID
        REFERENCES users(id)
        ON DELETE CASCADE,

    reported_post_id UUID
        REFERENCES posts(id)
        ON DELETE CASCADE,

    reported_message_id UUID
        REFERENCES messages(id)
        ON DELETE CASCADE,

    reported_room_id UUID
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    reason VARCHAR(100) NOT NULL,

    details TEXT,

    status report_status NOT NULL DEFAULT 'pending',

    reviewed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    resolution TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reports_target_required
        CHECK (
            reported_user_id IS NOT NULL
            OR reported_post_id IS NOT NULL
            OR reported_message_id IS NOT NULL
            OR reported_room_id IS NOT NULL
        )
);

CREATE INDEX IF NOT EXISTS reports_status_idx
ON reports(status, created_at);

-- ============================================================
-- SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    ip_address INET,

    user_agent TEXT,

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sessions_user_idx
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS sessions_expiry_idx
ON sessions(expires_at);

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_user_idx
ON password_reset_tokens(user_id);

-- ============================================================
-- VERIFICATION TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    token_type VARCHAR(50) NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS verification_tokens_user_idx
ON verification_tokens(user_id);

-- ============================================================
-- PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(150) NOT NULL UNIQUE,

    name VARCHAR(150) NOT NULL,

    description VARCHAR(500),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROLE PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    role VARCHAR(30) NOT NULL,

    permission_id UUID NOT NULL
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        role,
        permission_id
    ),

    CONSTRAINT role_permissions_role_valid
        CHECK (
            role IN (
                'owner',
                'admin',
                'moderator',
                'user'
            )
        )
);

-- ============================================================
-- SITE SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(150) PRIMARY KEY,

    value JSONB NOT NULL,

    description VARCHAR(500),

    is_public BOOLEAN NOT NULL DEFAULT FALSE,

    updated_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(150) NOT NULL,

    target_type VARCHAR(100),

    target_id UUID,

    metadata JSONB,

    ip_address INET,

    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
ON audit_logs(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx
ON audit_logs(action, created_at DESC);

-- ============================================================
-- FIRST ACCOUNT = OWNER
-- ============================================================
--
-- هذا هو الجزء المهم:
-- أول حساب فعلي يتم إدخاله إلى users يحصل على Owner.
--
-- لا يتم إنشاء أي حساب من هنا.
-- الحساب يأتي من التسجيل الحقيقي.
--
-- يوجد Advisory Transaction Lock لمنع حدوث حسابين Owner
-- بسبب تسجيل حسابين في نفس اللحظة.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_first_user_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    owner_exists BOOLEAN;
BEGIN

    PERFORM pg_advisory_xact_lock(
        hashtext('afandina_first_owner')
    );

    SELECT EXISTS (
        SELECT 1
        FROM users
        WHERE role = 'owner'
    )
    INTO owner_exists;

    IF NOT owner_exists THEN

        UPDATE users
        SET role = 'owner'
        WHERE id = NEW.id;

        NEW.role := 'owner';

    END IF;

    RETURN NEW;

END;
$$;

DROP TRIGGER IF EXISTS trigger_first_user_owner
ON users;

CREATE TRIGGER trigger_first_user_owner
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_first_user_owner();

-- ============================================================
-- AUTOMATIC USER SUPPORT ROWS
-- ============================================================
--
-- عند إنشاء حساب حقيقي فقط:
-- - Profile
-- - Stats
-- - Wallet
--
-- الرصيد يبدأ من صفر.
-- لا توجد Coins مجانية وهمية.
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_base_records()
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
        user_id,
        level,
        xp
    )
    VALUES (
        NEW.id,
        1,
        0
    )
    ON CONFLICT (user_id)
    DO NOTHING;

    INSERT INTO wallets (
        user_id,
        balance,
        lifetime_earned,
        lifetime_spent
    )
    VALUES (
        NEW.id,
        0,
        0,
        0
    )
    ON CONFLICT (user_id)
    DO NOTHING;

    RETURN NEW;

END;
$$;

DROP TRIGGER IF EXISTS trigger_create_user_base_records
ON users;

CREATE TRIGGER trigger_create_user_base_records
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_base_records();

-- ============================================================
-- UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.updated_at := NOW();

    RETURN NEW;

END;
$$;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trigger_users_updated_at
ON users;

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_profiles_updated_at
ON profiles;

CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_wallets_updated_at
ON wallets;

CREATE TRIGGER trigger_wallets_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_user_stats_updated_at
ON user_stats;

CREATE TRIGGER trigger_user_stats_updated_at
BEFORE UPDATE ON user_stats
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_rooms_updated_at
ON rooms;

CREATE TRIGGER trigger_rooms_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_posts_updated_at
ON posts;

CREATE TRIGGER trigger_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_comments_updated_at
ON comments;

CREATE TRIGGER trigger_comments_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_conversations_updated_at
ON conversations;

CREATE TRIGGER trigger_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_messages_updated_at
ON messages;

CREATE TRIGGER trigger_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_friend_requests_updated_at
ON friend_requests;

CREATE TRIGGER trigger_friend_requests_updated_at
BEFORE UPDATE ON friend_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_site_settings_updated_at
ON site_settings;

CREATE TRIGGER trigger_site_settings_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- REAL PERMISSION DEFINITIONS
-- ============================================================
--
-- هذه ليست مستخدمين ولا بيانات Demo.
-- هي تعريفات النظام للصلاحيات.
-- ============================================================

INSERT INTO permissions (
    code,
    name,
    description
)
VALUES

(
    'users.view',
    'عرض المستخدمين',
    'عرض بيانات المستخدمين المسموح بها'
),

(
    'users.manage',
    'إدارة المستخدمين',
    'إدارة حسابات المستخدمين'
),

(
    'users.ban',
    'حظر المستخدمين',
    'حظر أو رفع الحظر عن المستخدمين'
),

(
    'rooms.create',
    'إنشاء الغرف',
    'إنشاء غرفة بعد استيفاء شروط الشراء'
),

(
    'rooms.manage',
    'إدارة الغرف',
    'إدارة إعدادات الغرف'
),

(
    'rooms.moderate',
    'إدارة محتوى الغرف',
    'إدارة المخالفات داخل الغرف'
),

(
    'messages.moderate',
    'إدارة الرسائل',
    'إدارة الرسائل المخالفة'
),

(
    'posts.moderate',
    'إدارة المنشورات',
    'إدارة المنشورات المخالفة'
),

(
    'reports.review',
    'مراجعة البلاغات',
    'مراجعة البلاغات واتخاذ الإجراءات'
),

(
    'gifts.manage',
    'إدارة الهدايا',
    'إضافة وتعديل وإيقاف الهدايا'
),

(
    'vip.manage',
    'إدارة VIP',
    'إدارة خطط ومزايا VIP'
),

(
    'badges.manage',
    'إدارة الشارات',
    'إدارة الشارات ومنح الشارات الخاصة'
),

(
    'coins.manage',
    'إدارة Coins',
    'إدارة العمليات المالية المسموح بها'
),

(
    'site.settings',
    'إعدادات الموقع',
    'إدارة إعدادات الموقع'
),

(
    'audit.view',
    'عرض السجل',
    'عرض Audit Logs'
),

(
    'owner.full_access',
    'صلاحيات Owner الكاملة',
    'صلاحية Owner الكاملة على النظام'
)

ON CONFLICT (code)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ============================================================
-- OWNER PERMISSIONS
-- ============================================================

INSERT INTO role_permissions (
    role,
    permission_id
)
SELECT
    'owner',
    id
FROM permissions
ON CONFLICT (
    role,
    permission_id
)
DO NOTHING;

-- ============================================================
-- ADMIN PERMISSIONS
-- ============================================================

INSERT INTO role_permissions (
    role,
    permission_id
)
SELECT
    'admin',
    id
FROM permissions
WHERE code IN (
    'users.view',
    'users.manage',
    'users.ban',
    'rooms.manage',
    'rooms.moderate',
    'messages.moderate',
    'posts.moderate',
    'reports.review',
    'gifts.manage',
    'vip.manage',
    'badges.manage',
    'audit.view'
)
ON CONFLICT (
    role,
    permission_id
)
DO NOTHING;

-- ============================================================
-- MODERATOR PERMISSIONS
-- ============================================================

INSERT INTO role_permissions (
    role,
    permission_id
)
SELECT
    'moderator',
    id
FROM permissions
WHERE code IN (
    'users.view',
    'rooms.view',
    'rooms.moderate',
    'messages.moderate',
    'posts.moderate',
    'reports.review'
)
ON CONFLICT (
    role,
    permission_id
)
DO NOTHING;

-- ============================================================
-- USER PERMISSIONS
-- ============================================================

INSERT INTO role_permissions (
    role,
    permission_id
)
SELECT
    'user',
    id
FROM permissions
WHERE code IN (
    'users.view',
    'rooms.create'
)
ON CONFLICT (
    role,
    permission_id
)
DO NOTHING;

-- ============================================================
-- LEVEL SYSTEM
-- ============================================================
--
-- مستويات حقيقية للنظام.
-- لا يتم إعطاء أي مستخدم مستوى من هنا.
-- المستخدم يبدأ Level 1 عند التسجيل.
--
-- المكافأة اليومية تبدأ من Level 5.
-- ============================================================

INSERT INTO levels (
    level_number,
    title,
    xp_required,
    reward_coins,
    is_active
)
VALUES

(1,  'مبتدئ',       0,        0,       TRUE),
(2,  'متقدم',        100,      0,       TRUE),
(3,  'نشيط',         300,      0,       TRUE),
(4,  'محترف',        700,      0,       TRUE),
(5,  'مميز',         1500,     500,     TRUE),
(6,  'نجم',          3000,     750,     TRUE),
(7,  'متألق',        5500,     1000,    TRUE),
(8,  'VIP',          9000,     1500,    TRUE),
(9,  'أسطوري',       14000,    2000,    TRUE),
(10, 'نخبة',         22000,    3000,    TRUE),
(11, 'ملك الحضور',   33000,    4000,    TRUE),
(12, 'أسطورة الموقع',45000,   5000,    TRUE)

ON CONFLICT (
    level_number
)
DO UPDATE SET
    title = EXCLUDED.title,
    xp_required = EXCLUDED.xp_required,
    reward_coins = EXCLUDED.reward_coins,
    is_active = EXCLUDED.is_active;

-- ============================================================
-- LEVEL REWARDS
-- ============================================================
--
-- مكافآت الوصول للمستويات.
-- لا يتم منحها تلقائياً بمجرد تشغيل schema.
-- server.js ينفذ منطق الاستحقاق عند ارتفاع المستوى.
-- ============================================================

INSERT INTO level_rewards (
    level_number,
    reward_type,
    reward_value,
    is_active
)
SELECT
    level_number,
    'coins',
    jsonb_build_object(
        'coins',
        reward_coins
    ),
    TRUE
FROM levels
WHERE level_number >= 2
  AND reward_coins > 0;

-- ============================================================
-- VIP PLANS
-- ============================================================
--
-- تعريف خطط فقط.
-- لا يتم شراء أو منح VIP لأي حساب هنا.
-- ============================================================

INSERT INTO vip_plans (
    code,
    name,
    description,
    price_coins,
    duration_days,
    is_active
)
VALUES

(
    'vip_basic',
    'VIP Basic',
    'مزايا VIP الأساسية',
    25000,
    30,
    TRUE
),

(
    'vip_plus',
    'VIP Plus',
    'مزايا VIP المتقدمة',
    60000,
    30,
    TRUE
),

(
    'vip_elite',
    'VIP Elite',
    'مزايا VIP المميزة',
    120000,
    30,
    TRUE
)

ON CONFLICT (code)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_coins = EXCLUDED.price_coins,
    duration_days = EXCLUDED.duration_days,
    is_active = EXCLUDED.is_active;

-- ============================================================
-- VIP BENEFITS
-- ============================================================

INSERT INTO vip_benefits (
    vip_plan_id,
    benefit_code,
    benefit_value
)
SELECT
    id,
    'profile_badge',
    jsonb_build_object(
        'enabled',
        TRUE
    )
FROM vip_plans
WHERE code = 'vip_basic';

INSERT INTO vip_benefits (
    vip_plan_id,
    benefit_code,
    benefit_value
)
SELECT
    id,
    'profile_effect',
    jsonb_build_object(
        'enabled',
        TRUE
    )
FROM vip_plans
WHERE code = 'vip_plus';

INSERT INTO vip_benefits (
    vip_plan_id,
    benefit_code,
    benefit_value
)
SELECT
    id,
    'priority_support',
    jsonb_build_object(
        'enabled',
        TRUE
    )
FROM vip_plans
WHERE code = 'vip_elite';

-- ============================================================
-- GIFT STORE
-- ============================================================
--
-- هذه منتجات حقيقية داخل نظام المتجر وليست مستخدمين أو Demo.
--
-- الأسعار مرتبة تصاعدياً.
-- أعلى سعر = 200,000 Coins.
--
-- لا يتم منح أي منها لأي مستخدم.
-- ============================================================

INSERT INTO gifts (
    code,
    name,
    description,
    category,
    price_coins,
    is_active,
    is_limited,
    stock,
    sort_order
)
VALUES

(
    'rose',
    'وردة فاخرة',
    'هدية رقمية أنيقة',
    'basic',
    100,
    TRUE,
    FALSE,
    NULL,
    10
),

(
    'diamond',
    'ألماسة',
    'هدية رقمية مميزة',
    'premium',
    1000,
    TRUE,
    FALSE,
    NULL,
    20
),

(
    'crown',
    'تاج ملكي',
    'هدية ملكية فاخرة',
    'premium',
    5000,
    TRUE,
    FALSE,
    NULL,
    30
),

(
    'luxury_car',
    'سيارة فاخرة',
    'هدية رقمية فاخرة',
    'luxury',
    10000,
    TRUE,
    FALSE,
    NULL,
    40
),

(
    'supercar',
    'سيارة Supercar',
    'هدية رقمية فائقة الفخامة',
    'luxury',
    25000,
    TRUE,
    FALSE,
    NULL,
    50
),

(
    'private_jet',
    'طائرة خاصة',
    'هدية رقمية فاخرة',
    'luxury',
    50000,
    TRUE,
    FALSE,
    NULL,
    60
),

(
    'yacht',
    'يخت فاخر',
    'هدية رقمية فاخرة',
    'luxury',
    100000,
    TRUE,
    FALSE,
    NULL,
    70
),

(
    'royal_collection',
    'المجموعة الملكية',
    'أعلى هدية في المتجر',
    'elite',
    200000,
    TRUE,
    FALSE,
    NULL,
    80
)

ON CONFLICT (code)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    price_coins = EXCLUDED.price_coins,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;

-- ============================================================
-- SPECIAL BADGES
-- ============================================================
--
-- الشارات الخاصة ليست قابلة للشراء.
-- is_purchasable = FALSE
--
-- يمكن منحها فقط من النظام أو Owner/Admin
-- وفق منطق الصلاحيات في server.js.
-- ============================================================

INSERT INTO badges (
    code,
    name,
    description,
    rarity,
    level_required,
    is_special,
    is_purchasable,
    is_active
)
VALUES

(
    'owner',
    'Owner',
    'شارة مالك الموقع',
    'unique',
    1,
    TRUE,
    FALSE,
    TRUE
),

(
    'founder',
    'المؤسس',
    'شارة خاصة بالمؤسس',
    'unique',
    1,
    TRUE,
    FALSE,
    TRUE
),

(
    'elite',
    'النخبة',
    'شارة مميزة للمستويات العليا',
    'legendary',
    10,
    TRUE,
    FALSE,
    TRUE
),

(
    'legend',
    'أسطورة',
    'شارة خاصة للمستخدمين أصحاب الإنجازات',
    'legendary',
    12,
    TRUE,
    FALSE,
    TRUE
)

ON CONFLICT (code)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rarity = EXCLUDED.rarity,
    level_required = EXCLUDED.level_required,
    is_special = EXCLUDED.is_special,
    is_purchasable = FALSE,
    is_active = EXCLUDED.is_active;

-- ============================================================
-- SITE SETTINGS
-- ============================================================
--
-- إعدادات النظام فقط.
-- لا تحتوي على مستخدمين أو بيانات وهمية.
-- ============================================================

INSERT INTO site_settings (
    key,
    value,
    description,
    is_public
)
VALUES

(
    'room_purchase_price',
    '50000',
    'سعر شراء الغرفة بالCoins',
    TRUE
),

(
    'max_gift_price',
    '200000',
    'الحد الأعلى لسعر الهدية',
    TRUE
),

(
    'daily_reward_min_level',
    '5',
    'أقل مستوى للحصول على المكافأة اليومية',
    TRUE
),

(
    'registration_first_user_owner',
    'true',
    'أول حساب مسجل يصبح Owner',
    FALSE
)

ON CONFLICT (key)
DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public;

-- ============================================================
-- SAFETY INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS users_online_idx
ON users(is_online, last_seen_at);

CREATE INDEX IF NOT EXISTS user_stats_level_xp_idx
ON user_stats(level, xp);

CREATE INDEX IF NOT EXISTS wallets_balance_idx
ON wallets(balance);

CREATE INDEX IF NOT EXISTS rooms_slug_idx
ON rooms(slug);

CREATE INDEX IF NOT EXISTS gifts_price_idx
ON gifts(price_coins);

CREATE INDEX IF NOT EXISTS notifications_created_idx
ON notifications(created_at DESC);

-- ============================================================
-- FINAL DATABASE CHECK
-- ============================================================

DO $$
DECLARE
    required_count INTEGER;
    existing_count INTEGER;
BEGIN

    SELECT COUNT(*)
    INTO required_count
    FROM (
        VALUES
        ('users'),
        ('profiles'),
        ('user_stats'),
        ('wallets'),
        ('levels'),
        ('level_rewards'),
        ('level_reward_claims'),
        ('badges'),
        ('user_badges'),
        ('vip_plans'),
        ('user_vip'),
        ('vip_benefits'),
        ('gifts'),
        ('gift_effects'),
        ('gift_inventory'),
        ('gift_transactions'),
        ('rooms'),
        ('room_members'),
        ('conversations'),
        ('conversation_members'),
        ('messages'),
        ('posts'),
        ('comments'),
        ('post_likes'),
        ('follows'),
        ('friend_requests'),
        ('blocks'),
        ('wallet_transactions'),
        ('coin_transfers'),
        ('notifications'),
        ('reports'),
        ('sessions'),
        ('password_reset_tokens'),
        ('verification_tokens'),
        ('permissions'),
        ('role_permissions'),
        ('site_settings'),
        ('audit_logs')
    ) AS required_tables(table_name);

    SELECT COUNT(*)
    INTO existing_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'users',
        'profiles',
        'user_stats',
        'wallets',
        'levels',
        'level_rewards',
        'level_reward_claims',
        'badges',
        'user_badges',
        'vip_plans',
        'user_vip',
        'vip_benefits',
        'gifts',
        'gift_effects',
        'gift_inventory',
        'gift_transactions',
        'rooms',
        'room_members',
        'conversations',
        'conversation_members',
        'messages',
        'posts',
        'comments',
        'post_likes',
        'follows',
        'friend_requests',
        'blocks',
        'wallet_transactions',
        'coin_transfers',
        'notifications',
        'reports',
        'sessions',
        'password_reset_tokens',
        'verification_tokens',
        'permissions',
        'role_permissions',
        'site_settings',
        'audit_logs'
      );

    IF existing_count <> required_count THEN
        RAISE EXCEPTION
            'Database schema incomplete: % of % required tables found.',
            existing_count,
            required_count;
    END IF;

END $$;

COMMIT;
