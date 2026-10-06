BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    bio VARCHAR(500) NOT NULL DEFAULT '',
    avatar_url TEXT,
    cover_url TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'USER'
        CHECK (role IN ('USER', 'MODERATOR', 'ADMIN', 'OWNER')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED')),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    experience BIGINT NOT NULL DEFAULT 0 CHECK (experience >= 0),
    coins BIGINT NOT NULL DEFAULT 0 CHECK (coins >= 0),
    vip_level INTEGER NOT NULL DEFAULT 0 CHECK (vip_level >= 0),
    vip_expires_at TIMESTAMPTZ,
    last_daily_reward_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
    ON users (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
    ON users (LOWER(email))
    WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    permission_key VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('USER', 'MODERATOR', 'ADMIN', 'OWNER')),
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'ar',
    theme VARCHAR(30) NOT NULL DEFAULT 'dark',
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    messages_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    room_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    gift_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    privacy_profile VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (privacy_profile IN ('public', 'members', 'private')),
    privacy_messages VARCHAR(20) NOT NULL DEFAULT 'everyone'
        CHECK (privacy_messages IN ('everyone', 'friends', 'nobody')),
    show_online_status BOOLEAN NOT NULL DEFAULT TRUE,
    show_last_seen BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx
    ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS user_sessions_expires_idx
    ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_following_idx
    ON follows(following_id);

CREATE TABLE IF NOT EXISTS blocks (
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocked_idx
    ON blocks(blocked_id);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    avatar_url TEXT,
    cover_url TEXT,
    price BIGINT NOT NULL DEFAULT 50000 CHECK (price >= 0),
    max_members INTEGER NOT NULL DEFAULT 100 CHECK (max_members > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'LOCKED', 'SUSPENDED', 'DELETED')),
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rooms_owner_idx
    ON rooms(owner_id);

CREATE INDEX IF NOT EXISTS rooms_status_idx
    ON rooms(status);

CREATE TABLE IF NOT EXISTS room_members (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER'
        CHECK (role IN ('MEMBER', 'MODERATOR', 'MANAGER', 'OWNER')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'MUTED', 'BANNED', 'LEFT')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS room_members_user_idx
    ON room_members(user_id);

CREATE TABLE IF NOT EXISTS room_settings (
    room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
    allow_messages BOOLEAN NOT NULL DEFAULT TRUE,
    allow_gifts BOOLEAN NOT NULL DEFAULT TRUE,
    allow_reactions BOOLEAN NOT NULL DEFAULT TRUE,
    allow_media BOOLEAN NOT NULL DEFAULT TRUE,
    allow_links BOOLEAN NOT NULL DEFAULT TRUE,
    slow_mode_seconds INTEGER NOT NULL DEFAULT 0
        CHECK (slow_mode_seconds >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_permissions (
    id SERIAL PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(room_id, permission_key)
);

CREATE TABLE IF NOT EXISTS room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT'
        CHECK (message_type IN ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'GIFT', 'SYSTEM')),
    content TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    gift_id UUID,
    reply_to_id UUID REFERENCES room_messages(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS room_messages_room_created_idx
    ON room_messages(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS room_messages_sender_idx
    ON room_messages(sender_id);

CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT'
        CHECK (message_type IN ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO')),
    content TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    read_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS direct_messages_pair_idx
    ON direct_messages(sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS direct_messages_receiver_idx
    ON direct_messages(receiver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    media_type VARCHAR(20)
        CHECK (media_type IS NULL OR media_type IN ('IMAGE', 'VIDEO', 'AUDIO')),
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC'
        CHECK (visibility IN ('PUBLIC', 'FOLLOWERS', 'PRIVATE')),
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (status IN ('PUBLISHED', 'HIDDEN', 'DELETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (LENGTH(TRIM(content)) > 0 OR media_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS posts_user_created_idx
    ON posts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS posts_status_created_idx
    ON posts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'VISIBLE'
        CHECK (status IN ('VISIBLE', 'HIDDEN', 'DELETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (LENGTH(TRIM(content)) > 0)
);

CREATE INDEX IF NOT EXISTS comments_post_created_idx
    ON comments(post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    reaction_type VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL)
        OR
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),
    UNIQUE(user_id, post_id),
    UNIQUE(user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS reactions_post_idx
    ON reactions(post_id);

CREATE INDEX IF NOT EXISTS reactions_comment_idx
    ON reactions(comment_id);

CREATE TABLE IF NOT EXISTS wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
    lifetime_spent BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(40) NOT NULL,
    amount BIGINT NOT NULL CHECK (amount <> 0),
    balance_before BIGINT NOT NULL CHECK (balance_before >= 0),
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    reference_type VARCHAR(50),
    reference_id UUID,
    description VARCHAR(255) NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_user_created_idx
    ON transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_reference_idx
    ON transactions(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    sender_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    receiver_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS transfers_sender_idx
    ON transfers(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transfers_receiver_idx
    ON transfers(receiver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL DEFAULT '',
    image_url TEXT,
    animation_url TEXT,
    price BIGINT NOT NULL CHECK (price > 0 AND price <= 200000),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gifts_active_order_idx
    ON gifts(is_active, sort_order, price);

ALTER TABLE room_messages
    DROP CONSTRAINT IF EXISTS room_messages_gift_id_fkey;

ALTER TABLE room_messages
    ADD CONSTRAINT room_messages_gift_id_fkey
    FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    gift_id UUID NOT NULL REFERENCES gifts(id) ON DELETE RESTRICT,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price BIGINT NOT NULL CHECK (unit_price > 0),
    total_price BIGINT NOT NULL CHECK (total_price > 0),
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS gift_transactions_sender_idx
    ON gift_transactions(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gift_transactions_receiver_idx
    ON gift_transactions(receiver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS store_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL DEFAULT '',
    item_type VARCHAR(30) NOT NULL
        CHECK (item_type IN ('BADGE', 'ROOM', 'PROFILE_FRAME', 'VIP', 'OTHER')),
    image_url TEXT,
    price BIGINT NOT NULL CHECK (price >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_items_type_active_idx
    ON store_items(item_type, is_active);

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES store_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
    total_price BIGINT NOT NULL CHECK (total_price >= 0),
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS purchases_buyer_created_idx
    ON purchases(buyer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS user_inventory_user_idx
    ON user_inventory(user_id);

CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_name VARCHAR(100) NOT NULL,
    badge_image_url TEXT,
    badge_type VARCHAR(30) NOT NULL DEFAULT 'STORE'
        CHECK (badge_type IN ('OWNER', 'SYSTEM', 'LEVEL', 'VIP', 'STORE', 'SPECIAL')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, badge_name)
);

CREATE INDEX IF NOT EXISTS user_badges_user_idx
    ON user_badges(user_id);

CREATE TABLE IF NOT EXISTS levels (
    level INTEGER PRIMARY KEY,
    required_experience BIGINT NOT NULL UNIQUE CHECK (required_experience >= 0),
    daily_reward BIGINT NOT NULL DEFAULT 0 CHECK (daily_reward >= 0),
    title VARCHAR(100) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS level_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER NOT NULL REFERENCES levels(level) ON DELETE CASCADE,
    reward_type VARCHAR(30) NOT NULL,
    reward_value BIGINT NOT NULL DEFAULT 0 CHECK (reward_value >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(level, reward_type)
);

CREATE TABLE IF NOT EXISTS daily_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL REFERENCES levels(level) ON DELETE RESTRICT,
    coins BIGINT NOT NULL CHECK (coins >= 0),
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, claimed_at::date)
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    body VARCHAR(500) NOT NULL DEFAULT '',
    reference_type VARCHAR(50),
    reference_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
    ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
    ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    media_type VARCHAR(20) NOT NULL
        CHECK (media_type IN ('IMAGE', 'VIDEO', 'AUDIO', 'OTHER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uploads_user_created_idx
    ON uploads(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    target_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    target_message_id UUID REFERENCES room_messages(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    details VARCHAR(1000) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        target_user_id IS NOT NULL
        OR target_room_id IS NOT NULL
        OR target_post_id IS NOT NULL
        OR target_message_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS reports_status_created_idx
    ON reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
    ON audit_logs(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
    ON audit_logs(action, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS user_settings_set_updated_at ON user_settings;
CREATE TRIGGER user_settings_set_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS rooms_set_updated_at ON rooms;
CREATE TRIGGER rooms_set_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS room_members_set_updated_at ON room_members;
CREATE TRIGGER room_members_set_updated_at
BEFORE UPDATE ON room_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS room_settings_set_updated_at ON room_settings;
CREATE TRIGGER room_settings_set_updated_at
BEFORE UPDATE ON room_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS room_messages_set_updated_at ON room_messages;
CREATE TRIGGER room_messages_set_updated_at
BEFORE UPDATE ON room_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS direct_messages_set_updated_at ON direct_messages;
CREATE TRIGGER direct_messages_set_updated_at
BEFORE UPDATE ON direct_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS posts_set_updated_at ON posts;
CREATE TRIGGER posts_set_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS comments_set_updated_at ON comments;
CREATE TRIGGER comments_set_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS wallets_set_updated_at ON wallets;
CREATE TRIGGER wallets_set_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS gifts_set_updated_at ON gifts;
CREATE TRIGGER gifts_set_updated_at
BEFORE UPDATE ON gifts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS store_items_set_updated_at ON store_items;
CREATE TRIGGER store_items_set_updated_at
BEFORE UPDATE ON store_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS user_inventory_set_updated_at ON user_inventory;
CREATE TRIGGER user_inventory_set_updated_at
BEFORE UPDATE ON user_inventory
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS user_sessions_cleanup ON user_sessions;

CREATE OR REPLACE FUNCTION initialize_user_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO wallets (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_initialize_data ON users;
CREATE TRIGGER users_initialize_data
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_data();

CREATE OR REPLACE FUNCTION assign_first_user_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE id <> NEW.id
          AND role = 'OWNER'
          AND status <> 'DELETED'
    ) THEN
        UPDATE users
        SET role = 'OWNER'
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_first_owner_trigger ON users;
CREATE TRIGGER users_first_owner_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_first_user_owner();

INSERT INTO permissions (permission_key, description)
VALUES
    ('users.view', 'عرض المستخدمين'),
    ('users.manage', 'إدارة المستخدمين'),
    ('users.suspend', 'إيقاف المستخدمين'),
    ('users.ban', 'حظر المستخدمين'),
    ('users.delete', 'حذف المستخدمين'),
    ('users.permissions', 'إدارة صلاحيات المستخدمين'),
    ('rooms.view', 'عرض الغرف'),
    ('rooms.create', 'إنشاء الغرف'),
    ('rooms.manage', 'إدارة الغرف'),
    ('rooms.delete', 'حذف الغرف'),
    ('rooms.members', 'إدارة أعضاء الغرف'),
    ('rooms.settings', 'إدارة إعدادات الغرف'),
    ('rooms.moderate', 'إدارة محتوى الغرف'),
    ('posts.moderate', 'إدارة المنشورات'),
    ('comments.moderate', 'إدارة التعليقات'),
    ('reports.view', 'عرض البلاغات'),
    ('reports.manage', 'إدارة البلاغات'),
    ('wallet.view', 'عرض المحفظة'),
    ('wallet.manage', 'إدارة أرصدة المحافظ'),
    ('transactions.view', 'عرض المعاملات'),
    ('gifts.view', 'عرض الهدايا'),
    ('gifts.manage', 'إدارة الهدايا'),
    ('store.view', 'عرض المتجر'),
    ('store.manage', 'إدارة المتجر'),
    ('levels.view', 'عرض المستويات'),
    ('levels.manage', 'إدارة المستويات'),
    ('notifications.manage', 'إدارة الإشعارات'),
    ('settings.view', 'عرض الإعدادات'),
    ('settings.manage', 'إدارة إعدادات النظام'),
    ('audit.view', 'عرض سجل العمليات'),
    ('admin.access', 'الدخول إلى لوحة الإدارة'),
    ('owner.full_access', 'صلاحيات المالك الكاملة')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'MODERATOR', id
FROM permissions
WHERE permission_key IN (
    'users.view',
    'rooms.view',
    'rooms.members',
    'rooms.moderate',
    'posts.moderate',
    'comments.moderate',
    'reports.view',
    'reports.manage',
    'gifts.view',
    'store.view',
    'levels.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'ADMIN', id
FROM permissions
WHERE permission_key IN (
    'users.view',
    'users.manage',
    'users.suspend',
    'users.ban',
    'users.permissions',
    'rooms.view',
    'rooms.create',
    'rooms.manage',
    'rooms.delete',
    'rooms.members',
    'rooms.settings',
    'rooms.moderate',
    'posts.moderate',
    'comments.moderate',
    'reports.view',
    'reports.manage',
    'wallet.view',
    'wallet.manage',
    'transactions.view',
    'gifts.view',
    'gifts.manage',
    'store.view',
    'store.manage',
    'levels.view',
    'levels.manage',
    'notifications.manage',
    'settings.view',
    'settings.manage',
    'audit.view',
    'admin.access'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'OWNER', id
FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO levels (level, required_experience, daily_reward, title)
VALUES
    (1, 0, 0, 'مبتدئ'),
    (2, 100, 0, 'عضو'),
    (3, 250, 0, 'نشط'),
    (4, 500, 0, 'متفاعل'),
    (5, 1000, 100, 'متقدم'),
    (6, 1800, 120, 'مميز'),
    (7, 3000, 150, 'محترف'),
    (8, 5000, 180, 'خبير'),
    (9, 8000, 220, 'نجم'),
    (10, 12000, 250, 'نجم متقدم'),
    (11, 18000, 300, 'نخبة'),
    (12, 26000, 350, 'نخبة متقدمة'),
    (13, 38000, 400, 'أسطوري'),
    (14, 55000, 450, 'أسطوري متقدم'),
    (15, 80000, 500, 'ملك'),
    (16, 115000, 600, 'ملك متقدم'),
    (17, 165000, 700, 'قمة'),
    (18, 235000, 800, 'قمة متقدمة'),
    (19, 330000, 900, 'أسطورة'),
    (20, 450000, 1000, 'أسطورة عليا')
ON CONFLICT (level) DO UPDATE
SET
    required_experience = EXCLUDED.required_experience,
    daily_reward = EXCLUDED.daily_reward,
    title = EXCLUDED.title;

INSERT INTO system_settings (setting_key, setting_value)
VALUES
    ('site_name', to_jsonb('افـنـدツ⁠يـنـا🥀🖤'::text)),
    ('registration_enabled', 'true'::jsonb),
    ('rooms_enabled', 'true'::jsonb),
    ('posts_enabled', 'true'::jsonb),
    ('gifts_enabled', 'true'::jsonb),
    ('store_enabled', 'true'::jsonb),
    ('transfers_enabled', 'true'::jsonb),
    ('max_gift_price', '200000'::jsonb),
    ('room_purchase_price', '50000'::jsonb),
    ('daily_rewards_start_level', '5'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
