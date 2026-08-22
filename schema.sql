
-- ============================================================
-- 4. USER ROLE
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
        ),

    CONSTRAINT users_email_length
        CHECK (
            email IS NULL
            OR char_length(trim(email)) <= 255
        ),

    CONSTRAINT users_phone_length
        CHECK (
            phone IS NULL
            OR char_length(trim(phone)) BETWEEN 7 AND 30
        )

);

-- ============================================================
-- 6. USERS INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    users_username_unique_idx
ON users (
    LOWER(TRIM(username))
);

CREATE UNIQUE INDEX IF NOT EXISTS
    users_email_unique_idx
ON users (
    LOWER(TRIM(email))
)
WHERE email IS NOT NULL
  AND TRIM(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS
    users_phone_unique_idx
ON users (
    TRIM(phone)
)
WHERE phone IS NOT NULL
  AND TRIM(phone) <> '';

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
        CHECK (lifetime_spent >= 0),

    CONSTRAINT wallets_spent_not_more_than_earned
        CHECK (lifetime_spent <= lifetime_earned)

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
-- نهاية PART 1
-- لا تضع COMMIT هنا.
-- ============================================================-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 2 / 10
--
-- Levels
-- Level Rewards
-- Badges
-- VIP Plans
-- VIP Benefits
-- User VIP
-- ============================================================

-- ============================================================
-- 14. LEVELS
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
        DEFAULT NOW(),

    CONSTRAINT level_rewards_type_not_empty
        CHECK (
            char_length(trim(reward_type)) > 0
        )

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
        DEFAULT NOW()

);

-- ============================================================
-- مهم:
-- لا نستخدم UNIQUE constraint عادي هنا لأن reward_id
-- قد يكون NULL، وPostgreSQL يسمح بأكثر من NULL.
--
-- هذا الـ index يعامل NULL كقيمة واحدة.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    level_reward_claim_unique_idx
ON level_reward_claims (
    user_id,
    level_number,
    COALESCE(
        reward_id,
        '00000000-0000-0000-0000-000000000000'::UUID
    )
);

CREATE INDEX IF NOT EXISTS
    level_reward_claims_user_idx
ON level_reward_claims (
    user_id,
    claimed_at DESC
);

CREATE INDEX IF NOT EXISTS
    level_reward_claims_level_idx
ON level_reward_claims (
    level_number
);

-- ============================================================
-- 18. BADGES
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

-- ============================================================
-- نهاية PART 2
-- لا تضع COMMIT هنا.
-- ============================================================-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 3 / 10
--
-- Gifts
-- Gift Inventory
-- Gift Transactions
-- Coin Transactions
-- ============================================================

-- ============================================================
-- 23. GIFTS
-- ============================================================
--
-- تعريف الهدايا المتاحة في النظام.
-- هذا الجدول لا يمنح أي مستخدم هدية تلقائياً.
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

    icon_url TEXT,

    animation_url TEXT,

    price_coins BIGINT
        NOT NULL,

    category VARCHAR(50),

    rarity VARCHAR(50),

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    is_limited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    available_from TIMESTAMPTZ,

    available_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT gifts_price_valid
        CHECK (price_coins >= 0),

    CONSTRAINT gifts_name_not_empty
        CHECK (
            char_length(trim(name)) > 0
        ),

    CONSTRAINT gifts_dates_valid
        CHECK (
            available_until IS NULL
            OR available_from IS NULL
            OR available_until > available_from
        )

);

-- ============================================================
-- 24. GIFTS INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    gifts_active_idx
ON gifts (
    is_active
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

CREATE INDEX IF NOT EXISTS
    gifts_price_idx
ON gifts (
    price_coins
);

CREATE INDEX IF NOT EXISTS
    gifts_availability_idx
ON gifts (
    is_active,
    available_from,
    available_until
);

-- ============================================================
-- 25. USER GIFT INVENTORY
-- ============================================================
--
-- الهدايا الموجودة فعلياً في حساب المستخدم.
-- لا يتم إنشاء أي صف هنا تلقائياً إلا عند امتلاك المستخدم
-- هدية بالفعل.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_gift_inventory (

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    gift_id UUID
        NOT NULL
        REFERENCES gifts(id)
        ON DELETE RESTRICT,

    quantity BIGINT
        NOT NULL
        DEFAULT 0,

    first_received_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    last_received_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        gift_id
    ),

    CONSTRAINT gift_inventory_quantity_valid
        CHECK (quantity >= 0)

);

CREATE INDEX IF NOT EXISTS
    gift_inventory_user_idx
ON user_gift_inventory (
    user_id,
    updated_at DESC
);

CREATE INDEX IF NOT EXISTS
    gift_inventory_gift_idx
ON user_gift_inventory (
    gift_id
);

