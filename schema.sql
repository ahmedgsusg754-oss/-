-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PostgreSQL Database Schema
-- PART 1 / 10
--
-- هذا الملف هو مصدر قاعدة البيانات الرسمي للمشروع.
--
-- ممنوع وضع:
-- - مستخدمين تجريبيين
-- - حسابات وهمية
-- - أرصدة وهمية
-- - رسائل وهمية
-- - منشورات وهمية
-- - غرف وهمية
--
-- أول مستخدم حقيقي سيتم تسجيله سيصبح Owner
-- من خلال Trigger سيتم إضافته في جزء لاحق.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2. ENUM: USER STATUS
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
END
$$;

-- ============================================================
-- 3. ENUM: GENDER
-- ============================================================

DO $$
BEGIN
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
END
$$;

-- ============================================================
-- 4. ENUM: USER ROLE
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'user_role'
    ) THEN

        CREATE TYPE user_role AS ENUM (
            'owner',
            'admin',
            'moderator',
            'user'
        );

    END IF;
END
$$;

-- ============================================================
-- 5. USERS
-- ============================================================
--
-- الحسابات الحقيقية فقط.
--
-- ملاحظات:
-- role لا يتم تحديده من الواجهة.
-- Trigger في جزء لاحق سيجعل أول حساب Owner.
--
-- password_hash:
-- يجب أن يحتوي Hash فقط وليس كلمة المرور الأصلية.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    username VARCHAR(30)
        NOT NULL,

    email VARCHAR(255),

    phone VARCHAR(30),

    password_hash TEXT
        NOT NULL,

    role user_role
        NOT NULL
        DEFAULT 'user',

    status user_status
        NOT NULL
        DEFAULT 'active',

    gender gender_type
        NOT NULL
        DEFAULT 'unspecified',

    email_verified BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    phone_verified BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_online BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    last_seen_at TIMESTAMPTZ,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT users_username_length
        CHECK (
            char_length(trim(username))
            BETWEEN 3 AND 30
        ),

    CONSTRAINT users_username_not_empty
        CHECK (
            char_length(trim(username)) > 0
        )

);

-- ============================================================
-- 6. USERS INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    users_username_unique_idx
ON users (
    LOWER(username)
);

CREATE UNIQUE INDEX IF NOT EXISTS
    users_email_unique_idx
ON users (
    LOWER(email)
)
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
    users_phone_unique_idx
ON users (
    phone
)
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS
    users_status_idx
ON users (
    status
);

CREATE INDEX IF NOT EXISTS
    users_role_idx
ON users (
    role
);

CREATE INDEX IF NOT EXISTS
    users_online_idx
ON users (
    is_online,
    last_seen_at
);

CREATE INDEX IF NOT EXISTS
    users_created_at_idx
ON users (
    created_at DESC
);

-- ============================================================
-- 7. USER PROFILES
-- ============================================================
--
-- البيانات الإضافية للحساب.
-- يتم إنشاء السجل تلقائياً عند التسجيل الحقيقي
-- بواسطة Trigger في جزء لاحق.
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (

    user_id UUID
        PRIMARY KEY
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

    gender gender_type
        NOT NULL
        DEFAULT 'unspecified',

    is_verified BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    show_online_status BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    show_last_seen BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);

-- ============================================================
-- 8. PROFILE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    profiles_country_idx
ON profiles (
    country
);

CREATE INDEX IF NOT EXISTS
    profiles_city_idx
ON profiles (
    city
);

CREATE INDEX IF NOT EXISTS
    profiles_verified_idx
ON profiles (
    is_verified
);

-- ============================================================
-- 9. USER STATISTICS
-- ============================================================
--
-- إحصائيات الحساب.
--
-- لا توجد أرقام وهمية.
-- كل مستخدم يبدأ بالقيم الصفرية الحقيقية.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_stats (

    user_id UUID
        PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    level INTEGER
        NOT NULL
        DEFAULT 1,

    xp BIGINT
        NOT NULL
        DEFAULT 0,

    posts_count BIGINT
        NOT NULL
        DEFAULT 0,

    comments_count BIGINT
        NOT NULL
        DEFAULT 0,

    messages_count BIGINT
        NOT NULL
        DEFAULT 0,

    gifts_sent_count BIGINT
        NOT NULL
        DEFAULT 0,

    gifts_received_count BIGINT
        NOT NULL
        DEFAULT 0,

    coins_spent BIGINT
        NOT NULL
        DEFAULT 0,

    rooms_owned BIGINT
        NOT NULL
        DEFAULT 0,

    rooms_joined BIGINT
        NOT NULL
        DEFAULT 0,

    followers_count BIGINT
        NOT NULL
        DEFAULT 0,

    following_count BIGINT
        NOT NULL
        DEFAULT 0,

    reputation BIGINT
        NOT NULL
        DEFAULT 0,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT user_stats_level_positive
        CHECK (level >= 1),

    CONSTRAINT user_stats_xp_positive
        CHECK (xp >= 0),

    CONSTRAINT user_stats_posts_positive
        CHECK (posts_count >= 0),

    CONSTRAINT user_stats_comments_positive
        CHECK (comments_count >= 0),

    CONSTRAINT user_stats_messages_positive
        CHECK (messages_count >= 0),

    CONSTRAINT user_stats_gifts_sent_positive
        CHECK (gifts_sent_count >= 0),

    CONSTRAINT user_stats_gifts_received_positive
        CHECK (gifts_received_count >= 0),

    CONSTRAINT user_stats_coins_spent_positive
        CHECK (coins_spent >= 0),

    CONSTRAINT user_stats_rooms_owned_positive
        CHECK (rooms_owned >= 0),

    CONSTRAINT user_stats_rooms_joined_positive
        CHECK (rooms_joined >= 0),

    CONSTRAINT user_stats_followers_positive
        CHECK (followers_count >= 0),

    CONSTRAINT user_stats_following_positive
        CHECK (following_count >= 0),

    CONSTRAINT user_stats_reputation_valid
        CHECK (reputation >= 0)

);

-- ============================================================
-- 10. USER STATS INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    user_stats_level_idx
ON user_stats (
    level
);

CREATE INDEX IF NOT EXISTS
    user_stats_xp_idx
ON user_stats (
    xp DESC
);

CREATE INDEX IF NOT EXISTS
    user_stats_reputation_idx
ON user_stats (
    reputation DESC
);

-- ============================================================
-- 11. USER WALLETS
-- ============================================================
--
-- كل مستخدم حقيقي لديه Wallet واحدة.
--
-- البداية:
-- balance = 0
--
-- لا توجد Coins مجانية أو تجريبية.
-- ============================================================

CREATE TABLE IF NOT EXISTS wallets (

    user_id UUID
        PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    balance BIGINT
        NOT NULL
        DEFAULT 0,

    lifetime_earned BIGINT
        NOT NULL
        DEFAULT 0,

    lifetime_spent BIGINT
        NOT NULL
        DEFAULT 0,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT wallets_balance_valid
        CHECK (balance >= 0),

    CONSTRAINT wallets_earned_valid
        CHECK (lifetime_earned >= 0),

    CONSTRAINT wallets_spent_valid
        CHECK (lifetime_spent >= 0)

);

-- ============================================================
-- 12. WALLET INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    wallets_balance_idx
ON wallets (
    balance DESC
);

-- ============================================================
-- 13. BASIC DATABASE VALIDATION
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
    ) THEN

        RAISE EXCEPTION
            'Failed to create users table';

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
    ) THEN

        RAISE EXCEPTION
            'Failed to create profiles table';

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_stats'
    ) THEN

        RAISE EXCEPTION
            'Failed to create user_stats table';

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'wallets'
    ) THEN

        RAISE EXCEPTION
            'Failed to create wallets table';

    END IF;

END
$$;

-- ============================================================
-- نهاية الجزء الأول
-- الجزء الثاني سيكمل نفس الملف مباشرة.
-- ============================================================
-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 2 / 10
--
-- Levels
-- Level Rewards
-- Badges
-- User Badges
-- VIP Plans
-- VIP Benefits
-- User VIP
-- ============================================================

-- ============================================================
-- 14. LEVELS
-- ============================================================
--
-- تعريف مستويات النظام فقط.
-- لا يتم منح أي Coins أو مكافآت لأي مستخدم هنا.
-- ============================================================

CREATE TABLE IF NOT EXISTS levels (

    level_number INTEGER
        PRIMARY KEY,

    title VARCHAR(100)
        NOT NULL,

    xp_required BIGINT
        NOT NULL,

    reward_coins BIGINT
        NOT NULL
        DEFAULT 0,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT levels_number_valid
        CHECK (level_number >= 1),

    CONSTRAINT levels_xp_valid
        CHECK (xp_required >= 0),

    CONSTRAINT levels_reward_valid
        CHECK (reward_coins >= 0)

);

-- ============================================================
-- 15. LEVELS INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    levels_xp_required_idx
ON levels (
    xp_required
);

CREATE INDEX IF NOT EXISTS
    levels_active_idx
ON levels (
    is_active
);

-- ============================================================
-- 16. LEVEL REWARDS
-- ============================================================
--
-- تعريف المكافآت المرتبطة بالمستويات.
-- لا يتم إنشاء Claims للمستخدمين هنا.
-- ============================================================

CREATE TABLE IF NOT EXISTS level_rewards (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    level_number INTEGER
        NOT NULL
        REFERENCES levels(level_number)
        ON DELETE CASCADE,

    reward_type VARCHAR(50)
        NOT NULL,

    reward_value JSONB
        NOT NULL,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS
    level_rewards_level_idx
ON level_rewards (
    level_number
);

CREATE INDEX IF NOT EXISTS
    level_rewards_active_idx
ON level_rewards (
    is_active
);

-- ============================================================
-- 17. LEVEL REWARD CLAIMS
-- ============================================================
--
-- يسجل المكافآت التي استلمها المستخدم فعلياً.
-- ============================================================

CREATE TABLE IF NOT EXISTS level_reward_claims (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    level_number INTEGER
        NOT NULL
        REFERENCES levels(level_number)
        ON DELETE RESTRICT,

    reward_id UUID
        REFERENCES level_rewards(id)
        ON DELETE SET NULL,

    claimed_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT level_reward_claim_user_level_unique
        UNIQUE (
            user_id,
            level_number,
            reward_id
        )

);

CREATE INDEX IF NOT EXISTS
    level_reward_claims_user_idx
ON level_reward_claims (
    user_id,
    claimed_at DESC
);

-- ============================================================
-- 18. BADGES
-- ============================================================
--
-- الشارات الموجودة في النظام.
--
-- الشارة الخاصة:
-- is_special = TRUE
--
-- الشارة غير القابلة للشراء:
-- is_purchasable = FALSE
-- ============================================================

CREATE TABLE IF NOT EXISTS badges (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    name VARCHAR(100)
        NOT NULL,

    description VARCHAR(500),

    icon_url TEXT,

    rarity VARCHAR(50),

    level_required INTEGER
        REFERENCES levels(level_number)
        ON DELETE SET NULL,

    is_special BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_purchasable BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    price_coins BIGINT
        NOT NULL
        DEFAULT 0,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT badges_price_valid
        CHECK (price_coins >= 0),

    CONSTRAINT badges_special_purchase_valid
        CHECK (
            is_special = FALSE
            OR is_purchasable = FALSE
        )

);

CREATE INDEX IF NOT EXISTS
    badges_active_idx
ON badges (
    is_active
);

CREATE INDEX IF NOT EXISTS
    badges_rarity_idx
ON badges (
    rarity
);

CREATE INDEX IF NOT EXISTS
    badges_level_idx
ON badges (
    level_required
);

-- ============================================================
-- 19. USER BADGES
-- ============================================================
--
-- الشارات التي حصل عليها مستخدم فعلي.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_badges (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    badge_id UUID
        NOT NULL
        REFERENCES badges(id)
        ON DELETE CASCADE,

    awarded_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    awarded_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        badge_id
    )

);

CREATE INDEX IF NOT EXISTS
    user_badges_user_idx
ON user_badges (
    user_id,
    awarded_at DESC
);

CREATE INDEX IF NOT EXISTS
    user_badges_badge_idx
ON user_badges (
    badge_id
);

-- ============================================================
-- 20. VIP PLANS
-- ============================================================
--
-- تعريف خطط VIP فقط.
-- لا يتم تفعيل VIP لأي مستخدم من schema.
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_plans (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    name VARCHAR(100)
        NOT NULL,

    description VARCHAR(500),

    price_coins BIGINT
        NOT NULL,

    duration_days INTEGER
        NOT NULL,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT vip_plans_price_valid
        CHECK (price_coins > 0),

    CONSTRAINT vip_plans_duration_valid
        CHECK (duration_days > 0)

);

CREATE INDEX IF NOT EXISTS
    vip_plans_active_idx
ON vip_plans (
    is_active
);

CREATE INDEX IF NOT EXISTS
    vip_plans_price_idx
ON vip_plans (
    price_coins
);

-- ============================================================
-- 21. VIP BENEFITS
-- ============================================================
--
-- المزايا الخاصة بكل خطة VIP.
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_benefits (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    vip_plan_id UUID
        NOT NULL
        REFERENCES vip_plans(id)
        ON DELETE CASCADE,

    benefit_code VARCHAR(100)
        NOT NULL,

    benefit_value JSONB
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT vip_benefit_unique
        UNIQUE (
            vip_plan_id,
            benefit_code
        )

);

CREATE INDEX IF NOT EXISTS
    vip_benefits_plan_idx
ON vip_benefits (
    vip_plan_id
);

-- ============================================================
-- 22. USER VIP
-- ============================================================
--
-- اشتراكات VIP الفعلية للمستخدمين.
-- لا توجد سجلات هنا عند إنشاء قاعدة البيانات.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_vip (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    vip_plan_id UUID
        NOT NULL
        REFERENCES vip_plans(id)
        ON DELETE RESTRICT,

    started_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    expires_at TIMESTAMPTZ
        NOT NULL,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT user_vip_dates_valid
        CHECK (
            expires_at > started_at
        )

);

CREATE INDEX IF NOT EXISTS
    user_vip_user_idx
ON user_vip (
    user_id
);

CREATE INDEX IF NOT EXISTS
    user_vip_active_idx
ON user_vip (
    user_id,
    is_active,
    expires_at
);

-- ===-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PostgreSQL Database Schema
-- PART 2 / 2
--
-- تكملة الملف:
-- Messages
-- Conversations
-- Gifts
-- Store
-- Coin Transactions
-- Notifications
-- Levels
-- Badges
-- VIP
-- Reports
-- Moderation
-- Permissions
-- Audit Logs
-- Site Settings
-- Triggers
-- Validation
-- ============================================================


-- ============================================================
-- 21. CONVERSATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    is_group BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    title VARCHAR(150),

    avatar_url TEXT,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS
    conversations_created_by_idx
ON conversations (
    created_by
);

CREATE INDEX IF NOT EXISTS
    conversations_updated_idx
ON conversations (
    updated_at DESC
);


-- ============================================================
-- 22. CONVERSATION MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_members (

    conversation_id UUID
        NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    is_admin BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_muted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    joined_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    last_read_at TIMESTAMPTZ,

    PRIMARY KEY (
        conversation_id,
        user_id
    )

);

CREATE INDEX IF NOT EXISTS
    conversation_members_user_idx
ON conversation_members (
    user_id,
    joined_at DESC
);


-- ============================================================
-- 23. MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    conversation_id UUID
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    room_id UUID
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    message_type message_type
        NOT NULL
        DEFAULT 'text',

    content TEXT,

    media_url TEXT,

    reply_to_id UUID
        REFERENCES messages(id)
        ON DELETE SET NULL,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT messages_destination_valid
        CHECK (
            conversation_id IS NOT NULL
            OR room_id IS NOT NULL
        ),

    CONSTRAINT messages_content_valid
        CHECK (
            content IS NOT NULL
            OR media_url IS NOT NULL
            OR message_type IN (
                'gift',
                'system'
            )
        )

);