-- ============================================================
-- 26. GIFT TRANSACTIONS
-- ============================================================
--
-- كل عملية إرسال هدية فعلية.
--
-- sender:
-- المستخدم الذي أرسل الهدية.
--
-- receiver:
-- المستخدم الذي استلم الهدية.
--
-- لا يتم تخزين أي عملية وهمية.
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

    message TEXT,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT gift_transaction_quantity_valid
        CHECK (quantity > 0),

    CONSTRAINT gift_transaction_unit_price_valid
        CHECK (unit_price_coins >= 0),

    CONSTRAINT gift_transaction_total_valid
        CHECK (
            total_price_coins =
            unit_price_coins * quantity
        )

);

-- ============================================================
-- 27. GIFT TRANSACTION INDEXES
-- ============================================================

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
    gift_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    gift_transactions_created_idx
ON gift_transactions (
    created_at DESC
);

-- ============================================================
-- 28. COIN TRANSACTION TYPE
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

            'vip_purchase',

            'badge_purchase',

            'admin_adjustment',

            'refund',

            'withdrawal'

        );

    END IF;

END
$$;

-- ============================================================
-- 29. COIN TRANSACTIONS
-- ============================================================
--
-- سجل مالي داخلي لكل حركة Coins.
--
-- amount:
-- قيمة العملية.
--
-- balance_before:
-- الرصيد قبل العملية.
--
-- balance_after:
-- الرصيد بعدها.
--
-- لا يسمح النظام برصيد سالب.
-- ============================================================

CREATE TABLE IF NOT EXISTS coin_transactions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    transaction_type coin_transaction_type
        NOT NULL,

    amount BIGINT
        NOT NULL,

    balance_before BIGINT
        NOT NULL,

    balance_after BIGINT
        NOT NULL,

    reference_id UUID,

    description VARCHAR(500),

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT coin_transaction_amount_valid
        CHECK (amount <> 0),

    CONSTRAINT coin_transaction_balance_before_valid
        CHECK (balance_before >= 0),

    CONSTRAINT coin_transaction_balance_after_valid
        CHECK (balance_after >= 0)

);

-- ============================================================
-- 30. COIN TRANSACTION INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    coin_transactions_user_idx
ON coin_transactions (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    coin_transactions_type_idx
ON coin_transactions (
    transaction_type,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    coin_transactions_reference_idx
ON coin_transactions (
    reference_id
);

CREATE INDEX IF NOT EXISTS
    coin_transactions_created_idx
ON coin_transactions (
    created_at DESC
);

-- ============================================================
-- 31. BASIC GIFT DATABASE VALIDATION
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'gifts'
    ) THEN

        RAISE EXCEPTION
            'Failed to create gifts table';

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_gift_inventory'
    ) THEN

        RAISE EXCEPTION
            'Failed to create user_gift_inventory table';

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'gift_transactions'
    ) THEN

        RAISE EXCEPTION
            'Failed to create gift_transactions table';

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'coin_transactions'
    ) THEN

        RAISE EXCEPTION
            'Failed to create coin_transactions table';

    END IF;

END
$$;

-- ============================================================
-- نهاية PART 3
-- لا تضع COMMIT هنا.
-- ============================================================-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 4 / 10
--
-- Followers
-- Following
-- Blocks
-- Mutes
-- User Reports
-- ============================================================

-- ============================================================
-- 32. USER FOLLOWS
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
        CHECK (
            follower_id <> following_id
        )

);

CREATE INDEX IF NOT EXISTS
    user_follows_follower_idx
ON user_follows (
    follower_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    user_follows_following_idx
ON user_follows (
    following_id,
    created_at DESC
);

-- ============================================================
-- 33. USER BLOCKS
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
        CHECK (
            blocker_id <> blocked_id
        )

);

CREATE INDEX IF NOT EXISTS
    user_blocks_blocker_idx
ON user_blocks (
    blocker_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    user_blocks_blocked_idx
ON user_blocks (
    blocked_id
);

-- ============================================================
-- 34. USER MUTES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_mutes (

    muter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    muted_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        muter_id,
        muted_id
    ),

    CONSTRAINT user_mutes_not_self
        CHECK (
            muter_id <> muted_id
        ),

    CONSTRAINT user_mutes_expiry_valid
        CHECK (
            expires_at IS NULL
            OR expires_at > created_at
        )

);

CREATE INDEX IF NOT EXISTS
    user_mutes_muter_idx
ON user_mutes (
    muter_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    user_mutes_muted_idx
ON user_mutes (
    muted_id
);

CREATE INDEX IF NOT EXISTS
    user_mutes_expiry_idx
ON user_mutes (
    expires_at
);

-- ============================================================
-- 35. USER REPORT REASONS
-- ============================================================
--
-- تعريف أسباب البلاغات.
-- لا توجد بلاغات تجريبية.
-- ============================================================

CREATE TABLE IF NOT EXISTS report_reasons (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code VARCHAR(100)
        NOT NULL
        UNIQUE,

    title VARCHAR(150)
        NOT NULL,

    description VARCHAR(500),

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT report_reasons_title_not_empty
        CHECK (
            char_length(trim(title)) > 0
        )

);

CREATE INDEX IF NOT EXISTS
    report_reasons_active_idx
ON report_reasons (
    is_active
);

-- ============================================================
-- 36. USER REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_reports (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    reporter_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    reported_user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    reason_id UUID
        REFERENCES report_reasons(id)
        ON DELETE SET NULL,

    description TEXT,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    reviewed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    resolution_note TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT user_reports_not_self
        CHECK (
            reporter_id <> reported_user_id
        ),

    CONSTRAINT user_reports_status_valid
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'resolved',
                'rejected'
            )
        ),

    CONSTRAINT user_reports_review_data_valid
        CHECK (
            (
                status IN ('resolved', 'rejected')
                AND reviewed_at IS NOT NULL
            )
            OR
            (
                status IN ('pending', 'reviewing')
            )
        )

);

CREATE INDEX IF NOT EXISTS
    user_reports_reporter_idx
ON user_reports (
    reporter_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    user_reports_reported_user_idx
ON user_reports (
    reported_user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    user_reports_status_idx
ON user_reports (
    status,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    user_reports_reviewer_idx
ON user_reports (
    reviewed_by
);

-- ============================================================
-- 37. SOCIAL DATABASE VALIDATION
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_follows'
    ) THEN
        RAISE EXCEPTION
            'Failed to create user_follows table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_blocks'
    ) THEN
        RAISE EXCEPTION
            'Failed to create user_blocks table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_mutes'
    ) THEN
        RAISE EXCEPTION
            'Failed to create user_mutes table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'report_reasons'
    ) THEN
        RAISE EXCEPTION
            'Failed to create report_reasons table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_reports'
    ) THEN
        RAISE EXCEPTION
            'Failed to create user_reports table';
    END IF;

END
$$;

-- ============================================================
-- نهاية PART 4
-- لا تضع COMMIT هنا.
-- ============================================================-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 5 / 10
--
-- Posts
-- Post Media
-- Post Likes
-- Comments
-- Comment Likes
-- ============================================================

-- ============================================================
-- 38. POSTS
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

    visibility VARCHAR(20)
        NOT NULL
        DEFAULT 'public',

    comments_enabled BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    likes_count BIGINT
        NOT NULL
        DEFAULT 0,

    comments_count BIGINT
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

    CONSTRAINT posts_content_or_media
        CHECK (
            content IS NOT NULL
            OR EXISTS (
                SELECT 1
            )
        ),

    CONSTRAINT posts_likes_valid
        CHECK (likes_count >= 0),

    CONSTRAINT posts_comments_valid
        CHECK (comments_count >= 0),

    CONSTRAINT posts_shares_valid
        CHECK (shares_count >= 0)

);

-- ============================================================
-- 39. POSTS INDEXES
-- ============================================================

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
    posts_created_idx
ON posts (
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    posts_pinned_idx
ON posts (
    user_id,
    is_pinned,
    created_at DESC
);

-- ============================================================
-- 40. POST MEDIA
-- ============================================================

CREATE TABLE IF NOT EXISTS post_media (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    post_id UUID
        NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    media_type VARCHAR(20)
        NOT NULL,

    media_url TEXT
        NOT NULL,

    thumbnail_url TEXT,

    width INTEGER,

    height INTEGER,

    duration_seconds NUMERIC(10,2),

    sort_order INTEGER
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
                'audio'
            )
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

    CONSTRAINT post_media_sort_valid
        CHECK (
            sort_order >= 0
        )

);

CREATE INDEX IF NOT EXISTS
    post_media_post_idx
ON post_media (
    post_id,
    sort_order
);

-- ============================================================
-- 41. POST LIKES
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
-- 42. COMMENTS
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

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT comments_content_not_empty
        CHECK (
            char_length(trim(content)) > 0
        ),

    CONSTRAINT comments_likes_valid
        CHECK (
            likes_count >= 0
        ),

    CONSTRAINT comments_replies_valid
        CHECK (
            replies_count >= 0
        )

);

-- ============================================================
-- 43. COMMENT SELF-REFERENCE
-- ============================================================

ALTER TABLE comments
DROP CONSTRAINT IF EXISTS
    comments_parent_fk;

ALTER TABLE comments
ADD CONSTRAINT
    comments_parent_fk
FOREIGN KEY (
    parent_comment_id
)
REFERENCES comments(id)
ON DELETE CASCADE;

-- ============================================================
-- 44. COMMENTS INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    comments_post_idx
ON comments (
    post_id,
    created_at ASC
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
    parent_comment_id,
    created_at ASC
);

-- ============================================================
-- 45. COMMENT LIKES
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

CREATE INDEX IF NOT EXISTS
    comment_likes_comment_idx
ON comment_likes (
    comment_id,
    created_at DESC
);

-- ============================================================
-- 46. POST/COMMENT DATABASE VALIDATION
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'posts'
    ) THEN
        RAISE EXCEPTION
            'Failed to create posts table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'post_media'
    ) THEN
        RAISE EXCEPTION
            'Failed to create post_media table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'post_likes'
    ) THEN
        RAISE EXCEPTION
            'Failed to create post_likes table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'comments'
    ) THEN
        RAISE EXCEPTION
            'Failed to create comments table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'comment_likes'
    ) THEN
        RAISE EXCEPTION
            'Failed to create comment_likes table';
    END IF;