CREATE INDEX IF NOT EXISTS
    messages_conversation_idx
ON messages (
    conversation_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    messages_room_idx
ON messages (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    messages_sender_idx
ON messages (
    sender_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    messages_reply_idx
ON messages (
    reply_to_id
);


-- ============================================================
-- 24. MESSAGE READS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_reads (

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    read_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id
    )

);

CREATE INDEX IF NOT EXISTS
    message_reads_user_idx
ON message_reads (
    user_id,
    read_at DESC
);


-- ============================================================
-- 25. MESSAGE REACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_reactions (

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction VARCHAR(30)
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id,
        reaction
    )

);

CREATE INDEX IF NOT EXISTS
    message_reactions_message_idx
ON message_reactions (
    message_id
);


-- ============================================================
-- 26. GIFT CATALOG
-- ============================================================

CREATE TABLE IF NOT EXISTS gifts (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    name VARCHAR(100)
        NOT NULL,

    description VARCHAR(500),

    image_url TEXT
        NOT NULL,

    animation_url TEXT,

    category VARCHAR(50),

    price_coins BIGINT
        NOT NULL,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    sort_order INTEGER
        NOT NULL
        DEFAULT 0,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT gifts_price_valid
        CHECK (price_coins > 0)

);

CREATE INDEX IF NOT EXISTS
    gifts_active_idx
ON gifts (
    is_active,
    sort_order
);

CREATE INDEX IF NOT EXISTS
    gifts_category_idx
ON gifts (
    category
);


-- ============================================================
-- 27. GIFT TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS gift_transactions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    receiver_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    gift_id UUID
        NOT NULL
        REFERENCES gifts(id)
        ON DELETE RESTRICT,

    quantity INTEGER
        NOT NULL
        DEFAULT 1,

    unit_price_coins BIGINT
        NOT NULL,

    total_price_coins BIGINT
        NOT NULL,

    room_id UUID
        REFERENCES rooms(id)
        ON DELETE SET NULL,

    message_id UUID
        REFERENCES messages(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT gift_sender_receiver_different
        CHECK (
            sender_id <> receiver_id
        ),

    CONSTRAINT gift_quantity_valid
        CHECK (
            quantity > 0
        ),

    CONSTRAINT gift_unit_price_valid
        CHECK (
            unit_price_coins > 0
        ),

    CONSTRAINT gift_total_price_valid
        CHECK (
            total_price_coins > 0
        )

);

CREATE INDEX IF NOT EXISTS
    gift_transactions_sender_idx
ON gift_transactions (
    sender_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    gift_transactions_receiver_idx
ON gift_transactions (
    receiver_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    gift_transactions_gift_idx
ON gift_transactions (
    gift_id
);


-- ============================================================
-- 28. STORE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS store_items (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    name VARCHAR(150)
        NOT NULL,

    description VARCHAR(500),

    item_type VARCHAR(50)
        NOT NULL,

    image_url TEXT,

    price_coins BIGINT
        NOT NULL,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT store_items_price_valid
        CHECK (price_coins >= 0)

);

CREATE INDEX IF NOT EXISTS
    store_items_type_idx
ON store_items (
    item_type
);

CREATE INDEX IF NOT EXISTS
    store_items_active_idx
ON store_items (
    is_active
);


-- ============================================================
-- 29. USER STORE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_store_items (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    store_item_id UUID
        NOT NULL
        REFERENCES store_items(id)
        ON DELETE RESTRICT,

    quantity BIGINT
        NOT NULL
        DEFAULT 1,

    acquired_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        store_item_id
    ),

    CONSTRAINT user_store_items_quantity_valid
        CHECK (
            quantity > 0
        )

);


-- ============================================================
-- 30. COIN TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS coin_transactions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    type transaction_type
        NOT NULL,

    amount BIGINT
        NOT NULL,

    balance_before BIGINT
        NOT NULL,

    balance_after BIGINT
        NOT NULL,

    reference_id UUID,

    reference_type VARCHAR(100),

    description VARCHAR(500),

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT coin_transaction_amount_valid
        CHECK (
            amount <> 0
        ),

    CONSTRAINT coin_balance_before_valid
        CHECK (
            balance_before >= 0
        ),

    CONSTRAINT coin_balance_after_valid
        CHECK (
            balance_after >= 0
        )

);

CREATE INDEX IF NOT EXISTS
    coin_transactions_user_idx
ON coin_transactions (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    coin_transactions_type_idx
ON coin_transactions (
    type,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    coin_transactions_reference_idx
ON coin_transactions (
    reference_id
);


-- ============================================================
-- 31. COIN TRANSFERS
-- ============================================================

CREATE TABLE IF NOT EXISTS coin_transfers (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    receiver_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    amount BIGINT
        NOT NULL,

    sender_transaction_id UUID
        REFERENCES coin_transactions(id)
        ON DELETE SET NULL,

    receiver_transaction_id UUID
        REFERENCES coin_transactions(id)
        ON DELETE SET NULL,

    note VARCHAR(500),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT coin_transfer_users_different
        CHECK (
            sender_id <> receiver_id
        ),

    CONSTRAINT coin_transfer_amount_valid
        CHECK (
            amount > 0
        )

);

CREATE INDEX IF NOT EXISTS
    coin_transfers_sender_idx
ON coin_transfers (
    sender_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    coin_transfers_receiver_idx
ON coin_transfers (
    receiver_id,
    created_at DESC
);


-- ============================================================
-- 32. NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    actor_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    type notification_type
        NOT NULL,

    title VARCHAR(200)
        NOT NULL,

    body VARCHAR(1000),

    reference_id UUID,

    reference_type VARCHAR(100),

    is_read BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS
    notifications_user_idx
ON notifications (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    notifications_unread_idx
ON notifications (
    user_id,
    is_read,
    created_at DESC
);


-- ============================================================
-- 33. LEVELS
-- ============================================================

CREATE TABLE IF NOT EXISTS levels (

    level_number INTEGER
        PRIMARY KEY,

    title VARCHAR(100)
        NOT NULL,

    xp_required BIGINT
        NOT NULL,

    reward_coins BIGINT
        NOT NULL
        DEFAULT 0,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT levels_number_valid
        CHECK (
            level_number >= 1
        ),

    CONSTRAINT levels_xp_valid
        CHECK (
            xp_required >= 0
        ),

    CONSTRAINT levels_reward_valid
        CHECK (
            reward_coins >= 0
        )

);

CREATE INDEX IF NOT EXISTS
    levels_xp_idx
ON levels (
    xp_required
);


-- ============================================================
-- 34. BADGES
-- ============================================================

CREATE TABLE IF NOT EXISTS badges (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    name VARCHAR(100)
        NOT NULL,

    description VARCHAR(500),

    icon_url TEXT,

    rarity VARCHAR(50),

    is_special BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS
    badges_active_idx
ON badges (
    is_active
);


-- ============================================================
-- 35. USER BADGES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_badges (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    badge_id UUID
        NOT NULL
        REFERENCES badges(id)
        ON DELETE CASCADE,

    awarded_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    awarded_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        badge_id
    )

);

CREATE INDEX IF NOT EXISTS
    user_badges_user_idx
ON user_badges (
    user_id,
    awarded_at DESC
);


-- ============================================================
-- 36. VIP PLANS
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_plans (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    name VARCHAR(100)
        NOT NULL,

    description VARCHAR(500),

    price_coins BIGINT
        NOT NULL,

    duration_days INTEGER
        NOT NULL,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT vip_price_valid
        CHECK (
            price_coins > 0
        ),

    CONSTRAINT vip_duration_valid
        CHECK (
            duration_days > 0
        )

);

CREATE INDEX IF NOT EXISTS
    vip_plans_active_idx
ON vip_plans (
    is_active
);


-- ============================================================
-- 37. VIP BENEFITS
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_benefits (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    vip_plan_id UUID
        NOT NULL
        REFERENCES vip_plans(id)
        ON DELETE CASCADE,

    benefit_code VARCHAR(100)
        NOT NULL,

    benefit_value JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    UNIQUE (
        vip_plan_id,
        benefit_code
    )

);


-- ============================================================
-- 38. USER VIP
-- ============================================================

CREATE TABLE IF NOT EXISTS user_vip (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    vip_plan_id UUID
        NOT NULL
        REFERENCES vip_plans(id)
        ON DELETE RESTRICT,

    started_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    expires_at TIMESTAMPTZ
        NOT NULL,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT user_vip_dates_valid
        CHECK (
            expires_at > started_at
        )

);

CREATE INDEX IF NOT EXISTS
    user_vip_user_idx
ON user_vip (
    user_id,
    expires_at DESC
);

CREATE INDEX IF NOT EXISTS
    user_vip_active_idx
ON user_vip (
    user_id,
    is_active
);


-- ============================================================
-- 39. REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    reporter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    target_type report_target_type
        NOT NULL,

    target_id UUID
        NOT NULL,

    reason VARCHAR(200)
        NOT NULL,

    description VARCHAR(2000),

    status report_status
        NOT NULL
        DEFAULT 'open',

    assigned_to UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    resolution_note VARCHAR(2000),

    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS
    reports_status_idx
ON reports (
    status,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    reports_target_idx
ON reports (
    target_type,
    target_id
);

CREATE INDEX IF NOT EXISTS
    reports_reporter_idx
ON reports (
    reporter_id,
    created_at DESC
);


-- ============================================================
-- 40. USER MODERATION ACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS moderation_actions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    target_user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    moderator_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    action_type VARCHAR(50)
        NOT NULL,

    reason VARCHAR(1000),

    expires_at TIMESTAMPTZ,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    lifted_at TIMESTAMPTZ

);

CREATE INDEX IF NOT EXISTS
    moderation_target_idx
ON moderation_actions (
    target_user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    moderation_moderator_idx
ON moderation_actions (
    moderator_id,
    created_at DESC
);


-- ============================================================
-- 41. PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS permissions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(150)
        NOT NULL
        UNIQUE,

    name VARCHAR(150)
        NOT NULL,

    description VARCHAR(500),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


-- ============================================================
-- 42. ROLE PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permissions (

    role user_role
        NOT NULL,

    permission_id UUID
        NOT NULL
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        role,
        permission_id
    )

);

CREATE INDEX IF NOT EXISTS
    role_permissions_permission_idx
ON role_permissions (
    permission_id
);


-- ============================================================
-- 43. USER PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_permissions (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    permission_id UUID
        NOT NULL
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    granted BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    granted_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        permission_id
    )

);


-- ============================================================
-- 44. SITE SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS site_settings (

    setting_key VARCHAR(150)
        PRIMARY KEY,

    setting_value JSONB
        NOT NULL,

    is_public BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    updated_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


-- ============================================================
-- 45. AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    actor_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(150)
        NOT NULL,

    entity_type VARCHAR(100),

    entity_id UUID,

    ip_address INET,

    user_agent TEXT,

    old_data JSONB,

    new_data JSONB,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS
    audit_logs_actor_idx
ON audit_logs (
    actor_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    audit_logs_entity_idx
ON audit_logs (
    entity_type,
    entity_id
);

CREATE INDEX IF NOT EXISTS
    audit_logs_created_idx
ON audit_logs (
    created_at DESC
);


-- ============================================================
-- 46. USER DEVICES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_devices (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    device_id VARCHAR(255)
        NOT NULL,

    device_name VARCHAR(200),

    platform VARCHAR(50),

    browser VARCHAR(100),

    ip_address INET,

    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    UNIQUE (
        user_id,
        device_id
    )

);

CREATE INDEX IF NOT EXISTS
    user_devices_user_idx
ON user_devices (
    user_id,
    last_seen_at DESC
);


-- ============================================================
-- 47. LOGIN ATTEMPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS login_attempts (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    identifier VARCHAR(255)
        NOT NULL,

    ip_address INET,

    success BOOLEAN
        NOT NULL,

    failure_reason VARCHAR(200),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS
    login_attempts_identifier_idx
ON login_attempts (
    identifier,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    login_attempts_ip_idx
ON login_attempts (
    ip_address,
    created_at DESC
);


-- ============================================================
-- 48. TRIGGER FUNCTION:
--     UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.updated_at = NOW();

    RETURN NEW;

END;
$$;


-- ============================================================
-- 49. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS
    users_set_updated_at
ON users;

CREATE TRIGGER
    users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    profiles_set_updated_at
ON profiles;

CREATE TRIGGER
    profiles_set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    user_settings_set_updated_at
ON user_settings;

CREATE TRIGGER
    user_settings_set_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    user_stats_set_updated_at
ON user_stats;

CREATE TRIGGER
    user_stats_set_updated_at
BEFORE UPDATE ON user_stats
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    wallets_set_updated_at
ON wallets;

CREATE TRIGGER
    wallets_set_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    rooms_set_updated_at
ON rooms;

CREATE TRIGGER
    rooms_set_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    posts_set_updated_at
ON posts;

CREATE TRIGGER
    posts_set_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    post_comments_set_updated_at
ON post_comments;

CREATE TRIGGER
    post_comments_set_updated_at
BEFORE UPDATE ON post_comments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    conversations_set_updated_at
ON conversations;

CREATE TRIGGER
    conversations_set_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    store_items_set_updated_at
ON store_items;

CREATE TRIGGER
    store_items_set_updated_at
BEFORE UPDATE ON store_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    user_store_items_set_updated_at
ON user_store_items;

CREATE TRIGGER
    user_store_items_set_updated_at
BEFORE UPDATE ON user_store_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    vip_plans_set_updated_at
ON vip_plans;

CREATE TRIGGER
    vip_plans_set_updated_at
BEFORE UPDATE ON vip_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    reports_set_updated_at
ON reports;

CREATE TRIGGER
    reports_set_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    site_settings_set_updated_at
ON site_settings;

CREATE TRIGGER
    site_settings_set_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 50. CREATE USER RELATED RECORDS
-- ============================================================
--
-- عند إنشاء مستخدم حقيقي:
-- profiles
-- user_settings
-- user_stats
-- wallets
-- يتم إنشاؤها تلقائياً.
--
-- لا يتم إعطاء المستخدم أي Coins.
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_related_records()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    INSERT INTO profiles (
        user_id,
        display_name,
        gender
    )
    VALUES (
        NEW.id,
        NEW.username,
        NEW.gender
    )
    ON CONFLICT (user_id)
    DO NOTHING;


    INSERT INTO user_settings (
        user_id
    )
    VALUES (
        NEW.id
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


DROP TRIGGER IF EXISTS
    users_create_related_records
ON users;

CREATE TRIGGER
    users_create_related_records
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_related_records();


-- ============================================================
-- 51. FIRST USER = OWNER
-- ============================================================
--
-- أول مستخدم حقيقي فقط يحصل على Owner.
--
-- لا نعتمد على COUNT وحده داخل INSERT.
-- يتم فحص وجود Owner مع قفل مناسب للمعاملة.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_first_user_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    owner_exists BOOLEAN;
BEGIN

    SELECT EXISTS (
        SELECT 1
        FROM users
        WHERE role = 'owner'
          AND id <> NEW.id
          AND status <> 'deleted'
    )
    INTO owner_exists;


    IF NOT owner_exists THEN

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


-- ============================================================
-- 52. PREVENT MULTIPLE OWNERS
-- ============================================================
--
-- النظام يسمح بمالك واحد فقط.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    users_single_owner_idx
ON users (
    role
)
WHERE role = 'owner';


-- ============================================================
-- 53. LEVEL REWARD CLAIMS
-- ============================================================

CREATE TABLE IF NOT EXISTS level_reward_claims (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    level_number INTEGER
        NOT NULL
        REFERENCES levels(level_number)
        ON DELETE RESTRICT,

    reward_id UUID,

    claimed_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);

CREATE UNIQUE INDEX IF NOT EXISTS
    level_reward_claim_unique_idx
ON level_reward_claims (
    user_id,
    level_number,
    reward_id
);


-- ============================================================
-- 54. BASIC SYSTEM VALIDATION
-- ============================================================

DO $$
DECLARE
    required_table TEXT;
BEGIN

    FOREACH required_table IN ARRAY ARRAY[
        'users',
        'profiles',
        'user_settings',
        'user_stats',
        'wallets',
        'sessions',
        'password_reset_tokens',
        'verification_tokens',
        'follows',
        'blocked_users',
        'rooms',
        'room_members',
        'messages',
        'conversations',
        'conversation_members',
        'posts',
        'post_likes',
        'post_comments',
        'comment_likes',
        'gifts',
        'gift_transactions',
        'store_items',
        'user_store_items',
        'coin_transactions',
        'coin_transfers',
        'notifications',
        'levels',
        'badges',
        'user_badges',
        'vip_plans',
        'vip_benefits',
        'user_vip',
        'reports',
        'moderation_actions',
        'permissions',
        'role_permissions',
        'user_permissions',
        'site_settings',
        'audit_logs',
        'user_devices',
        'login_attempts'
    ]
    LOOP

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = required_table
        ) THEN

            RAISE EXCEPTION
                'Required table was not created: %',
                required_table;

        END IF;

    END LOOP;

END;
$$;


-- ============================================================
-- 55. VERIFY REQUIRED FUNCTIONS
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'set_updated_at'
    ) THEN

        RAISE EXCEPTION
            'set_updated_at function was not created';

    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'create_user_related_records'
    ) THEN

        RAISE EXCEPTION
            'create_user_related_records function was not created';

    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'assign_first_user_owner'
    ) THEN

        RAISE EXCEPTION
            'assign_first_user_owner function was not created';

    END IF;

END;
$$;


-- ============================================================
-- 56. FINAL SCHEMA MARKER
-- ============================================================
--
-- هذا السجل لا يحتوي على مستخدمين أو أرصدة أو محتوى.
-- هو مجرد إعداد داخلي لمعرفة أن الـ Schema اكتمل.
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_metadata (

    key VARCHAR(100)
        PRIMARY KEY,

    value VARCHAR(255)
        NOT NULL,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


INSERT INTO schema_metadata (
    key,
    value
)
VALUES (
    'schema_version',
    '1.0.0'
)
ON CONFLICT (key)
DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();


-- ============================================================
-- 57. FINAL COMMIT
-- ============================================================
--
-- نهاية schema.sql
-- ============================================================

COMMIT;
-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- CONTINUATION
--
-- PART 3
-- Coins
-- Wallet Transactions
-- Gifts
-- Gift Transactions
-- Store
-- Purchases
-- ============================================================


-- ============================================================
-- 27. COIN TRANSACTION TYPES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'coin_transaction_type'
    ) THEN

        CREATE TYPE coin_transaction_type AS ENUM (
            'purchase',
            'gift_sent',
            'gift_received',
            'level_reward',
            'admin_adjustment',
            'refund',
            'withdrawal',
            'room_support',
            'vip_purchase',
            'badge_purchase',
            'store_purchase'
        );

    END IF;
END
$$;


-- ============================================================
-- 28. COIN TRANSACTIONS
-- ============================================================
--
-- دفتر الحركات المالي الحقيقي.
--
-- لا يتم إنشاء أي حركة تلقائياً لمستخدم جديد.
-- ============================================================

CREATE TABLE IF NOT EXISTS coin_transactions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    type coin_transaction_type
        NOT NULL,

    amount BIGINT
        NOT NULL,

    balance_before BIGINT
        NOT NULL,

    balance_after BIGINT
        NOT NULL,

    reference_id UUID,

    reference_type VARCHAR(100),

    description TEXT,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT coin_transactions_amount_valid
        CHECK (amount <> 0),

    CONSTRAINT coin_transactions_balance_before_valid
        CHECK (balance_before >= 0),

    CONSTRAINT coin_transactions_balance_after_valid
        CHECK (balance_after >= 0)

);


CREATE INDEX IF NOT EXISTS
    coin_transactions_user_idx
ON coin_transactions (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    coin_transactions_type_idx
ON coin_transactions (
    type,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    coin_transactions_reference_idx
ON coin_transactions (
    reference_id
);


-- ============================================================
-- 29. GIFT CATALOG
-- ============================================================
--
-- تعريف الهدايا فقط.
-- لا توجد هدايا مرسلة لأي مستخدم هنا.
-- ============================================================

CREATE TABLE IF NOT EXISTS gifts (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    name VARCHAR(150)
        NOT NULL,

    description VARCHAR(500),

    image_url TEXT,

    animation_url TEXT,

    sound_url TEXT,

    price_coins BIGINT
        NOT NULL,

    rarity VARCHAR(50)
        NOT NULL
        DEFAULT 'common',

    category VARCHAR(100),

    display_order INTEGER
        NOT NULL
        DEFAULT 0,

    is_animated BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_featured BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT gifts_price_valid
        CHECK (price_coins > 0),

    CONSTRAINT gifts_order_valid
        CHECK (display_order >= 0)

);


CREATE INDEX IF NOT EXISTS
    gifts_active_idx
ON gifts (
    is_active,
    display_order
);


CREATE INDEX IF NOT EXISTS
    gifts_category_idx
ON gifts (
    category
);


CREATE INDEX IF NOT EXISTS
    gifts_rarity_idx
ON gifts (
    rarity
);


-- ============================================================
-- 30. GIFT TRANSACTIONS
-- ============================================================
--
-- كل عملية إرسال هدية حقيقية.
-- ============================================================

CREATE TABLE IF NOT EXISTS gift_transactions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    receiver_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    gift_id UUID
        NOT NULL
        REFERENCES gifts(id)
        ON DELETE RESTRICT,

    quantity INTEGER
        NOT NULL
        DEFAULT 1,

    unit_price BIGINT
        NOT NULL,

    total_price BIGINT
        NOT NULL,

    message TEXT,

    room_id UUID,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT gift_transactions_quantity_valid
        CHECK (quantity > 0),

    CONSTRAINT gift_transactions_unit_price_valid
        CHECK (unit_price > 0),

    CONSTRAINT gift_transactions_total_valid
        CHECK (total_price > 0),

    CONSTRAINT gift_transactions_users_different
        CHECK (sender_id <> receiver_id)

);


CREATE INDEX IF NOT EXISTS
    gift_transactions_sender_idx
ON gift_transactions (
    sender_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    gift_transactions_receiver_idx
ON gift_transactions (
    receiver_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    gift_transactions_gift_idx
ON gift_transactions (
    gift_id
);


-- ============================================================
-- 31. STORE CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS store_categories (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    name VARCHAR(150)
        NOT NULL,

    description VARCHAR(500),

    icon_url TEXT,

    display_order INTEGER
        NOT NULL
        DEFAULT 0,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    store_categories_active_idx
ON store_categories (
    is_active,
    display_order
);


-- ============================================================
-- 32. STORE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS store_items (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    category_id UUID
        REFERENCES store_categories(id)
        ON DELETE SET NULL,

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    name VARCHAR(150)
        NOT NULL,

    description VARCHAR(1000),

    image_url TEXT,

    item_type VARCHAR(100)
        NOT NULL,

    price_coins BIGINT
        NOT NULL,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    stock BIGINT,

    display_order INTEGER
        NOT NULL
        DEFAULT 0,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT store_items_price_valid
        CHECK (price_coins > 0),

    CONSTRAINT store_items_stock_valid
        CHECK (
            stock IS NULL
            OR stock >= 0
        )

);


CREATE INDEX IF NOT EXISTS
    store_items_category_idx
ON store_items (
    category_id
);


CREATE INDEX IF NOT EXISTS
    store_items_active_idx
ON store_items (
    is_active,
    display_order
);


-- ============================================================
-- 33. USER STORE ITEMS
-- ============================================================
--
-- المقتنيات الحقيقية للمستخدم.
-- لا يتم إنشاء أي مقتنيات عند بداية النظام.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_store_items (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    store_item_id UUID
        NOT NULL
        REFERENCES store_items(id)
        ON DELETE RESTRICT,

    quantity INTEGER
        NOT NULL
        DEFAULT 1,

    acquired_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    expires_at TIMESTAMPTZ,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    CONSTRAINT user_store_items_quantity_valid
        CHECK (quantity > 0)

);


CREATE INDEX IF NOT EXISTS
    user_store_items_user_idx
ON user_store_items (
    user_id,
    acquired_at DESC
);


CREATE INDEX IF NOT EXISTS
    user_store_items_item_idx
ON user_store_items (
    store_item_id
);


-- ============================================================
-- 34. STORE PURCHASES
-- ============================================================

CREATE TABLE IF NOT EXISTS store_purchases (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    store_item_id UUID
        NOT NULL
        REFERENCES store_items(id)
        ON DELETE RESTRICT,

    quantity INTEGER
        NOT NULL,

    unit_price BIGINT
        NOT NULL,

    total_price BIGINT
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT store_purchase_quantity_valid
        CHECK (quantity > 0),

    CONSTRAINT store_purchase_unit_price_valid
        CHECK (unit_price > 0),

    CONSTRAINT store_purchase_total_valid
        CHECK (total_price > 0)

);


CREATE INDEX IF NOT EXISTS
    store_purchases_user_idx
ON store_purchases (
    user_id,
    created_at DESC
);


-- ============================================================
-- 35. USER SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_sessions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT
        NOT NULL
        UNIQUE,

    ip_address INET,

    user_agent TEXT,

    device_name VARCHAR(200),

    expires_at TIMESTAMPTZ
        NOT NULL,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    last_used_at TIMESTAMPTZ,

    CONSTRAINT user_sessions_expiry_valid
        CHECK (expires_at > created_at)

);


CREATE INDEX IF NOT EXISTS
    user_sessions_user_idx
ON user_sessions (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    user_sessions_expiry_idx
ON user_sessions (
    expires_at
);


-- ============================================================
-- 36. PASSWORD RESET TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT
        NOT NULL
        UNIQUE,

    expires_at TIMESTAMPTZ
        NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    password_reset_user_idx
ON password_reset_tokens (
    user_id,
    created_at DESC
);


-- ============================================================
-- 37. EMAIL VERIFICATION TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS email_verification_tokens (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT
        NOT NULL
        UNIQUE,

    expires_at TIMESTAMPTZ
        NOT NULL,

    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    email_verification_user_idx
ON email_verification_tokens (
    user_id,
    created_at DESC
);


-- ============================================================
-- 38. USER BLOCKS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_blocks (

    blocker_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    blocked_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        blocker_id,
        blocked_id
    ),

    CONSTRAINT user_blocks_not_self
        CHECK (blocker_id <> blocked_id)

);


CREATE INDEX IF NOT EXISTS
    user_blocks_blocked_idx
ON user_blocks (
    blocked_id
);


-- ============================================================
-- 39. USER FOLLOWS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_follows (

    follower_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    following_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        follower_id,
        following_id
    ),

    CONSTRAINT user_follows_not_self
        CHECK (follower_id <> following_id)

);


CREATE INDEX IF NOT EXISTS
    user_follows_following_idx
ON user_follows (
    following_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    user_follows_follower_idx
ON user_follows (
    follower_id,
    created_at DESC
);


-- ============================================================
-- 40. NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(100)
        NOT NULL,

    title VARCHAR(200)
        NOT NULL,

    message TEXT,

    data JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_read BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    read_at TIMESTAMPTZ

);


CREATE INDEX IF NOT EXISTS
    notifications_user_idx
ON notifications (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    notifications_unread_idx
ON notifications (
    user_id,
    is_read,
    created_at DESC
);


-- ============================================================
-- 41. AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(150)
        NOT NULL,

    entity_type VARCHAR(100),

    entity_id UUID,

    ip_address INET,

    user_agent TEXT,

    details JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    audit_logs_user_idx
ON audit_logs (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    audit_logs_action_idx
ON audit_logs (
    action,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    audit_logs_entity_idx
ON audit_logs (
    entity_type,
    entity_id
);


-- ============================================================
-- 42. SITE SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS site_settings (

    key VARCHAR(150)
        PRIMARY KEY,

    value JSONB
        NOT NULL,

    description VARCHAR(500),

    is_public BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    updated_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


-- ============================================================
-- 43. USER SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (

    user_id UUID
        PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    language VARCHAR(20)
        NOT NULL
        DEFAULT 'ar',

    theme VARCHAR(30)
        NOT NULL
        DEFAULT 'dark',

    notifications_enabled BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    sounds_enabled BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    messages_from VARCHAR(30)
        NOT NULL
        DEFAULT 'everyone',

    profile_visibility VARCHAR(30)
        NOT NULL
        DEFAULT 'public',

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


-- ============================================================
-- 44. REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    reporter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reported_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    entity_type VARCHAR(100),

    entity_id UUID,

    reason VARCHAR(200)
        NOT NULL,

    description TEXT,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    handled_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    handled_at TIMESTAMPTZ,

    resolution TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT reports_status_valid
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'resolved',
                'rejected'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    reports_status_idx
ON reports (
    status,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    reports_reporter_idx
ON reports (
    reporter_id,
    created_at DESC
);


-- ============================================================
-- 45. CONTENT MODERATION ACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS moderation_actions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    moderator_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    target_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action_type VARCHAR(100)
        NOT NULL,

    reason TEXT,

    duration_minutes INTEGER,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    moderation_actions_target_idx
ON moderation_actions (
    target_user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    moderation_actions_moderator_idx
ON moderation_actions (
    moderator_id,
    created_at DESC
);


-- ============================================================
-- نهاية PART 3
-- ============================================================
--
-- لا يوجد COMMIT هنا.
-- ============================================================
-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 4 / 10
--
-- Rooms
-- Room Members
-- Room Roles
-- Room Permissions
-- Room Bans
-- Room Mutes
-- Room Messages
-- ============================================================


-- ============================================================
-- 46. ROOM TYPES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'room_type'
    ) THEN

        CREATE TYPE room_type AS ENUM (
            'public',
            'private',
            'protected'
        );

    END IF;
END
$$;


-- ============================================================
-- 47. ROOM STATUS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'room_status'
    ) THEN

        CREATE TYPE room_status AS ENUM (
            'active',
            'locked',
            'archived',
            'deleted'
        );

    END IF;
END
$$;


-- ============================================================
-- 48. ROOM MEMBER ROLES
-- ============================================================

DO $$
BEGIN
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
END
$$;


-- ============================================================
-- 49. ROOMS
-- ============================================================
--
-- غرف الدردشة الحقيقية.
--
-- لا يتم إنشاء أي غرف تجريبية.
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    owner_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    name VARCHAR(150)
        NOT NULL,

    slug VARCHAR(180)
        NOT NULL
        UNIQUE,

    description VARCHAR(1000),

    image_url TEXT,

    cover_url TEXT,

    room_type room_type
        NOT NULL
        DEFAULT 'public',

    status room_status
        NOT NULL
        DEFAULT 'active',

    password_hash TEXT,

    max_members INTEGER
        NOT NULL
        DEFAULT 100,

    is_featured BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_verified BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    allow_gifts BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_messages BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_media BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_links BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT rooms_name_valid
        CHECK (
            char_length(trim(name))
            BETWEEN 2 AND 150
        ),

    CONSTRAINT rooms_slug_valid
        CHECK (
            char_length(trim(slug))
            BETWEEN 2 AND 180
        ),

    CONSTRAINT rooms_max_members_valid
        CHECK (
            max_members > 0
        ),

    CONSTRAINT rooms_password_type_valid
        CHECK (
            room_type <> 'protected'
            OR password_hash IS NOT NULL
        )

);


-- ============================================================
-- 50. ROOM INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    rooms_owner_idx
ON rooms (
    owner_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    rooms_status_idx
ON rooms (
    status,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    rooms_type_idx
ON rooms (
    room_type,
    status
);

CREATE INDEX IF NOT EXISTS
    rooms_featured_idx
ON rooms (
    is_featured,
    status,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    rooms_verified_idx
ON rooms (
    is_verified,
    status,
    created_at DESC
);


-- ============================================================
-- 51. ROOM MEMBERS
-- ============================================================
--
-- الأعضاء الحقيقيون للغرف.
-- ============================================================

CREATE TABLE IF NOT EXISTS room_members (

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role room_member_role
        NOT NULL
        DEFAULT 'member',

    is_muted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_banned BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    joined_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    left_at TIMESTAMPTZ,

    last_seen_at TIMESTAMPTZ,

    PRIMARY KEY (
        room_id,
        user_id
    ),

    CONSTRAINT room_members_dates_valid
        CHECK (
            left_at IS NULL
            OR left_at >= joined_at
        )

);


-- ============================================================
-- 52. ROOM MEMBER INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    room_members_user_idx
ON room_members (
    user_id,
    joined_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_members_room_role_idx
ON room_members (
    room_id,
    role
);

CREATE INDEX IF NOT EXISTS
    room_members_active_idx
ON room_members (
    room_id,
    left_at
);


-- ============================================================
-- 53. ROOM PERMISSIONS
-- ============================================================
--
-- الصلاحيات الخاصة بكل دور داخل الغرفة.
-- ============================================================

CREATE TABLE IF NOT EXISTS room_permissions (

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    role room_member_role
        NOT NULL,

    can_send_messages BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    can_delete_messages BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    can_mute_members BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    can_ban_members BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    can_manage_members BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    can_manage_room BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    can_send_gifts BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    can_pin_messages BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    can_delete_room BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        room_id,
        role
    )

);


CREATE INDEX IF NOT EXISTS
    room_permissions_role_idx
ON room_permissions (
    role
);


-- ============================================================
-- 54. ROOM BANS
-- ============================================================
--
-- حظر المستخدمين من الغرف.
-- ============================================================

CREATE TABLE IF NOT EXISTS room_bans (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    banned_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reason TEXT,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    revoked_at TIMESTAMPTZ,

    CONSTRAINT room_bans_expiry_valid
        CHECK (
            expires_at IS NULL
            OR expires_at > created_at
        )

);


CREATE INDEX IF NOT EXISTS
    room_bans_room_idx
ON room_bans (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_bans_user_idx
ON room_bans (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_bans_active_idx
ON room_bans (
    room_id,
    user_id,
    revoked_at,
    expires_at
);


-- ============================================================
-- 55. ROOM MUTES
-- ============================================================

CREATE TABLE IF NOT EXISTS room_mutes (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    muted_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reason TEXT,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    revoked_at TIMESTAMPTZ,

    CONSTRAINT room_mutes_expiry_valid
        CHECK (
            expires_at IS NULL
            OR expires_at > created_at
        )

);


CREATE INDEX IF NOT EXISTS
    room_mutes_room_idx
ON room_mutes (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_mutes_user_idx
ON room_mutes (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_mutes_active_idx
ON room_mutes (
    room_id,
    user_id,
    revoked_at,
    expires_at
);


-- ============================================================
-- 56. ROOM MESSAGES
-- ============================================================
--
-- رسائل غرف الدردشة الحقيقية.
-- ============================================================

CREATE TABLE IF NOT EXISTS room_messages (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reply_to_id UUID
        REFERENCES room_messages(id)
        ON DELETE SET NULL,

    content TEXT,

    message_type VARCHAR(50)
        NOT NULL
        DEFAULT 'text',

    media_url TEXT,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_messages_content_valid
        CHECK (
            content IS NOT NULL
            OR media_url IS NOT NULL
        ),

    CONSTRAINT room_messages_content_length
        CHECK (
            content IS NULL
            OR char_length(content) <= 10000
        )

);


-- ============================================================
-- 57. ROOM MESSAGE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    room_messages_room_idx
ON room_messages (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_messages_user_idx
ON room_messages (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_messages_reply_idx
ON room_messages (
    reply_to_id
);

CREATE INDEX IF NOT EXISTS
    room_messages_type_idx
ON room_messages (
    room_id,
    message_type,
    created_at DESC
);


-- ============================================================
-- 58. ROOM MESSAGE REACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_message_reactions (

    message_id UUID
        NOT NULL
        REFERENCES room_messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction VARCHAR(50)
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id,
        reaction
    )

);


CREATE INDEX IF NOT EXISTS
    room_message_reactions_user_idx
ON room_message_reactions (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_message_reactions_message_idx
ON room_message_reactions (
    message_id,
    reaction
);


-- ============================================================
-- 59. ROOM PINNED MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS room_pinned_messages (

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    message_id UUID
        NOT NULL
        REFERENCES room_messages(id)
        ON DELETE CASCADE,

    pinned_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        room_id,
        message_id
    )

);


CREATE INDEX IF NOT EXISTS
    room_pinned_messages_message_idx
ON room_pinned_messages (
    message_id
);


-- ============================================================
-- 60. ROOM JOIN REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_join_requests (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    message TEXT,

    reviewed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_join_requests_status_valid
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected',
                'cancelled'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    room_join_requests_room_idx
ON room_join_requests (
    room_id,
    status,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_join_requests_user_idx
ON room_join_requests (
    user_id,
    created_at DESC
);


-- ============================================================
-- 61. ROOM INVITATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_invitations (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    inviter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    invitee_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    responded_at TIMESTAMPTZ,

    CONSTRAINT room_invitations_status_valid
        CHECK (
            status IN (
                'pending',
                'accepted',
                'declined',
                'expired',
                'cancelled'
            )
        ),

    CONSTRAINT room_invitations_users_different
        CHECK (
            inviter_id <> invitee_id
        )

);


CREATE INDEX IF NOT EXISTS
    room_invitations_room_idx
ON room_invitations (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_invitations_invitee_idx
ON room_invitations (
    invitee_id,
    status,
    created_at DESC
);


-- ============================================================
-- 62. ROOM SUPPORT TRANSACTIONS
-- ============================================================
--
-- دعم الغرف بالـ Coins.
-- العملية المالية الفعلية يتم تسجيلها هنا.
-- ============================================================

CREATE TABLE IF NOT EXISTS room_support_transactions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    amount BIGINT
        NOT NULL,

    message TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_support_amount_valid
        CHECK (
            amount > 0
        )

);


CREATE INDEX IF NOT EXISTS
    room_support_room_idx
ON room_support_transactions (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_support_sender_idx
ON room_support_transactions (
    sender_id,
    created_at DESC
);


-- ============================================================
-- 63. ROOM VIEWERS / PRESENCE
-- ============================================================
--
-- حالة وجود المستخدم داخل الغرفة.
-- تستخدم مع Socket.IO لاحقاً.
-- ============================================================

CREATE TABLE IF NOT EXISTS room_presence (

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    socket_id VARCHAR(255),

    joined_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    last_seen_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        room_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    room_presence_user_idx
ON room_presence (
    user_id,
    last_seen_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_presence_socket_idx
ON room_presence (
    socket_id
);


-- ============================================================
-- 64. ROOM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_settings (

    room_id UUID
        PRIMARY KEY
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    slow_mode_seconds INTEGER
        NOT NULL
        DEFAULT 0,

    max_message_length INTEGER
        NOT NULL
        DEFAULT 5000,

    allow_images BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_videos BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_audio BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_files BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_mentions BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    require_join_approval BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_settings_slow_mode_valid
        CHECK (
            slow_mode_seconds >= 0
        ),

    CONSTRAINT room_settings_message_length_valid
        CHECK (
            max_message_length > 0
        )

);
-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 5 / 10
--
-- Messages
-- Conversations
-- Conversation Members
-- Message Reactions
-- Message Attachments
-- Message Replies
-- Message Mentions
-- Message Reports
-- ============================================================


-- ============================================================
-- 66. CONVERSATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    type VARCHAR(30)
        NOT NULL
        DEFAULT 'private',

    name VARCHAR(150),

    description VARCHAR(500),

    image_url TEXT,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    last_message_id UUID,

    last_message_at TIMESTAMPTZ,

    messages_count BIGINT
        NOT NULL
        DEFAULT 0,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT conversations_type_valid
        CHECK (
            type IN (
                'private',
                'group'
            )
        ),

    CONSTRAINT conversations_messages_count_valid
        CHECK (messages_count >= 0)

);


CREATE INDEX IF NOT EXISTS
    conversations_created_by_idx
ON conversations (
    created_by
);


CREATE INDEX IF NOT EXISTS
    conversations_last_message_idx
ON conversations (
    last_message_at DESC
);


CREATE INDEX IF NOT EXISTS
    conversations_active_idx
ON conversations (
    is_active,
    updated_at DESC
);


-- ============================================================
-- 67. CONVERSATION MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_members (

    conversation_id UUID
        NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role VARCHAR(30)
        NOT NULL
        DEFAULT 'member',

    nickname VARCHAR(100),

    is_muted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_archived BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_pinned BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    joined_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    last_read_at TIMESTAMPTZ,

    left_at TIMESTAMPTZ,

    PRIMARY KEY (
        conversation_id,
        user_id
    ),

    CONSTRAINT conversation_members_role_valid
        CHECK (
            role IN (
                'owner',
                'admin',
                'member'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    conversation_members_user_idx
ON conversation_members (
    user_id,
    joined_at DESC
);


CREATE INDEX IF NOT EXISTS
    conversation_members_active_idx
ON conversation_members (
    conversation_id,
    left_at
);


-- ============================================================
-- 68. MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    conversation_id UUID
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    room_id UUID
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reply_to_id UUID,

    content TEXT,

    message_type VARCHAR(30)
        NOT NULL
        DEFAULT 'text',

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT messages_type_valid
        CHECK (
            message_type IN (
                'text',
                'image',
                'video',
                'audio',
                'file',
                'gift',
                'system'
            )
        ),

    CONSTRAINT messages_destination_valid
        CHECK (
            conversation_id IS NOT NULL
            OR room_id IS NOT NULL
        ),

    CONSTRAINT messages_content_valid
        CHECK (
            content IS NOT NULL
            OR message_type <> 'text'
        )

);


CREATE INDEX IF NOT EXISTS
    messages_conversation_idx
ON messages (
    conversation_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    messages_room_idx
ON messages (
    room_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    messages_sender_idx
ON messages (
    sender_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    messages_reply_idx
ON messages (
    reply_to_id
);


CREATE INDEX IF NOT EXISTS
    messages_deleted_idx
ON messages (
    is_deleted,
    created_at DESC
);


-- ============================================================
-- 69. MESSAGE REPLIES
-- ============================================================

CREATE TABLE IF NOT EXISTS message_replies (

    message_id UUID
        PRIMARY KEY
        REFERENCES messages(id)
        ON DELETE CASCADE,

    replied_to_message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT message_replies_not_self
        CHECK (
            message_id <> replied_to_message_id
        )

);


CREATE INDEX IF NOT EXISTS
    message_replies_target_idx
ON message_replies (
    replied_to_message_id
);


-- ============================================================
-- 70. MESSAGE ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_attachments (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    attachment_type VARCHAR(30)
        NOT NULL,

    file_url TEXT
        NOT NULL,

    file_name VARCHAR(255),

    mime_type VARCHAR(150),

    file_size BIGINT,

    width INTEGER,

    height INTEGER,

    duration_seconds INTEGER,

    thumbnail_url TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT message_attachments_type_valid
        CHECK (
            attachment_type IN (
                'image',
                'video',
                'audio',
                'file'
            )
        ),

    CONSTRAINT message_attachments_size_valid
        CHECK (
            file_size IS NULL
            OR file_size >= 0
        ),

    CONSTRAINT message_attachments_width_valid
        CHECK (
            width IS NULL
            OR width > 0
        ),

    CONSTRAINT message_attachments_height_valid
        CHECK (
            height IS NULL
            OR height > 0
        ),

    CONSTRAINT message_attachments_duration_valid
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        )

);


CREATE INDEX IF NOT EXISTS
    message_attachments_message_idx
ON message_attachments (
    message_id,
    created_at
);


-- ============================================================
-- 71. MESSAGE REACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_reactions (

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction VARCHAR(50)
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id,
        reaction
    )

);


CREATE INDEX IF NOT EXISTS
    message_reactions_message_idx
ON message_reactions (
    message_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    message_reactions_user_idx
ON message_reactions (
    user_id,
    created_at DESC
);


-- ============================================================
-- 72. MESSAGE READ RECEIPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_read_receipts (

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    read_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    message_read_receipts_user_idx
ON message_read_receipts (
    user_id,
    read_at DESC
);


-- ============================================================
-- 73. MESSAGE MENTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_mentions (

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    mentioned_user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        mentioned_user_id
    )

);


CREATE INDEX IF NOT EXISTS
    message_mentions_user_idx
ON message_mentions (
    mentioned_user_id,
    created_at DESC
);


-- ============================================================
-- 74. MESSAGE REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_reports (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    reporter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reason VARCHAR(200)
        NOT NULL,

    description TEXT,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    handled_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    handled_at TIMESTAMPTZ,

    resolution TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT message_reports_status_valid
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'resolved',
                'rejected'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    message_reports_message_idx
ON message_reports (
    message_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    message_reports_reporter_idx
ON message_reports (
    reporter_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    message_reports_status_idx
ON message_reports (
    status,
    created_at DESC
);


-- ============================================================
-- 75. MESSAGE DELETIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_deletions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    deleted_by UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    reason VARCHAR(500),

    deleted_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    message_deletions_message_idx
ON message_deletions (
    message_id,
    deleted_at DESC
);


CREATE INDEX IF NOT EXISTS
    message_deletions_user_idx
ON message_deletions (
    deleted_by,
    deleted_at DESC
);


-- ============================================================
-- 76. MESSAGE EDIT HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS message_edit_history (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    editor_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    old_content TEXT,

    new_content TEXT,

    edited_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    message_edit_history_message_idx
ON message_edit_history (
    message_id,
    edited_at DESC
);


-- ============================================================
-- 77. CONVERSATION MESSAGE SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_settings (

    conversation_id UUID
        PRIMARY KEY
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    allow_media BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_links BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_reactions BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_replies BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    disappearing_messages BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    disappearing_after_seconds INTEGER,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT conversation_disappearing_valid
        CHECK (
            disappearing_after_seconds IS NULL
            OR disappearing_after_seconds > 0
        )

);


-- ============================================================
-- 78. CONVERSATION INVITES
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_invites (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    conversation_id UUID
        NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    inviter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    invited_user_id UUID
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT
        UNIQUE,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    expires_at TIMESTAMPTZ,

    accepted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT conversation_invites_status_valid
        CHECK (
            status IN (
                'pending',
                'accepted',
                'declined',
                'expired',
                'cancelled'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    conversation_invites_conversation_idx
ON conversation_invites (
    conversation_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    conversation_invites_user_idx
ON conversation_invites (
    invited_user_id,
    status,
    created_at DESC
);


-- ============================================================
-- 79. CONVERSATION CALLS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_calls (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    conversation_id UUID
        NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    caller_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    call_type VARCHAR(30)
        NOT NULL,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'started',

    started_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    answered_at TIMESTAMPTZ,

    ended_at TIMESTAMPTZ,

    duration_seconds BIGINT,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    CONSTRAINT conversation_calls_type_valid
        CHECK (
            call_type IN (
                'audio',
                'video'
            )
        ),

    CONSTRAINT conversation_calls_status_valid
        CHECK (
            status IN (
                'started',
                'ringing',
                'answered',
                'ended',
                'missed',
                'rejected',
                'failed'
            )
        ),

    CONSTRAINT conversation_calls_duration_valid
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        )

);


CREATE INDEX IF NOT EXISTS
    conversation_calls_conversation_idx
ON conversation_calls (
    conversation_id,
    started_at DESC
);


CREATE INDEX IF NOT EXISTS
    conversation_calls_caller_idx
ON conversation_calls (
    caller_id,
    started_at DESC
);


-- ============================================================
-- 80. CONVERSATION CALL PARTICIPANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_call_participants (

    call_id UUID
        NOT NULL
        REFERENCES conversation_calls(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    joined_at TIMESTAMPTZ,

    left_at TIMESTAMPTZ,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'invited',

    PRIMARY KEY (
        call_id,
        user_id
    ),

    CONSTRAINT conversation_call_participant_status_valid
        CHECK (
            status IN (
                'invited',
                'ringing',
                'joined',
                'left',
                'rejected',
                'missed'
            )
        ),

    CONSTRAINT conversation_call_participant_dates_valid
        CHECK (
            left_at IS NULL
            OR joined_at IS NULL
            OR left_at >= joined_at
        )

);


CREATE INDEX IF NOT EXISTS
    conversation_call_participants_user_idx
ON conversation_call_participants (
    user_id,
    joined_at DESC
);


-- ============================================================
-- 81. MESSAGE BOOKMARKS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_bookmarks (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        message_id
    )

);


CREATE INDEX IF NOT EXISTS
    message_bookmarks_message_idx
ON message_bookmarks (
    message_id,
    created_at DESC
);


-- ============================================================
-- 82. USER TYPING STATUS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_typing_status (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    conversation_id UUID
        NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    started_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        conversation_id
    )

);


CREATE INDEX IF NOT EXISTS
    user_typing_status_conversation_idx
ON user_typing_status (
    conversation_id,
    updated_at DESC
);


-- ============================================================
-- 83. MESSAGE DELIVERY STATUS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_delivery_status (

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'sent',

    delivered_at TIMESTAMPTZ,

    read_at TIMESTAMPTZ,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id
    ),

    CONSTRAINT message_delivery_status_valid
        CHECK (
            status IN (
                'sent',
                'delivered',
                'read',
                'failed'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    message_delivery_status_user_idx
ON message_delivery_status (
    user_id,
    updated_at DESC
);


-- ============================================================
-- نهاية PART 5
-- ============================================================
--
-- لا يوجد COMMIT هنا.
-- الجزء السادس سيكمل نفس الملف مباشرة.
-- ============================================================
-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 6 / 10
--
-- Rooms
-- Room Members
-- Room Roles
-- Room Messages
-- Direct Messages
-- Message Attachments
-- Message Reactions
-- ============================================================


-- ============================================================
-- 60. ROOM TYPES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'room_type'
    ) THEN

        CREATE TYPE room_type AS ENUM (
            'public',
            'private',
            'vip'
        );

    END IF;
END
$$;


-- ============================================================
-- 61. ROOM STATUS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'room_status'
    ) THEN

        CREATE TYPE room_status AS ENUM (
            'active',
            'locked',
            'suspended',
            'deleted'
        );

    END IF;
END
$$;


-- ============================================================
-- 62. ROOM MEMBER ROLES
-- ============================================================

DO $$
BEGIN
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
END
$$;


-- ============================================================
-- 63. MESSAGE TYPES
-- ============================================================

DO $$
BEGIN
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
END
$$;


-- ============================================================
-- 64. ROOMS
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    owner_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    name VARCHAR(150)
        NOT NULL,

    description VARCHAR(1000),

    image_url TEXT,

    cover_url TEXT,

    room_type room_type
        NOT NULL
        DEFAULT 'public',

    status room_status
        NOT NULL
        DEFAULT 'active',

    password_hash TEXT,

    max_members INTEGER
        NOT NULL
        DEFAULT 100,

    is_featured BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_verified BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    allow_gifts BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_messages BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_media BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_links BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    coins_received BIGINT
        NOT NULL
        DEFAULT 0,

    members_count BIGINT
        NOT NULL
        DEFAULT 0,

    messages_count BIGINT
        NOT NULL
        DEFAULT 0,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT rooms_name_valid
        CHECK (
            char_length(trim(name))
            BETWEEN 2 AND 150
        ),

    CONSTRAINT rooms_max_members_valid
        CHECK (max_members > 0),

    CONSTRAINT rooms_coins_received_valid
        CHECK (coins_received >= 0),

    CONSTRAINT rooms_members_count_valid
        CHECK (members_count >= 0),

    CONSTRAINT rooms_messages_count_valid
        CHECK (messages_count >= 0)

);


CREATE INDEX IF NOT EXISTS
    rooms_owner_idx
ON rooms (
    owner_id
);

CREATE INDEX IF NOT EXISTS
    rooms_status_idx
ON rooms (
    status
);

CREATE INDEX IF NOT EXISTS
    rooms_type_idx
ON rooms (
    room_type
);

CREATE INDEX IF NOT EXISTS
    rooms_featured_idx
ON rooms (
    is_featured,
    status
);

CREATE INDEX IF NOT EXISTS
    rooms_created_idx
ON rooms (
    created_at DESC
);


-- ============================================================
-- 65. ROOM MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_members (

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role room_member_role
        NOT NULL
        DEFAULT 'member',

    is_muted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_banned BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    joined_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    last_seen_at TIMESTAMPTZ,

    PRIMARY KEY (
        room_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    room_members_user_idx
ON room_members (
    user_id,
    joined_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_members_role_idx
ON room_members (
    room_id,
    role
);

CREATE INDEX IF NOT EXISTS
    room_members_active_idx
ON room_members (
    room_id,
    is_banned
);


-- ============================================================
-- 66. ROOM INVITES
-- ============================================================

CREATE TABLE IF NOT EXISTS room_invites (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    inviter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    invited_user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    responded_at TIMESTAMPTZ,

    CONSTRAINT room_invites_status_valid
        CHECK (
            status IN (
                'pending',
                'accepted',
                'declined',
                'expired',
                'cancelled'
            )
        ),

    CONSTRAINT room_invites_users_valid
        CHECK (
            inviter_id <> invited_user_id
        )

);


CREATE INDEX IF NOT EXISTS
    room_invites_room_idx
ON room_invites (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_invites_user_idx
ON room_invites (
    invited_user_id,
    status,
    created_at DESC
);


-- ============================================================
-- 67. ROOM BANS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_bans (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    banned_by UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    reason TEXT,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    revoked_at TIMESTAMPTZ

);


CREATE INDEX IF NOT EXISTS
    room_bans_room_idx
ON room_bans (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_bans_user_idx
ON room_bans (
    user_id,
    created_at DESC
);


-- ============================================================
-- 68. ROOM MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS room_messages (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    message_type message_type
        NOT NULL
        DEFAULT 'text',

    content TEXT,

    reply_to_id UUID,

    gift_transaction_id UUID
        REFERENCES gift_transactions(id)
        ON DELETE SET NULL,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_messages_content_valid
        CHECK (
            content IS NOT NULL
            OR message_type <> 'text'
        )

);


ALTER TABLE room_messages
DROP CONSTRAINT IF EXISTS room_messages_reply_fk;

ALTER TABLE room_messages
ADD CONSTRAINT room_messages_reply_fk
FOREIGN KEY (reply_to_id)
REFERENCES room_messages(id)
ON DELETE SET NULL;


CREATE INDEX IF NOT EXISTS
    room_messages_room_idx
ON room_messages (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_messages_sender_idx
ON room_messages (
    sender_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_messages_reply_idx
ON room_messages (
    reply_to_id
);


-- ============================================================
-- 69. ROOM MESSAGE REACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_message_reactions (

    message_id UUID
        NOT NULL
        REFERENCES room_messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction VARCHAR(50)
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id,
        reaction
    )

);


CREATE INDEX IF NOT EXISTS
    room_message_reactions_message_idx
ON room_message_reactions (
    message_id
);

CREATE INDEX IF NOT EXISTS
    room_message_reactions_user_idx
ON room_message_reactions (
    user_id,
    created_at DESC
);


-- ============================================================
-- 70. MESSAGE ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_attachments (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_message_id UUID
        REFERENCES room_messages(id)
        ON DELETE CASCADE,

    direct_message_id UUID,

    file_url TEXT
        NOT NULL,

    file_name VARCHAR(255),

    mime_type VARCHAR(150),

    file_size BIGINT,

    width INTEGER,

    height INTEGER,

    duration_seconds INTEGER,

    thumbnail_url TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT message_attachments_message_valid
        CHECK (
            room_message_id IS NOT NULL
            OR direct_message_id IS NOT NULL
        ),

    CONSTRAINT message_attachments_size_valid
        CHECK (
            file_size IS NULL
            OR file_size >= 0
        )

);


CREATE INDEX IF NOT EXISTS
    message_attachments_room_message_idx
ON message_attachments (
    room_message_id
);

CREATE INDEX IF NOT EXISTS
    message_attachments_direct_message_idx
ON message_attachments (
    direct_message_id
);


-- ============================================================
-- 71. DIRECT CONVERSATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS direct_conversations (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_one_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    user_two_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT direct_conversations_users_different
        CHECK (
            user_one_id <> user_two_id
        )

);


CREATE UNIQUE INDEX IF NOT EXISTS
    direct_conversations_pair_idx
ON direct_conversations (
    LEAST(user_one_id, user_two_id),
    GREATEST(user_one_id, user_two_id)
);


CREATE INDEX IF NOT EXISTS
    direct_conversations_user_one_idx
ON direct_conversations (
    user_one_id,
    updated_at DESC
);

CREATE INDEX IF NOT EXISTS
    direct_conversations_user_two_idx
ON direct_conversations (
    user_two_id,
    updated_at DESC
);


-- ============================================================
-- 72. DIRECT MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS direct_messages (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    conversation_id UUID
        NOT NULL
        REFERENCES direct_conversations(id)
        ON DELETE CASCADE,

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    receiver_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    message_type message_type
        NOT NULL
        DEFAULT 'text',

    content TEXT,

    reply_to_id UUID,

    gift_transaction_id UUID
        REFERENCES gift_transactions(id)
        ON DELETE SET NULL,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_read BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    read_at TIMESTAMPTZ,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT direct_messages_users_valid
        CHECK (
            sender_id <> receiver_id
        ),

    CONSTRAINT direct_messages_content_valid
        CHECK (
            content IS NOT NULL
            OR message_type <> 'text'
        )

);


ALTER TABLE direct_messages
DROP CONSTRAINT IF EXISTS direct_messages_reply_fk;

ALTER TABLE direct_messages
ADD CONSTRAINT direct_messages_reply_fk
FOREIGN KEY (reply_to_id)
REFERENCES direct_messages(id)
ON DELETE SET NULL;


CREATE INDEX IF NOT EXISTS
    direct_messages_conversation_idx
ON direct_messages (
    conversation_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    direct_messages_sender_idx
ON direct_messages (
    sender_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    direct_messages_receiver_idx
ON direct_messages (
    receiver_id,
    is_read,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    direct_messages_reply_idx
ON direct_messages (
    reply_to_id
);


-- ============================================================
-- 73. DIRECT MESSAGE REACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS direct_message_reactions (

    message_id UUID
        NOT NULL
        REFERENCES direct_messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction VARCHAR(50)
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id,
        reaction
    )

);


CREATE INDEX IF NOT EXISTS
    direct_message_reactions_message_idx
ON direct_message_reactions (
    message_id
);

CREATE INDEX IF NOT EXISTS
    direct_message_reactions_user_idx
ON direct_message_reactions (
    user_id,
    created_at DESC
);


-- ============================================================
-- 74. DIRECT MESSAGE DELETIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS direct_message_deletions (

    message_id UUID
        NOT NULL
        REFERENCES direct_messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    deleted_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    direct_message_deletions_user_idx
ON direct_message_deletions (
    user_id,
    deleted_at DESC
);


-- ============================================================
-- 75. ROOM MESSAGE READS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_message_reads (

    message_id UUID
        NOT NULL
        REFERENCES room_messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    read_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    room_message_reads_user_idx
ON room_message_reads (
    user_id,
    read_at DESC
);


-- ============================================================
-- 76. ROOM SUPPORT TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_support_transactions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    amount BIGINT
        NOT NULL,

    coin_transaction_id UUID
        REFERENCES coin_transactions(id)
        ON DELETE SET NULL,

    message TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_support_amount_valid
        CHECK (amount > 0)

);


CREATE INDEX IF NOT EXISTS
    room_support_room_idx
ON room_support_transactions (
    room_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_support_sender_idx
ON room_support_transactions (
    sender_id,
    created_at DESC
);


-- ============================================================
-- 77. ROOM PINNED MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS room_pinned_messages (

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    message_id UUID
        NOT NULL
        REFERENCES room_messages(id)
        ON DELETE CASCADE,

    pinned_by UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        room_id,
        message_id
    )

);


CREATE INDEX IF NOT EXISTS
    room_pinned_messages_room_idx
ON room_pinned_messages (
    room_id,
    created_at DESC
);


-- ============================================================
-- 78. ROOM JOIN REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_join_requests (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    reviewed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_join_requests_status_valid
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected',
                'cancelled'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    room_join_requests_room_idx
ON room_join_requests (
    room_id,
    status,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    room_join_requests_user_idx
ON room_join_requests (
    user_id,
    created_at DESC
);


-- ============================================================
-- 79. ROOM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_settings (

    room_id UUID
        PRIMARY KEY
        REF
  -- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 7 / 10
--
-- Posts
-- Comments
-- Likes
-- Saves
-- Hashtags
-- Mentions
-- ============================================================


-- ============================================================
-- 81. POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    content TEXT,

    visibility VARCHAR(30)
        NOT NULL
        DEFAULT 'public',

    allow_comments BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_likes BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    comments_count BIGINT
        NOT NULL
        DEFAULT 0,

    likes_count BIGINT
        NOT NULL
        DEFAULT 0,

    views_count BIGINT
        NOT NULL
        DEFAULT 0,

    shares_count BIGINT
        NOT NULL
        DEFAULT 0,

    is_pinned BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT posts_visibility_valid
        CHECK (
            visibility IN (
                'public',
                'followers',
                'private'
            )
        ),

    CONSTRAINT posts_content_valid
        CHECK (
            content IS NOT NULL
            OR is_deleted = TRUE
        ),

    CONSTRAINT posts_comments_count_valid
        CHECK (comments_count >= 0),

    CONSTRAINT posts_likes_count_valid
        CHECK (likes_count >= 0),

    CONSTRAINT posts_views_count_valid
        CHECK (views_count >= 0),

    CONSTRAINT posts_shares_count_valid
        CHECK (shares_count >= 0)

);


CREATE INDEX IF NOT EXISTS
    posts_user_idx
ON posts (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    posts_visibility_idx
ON posts (
    visibility,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    posts_active_idx
ON posts (
    is_deleted,
    created_at DESC
);


-- ============================================================
-- 82. POST MEDIA
-- ============================================================

CREATE TABLE IF NOT EXISTS post_media (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    media_type VARCHAR(30)
        NOT NULL,

    media_url TEXT
        NOT NULL,

    thumbnail_url TEXT,

    file_name VARCHAR(255),

    mime_type VARCHAR(150),

    file_size BIGINT,

    width INTEGER,

    height INTEGER,

    duration_seconds INTEGER,

    display_order INTEGER
        NOT NULL
        DEFAULT 0,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT post_media_type_valid
        CHECK (
            media_type IN (
                'image',
                'video',
                'audio',
                'file'
            )
        ),

    CONSTRAINT post_media_size_valid
        CHECK (
            file_size IS NULL
            OR file_size >= 0
        ),

    CONSTRAINT post_media_order_valid
        CHECK (display_order >= 0)

);


CREATE INDEX IF NOT EXISTS
    post_media_post_idx
ON post_media (
    post_id,
    display_order
);


-- ============================================================
-- 83. POST LIKES
-- ============================================================

CREATE TABLE IF NOT EXISTS post_likes (

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        post_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    post_likes_user_idx
ON post_likes (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    post_likes_post_idx
ON post_likes (
    post_id,
    created_at DESC
);


-- ============================================================
-- 84. POST SAVES
-- ============================================================

CREATE TABLE IF NOT EXISTS post_saves (

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        post_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    post_saves_user_idx
ON post_saves (
    user_id,
    created_at DESC
);


-- ============================================================
-- 85. POST VIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS post_views (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    ip_address INET,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    post_views_post_idx
ON post_views (
    post_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    post_views_user_idx
ON post_views (
    user_id,
    created_at DESC
);


-- ============================================================
-- 86. POST SHARES
-- ============================================================

CREATE TABLE IF NOT EXISTS post_shares (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    post_shares_post_idx
ON post_shares (
    post_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    post_shares_user_idx
ON post_shares (
    user_id,
    created_at DESC
);


-- ============================================================
-- 87. COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    parent_id UUID,

    content TEXT
        NOT NULL,

    likes_count BIGINT
        NOT NULL
        DEFAULT 0,

    replies_count BIGINT
        NOT NULL
        DEFAULT 0,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT comments_content_valid
        CHECK (
            char_length(trim(content)) > 0
        ),

    CONSTRAINT comments_likes_valid
        CHECK (likes_count >= 0),

    CONSTRAINT comments_replies_valid
        CHECK (replies_count >= 0)

);


ALTER TABLE comments
DROP CONSTRAINT IF EXISTS comments_parent_fk;

ALTER TABLE comments
ADD CONSTRAINT comments_parent_fk
FOREIGN KEY (parent_id)
REFERENCES comments(id)
ON DELETE CASCADE;


CREATE INDEX IF NOT EXISTS
    comments_post_idx
ON comments (
    post_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    comments_user_idx
ON comments (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    comments_parent_idx
ON comments (
    parent_id,
    created_at ASC
);


-- ============================================================
-- 88. COMMENT LIKES
-- ============================================================

CREATE TABLE IF NOT EXISTS comment_likes (

    comment_id UUID
        NOT NULL
        REFERENCES comments(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        comment_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    comment_likes_user_idx
ON comment_likes (
    user_id,
    created_at DESC
);


-- ============================================================
-- 89. HASHTAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS hashtags (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    tag VARCHAR(100)
        NOT NULL
        UNIQUE,

    posts_count BIGINT
        NOT NULL
        DEFAULT 0,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT hashtags_count_valid
        CHECK (posts_count >= 0)

);


CREATE INDEX IF NOT EXISTS
    hashtags_tag_idx
ON hashtags (
    LOWER(tag)
);


-- ============================================================
-- 90. POST HASHTAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS post_hashtags (

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    hashtag_id UUID
        NOT NULL
        REFERENCES hashtags(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        post_id,
        hashtag_id
    )

);


CREATE INDEX IF NOT EXISTS
    post_hashtags_hashtag_idx
ON post_hashtags (
    hashtag_id,
    created_at DESC
);


-- ============================================================
-- 91. USER MENTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_mentions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        REFERENCES posts(id)
        ON DELETE CASCADE,

    comment_id UUID
        REFERENCES comments(id)
        ON DELETE CASCADE,

    mentioned_user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    mentioned_by UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT user_mentions_source_valid
        CHECK (
            post_id IS NOT NULL
            OR comment_id IS NOT NULL
        )

);


CREATE INDEX IF NOT EXISTS
    user_mentions_user_idx
ON user_mentions (
    mentioned_user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    user_mentions_post_idx
ON user_mentions (
    post_id
);

CREATE INDEX IF NOT EXISTS
    user_mentions_comment_idx
ON user_mentions (
    comment_id
);


-- ============================================================
-- 92. POST REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS post_reports (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    reporter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reason VARCHAR(200)
        NOT NULL,

    description TEXT,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    handled_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    handled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT post_reports_status_valid
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'resolved',
                'rejected'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    post_reports_post_idx
ON post_reports (
    post_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    post_reports_status_idx
ON post_reports (
    status,
    created_at DESC
);


-- ============================================================
-- 93. COMMENT REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS comment_reports (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    comment_id UUID
        NOT NULL
        REFERENCES comments(id)
        ON DELETE CASCADE,

    reporter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reason VARCHAR(200)
        NOT NULL,

    description TEXT,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    handled_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    handled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT comment_reports_status_valid
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'resolved',
                'rejected'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    comment_reports_comment_idx
ON comment_reports (
    comment_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    comment_reports_status_idx
ON comment_reports (
    status,
    created_at DESC
);


-- ============================================================
-- 94. POST PINNED BY USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_pinned_posts (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        post_id
    )

);


CREATE INDEX IF NOT EXISTS
    user_pinned_posts_user_idx
ON user_pinned_posts (
    user_id,
    created_at DESC
);


-- ============================================================
-- 95. POST BOOKMARK COLLECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS bookmark_collections (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    name VARCHAR(150)
        NOT NULL,

    description VARCHAR(500),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    bookmark_collections_user_idx
ON bookmark_collections (
    user_id,
    created_at DESC
);


-- ============================================================
-- 96. COLLECTION POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS collection_posts (

    collection_id UUID
        NOT NULL
        REFERENCES bookmark_collections(id)
        ON DELETE CASCADE,

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        collection_id,
        post_id
    )

);


CREATE INDEX IF NOT EXISTS
    collection_posts_post_idx
ON collection_posts (
    post_id,
    created_at DESC
);


-- ============================================================
-- 97. POST EDIT HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS post_edit_history (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    edited_by UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    old_content TEXT,

    new_content TEXT,

    edited_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    post_edit_history_post_idx
ON post_edit_history (
    post_id,
    edited_at DESC
);


-- ============================================================
-- 98. COMMENT EDIT HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS comment_edit_history (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    comment_id UUID
        NOT NULL
        REFERENCES comments(id)
        ON DELETE CASCADE,

    edited_by UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    old_content TEXT,

    new_content TEXT,

    edited_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    comment_edit_history_comment_idx
ON comment_edit_history (
    comment_id,
    edited_at DESC
);


-- ============================================================
-- 99. POST MENTIONS NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS mention_notifications (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    mention_id UUID
        NOT NULL
        REFERENCES user_mentions(id)
        ON DELETE CASCADE,

    notification_id UUID
        REFERENCES notifications(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    mention_notifications_mention_idx
ON mention_notifications (
    mention_id
);


-- ============================================================
-- نهاية PART 7
-- ============================================================
--
-- لا يوجد COMMIT هنا.
-- الجزء الثامن سيُضاف مباشرة بعد هذا الجزء.
-- ============================================================
-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 8 / 10
--
-- Chat Rooms
-- Room Members
-- Room Roles
-- Room Messages
-- Direct Messages
-- Message Reactions
-- Message Attachments
-- ============================================================


-- ============================================================
-- 90. ROOM TYPES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'room_type'
    ) THEN

        CREATE TYPE room_type AS ENUM (
            'public',
            'private',
            'vip'
        );

    END IF;
END
$$;


-- ============================================================
-- 91. ROOM STATUS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'room_status'
    ) THEN

        CREATE TYPE room_status AS ENUM (
            'active',
            'locked',
            'suspended',
            'deleted'
        );

    END IF;
END
$$;


-- ============================================================
-- 92. CHAT ROOMS
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    owner_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    name VARCHAR(150)
        NOT NULL,

    description VARCHAR(1000),

    type room_type
        NOT NULL
        DEFAULT 'public',

    status room_status
        NOT NULL
        DEFAULT 'active',

    avatar_url TEXT,

    cover_url TEXT,

    welcome_message TEXT,

    max_members INTEGER
        NOT NULL
        DEFAULT 1000,

    is_verified BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_featured BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    allow_guests BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    allow_gifts BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_messages BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT rooms_name_valid
        CHECK (
            char_length(trim(name))
            BETWEEN 2 AND 150
        ),

    CONSTRAINT rooms_max_members_valid
        CHECK (
            max_members > 0
        )

);


CREATE INDEX IF NOT EXISTS
    rooms_owner_idx
ON rooms (
    owner_id
);


CREATE INDEX IF NOT EXISTS
    rooms_status_idx
ON rooms (
    status,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    rooms_type_idx
ON rooms (
    type,
    status
);


CREATE INDEX IF NOT EXISTS
    rooms_featured_idx
ON rooms (
    is_featured,
    status
);


-- ============================================================
-- 93. ROOM MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_members (

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    joined_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    left_at TIMESTAMPTZ,

    is_muted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_banned BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    last_read_message_id UUID,

    PRIMARY KEY (
        room_id,
        user_id
    ),

    CONSTRAINT room_members_dates_valid
        CHECK (
            left_at IS NULL
            OR left_at >= joined_at
        )

);


CREATE INDEX IF NOT EXISTS
    room_members_user_idx
ON room_members (
    user_id,
    joined_at DESC
);


CREATE INDEX IF NOT EXISTS
    room_members_room_idx
ON room_members (
    room_id,
    joined_at DESC
);


-- ============================================================
-- 94. ROOM ROLES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'room_member_role'
    ) THEN

        CREATE TYPE room_member_role AS ENUM (
            'owner',
            'manager',
            'moderator',
            'member'
        );

    END IF;
END
$$;


CREATE TABLE IF NOT EXISTS room_member_roles (

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role room_member_role
        NOT NULL
        DEFAULT 'member',

    assigned_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    assigned_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        room_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    room_member_roles_user_idx
ON room_member_roles (
    user_id
);


CREATE INDEX IF NOT EXISTS
    room_member_roles_role_idx
ON room_member_roles (
    room_id,
    role
);


-- ============================================================
-- 95. ROOM BANS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_bans (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    banned_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reason TEXT,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    revoked_at TIMESTAMPTZ

);


CREATE INDEX IF NOT EXISTS
    room_bans_room_idx
ON room_bans (
    room_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    room_bans_user_idx
ON room_bans (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    room_bans_active_idx
ON room_bans (
    room_id,
    user_id,
    expires_at
);


-- ============================================================
-- 96. ROOM MUTED USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_mutes (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    muted_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reason TEXT,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    revoked_at TIMESTAMPTZ

);


CREATE INDEX IF NOT EXISTS
    room_mutes_room_idx
ON room_mutes (
    room_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    room_mutes_user_idx
ON room_mutes (
    user_id,
    created_at DESC
);


-- ============================================================
-- 97. ROOM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_settings (

    room_id UUID
        PRIMARY KEY
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    slow_mode_seconds INTEGER
        NOT NULL
        DEFAULT 0,

    require_approval BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    allow_links BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_media BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_voice BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_video BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_mentions BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_settings_slow_mode_valid
        CHECK (
            slow_mode_seconds >= 0
        )

);


-- ============================================================
-- 98. ROOM INVITATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_invitations (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    inviter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    invitee_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    responded_at TIMESTAMPTZ,

    CONSTRAINT room_invitation_status_valid
        CHECK (
            status IN (
                'pending',
                'accepted',
                'rejected',
                'expired',
                'cancelled'
            )
        ),

    CONSTRAINT room_invitation_users_valid
        CHECK (
            inviter_id <> invitee_id
        )

);


CREATE INDEX IF NOT EXISTS
    room_invitations_room_idx
ON room_invitations (
    room_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    room_invitations_invitee_idx
ON room_invitations (
    invitee_id,
    status,
    created_at DESC
);


-- ============================================================
-- 99. ROOM MESSAGES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'room_message_type'
    ) THEN

        CREATE TYPE room_message_type AS ENUM (
            'text',
            'image',
            'video',
            'audio',
            'file',
            'gift',
            'system'
        );

    END IF;
END
$$;


CREATE TABLE IF NOT EXISTS room_messages (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    message_type room_message_type
        NOT NULL
        DEFAULT 'text',

    content TEXT,

    reply_to_id UUID,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_messages_content_valid
        CHECK (
            content IS NOT NULL
            OR message_type <> 'text'
        )

);


ALTER TABLE room_members
DROP CONSTRAINT IF EXISTS room_members_last_read_fk;


ALTER TABLE room_members
ADD CONSTRAINT room_members_last_read_fk
FOREIGN KEY (last_read_message_id)
REFERENCES room_messages(id)
ON DELETE SET NULL;


ALTER TABLE room_messages
DROP CONSTRAINT IF EXISTS room_messages_reply_fk;


ALTER TABLE room_messages
ADD CONSTRAINT room_messages_reply_fk
FOREIGN KEY (reply_to_id)
REFERENCES room_messages(id)
ON DELETE SET NULL;


CREATE INDEX IF NOT EXISTS
    room_messages_room_idx
ON room_messages (
    room_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    room_messages_sender_idx
ON room_messages (
    sender_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    room_messages_reply_idx
ON room_messages (
    reply_to_id
);


-- ============================================================
-- 100. DIRECT CONVERSATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    is_group BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    title VARCHAR(200),

    avatar_url TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    conversations_created_by_idx
ON conversations (
    created_by,
    created_at DESC
);


-- ============================================================
-- 101. CONVERSATION MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_members (

    conversation_id UUID
        NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    joined_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    left_at TIMESTAMPTZ,

    is_muted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_archived BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    last_read_message_id UUID,

    PRIMARY KEY (
        conversation_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    conversation_members_user_idx
ON conversation_members (
    user_id,
    joined_at DESC
);


CREATE INDEX IF NOT EXISTS
    conversation_members_conversation_idx
ON conversation_members (
    conversation_id,
    joined_at DESC
);


-- ============================================================
-- 102. DIRECT MESSAGES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'direct_message_type'
    ) THEN

        CREATE TYPE direct_message_type AS ENUM (
            'text',
            'image',
            'video',
            'audio',
            'file',
            'gift',
            'system'
        );

    END IF;
END
$$;


CREATE TABLE IF NOT EXISTS messages (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    conversation_id UUID
        NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    sender_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    message_type direct_message_type
        NOT NULL
        DEFAULT 'text',

    content TEXT,

    reply_to_id UUID,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT messages_content_valid
        CHECK (
            content IS NOT NULL
            OR message_type <> 'text'
        )

);


ALTER TABLE conversation_members
DROP CONSTRAINT IF EXISTS conversation_members_last_read_fk;


ALTER TABLE conversation_members
ADD CONSTRAINT conversation_members_last_read_fk
FOREIGN KEY (last_read_message_id)
REFERENCES messages(id)
ON DELETE SET NULL;


ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_reply_fk;


ALTER TABLE messages
ADD CONSTRAINT messages_reply_fk
FOREIGN KEY (reply_to_id)
REFERENCES messages(id)
ON DELETE SET NULL;


CREATE INDEX IF NOT EXISTS
    messages_conversation_idx
ON messages (
    conversation_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    messages_sender_idx
ON messages (
    sender_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    messages_reply_idx
ON messages (
    reply_to_id
);


-- ============================================================
-- 103. MESSAGE REACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_reactions (

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction VARCHAR(50)
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id,
        reaction
    )

);


CREATE INDEX IF NOT EXISTS
    message_reactions_user_idx
ON message_reactions (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    message_reactions_reaction_idx
ON message_reactions (
    reaction,
    created_at DESC
);


-- ============================================================
-- 104. ROOM MESSAGE REACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_message_reactions (

    message_id UUID
        NOT NULL
        REFERENCES room_messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction VARCHAR(50)
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        message_id,
        user_id,
        reaction
    )

);


CREATE INDEX IF NOT EXISTS
    room_message_reactions_user_idx
ON room_message_reactions (
    user_id,
    created_at DESC
);


-- ============================================================
-- 105. MESSAGE ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_attachments (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    file_url TEXT
        NOT NULL,

    file_name VARCHAR(255),

    mime_type VARCHAR(150),

    file_size BIGINT,

    width INTEGER,

    height INTEGER,

    duration_seconds INTEGER,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT message_attachment_size_valid
        CHECK (
            file_size IS NULL
            OR file_size >= 0
        ),

    CONSTRAINT message_attachment_width_valid
        CHECK (
            width IS NULL
            OR width > 0
        ),

    CONSTRAINT message_attachment_height_valid
        CHECK (
            height IS NULL
            OR height > 0
        ),

    CONSTRAINT message_attachment_duration_valid
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        )

);


CREATE INDEX IF NOT EXISTS
    message_attachments_message_idx
ON message_attachments (
    message_id,
    created_at
);


-- ============================================================
-- 106. ROOM MESSAGE ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_message_attachments (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    message_id UUID
        NOT NULL
        REFERENCES room_messages(id)
        ON DELETE CASCADE,

    file_url TEXT
        NOT NULL,

    file_name VARCHAR(255),

    mime_type VARCHAR(150),

    file_size BIGINT,

    width INTEGER,

    height INTEGER,

    duration_seconds INTEGER,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_attachment_size_valid
        CHECK (
            file_size IS NULL
            OR file_size >= 0
        ),

    CONSTRAINT room_attachment_width_valid
        CHECK (
            width IS NULL
            OR width > 0
        ),

    CONSTRAINT room_attachment_height_valid
        CHECK (
            height IS NULL
            OR height > 0
        ),

    CONSTRAINT room_attachment_duration_valid
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        )

);


CREATE INDEX IF NOT EXISTS
    room_message_attachments_message_idx
ON room_message_attachments (
    message_id,
    created_at
);


-- ============================================================
-- 107. MESSAGE DELIVERY STATUS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_delivery_status (

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    delivered_at TIMESTAMPTZ,

    read_at TIMESTAMPTZ,

    PRIMARY KEY (
        message_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    message_delivery_user_idx
ON message_-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 9 / 10
--
-- Posts
-- Comments
-- Likes
-- Media
-- Stories
-- Hashtags
-- Mentions
-- Saved Content
-- ============================================================

-- ============================================================
-- 115. POST TYPES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'post_type'
    ) THEN

        CREATE TYPE post_type AS ENUM (
            'text',
            'image',
            'video',
            'audio',
            'mixed'
        );

    END IF;
END
$$;


-- ============================================================
-- 116. POST STATUS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'post_status'
    ) THEN

        CREATE TYPE post_status AS ENUM (
            'published',
            'hidden',
            'deleted',
            'pending'
        );

    END IF;
END
$$;


-- ============================================================
-- 117. POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    post_type post_type
        NOT NULL
        DEFAULT 'text',

    content TEXT,

    status post_status
        NOT NULL
        DEFAULT 'published',

    visibility VARCHAR(30)
        NOT NULL
        DEFAULT 'public',

    comments_enabled BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    likes_enabled BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    shares_count BIGINT
        NOT NULL
        DEFAULT 0,

    views_count BIGINT
        NOT NULL
        DEFAULT 0,

    likes_count BIGINT
        NOT NULL
        DEFAULT 0,

    comments_count BIGINT
        NOT NULL
        DEFAULT 0,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT posts_shares_valid
        CHECK (shares_count >= 0),

    CONSTRAINT posts_views_valid
        CHECK (views_count >= 0),

    CONSTRAINT posts_likes_valid
        CHECK (likes_count >= 0),

    CONSTRAINT posts_comments_valid
        CHECK (comments_count >= 0),

    CONSTRAINT posts_visibility_valid
        CHECK (
            visibility IN (
                'public',
                'followers',
                'private'
            )
        )

);


CREATE INDEX IF NOT EXISTS
    posts_user_idx
ON posts (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    posts_status_idx
ON posts (
    status,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    posts_visibility_idx
ON posts (
    visibility,
    status,
    created_at DESC
);


-- ============================================================
-- 118. POST MEDIA
-- ============================================================

CREATE TABLE IF NOT EXISTS post_media (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    media_type VARCHAR(30)
        NOT NULL,

    file_url TEXT
        NOT NULL,

    thumbnail_url TEXT,

    file_name VARCHAR(255),

    mime_type VARCHAR(150),

    file_size BIGINT,

    width INTEGER,

    height INTEGER,

    duration_seconds INTEGER,

    display_order INTEGER
        NOT NULL
        DEFAULT 0,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT post_media_size_valid
        CHECK (
            file_size IS NULL
            OR file_size >= 0
        ),

    CONSTRAINT post_media_width_valid
        CHECK (
            width IS NULL
            OR width > 0
        ),

    CONSTRAINT post_media_height_valid
        CHECK (
            height IS NULL
            OR height > 0
        ),

    CONSTRAINT post_media_duration_valid
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        ),

    CONSTRAINT post_media_order_valid
        CHECK (
            display_order >= 0
        )

);


CREATE INDEX IF NOT EXISTS
    post_media_post_idx
ON post_media (
    post_id,
    display_order
);


-- ============================================================
-- 119. POST LIKES
-- ============================================================

CREATE TABLE IF NOT EXISTS post_likes (

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction VARCHAR(50)
        NOT NULL
        DEFAULT 'like',

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        post_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    post_likes_user_idx
ON post_likes (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    post_likes_reaction_idx
ON post_likes (
    reaction,
    created_at DESC
);


-- ============================================================
-- 120. POST COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS post_comments (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    parent_comment_id UUID,

    content TEXT
        NOT NULL,

    likes_count BIGINT
        NOT NULL
        DEFAULT 0,

    replies_count BIGINT
        NOT NULL
        DEFAULT 0,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT post_comments_content_valid
        CHECK (
            char_length(trim(content)) > 0
        ),

    CONSTRAINT post_comments_likes_valid
        CHECK (
            likes_count >= 0
        ),

    CONSTRAINT post_comments_replies_valid
        CHECK (
            replies_count >= 0
        )

);


ALTER TABLE post_comments
DROP CONSTRAINT IF EXISTS post_comments_parent_fk;


ALTER TABLE post_comments
ADD CONSTRAINT post_comments_parent_fk
FOREIGN KEY (parent_comment_id)
REFERENCES post_comments(id)
ON DELETE CASCADE;


CREATE INDEX IF NOT EXISTS
    post_comments_post_idx
ON post_comments (
    post_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    post_comments_user_idx
ON post_comments (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    post_comments_parent_idx
ON post_comments (
    parent_comment_id,
    created_at ASC
);


-- ============================================================
-- 121. COMMENT LIKES
-- ============================================================

CREATE TABLE IF NOT EXISTS comment_likes (

    comment_id UUID
        NOT NULL
        REFERENCES post_comments(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        comment_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    comment_likes_user_idx
ON comment_likes (
    user_id,
    created_at DESC
);


-- ============================================================
-- 122. POST SHARES
-- ============================================================

CREATE TABLE IF NOT EXISTS post_shares (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT post_shares_unique_user
        UNIQUE (
            post_id,
            user_id
        )

);


CREATE INDEX IF NOT EXISTS
    post_shares_user_idx
ON post_shares (
    user_id,
    created_at DESC
);


-- ============================================================
-- 123. POST VIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS post_views (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    ip_address INET,

    user_agent TEXT,

    viewed_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX IF NOT EXISTS
    post_views_post_idx
ON post_views (
    post_id,
    viewed_at DESC
);


CREATE INDEX IF NOT EXISTS
    post_views_user_idx
ON post_views (
    user_id,
    viewed_at DESC
);


-- ============================================================
-- 124. STORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS stories (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    media_type VARCHAR(30)
        NOT NULL,

    media_url TEXT
        NOT NULL,

    thumbnail_url TEXT,

    caption TEXT,

    background_data JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    visibility VARCHAR(30)
        NOT NULL
        DEFAULT 'public',

    expires_at TIMESTAMPTZ
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT stories_visibility_valid
        CHECK (
            visibility IN (
                'public',
                'followers',
                'private'
            )
        ),

    CONSTRAINT stories_expiry_valid
        CHECK (
            expires_at > created_at
        )

);


CREATE INDEX IF NOT EXISTS
    stories_user_idx
ON stories (
    user_id,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    stories_active_idx
ON stories (
    expires_at,
    created_at DESC
);


-- ============================================================
-- 125. STORY VIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS story_views (

    story_id UUID
        NOT NULL
        REFERENCES stories(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    viewed_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        story_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    story_views_user_idx
ON story_views (
    user_id,
    viewed_at DESC
);


-- ============================================================
-- 126. STORY REACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS story_reactions (

    story_id UUID
        NOT NULL
        REFERENCES stories(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction VARCHAR(50)
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        story_id,
        user_id
    )

);


CREATE INDEX IF NOT EXISTS
    story_reactions_user_idx
ON story_reactions (
    user_id,
    created_at DESC
);


-- ============================================================
-- 127. HASHTAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS hashtags (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    tag VARCHAR(100)
        NOT NULL
        UNIQUE,

    usage_count BIGINT
        NOT NULL
        DEFAULT 0,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT hashtags_usage_valid
        CHECK (
            usage_count >= 0
        )

);


CREATE INDEX IF NOT EXISTS
    hashtags_usage_idx
ON hashtags (
    usage_count DESC
);


CREATE INDEX IF NOT EXISTS
    hashtags_tag_idx
ON hashtags (
    LOWER(tag)
);


-- ============================================================
-- 128. POST HASHTAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS post_hashtags (

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    hashtag_id UUID
        NOT NULL
        REFERENCES hashtags(id)
        ON DELETE CASCADE,

    PRIMARY KEY (
        post_id,
        hashtag_id
    )

);


CREATE INDEX IF NOT EXISTS
    post_hashtags_hashtag_idx
ON post_hashtags (
    hashtag_id
);


-- ============================================================
-- 129. COMMENT HASHTAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS comment_hashtags (

    comment_id UUID
        NOT NULL
        REFERENCES post_comments(id)
        ON DELETE CASCADE,

    hashtag_id UUID
        NOT NULL
        REFERENCES hashtags(id)
        ON DELETE CASCADE,

    PRIMARY KEY (
        comment_id,
        hashtag_id
    )

);


CREATE INDEX IF NOT EXISTS
    comment_hashtags_hashtag_idx
ON comment_hashtags (
    hashtag_id
);


-- ============================================================
-- 130. USER MENTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_mentions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    mentioned_by UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    mentioned_user UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    post_id UUID
        REFERENCES posts(id)
        ON DELETE CASCADE,

    comment_id UUID
        REFERENCES post_comments(id)
        ON DELETE CASCADE,

    message_id UUID
        REFERENCES messages(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT user_mentions_target_valid
        CHECK (
            post_id IS NOT NULL
            OR comment_id IS NOT NULL
            OR message_id IS NOT NULL
        )

);


CREATE INDEX IF NOT EXISTS
    user_mentions_user_idx
ON user_mentions (
    mentioned_user,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    user_mentions_sender_idx
ON user_mentions (
    mentioned_by,
    created_at DESC
);


-- ============================================================
-- 131. SAVED POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_posts (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        post_id
    )

);


CREATE INDEX IF NOT EXISTS
    saved_posts_user_idx
ON saved_posts (
    user_id,
    created_at DESC
);


-- ============================================================
-- 132. SAVED STORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_stories (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    story_id UUID
        NOT NULL
        REFERENCES stories(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        story_id
    )

);


CREATE INDEX IF NOT EXISTS
    saved_stories_user_idx
ON saved_stories (
    user_id,
    created_at DESC
);


-- ============================================================
-- 133. CONTENT COLLECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS content_collections (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    name VARCHAR(150)
        NOT NULL,

    description VARCHAR(500),

    is_private BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT content_collections_name_valid
        CHECK (
            char_length(trim(name))
            BETWEEN 1 AND 150
        )

);


CREATE INDEX IF NOT EXISTS
    content_collections_user_idx
ON content_collections (
    user_id,
    created_at DESC
);


-- ============================================================
-- 134. COLLECTION POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS collection_posts (

    collection_id UUID
        NOT NULL
        REFERENCES content_collections(id)
        ON DELETE CASCADE,

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        collection_id,
        post_id
    )

);


CREATE INDEX IF NOT EXISTS
    collection_posts_post_idx
ON collection_posts (
    post_id
);


-- ============================================================
-- 135. CONTENT REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS content_reports (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    reporter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    post_id UUID
        REFERENCES posts(id)
        ON DELETE CASCADE,

    comment_id UUID
        REFERENCES post_comments(id)
        ON DELETE CASCADE,

    story_id UUID
        REFERENCES stories(id)
        ON DELETE CASCADE,

    reason VARCHAR(200)
        NOT NULL,

    description TEXT,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    reviewed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    resolution TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT content_reports_status_valid
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'resolved',
                'rejected'
            )
        ),

    CONSTRAINT content_reports_target_valid
        CHECK (
            post_id IS NOT NULL
            OR comment_id IS NOT NULL
            OR story_id IS NOT NULL
        )

);


CREATE INDEX IF NOT EXISTS
    content_reports_status_idx
ON content_reports (
    status,
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    content_reports_reporter_idx
ON content_reports (
    reporter_id,
    created_at DESC
);


-- ============================================================
-- 136. CONTENT MODERATION
-- ============================================================

CREATE TABLE IF NOT EXISTS content_moderation (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    moderator_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    post_id UUID
        REFERENCES posts(id)
        ON DELETE CASCADE,

    comment_id UUID
        REFERENCES post_comments(id)
        ON DELETE CASCADE,

    story_id UUID
        REFERENCES stories(id)
        ON DELETE CASCADE,

    action_type VARCHAR(100)
        NOT NULL,

    reason TEXT,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT content_moderation_target_valid
        CHECK (
            post_id IS NOT NULL
    -- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 10 / 10
--
-- Triggers
-- Functions
-- Automatic user initialization
-- First user Owner
-- Updated timestamps
-- Final validation
-- COMMIT
-- ============================================================


-- ============================================================
-- 1. GENERIC UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ============================================================
-- 2. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS users_set_updated_at
ON users;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS profiles_set_updated_at
ON profiles;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS user_stats_set_updated_at
ON user_stats;

CREATE TRIGGER user_stats_set_updated_at
BEFORE UPDATE ON user_stats
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS wallets_set_updated_at
ON wallets;

CREATE TRIGGER wallets_set_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS vip_plans_set_updated_at
ON vip_plans;

CREATE TRIGGER vip_plans_set_updated_at
BEFORE UPDATE ON vip_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS gifts_set_updated_at
ON gifts;

CREATE TRIGGER gifts_set_updated_at
BEFORE UPDATE ON gifts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS store_items_set_updated_at
ON store_items;

CREATE TRIGGER store_items_set_updated_at
BEFORE UPDATE ON store_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS site_settings_set_updated_at
ON site_settings;

CREATE TRIGGER site_settings_set_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS user_settings_set_updated_at
ON user_settings;

CREATE TRIGGER user_settings_set_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 3. USER INITIALIZATION FUNCTION
-- ============================================================
--
-- عند إنشاء مستخدم حقيقي:
--
-- profiles
-- user_stats
-- wallets
-- user_settings
--
-- يتم إنشاؤها تلقائياً.
--
-- لا يتم إضافة Coins.
-- لا يتم إضافة Gifts.
-- لا يتم إضافة Badges.
-- لا يتم إضافة VIP.
-- لا يتم إضافة محتوى تجريبي.
-- ============================================================

CREATE OR REPLACE FUNCTION initialize_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    INSERT INTO profiles (
        user_id,
        display_name,
        gender
    )
    VALUES (
        NEW.id,
        NEW.username,
        NEW.gender
    )
    ON CONFLICT (user_id)
    DO NOTHING;


    INSERT INTO user_stats (
        user_id,
        level,
        xp,
        posts_count,
        comments_count,
        messages_count,
        gifts_sent_count,
        gifts_received_count,
        coins_spent,
        rooms_owned,
        rooms_joined,
        followers_count,
        following_count,
        reputation
    )
    VALUES (
        NEW.id,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
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


    INSERT INTO user_settings (
        user_id,
        language,
        theme,
        notifications_enabled,
        sounds_enabled,
        messages_from,
        profile_visibility
    )
    VALUES (
        NEW.id,
        'ar',
        'dark',
        TRUE,
        TRUE,
        'everyone',
        'public'
    )
    ON CONFLICT (user_id)
    DO NOTHING;


    RETURN NEW;

END;
$$;


-- ============================================================
-- 4. USER INITIALIZATION TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS initialize_new_user_trigger
ON users;

CREATE TRIGGER initialize_new_user_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION initialize_new_user();


-- ============================================================
-- 5. FIRST USER OWNER FUNCTION
-- ============================================================
--
-- أول مستخدم حقيقي فقط يصبح Owner.
--
-- المستخدمون بعده:
-- user
--
-- لا يمكن للواجهة تحديد Owner.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_first_user_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE id <> NEW.id
        AND deleted_at IS NULL
    ) THEN

        NEW.role = 'owner';

    ELSE

        NEW.role = 'user';

    END IF;

    RETURN NEW;

END;
$$;


-- ============================================================
-- 6. FIRST USER OWNER TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS assign_first_user_owner_trigger
ON users;

CREATE TRIGGER assign_first_user_owner_trigger
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_first_user_owner();


-- ============================================================
-- 7. PREVENT OWNER ROLE FROM BEING CREATED DUPLICATELY
-- ============================================================
--
-- يسمح بوجود Owner واحد فقط.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    users_single_owner_idx
ON users (
    role
)
WHERE role = 'owner'
AND deleted_at IS NULL;


-- ============================================================
-- 8. FOLLOWER COUNTER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_follow_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF TG_OP = 'INSERT' THEN

        UPDATE user_stats
        SET following_count = following_count + 1,
            updated_at = NOW()
        WHERE user_id = NEW.follower_id;

        UPDATE user_stats
        SET followers_count = followers_count + 1,
            updated_at = NOW()
        WHERE user_id = NEW.following_id;

        RETURN NEW;

    END IF;


    IF TG_OP = 'DELETE' THEN

        UPDATE user_stats
        SET following_count =
            GREATEST(following_count - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.follower_id;

        UPDATE user_stats
        SET followers_count =
            GREATEST(followers_count - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.following_id;

        RETURN OLD;

    END IF;


    RETURN NULL;

END;
$$;


-- ============================================================
-- 9. FOLLOW COUNTER TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS update_follow_counters_trigger
ON user_follows;

CREATE TRIGGER update_follow_counters_trigger
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW
EXECUTE FUNCTION update_follow_counters();


-- ============================================================
-- 10. LEVEL VALIDATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_user_level(
    input_xp BIGINT
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    calculated_level INTEGER;
BEGIN

    SELECT COALESCE(
        MAX(level_number),
        1
    )
    INTO calculated_level
    FROM levels
    WHERE is_active = TRUE
    AND xp_required <= GREATEST(input_xp, 0);

    RETURN calculated_level;

END;
$$;


-- ============================================================
-- 11. UPDATE USER LEVEL FROM XP
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_level_from_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.level = calculate_user_level(NEW.xp);

    RETURN NEW;

END;
$$;


-- ============================================================
-- 12. USER LEVEL TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS update_user_level_from_xp_trigger
ON user_stats;

CREATE TRIGGER update_user_level_from_xp_trigger
BEFORE INSERT OR UPDATE OF xp
ON user_stats
FOR EACH ROW
EXECUTE FUNCTION update_user_level_from_xp();


-- ============================================================
-- 13. NOTIFICATION READ FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION mark_notification_read()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.is_read = TRUE
       AND OLD.is_read = FALSE
       AND NEW.read_at IS NULL
    THEN

        NEW.read_at = NOW();

    END IF;

    RETURN NEW;

END;
$$;


-- ============================================================
-- 14. NOTIFICATION READ TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS mark_notification_read_trigger
ON notifications;

CREATE TRIGGER mark_notification_read_trigger
BEFORE UPDATE OF is_read
ON notifications
FOR EACH ROW
EXECUTE FUNCTION mark_notification_read();


-- ============================================================
-- 15. TOKEN CLEANUP INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    password_reset_expiry_idx
ON password_reset_tokens (
    expires_at
);

CREATE INDEX IF NOT EXISTS
    email_verification_expiry_idx
ON email_verification_tokens (
    expires_at
);


-- ============================================================
-- 16. ONLINE USERS INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    users_active_online_idx
ON users (
    is_online,
    last_seen_at DESC
)
WHERE status = 'active';


-- ============================================================
-- 17. ACTIVE VIP INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    user_vip_current_idx
ON user_vip (
    user_id,
    expires_at DESC
)
WHERE is_active = TRUE;


-- ============================================================
-- 18. ACTIVE STORE ITEMS INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    store_items_available_idx
ON store_items (
    price_coins,
    display_order
)
WHERE is_active = TRUE;


-- ============================================================
-- 19. ACTIVE GIFTS INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    gifts_featured_idx
ON gifts (
    display_order,
    price_coins
)
WHERE is_active = TRUE
AND is_featured = TRUE;


-- ============================================================
-- 20. FINAL DATABASE VALIDATION
-- ============================================================

DO $$
DECLARE
    required_table TEXT;
    required_tables TEXT[] := ARRAY[
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
        'vip_benefits',
        'user_vip',
        'coin_transactions',
        'gifts',
        'gift_transactions',
        'store_categories',
        'store_items',
        'user_store_items',
        'store_purchases',
        'user_sessions',
        'password_reset_tokens',
        'email_verification_tokens',
        'user_blocks',
        'user_follows',
        'notifications',
        'audit_logs',
        'site_settings',
        'user_settings',
        'reports',
        'moderation_actions'
    ];
BEGIN

    FOREACH required_table IN ARRAY required_tables
    LOOP

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = required_table
        ) THEN

            RAISE EXCEPTION
                'Required table missing: %',
                required_table;

        END IF;

    END LOOP;

END
$$;


-- ============================================================
-- 21. FINAL OWNER VALIDATION
-- ============================================================
--
-- لا يتم إنشاء Owner وهمي.
-- يتم تعيين Owner فقط عند إنشاء أول مستخدم حقيقي.
-- ============================================================

DO $$
DECLARE
    owner_count INTEGER;
BEGIN

    SELECT COUNT(*)
    INTO owner_count
    FROM users
    WHERE role = 'owner'
    AND deleted_at IS NULL;

    IF owner_count > 1 THEN

        RAISE EXCEPTION
            'Database validation failed: more than one active Owner exists';

    END IF;

END
$$;


-- ============================================================
-- 22. FINAL SCHEMA STATUS
-- ============================================================

DO $$
BEGIN

    RAISE NOTICE
        'افـنـدツينا🥀🖤 schema.sql installed successfully.';

    RAISE NOTICE
        'No demo users, demo balances, demo messages, or fake content were inserted.';

    RAISE NOTICE
        'The first real registered user will become Owner.';

END
$$;


-- ============================================================
-- END OF schema.sql
-- PART 10 / 10
-- ============================================================

COMMIT;-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 10 / 10
--
-- Triggers
-- Functions
-- Automatic user initialization
-- First user Owner
-- Updated timestamps
-- Final validation
-- COMMIT
-- ============================================================


-- ============================================================
-- 1. GENERIC UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ============================================================
-- 2. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS users_set_updated_at
ON users;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS profiles_set_updated_at
ON profiles;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS user_stats_set_updated_at
ON user_stats;

CREATE TRIGGER user_stats_set_updated_at
BEFORE UPDATE ON user_stats
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS wallets_set_updated_at
ON wallets;

CREATE TRIGGER wallets_set_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS vip_plans_set_updated_at
ON vip_plans;

CREATE TRIGGER vip_plans_set_updated_at
BEFORE UPDATE ON vip_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS gifts_set_updated_at
ON gifts;

CREATE TRIGGER gifts_set_updated_at
BEFORE UPDATE ON gifts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS store_items_set_updated_at
ON store_items;

CREATE TRIGGER store_items_set_updated_at
BEFORE UPDATE ON store_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS site_settings_set_updated_at
ON site_settings;

CREATE TRIGGER site_settings_set_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS user_settings_set_updated_at
ON user_settings;

CREATE TRIGGER user_settings_set_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 3. USER INITIALIZATION FUNCTION
-- ============================================================
--
-- عند إنشاء مستخدم حقيقي:
--
-- profiles
-- user_stats
-- wallets
-- user_settings
--
-- يتم إنشاؤها تلقائياً.
--
-- لا يتم إضافة Coins.
-- لا يتم إضافة Gifts.
-- لا يتم إضافة Badges.
-- لا يتم إضافة VIP.
-- لا يتم إضافة محتوى تجريبي.
-- ============================================================

CREATE OR REPLACE FUNCTION initialize_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    INSERT INTO profiles (
        user_id,
        display_name,
        gender
    )
    VALUES (
        NEW.id,
        NEW.username,
        NEW.gender
    )
    ON CONFLICT (user_id)
    DO NOTHING;


    INSERT INTO user_stats (
        user_id,
        level,
        xp,
        posts_count,
        comments_count,
        messages_count,
        gifts_sent_count,
        gifts_received_count,
        coins_spent,
        rooms_owned,
        rooms_joined,
        followers_count,
        following_count,
        reputation
    )
    VALUES (
        NEW.id,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
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


    INSERT INTO user_settings (
        user_id,
        language,
        theme,
        notifications_enabled,
        sounds_enabled,
        messages_from,
        profile_visibility
    )
    VALUES (
        NEW.id,
        'ar',
        'dark',
        TRUE,
        TRUE,
        'everyone',
        'public'
    )
    ON CONFLICT (user_id)
    DO NOTHING;


    RETURN NEW;

END;
$$;


-- ============================================================
-- 4. USER INITIALIZATION TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS initialize_new_user_trigger
ON users;

CREATE TRIGGER initialize_new_user_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION initialize_new_user();


-- ============================================================
-- 5. FIRST USER OWNER FUNCTION
-- ============================================================
--
-- أول مستخدم حقيقي فقط يصبح Owner.
--
-- المستخدمون بعده:
-- user
--
-- لا يمكن للواجهة تحديد Owner.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_first_user_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE id <> NEW.id
        AND deleted_at IS NULL
    ) THEN

        NEW.role = 'owner';

    ELSE

        NEW.role = 'user';

    END IF;

    RETURN NEW;

END;
$$;


-- ============================================================
-- 6. FIRST USER OWNER TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS assign_first_user_owner_trigger
ON users;

CREATE TRIGGER assign_first_user_owner_trigger
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_first_user_owner();


-- ============================================================
-- 7. PREVENT OWNER ROLE FROM BEING CREATED DUPLICATELY
-- ============================================================
--
-- يسمح بوجود Owner واحد فقط.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    users_single_owner_idx
ON users (
    role
)
WHERE role = 'owner'
AND deleted_at IS NULL;


-- ============================================================
-- 8. FOLLOWER COUNTER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_follow_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF TG_OP = 'INSERT' THEN

        UPDATE user_stats
        SET following_count = following_count + 1,
            updated_at = NOW()
        WHERE user_id = NEW.follower_id;

        UPDATE user_stats
        SET followers_count = followers_count + 1,
            updated_at = NOW()
        WHERE user_id = NEW.following_id;

        RETURN NEW;

    END IF;


    IF TG_OP = 'DELETE' THEN

        UPDATE user_stats
        SET following_count =
            GREATEST(following_count - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.follower_id;

        UPDATE user_stats
        SET followers_count =
            GREATEST(followers_count - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.following_id;

        RETURN OLD;

    END IF;


    RETURN NULL;

END;
$$;


-- ============================================================
-- 9. FOLLOW COUNTER TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS update_follow_counters_trigger
ON user_follows;

CREATE TRIGGER update_follow_counters_trigger
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW
EXECUTE FUNCTION update_follow_counters();


-- ============================================================
-- 10. LEVEL VALIDATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_user_level(
    input_xp BIGINT
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    calculated_level INTEGER;
BEGIN

    SELECT COALESCE(
        MAX(level_number),
        1
    )
    INTO calculated_level
    FROM levels
    WHERE is_active = TRUE
    AND xp_required <= GREATEST(input_xp, 0);

    RETURN calculated_level;

END;
$$;


-- ============================================================
-- 11. UPDATE USER LEVEL FROM XP
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_level_from_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.level = calculate_user_level(NEW.xp);

    RETURN NEW;

END;
$$;


-- ============================================================
-- 12. USER LEVEL TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS update_user_level_from_xp_trigger
ON user_stats;

CREATE TRIGGER update_user_level_from_xp_trigger
BEFORE INSERT OR UPDATE OF xp
ON user_stats
FOR EACH ROW
EXECUTE FUNCTION update_user_level_from_xp();


-- ============================================================
-- 13. NOTIFICATION READ FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION mark_notification_read()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.is_read = TRUE
       AND OLD.is_read = FALSE
       AND NEW.read_at IS NULL
    THEN

        NEW.read_at = NOW();

    END IF;

    RETURN NEW;

END;
$$;


-- ============================================================
-- 14. NOTIFICATION READ TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS mark_notification_read_trigger
ON notifications;

CREATE TRIGGER mark_notification_read_trigger
BEFORE UPDATE OF is_read
ON notifications
FOR EACH ROW
EXECUTE FUNCTION mark_notification_read();


-- ============================================================
-- 15. TOKEN CLEANUP INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    password_reset_expiry_idx
ON password_reset_tokens (
    expires_at
);

CREATE INDEX IF NOT EXISTS
    email_verification_expiry_idx
ON email_verification_tokens (
    expires_at
);


-- ============================================================
-- 16. ONLINE USERS INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    users_active_online_idx
ON users (
    is_online,
    last_seen_at DESC
)
WHERE status = 'active';


-- ============================================================
-- 17. ACTIVE VIP INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    user_vip_current_idx
ON user_vip (
    user_id,
    expires_at DESC
)
WHERE is_active = TRUE;


-- ============================================================
-- 18. ACTIVE STORE ITEMS INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    store_items_available_idx
ON store_items (
    price_coins,
    display_order
)
WHERE is_active = TRUE;


-- ============================================================
-- 19. ACTIVE GIFTS INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
    gifts_featured_idx
ON gifts (
    display_order,
    price_coins
)
WHERE is_active = TRUE
AND is_featured = TRUE;


-- ============================================================
-- 20. FINAL DATABASE VALIDATION
-- ============================================================

DO $$
DECLARE
    required_table TEXT;
    required_tables TEXT[] := ARRAY[
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
        'vip_benefits',
        'user_vip',
        'coin_transactions',
        'gifts',
        'gift_transactions',
        'store_categories',
        'store_items',
        'user_store_items',
        'store_purchases',
        'user_sessions',
        'password_reset_tokens',
        'email_verification_tokens',
        'user_blocks',
        'user_follows',
        'notifications',
        'audit_logs',
        'site_settings',
        'user_settings',
        'reports',
        'moderation_actions'
    ];
BEGIN

    FOREACH required_table IN ARRAY required_tables
    LOOP

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = required_table
        ) THEN

            RAISE EXCEPTION
                'Required table missing: %',
                required_table;

        END IF;

    END LOOP;

END
$$;


-- ============================================================
-- 21. FINAL OWNER VALIDATION
-- ============================================================
--
-- لا يتم إنشاء Owner وهمي.
-- يتم تعيين Owner فقط عند إنشاء أول مستخدم حقيقي.
-- ============================================================

DO $$
DECLARE
    owner_count INTEGER;
BEGIN

    SELECT COUNT(*)
    INTO owner_count
    FROM users
    WHERE role = 'owner'
    AND deleted_at IS NULL;

    IF owner_count > 1 THEN

        RAISE EXCEPTION
            'Database validation failed: more than one active Owner exists';

    END IF;

END
$$;


-- ============================================================
-- 22. FINAL SCHEMA STATUS
-- ============================================================

DO $$
BEGIN

    RAISE NOTICE
        'افـنـدツينا🥀🖤 schema.sql installed successfully.';

    RAISE NOTICE
        'No demo users, demo balances, demo messages, or fake content were inserted.';

    RAISE NOTICE
        'The first real registered user will become Owner.';

END
$$;


-- ============================================================
-- END OF schema.sql
-- PART 10 / 10
-- ============================================================

COMMIT;