END
$$;

-- ============================================================
-- نهاية PART 5
-- لا تضع COMMIT هنا.
-- ============================================================-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 6 / 10
--
-- Conversations
-- Conversation Members
-- Messages
-- Message Reactions
-- Message Attachments
-- ============================================================

-- ============================================================
-- 47. CONVERSATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    conversation_type VARCHAR(20)
        NOT NULL
        DEFAULT 'direct',

    title VARCHAR(150),

    avatar_url TEXT,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    last_message_id UUID,

    last_message_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT conversations_type_valid
        CHECK (
            conversation_type IN (
                'direct',
                'group'
            )
        ),

    CONSTRAINT conversations_title_valid
        CHECK (
            title IS NULL
            OR char_length(trim(title)) BETWEEN 1 AND 150
        )

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
    conversations_created_idx
ON conversations (
    created_at DESC
);

-- ============================================================
-- 48. CONVERSATION MEMBERS
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

    role VARCHAR(20)
        NOT NULL
        DEFAULT 'member',

    joined_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    left_at TIMESTAMPTZ,

    last_read_at TIMESTAMPTZ,

    is_muted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    muted_until TIMESTAMPTZ,

    PRIMARY KEY (
        conversation_id,
        user_id
    ),

    CONSTRAINT conversation_member_role_valid
        CHECK (
            role IN (
                'owner',
                'admin',
                'member'
            )
        ),

    CONSTRAINT conversation_member_dates_valid
        CHECK (
            left_at IS NULL
            OR left_at >= joined_at
        ),

    CONSTRAINT conversation_member_mute_valid
        CHECK (
            muted_until IS NULL
            OR muted_until > joined_at
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
    joined_at
);

-- ============================================================
-- 49. MESSAGES
-- ============================================================

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
        ON DELETE RESTRICT,

    reply_to_message_id UUID,

    message_type VARCHAR(20)
        NOT NULL
        DEFAULT 'text',

    content TEXT,

    is_edited BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    edited_at TIMESTAMPTZ,

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

    CONSTRAINT messages_content_valid
        CHECK (
            content IS NULL
            OR char_length(content) <= 10000
        )

);

-- ============================================================
-- 50. MESSAGE REPLY RELATION
-- ============================================================

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS
    messages_reply_fk;

ALTER TABLE messages
ADD CONSTRAINT
    messages_reply_fk
FOREIGN KEY (
    reply_to_message_id
)
REFERENCES messages(id)
ON DELETE SET NULL;

-- ============================================================
-- 51. MESSAGES INDEXES
-- ============================================================

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
    reply_to_message_id
);

CREATE INDEX IF NOT EXISTS
    messages_created_idx
ON messages (
    created_at DESC
);

-- ============================================================
-- 52. MESSAGE ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS message_attachments (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    message_id UUID
        NOT NULL
        REFERENCES messages(id)
        ON DELETE CASCADE,

    attachment_type VARCHAR(20)
        NOT NULL,

    file_url TEXT
        NOT NULL,

    thumbnail_url TEXT,

    file_name VARCHAR(255),

    mime_type VARCHAR(150),

    file_size BIGINT,

    width INTEGER,

    height INTEGER,

    duration_seconds NUMERIC(10,2),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT message_attachment_type_valid
        CHECK (
            attachment_type IN (
                'image',
                'video',
                'audio',
                'file'
            )
        ),

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
-- 53. MESSAGE REACTIONS
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
        user_id
    ),

    CONSTRAINT message_reaction_not_empty
        CHECK (
            char_length(trim(reaction)) BETWEEN 1 AND 30
        )

);

CREATE INDEX IF NOT EXISTS
    message_reactions_user_idx
ON message_reactions (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    message_reactions_message_idx
ON message_reactions (
    message_id,
    created_at DESC
);

-- ============================================================
-- 54. CONVERSATION DATABASE VALIDATION
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'conversations'
    ) THEN
        RAISE EXCEPTION
            'Failed to create conversations table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'conversation_members'
    ) THEN
        RAISE EXCEPTION
            'Failed to create conversation_members table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'messages'
    ) THEN
        RAISE EXCEPTION
            'Failed to create messages table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'message_attachments'
    ) THEN
        RAISE EXCEPTION
            'Failed to create message_attachments table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'message_reactions'
    ) THEN
        RAISE EXCEPTION
            'Failed to create message_reactions table';
    END IF;

END
$$;

-- ============================================================
-- نهاية PART 6
-- لا تضع COMMIT هنا.
-- ============================================================-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 7 / 10
--
-- Rooms
-- Room Members
-- Room Messages
-- Room Moderators
-- ============================================================

-- ============================================================
-- 55. ROOMS
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    owner_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    name VARCHAR(120)
        NOT NULL,

    description VARCHAR(500),

    avatar_url TEXT,

    cover_url TEXT,

    room_type VARCHAR(20)
        NOT NULL
        DEFAULT 'public',

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'active',

    max_members INTEGER
        NOT NULL
        DEFAULT 100,

    members_count BIGINT
        NOT NULL
        DEFAULT 0,

    messages_count BIGINT
        NOT NULL
        DEFAULT 0,

    is_locked BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    is_verified BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT rooms_name_valid
        CHECK (
            char_length(trim(name))
            BETWEEN 2 AND 120
        ),

    CONSTRAINT rooms_type_valid
        CHECK (
            room_type IN (
                'public',
                'private'
            )
        ),

    CONSTRAINT rooms_status_valid
        CHECK (
            status IN (
                'active',
                'closed',
                'suspended'
            )
        ),

    CONSTRAINT rooms_max_members_valid
        CHECK (
            max_members > 0
        ),

    CONSTRAINT rooms_members_count_valid
        CHECK (
            members_count >= 0
        ),

    CONSTRAINT rooms_messages_count_valid
        CHECK (
            messages_count >= 0
        )

);

-- ============================================================
-- 56. ROOMS INDEXES
-- ============================================================

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
    room_type,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    rooms_verified_idx
ON rooms (
    is_verified,
    created_at DESC
);

-- ============================================================
-- 57. ROOM MEMBERS
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

    role VARCHAR(20)
        NOT NULL
        DEFAULT 'member',

    joined_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    left_at TIMESTAMPTZ,

    is_muted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    muted_until TIMESTAMPTZ,

    PRIMARY KEY (
        room_id,
        user_id
    ),

    CONSTRAINT room_member_role_valid
        CHECK (
            role IN (
                'owner',
                'moderator',
                'member'
            )
        ),

    CONSTRAINT room_member_dates_valid
        CHECK (
            left_at IS NULL
            OR left_at >= joined_at
        )

);

-- ============================================================
-- 58. ROOM MEMBERS INDEXES
-- ============================================================

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
    joined_at
);

CREATE INDEX IF NOT EXISTS
    room_members_role_idx
ON room_members (
    room_id,
    role
);

-- ============================================================
-- 59. ROOM MESSAGES
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

    message_type VARCHAR(20)
        NOT NULL
        DEFAULT 'text',

    content TEXT,

    media_url TEXT,

    reply_to_id UUID,

    is_deleted BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT room_message_type_valid
        CHECK (
            message_type IN (
                'text',
                'image',
                'video',
                'audio',
                'gift',
                'system'
            )
        ),

    CONSTRAINT room_message_content_valid
        CHECK (
            content IS NULL
            OR char_length(content) <= 10000
        )

);

-- ============================================================
-- 60. ROOM MESSAGE REPLY
-- ============================================================

ALTER TABLE room_messages
DROP CONSTRAINT IF EXISTS
    room_messages_reply_fk;

ALTER TABLE room_messages
ADD CONSTRAINT
    room_messages_reply_fk
FOREIGN KEY (
    reply_to_id
)
REFERENCES room_messages(id)
ON DELETE SET NULL;

-- ============================================================
-- 61. ROOM MESSAGES INDEXES
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

-- ============================================================
-- 62. ROOM MODERATORS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_moderators (

    room_id UUID
        NOT NULL
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    permissions JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    appointed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    appointed_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        room_id,
        user_id
    )

);

CREATE INDEX IF NOT EXISTS
    room_moderators_user_idx
ON room_moderators (
    user_id
);

CREATE INDEX IF NOT EXISTS
    room_moderators_room_idx
ON room_moderators (
    room_id
);

-- ============================================================
-- 63. ROOM DATABASE VALIDATION
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'rooms'
    ) THEN
        RAISE EXCEPTION
            'Failed to create rooms table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'room_members'
    ) THEN
        RAISE EXCEPTION
            'Failed to create room_members table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'room_messages'
    ) THEN
        RAISE EXCEPTION
            'Failed to create room_messages table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'room_moderators'
    ) THEN
        RAISE EXCEPTION
            'Failed to create room_moderators table';
    END IF;

END
$$;

-- ============================================================
-- نهاية PART 7 / 10
-- لا تضع COMMIT هنا.
-- ============================================================-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 8 / 10
--
-- Followers
-- Notifications
-- Blocks
-- Reports
-- ============================================================

-- ============================================================
-- 64. FOLLOWERS
-- ============================================================

CREATE TABLE IF NOT EXISTS followers (

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

    CONSTRAINT followers_not_self
        CHECK (
            follower_id <> following_id
        )

);

CREATE INDEX IF NOT EXISTS
    followers_follower_idx
ON followers (
    follower_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    followers_following_idx
ON followers (
    following_id,
    created_at DESC
);

-- ============================================================
-- 65. NOTIFICATIONS
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

    notification_type VARCHAR(50)
        NOT NULL,

    title VARCHAR(200),

    message TEXT,

    data JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    is_read BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT notifications_title_valid
        CHECK (
            title IS NULL
            OR char_length(title) <= 200
        )

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

CREATE INDEX IF NOT EXISTS
    notifications_actor_idx
ON notifications (
    actor_id,
    created_at DESC
);

-- ============================================================
-- 66. BLOCKED USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS blocked_users (

    blocker_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    blocked_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reason VARCHAR(300),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    PRIMARY KEY (
        blocker_id,
        blocked_id
    ),

    CONSTRAINT blocked_users_not_self
        CHECK (
            blocker_id <> blocked_id
        )

);

CREATE INDEX IF NOT EXISTS
    blocked_users_blocker_idx
ON blocked_users (
    blocker_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    blocked_users_blocked_idx
ON blocked_users (
    blocked_id,
    created_at DESC
);

-- ============================================================
-- 67. REPORTS
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
        ON DELETE CASCADE,

    post_id UUID
        REFERENCES posts(id)
        ON DELETE CASCADE,

    comment_id UUID
        REFERENCES comments(id)
        ON DELETE CASCADE,

    message_id UUID
        REFERENCES messages(id)
        ON DELETE CASCADE,

    room_id UUID
        REFERENCES rooms(id)
        ON DELETE CASCADE,

    report_type VARCHAR(50)
        NOT NULL,

    reason TEXT
        NOT NULL,

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

    updated_at TIMESTAMPTZ
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
        ),

    CONSTRAINT reports_reason_valid
        CHECK (
            char_length(trim(reason)) > 0
        ),

    CONSTRAINT reports_target_exists
        CHECK (
            reported_user_id IS NOT NULL
            OR post_id IS NOT NULL
            OR comment_id IS NOT NULL
            OR message_id IS NOT NULL
            OR room_id IS NOT NULL
        )

);

CREATE INDEX IF NOT EXISTS
    reports_reporter_idx
ON reports (
    reporter_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    reports_status_idx
ON reports (
    status,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    reports_reported_user_idx
ON reports (
    reported_user_id
);

CREATE INDEX IF NOT EXISTS
    reports_post_idx
ON reports (
    post_id
);

CREATE INDEX IF NOT EXISTS
    reports_comment_idx
ON reports (
    comment_id
);

CREATE INDEX IF NOT EXISTS
    reports_message_idx
ON reports (
    message_id
);

CREATE INDEX IF NOT EXISTS
    reports_room_idx
ON reports (
    room_id
);

-- ============================================================
-- 68. FOLLOW / NOTIFICATION / SAFETY VALIDATION
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'followers'
    ) THEN
        RAISE EXCEPTION
            'Failed to create followers table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
    ) THEN
        RAISE EXCEPTION
            'Failed to create notifications table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'blocked_users'
    ) THEN
        RAISE EXCEPTION
            'Failed to create blocked_users table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'reports'
    ) THEN
        RAISE EXCEPTION
            'Failed to create reports table';
    END IF;

END
$$;

-- ============================================================
-- نهاية PART 8 / 10
-- لا تضع COMMIT هنا.
-- ============================================================-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 9 / 10
--
-- Gift Catalog
-- Gifts
-- Coin Transactions
-- Wallet Transactions
-- Gift Transactions
-- ============================================================

-- ============================================================
-- 69. GIFT CATALOG
-- ============================================================
--
-- تعريف الهدايا فقط.
-- لا يتم منح أي هدية لأي مستخدم هنا.
-- ============================================================

CREATE TABLE IF NOT EXISTS gift_catalog (

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

    animation_url TEXT,

    preview_url TEXT,

    category VARCHAR(50)
        NOT NULL
        DEFAULT 'general',

    price_coins BIGINT
        NOT NULL,

    rarity VARCHAR(30)
        NOT NULL
        DEFAULT 'common',

    sort_order INTEGER
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

    CONSTRAINT gift_catalog_price_valid
        CHECK (
            price_coins > 0
        ),

    CONSTRAINT gift_catalog_sort_valid
        CHECK (
            sort_order >= 0
        )

);

CREATE INDEX IF NOT EXISTS
    gift_catalog_active_idx
ON gift_catalog (
    is_active,
    sort_order
);

CREATE INDEX IF NOT EXISTS
    gift_catalog_category_idx
ON gift_catalog (
    category,
    is_active
);

CREATE INDEX IF NOT EXISTS
    gift_catalog_rarity_idx
ON gift_catalog (
    rarity
);

-- ============================================================
-- 70. GIFT TRANSACTIONS
-- ============================================================
--
-- تسجيل إرسال الهدايا الحقيقي.
--
-- sender = المرسل
-- receiver = المستلم
--
-- القيمة تحفظ وقت العملية حتى لو تغير سعر الهدية لاحقاً.
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
        REFERENCES gift_catalog(id)
        ON DELETE RESTRICT,

    quantity INTEGER
        NOT NULL
        DEFAULT 1,

    unit_price_coins BIGINT
        NOT NULL,

    total_price_coins BIGINT
        NOT NULL,

    message TEXT,

    conversation_id UUID
        REFERENCES conversations(id)
        ON DELETE SET NULL,

    room_id UUID
        REFERENCES rooms(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT gift_transaction_quantity_valid
        CHECK (
            quantity > 0
        ),

    CONSTRAINT gift_transaction_unit_price_valid
        CHECK (
            unit_price_coins > 0
        ),

    CONSTRAINT gift_transaction_total_valid
        CHECK (
            total_price_coins > 0
        ),

    CONSTRAINT gift_transaction_users_valid
        CHECK (
            sender_id <> receiver_id
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
    gift_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    gift_transactions_conversation_idx
ON gift_transactions (
    conversation_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    gift_transactions_room_idx
ON gift_transactions (
    room_id,
    created_at DESC
);

-- ============================================================
-- 71. COIN TRANSACTIONS
-- ============================================================
--
-- سجل كل حركة Coins.
--
-- لا يتم إنشاء أي حركة هنا.
-- ============================================================

CREATE TABLE IF NOT EXISTS coin_transactions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    transaction_type VARCHAR(40)
        NOT NULL,

    amount BIGINT
        NOT NULL,

    balance_before BIGINT
        NOT NULL,

    balance_after BIGINT
        NOT NULL,

    reference_type VARCHAR(50),

    reference_id UUID,

    description TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT coin_transaction_amount_valid
        CHECK (
            amount <> 0
        ),

    CONSTRAINT coin_transaction_balance_before_valid
        CHECK (
            balance_before >= 0
        ),

    CONSTRAINT coin_transaction_balance_after_valid
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
    transaction_type,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    coin_transactions_reference_idx
ON coin_transactions (
    reference_type,
    reference_id
);

-- ============================================================
-- 72. WALLET TRANSACTIONS
-- ============================================================
--
-- سجل مالي منفصل للـ Wallet.
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    transaction_type VARCHAR(40)
        NOT NULL,

    amount BIGINT
        NOT NULL,

    balance_before BIGINT
        NOT NULL,

    balance_after BIGINT
        NOT NULL,

    reference_type VARCHAR(50),

    reference_id UUID,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT wallet_transaction_amount_valid
        CHECK (
            amount <> 0
        ),

    CONSTRAINT wallet_transaction_before_valid
        CHECK (
            balance_before >= 0
        ),

    CONSTRAINT wallet_transaction_after_valid
        CHECK (
            balance_after >= 0
        )

);

CREATE INDEX IF NOT EXISTS
    wallet_transactions_user_idx
ON wallet_transactions (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    wallet_transactions_type_idx
ON wallet_transactions (
    transaction_type,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    wallet_transactions_reference_idx
ON wallet_transactions (
    reference_type,
    reference_id
);

-- ============================================================
-- 73. GIFT DATABASE VALIDATION
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'gift_catalog'
    ) THEN
        RAISE EXCEPTION
            'Failed to create gift_catalog table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'gift_transactions'
    ) THEN
        RAISE EXCEPTION
            'Failed to create gift_transactions table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'coin_transactions'
    ) THEN
        RAISE EXCEPTION
            'Failed to create coin_transactions table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'wallet_transactions'
    ) THEN
        RAISE EXCEPTION
            'Failed to create wallet_transactions table';
    END IF;

END
$$;

-- ============================================================
-- نهاية PART 9 / 10
-- لا تضع COMMIT هنا.
-- ============================================================-- ============================================================
-- افـنـدツينا🥀🖤
-- schema.sql
-- PART 10 / 10
--
-- Audit Logs
-- Sessions
-- Password Resets
-- Verification Codes
-- User Settings
-- Triggers
-- Final Validation
-- ============================================================

-- ============================================================
-- 74. USER SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_sessions (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    session_token_hash TEXT
        NOT NULL
        UNIQUE,

    ip_address INET,

    user_agent TEXT,

    expires_at TIMESTAMPTZ
        NOT NULL,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    last_used_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT session_expiry_valid
        CHECK (
            expires_at > created_at
        )

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
-- 75. PASSWORD RESET TOKENS
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
        DEFAULT NOW(),

    CONSTRAINT password_reset_expiry_valid
        CHECK (
            expires_at > created_at
        )

);

CREATE INDEX IF NOT EXISTS
    password_reset_user_idx
ON password_reset_tokens (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    password_reset_expiry_idx
ON password_reset_tokens (
    expires_at
);

-- ============================================================
-- 76. VERIFICATION CODES
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_codes (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE CASCADE,

    destination VARCHAR(255)
        NOT NULL,

    destination_type VARCHAR(20)
        NOT NULL,

    code_hash TEXT
        NOT NULL,

    purpose VARCHAR(40)
        NOT NULL,

    expires_at TIMESTAMPTZ
        NOT NULL,

    used_at TIMESTAMPTZ,

    attempts INTEGER
        NOT NULL
        DEFAULT 0,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT verification_destination_type_valid
        CHECK (
            destination_type IN (
                'email',
                'phone'
            )
        ),

    CONSTRAINT verification_attempts_valid
        CHECK (
            attempts >= 0
        ),

    CONSTRAINT verification_expiry_valid
        CHECK (
            expires_at > created_at
        )

);

CREATE INDEX IF NOT EXISTS
    verification_codes_user_idx
ON verification_codes (
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    verification_codes_destination_idx
ON verification_codes (
    destination,
    purpose,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    verification_codes_expiry_idx
ON verification_codes (
    expires_at
);

-- ============================================================
-- 77. USER SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (

    user_id UUID
        PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    language VARCHAR(20)
        NOT NULL
        DEFAULT 'ar',

    theme VARCHAR(20)
        NOT NULL
        DEFAULT 'dark',

    notifications_enabled BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    sound_enabled BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    show_gifts BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    allow_messages_from VARCHAR(30)
        NOT NULL
        DEFAULT 'everyone',

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT user_settings_theme_valid
        CHECK (
            theme IN (
                'dark',
                'light',
                'system'
            )
        ),

    CONSTRAINT user_settings_messages_valid
        CHECK (
            allow_messages_from IN (
                'everyone',
                'followers',
                'nobody'
            )
        )

);

-- ============================================================
-- 78. AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (

    id UUID
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(100)
        NOT NULL,

    target_type VARCHAR(50),

    target_id UUID,

    ip_address INET,

    user_agent TEXT,

    metadata JSONB
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
    audit_logs_target_idx
ON audit_logs (
    target_type,
    target_id
);

-- ============================================================
-- 79. UPDATED_AT FUNCTION
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
-- 80. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS
    users_updated_at_trigger
ON users;

CREATE TRIGGER
    users_updated_at_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    profiles_updated_at_trigger
ON profiles;

CREATE TRIGGER
    profiles_updated_at_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    user_stats_updated_at_trigger
ON user_stats;

CREATE TRIGGER
    user_stats_updated_at_trigger
BEFORE UPDATE ON user_stats
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    wallets_updated_at_trigger
ON wallets;

CREATE TRIGGER
    wallets_updated_at_trigger
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    vip_plans_updated_at_trigger
ON vip_plans;

CREATE TRIGGER
    vip_plans_updated_at_trigger
BEFORE UPDATE ON vip_plans
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
    comments_updated_at_trigger
ON comments;

CREATE TRIGGER
    comments_updated_at_trigger
BEFORE UPDATE ON comments
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
    messages_updated_at_trigger
ON messages;

CREATE TRIGGER
    messages_updated_at_trigger
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    rooms_updated_at_trigger
ON rooms;

CREATE TRIGGER
    rooms_updated_at_trigger
BEFORE UPDATE ON rooms
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    room_messages_updated_at_trigger
ON room_messages;

CREATE TRIGGER
    room_messages_updated_at_trigger
BEFORE UPDATE ON room_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    reports_updated_at_trigger
ON reports;

CREATE TRIGGER
    reports_updated_at_trigger
BEFORE UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    gift_catalog_updated_at_trigger
ON gift_catalog;

CREATE TRIGGER
    gift_catalog_updated_at_trigger
BEFORE UPDATE ON gift_catalog
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

-- ============================================================
-- 81. FIRST USER OWNER FUNCTION
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
          AND role <> 'deleted'
    ) THEN

        NEW.role = 'owner';

    END IF;

    RETURN NEW;

END;
$$;

-- ============================================================
-- 82. FIRST USER OWNER TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS
    first_user_owner_trigger
ON users;

CREATE TRIGGER
    first_user_owner_trigger
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_first_user_owner();

-- ============================================================
-- 83. CREATE USER DEFAULT DATA
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_default_data()
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

    INSERT INTO user_settings (
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

-- ============================================================
-- 84. CREATE USER DEFAULT DATA TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS
    create_user_default_data_trigger
ON users;

CREATE TRIGGER
    create_user_default_data_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_default_data();

-- ============================================================
-- 85. FINAL DATABASE VALIDATION
-- ============================================================

DO $$
DECLARE
    required_table TEXT;
BEGIN

    FOREACH required_table IN ARRAY ARRAY[
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
        'posts',
        'post_media',
        'post_likes',
        'comments',
        'comment_likes',
        'conversations',
        'conversation_members',
        'messages',
        'message_attachments',
        'message_reactions',
        'rooms',
        'room_members',
        'room_messages',
        'room_moderators',
        'followers',
        'notifications',
        'blocked_users',
        'reports',
        'gift_catalog',
        'gift_transactions',
        'coin_transactions',
        'wallet_transactions',
        'user_sessions',
        'password_reset_tokens',
        'verification_codes',
        'user_settings',
        'audit_logs'
    ]
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
-- 86. COMMIT
-- ============================================================

COMMIT;

-- ============================================================
-- نهاية schema.sql
-- PART 10 / 10
-- ============================================================phone_verified BOOLEAN
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

    deleted_at TIMESTAMPTZ,    CONSTRAINT users_username_length
        CHECK (
            char_length(trim(username))
            BETWEEN 3 AND 30
        ),

    CONSTRAINT users_username_not_empty
        CHECK (
            char_length(trim(username)) > 0
        )

);-- ============================================================
-- 6. USERS INDEXES
-- ============================================================        NOT NULL
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
-- 8. USER STATISTICS
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
-- 9. USER WALLETS
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

CREATE INDEX IF NOT EXISTS
    wallets_balance_idx
ON wallets (
    balance DESC
);

-- ============================================================
-- 10. PART 1 VALIDATION
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
-- نهاية PART 1
-- ============================================================
