/* =========================================================
   افـنـدツينا🥀🖤
   database.js
   Central Data Layer
   =========================================================

   IMPORTANT:
   هذا الملف هو طبقة البيانات في الواجهة الأمامية.
   لا تضع كلمات مرور أو مفاتيح Admin سرية هنا.
   الصلاحيات الحقيقية يجب فرضها أيضًا على الخادم / قاعدة البيانات.

   يوفر:
   - Users
   - Profiles
   - Sessions
   - Rooms
   - Messages
   - Posts
   - Comments
   - Likes
   - Notifications
   - Friends / Following
   - Blocks
   - Reports
   - Store
   - Wallet
   - Purchases
   - Roles / Permissions
   - Site Settings
   - Statistics
   - Audit Logs
   - Backup / Restore
   - Search
   - Events
   - API adapter
   ========================================================= */

"use strict";

/* =========================================================
   1. GLOBAL CONFIG
   ========================================================= */

const DB_CONFIG = Object.freeze({
    name: "afandina_database",
    version: 1,

    storageKey: "afandina_db_v1",
    sessionKey: "afandina_session",
    settingsKey: "afandina_settings",

    maxMessageLength: 5000,
    maxPostLength: 10000,
    maxCommentLength: 3000,

    pageSize: 30,

    defaultCurrency: "coins",

    api: {
        enabled: false,
        baseURL: "",
        timeout: 15000
    }
});

/* =========================================================
   2. UTILITIES
   ========================================================= */

const DBUtils = {

    id(prefix = "id") {
        const random =
            typeof crypto !== "undefined" &&
            crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        return `${prefix}_${random}`;
    },

    now() {
        return new Date().toISOString();
    },

    clone(data) {
        if (typeof structuredClone === "function") {
            return structuredClone(data);
        }

        return JSON.parse(JSON.stringify(data));
    },

    normalize(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase();
    },

    text(value, max = 10000) {
        return String(value ?? "")
            .replace(/\u0000/g, "")
            .trim()
            .slice(0, max);
    },

    number(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    },

    bool(value) {
        return Boolean(value);
    },

    array(value) {
        return Array.isArray(value) ? value : [];
    },

    paginate(items, page = 1, limit = DB_CONFIG.pageSize) {

        page = Math.max(1, Number(page) || 1);
        limit = Math.max(1, Math.min(100, Number(limit) || DB_CONFIG.pageSize));

        const total = items.length;
        const pages = Math.max(1, Math.ceil(total / limit));

        const start = (page - 1) * limit;

        return {
            data: items.slice(start, start + limit),
            page,
            limit,
            total,
            pages,
            hasNext: page < pages,
            hasPrev: page > 1
        };
    },

    safeJSONParse(value, fallback = null) {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }
};

/* =========================================================
   3. DEFAULT DATABASE
   ========================================================= */

function createDefaultDatabase() {

    return {

        meta: {
            name: DB_CONFIG.name,
            version: DB_CONFIG.version,
            createdAt: DBUtils.now(),
            updatedAt: DBUtils.now()
        },

        users: [],

        sessions: [],

        profiles: [],

        rooms: [],

        messages: [],

        posts: [],

        comments: [],

        likes: [],

        notifications: [],

        friendships: [],

        follows: [],

        blocks: [],

        reports: [],

        products: [],

        purchases: [],

        wallets: [],

        transactions: [],

        roles: [],

        permissions: [],

        siteSettings: {
            siteName: "افـنـدツينا🥀🖤",
            siteDescription: "منصة تعارف ودردشة عربية",
            maintenance: false,
            registrationEnabled: true,
            guestEnabled: true,
            chatEnabled: true,
            storeEnabled: true,
            postsEnabled: true,
            notificationsEnabled: true
        },

        auditLogs: [],

        bans: [],

        invites: [],

        roomMembers: [],

        roomModerators: [],

        passwordResets: [],

        verificationCodes: [],

        statistics: {
            users: 0,
            onlineUsers: 0,
            rooms: 0,
            messages: 0,
            posts: 0,
            reports: 0,
            purchases: 0
        }
    };
}

/* =========================================================
   4. DATABASE ENGINE
   ========================================================= */

class DatabaseEngine {

    constructor() {

        this.events = new EventTarget();

        this.db = this.load();

        this.migrate();

        this.updateStatistics();
    }

    load() {

        const raw = localStorage.getItem(DB_CONFIG.storageKey);

        if (!raw) {
            const fresh = createDefaultDatabase();

            localStorage.setItem(
                DB_CONFIG.storageKey,
                JSON.stringify(fresh)
            );

            return fresh;
        }

        const parsed = DBUtils.safeJSONParse(raw, null);

        if (!parsed || typeof parsed !== "object") {
            return createDefaultDatabase();
        }

        return {
            ...createDefaultDatabase(),
            ...parsed
        };
    }

    save() {

        this.db.meta.updatedAt = DBUtils.now();

        localStorage.setItem(
            DB_CONFIG.storageKey,
            JSON.stringify(this.db)
        );

        this.updateStatistics();

        this.emit("database:updated", this.db.meta);
    }

    migrate() {

        if (!this.db.meta) {
            this.db.meta = {
                name: DB_CONFIG.name,
                version: DB_CONFIG.version,
                createdAt: DBUtils.now(),
                updatedAt: DBUtils.now()
            };
        }

        const defaults = createDefaultDatabase();

        Object.keys(defaults).forEach(key => {

            if (!(key in this.db)) {
                this.db[key] = DBUtils.clone(defaults[key]);
            }

        });

        this.db.meta.version = DB_CONFIG.version;

        this.save();
    }

    emit(type, detail = {}) {

        this.events.dispatchEvent(
            new CustomEvent(type, {
                detail: DBUtils.clone(detail)
            })
        );
    }

    on(type, callback) {

        this.events.addEventListener(type, callback);

        return () => {
            this.events.removeEventListener(type, callback);
        };
    }

    table(name) {

        if (!(name in this.db)) {
            throw new Error(`Unknown database table: ${name}`);
        }

        return this.db[name];
    }

    insert(table, data) {

        const item = {
            id: data.id || DBUtils.id(table),
            createdAt: data.createdAt || DBUtils.now(),
            updatedAt: DBUtils.now(),
            ...DBUtils.clone(data)
        };

        this.table(table).push(item);

        this.save();

        this.emit(`${table}:created`, item);

        return DBUtils.clone(item);
    }

    find(table, predicate) {

        return this.table(table).find(predicate) || null;
    }

    findById(table, id) {

        return this.find(
            table,
            item => item.id === id
        );
    }

    filter(table, predicate) {

        return this.table(table)
            .filter(predicate)
            .map(DBUtils.clone);
    }

    update(table, id, patch) {

        const items = this.table(table);

        const index = items.findIndex(
            item => item.id === id
        );

        if (index === -1) {
            throw new Error("العنصر غير موجود");
        }

        items[index] = {
            ...items[index],
            ...DBUtils.clone(patch),
            updatedAt: DBUtils.now()
        };

        this.save();

        this.emit(`${table}:updated`, items[index]);

        return DBUtils.clone(items[index]);
    }

    remove(table, id) {

        const items = this.table(table);

        const index = items.findIndex(
            item => item.id === id
        );

        if (index === -1) {
            return false;
        }

        const deleted = items.splice(index, 1)[0];

        this.save();

        this.emit(`${table}:deleted`, deleted);

        return true;
    }

    clear(table) {

        this.db[table] = [];

        this.save();

        this.emit(`${table}:cleared`, {});
    }

    export() {

        return JSON.stringify(
            DBUtils.clone(this.db),
            null,
            2
        );
    }

    import(json) {

        const parsed = typeof json === "string"
            ? DBUtils.safeJSONParse(json, null)
            : json;

        if (!parsed || typeof parsed !== "object") {
            throw new Error("ملف قاعدة البيانات غير صالح");
        }

        this.db = {
            ...createDefaultDatabase(),
            ...DBUtils.clone(parsed)
        };

        this.save();

        this.emit("database:imported", {
            timestamp: DBUtils.now()
        });

        return true;
    }

    reset() {

        this.db = createDefaultDatabase();

        this.save();

        this.emit("database:reset", {});

        return true;
    }

    updateStatistics() {

        this.db.statistics = {
            users: this.db.users.length,

            onlineUsers: this.db.users
                .filter(u => u.online)
                .length,

            rooms: this.db.rooms.length,

            messages: this.db.messages.length,

            posts: this.db.posts.length,

            reports: this.db.reports
                .filter(r => r.status !== "resolved")
                .length,

            purchases: this.db.purchases.length
        };

        localStorage.setItem(
            DB_CONFIG.storageKey,
            JSON.stringify(this.db)
        );
    }
}

const DB = new DatabaseEngine();

/* =========================================================
   5. SESSION MANAGER
   ========================================================= */

const SessionManager = {

    get() {

        const raw =
            localStorage.getItem(DB_CONFIG.sessionKey);

        return DBUtils.safeJSONParse(raw, null);
    },

    set(session) {

        localStorage.setItem(
            DB_CONFIG.sessionKey,
            JSON.stringify(session)
        );

        DB.emit("session:changed", session);
    },

    clear() {

        localStorage.removeItem(
            DB_CONFIG.sessionKey
        );

        DB.emit("session:changed", null);
    },

    user() {

        const session = this.get();

        if (!session?.userId) {
            return null;
        }

        return DB.findById(
            "users",
            session.userId
        );
    },

    authenticated() {

        return Boolean(this.user());
    }
};

/* =========================================================
   6. USER MANAGER
   ========================================================= */

const Users = {

    create(data = {}) {

        const username =
            DBUtils.text(data.username, 40);

        const email =
            DBUtils.normalize(data.email);

        if (!username) {
            throw new Error("اسم المستخدم مطلوب");
        }

        if (DB.find(
            "users",
            u => DBUtils.normalize(u.username) ===
                 DBUtils.normalize(username)
        )) {
            throw new Error("اسم المستخدم مستخدم بالفعل");
        }

        if (email && DB.find(
            "users",
            u => DBUtils.normalize(u.email) === email
        )) {
            throw new Error("البريد الإلكتروني مستخدم بالفعل");
        }

        const user = DB.insert("users", {

            username,

            email,

            displayName:
                DBUtils.text(
                    data.displayName || username,
                    80
                ),

            avatar:
                data.avatar || "",

            bio:
                DBUtils.text(data.bio, 500),

            age:
                data.age
                    ? DBUtils.number(data.age)
                    : null,

            gender:
                DBUtils.text(data.gender, 30),

            country:
                DBUtils.text(data.country, 80),

            role:
                data.role || "user",

            status: "active",

            online: false,

            verified:
                Boolean(data.verified),

            coins:
                Math.max(
                    0,
                    DBUtils.number(data.coins)
                ),

            followersCount: 0,

            followingCount: 0,

            friendsCount: 0,

            lastSeen: DBUtils.now()
        });

        DB.insert("profiles", {
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            bio: user.bio,
            age: user.age,
            gender: user.gender,
            country: user.country
        });

        Wallet.ensure(user.id);

        return user;
    },

    get(id) {
        return DB.findById("users", id);
    },

    byUsername(username) {

        return DB.find(
            "users",
            u =>
                DBUtils.normalize(u.username) ===
                DBUtils.normalize(username)
        );
    },

    update(id, data) {

        const allowed = [
            "displayName",
            "avatar",
            "bio",
            "age",
            "gender",
            "country",
            "verified",
            "status",
            "online",
            "role"
        ];

        const patch = {};

        allowed.forEach(key => {

            if (key in data) {
                patch[key] = data[key];
            }

        });

        const user = DB.update(
            "users",
            id,
            patch
        );

        const profile =
            DB.find(
                "profiles",
                p => p.userId === id
            );

        if (profile) {

            DB.update(
                "profiles",
                profile.id,
                {
                    ...patch
                }
            );
        }

        return user;
    },

    delete(id) {

        return DB.remove(
            "users",
            id
        );
    },

    setOnline(id, online) {

        return this.update(
            id,
            {
                online: Boolean(online),
                lastSeen: DBUtils.now()
            }
        );
    },

    search(query, page = 1) {

        const q = DBUtils.normalize(query);

        const results =
            DB.filter(
                "users",
                user =>
                    !q ||
                    DBUtils.normalize(user.username)
                        .includes(q) ||
                    DBUtils.normalize(user.displayName)
                        .includes(q)
            );

        return DBUtils.paginate(
            results,
            page
        );
    }
};

/* =========================================================
   7. AUTH / SESSION
   ========================================================= */

const Auth = {

    async login(username, password) {

        const user = Users.byUsername(username);

        if (!user) {
            throw new Error("بيانات الدخول غير صحيحة");
        }

        if (user.status === "banned") {
            throw new Error("هذا الحساب محظور");
        }

        /*
         * ملاحظة:
         * التحقق الحقيقي من كلمة المرور يجب أن يتم على الخادم.
         * هذا الفرع يسمح بدمج API حقيقي لاحقًا.
         */

        if (DB_CONFIG.api.enabled) {
            return API.request(
                "/auth/login",
                {
                    method: "POST",
                    body: {
                        username,
                        password
                    }
                }
            );
        }

        const session = {
            id: DBUtils.id("session"),
            userId: user.id,
            createdAt: DBUtils.now(),
            lastActivity: DBUtils.now()
        };

        SessionManager.set(session);

        Users.setOnline(
            user.id,
            true
        );

        Notifications.create(
            user.id,
            "تسجيل دخول جديد",
            "تم تسجيل الدخول إلى حسابك.",
            "security"
        );

        return {
            success: true,
            user: Users.get(user.id),
            session
        };
    },

    logout() {

        const user =
            SessionManager.user();

        if (user) {
            Users.setOnline(
                user.id,
                false
            );
        }

        SessionManager.clear();

        return true;
    }
};

/* =========================================================
   8. ROLES & PERMISSIONS
   ========================================================= */

const Permissions = {

    all: [
        "users.view",
        "users.create",
        "users.edit",
        "users.delete",
        "users.ban",

        "rooms.view",
        "rooms.create",
        "rooms.edit",
        "rooms.delete",
        "rooms.moderate",

        "messages.view",
        "messages.delete",

        "posts.view",
        "posts.create",
        "posts.edit",
        "posts.delete",
        "posts.moderate",

        "reports.view",
        "reports.resolve",

        "store.view",
        "store.manage",
        "store.purchase",

        "settings.view",
        "settings.manage",

        "statistics.view",

        "logs.view",

        "roles.view",
        "roles.manage"
    ],

    owner: [
        "*"
    ],

    admin: [
        "users.view",
        "users.edit",
        "users.ban",

        "rooms.view",
        "rooms.edit",
        "rooms.delete",
        "rooms.moderate",

        "messages.view",
        "messages.delete",

        "posts.view",
        "posts.edit",
        "posts.delete",
        "posts.moderate",

        "reports.view",
        "reports.resolve",

        "store.view",
        "store.manage",

        "settings.view",
        "statistics.view",
        "logs.view"
    ],

    moderator: [
        "users.view",
        "rooms.view",
        "rooms.moderate",
        "messages.view",
        "messages.delete",
        "posts.view",
        "posts.moderate",
        "reports.view",
        "reports.resolve"
    ],

    user: [
        "users.view",
        "rooms.view",
        "rooms.create",
        "messages.view",
        "posts.view",
        "posts.create",
        "posts.edit",
        "posts.delete",
        "store.view",
        "store.purchase"
    ]
};

function hasPermission(user, permission) {

    if (!user) {
        return false;
    }

    const role =
        Permissions[user.role] || [];

    return (
        role.includes("*") ||
        role.includes(permission)
    );
}

/* =========================================================
   9. ROOMS
   ========================================================= */

const Rooms = {

    create(data = {}) {

        const room = DB.insert(
            "rooms",
            {
                name:
                    DBUtils.text(
                        data.name,
                        100
                    ),

                description:
                    DBUtils.text(
                        data.description,
                        500
                    ),

                ownerId:
                    data.ownerId ||
                    SessionManager.user()?.id ||
                    null,

                image:
                    data.image || "",

                type:
                    data.type || "public",

                passwordProtected:
                    Boolean(data.passwordProtected),

                active: true,

                membersCount: 0,

                moderators: [],

                settings: {
                    slowMode: false,
                    maxMembers: 1000,
                    allowMedia: true,
                    allowLinks: true,
                    allowGuests: false,
                    ...data.settings
                }
            }
        );

        return room;
    },

    get(id) {
        return DB.findById(
            "rooms",
            id
        );
    },

    update(id, data) {

        return DB.update(
            "rooms",
            id,
            data
        );
    },

    delete(id) {

        DB.filter(
            "roomMembers",
            m => m.roomId === id
        ).forEach(member => {
            DB.remove(
                "roomMembers",
                member.id
            );
        });

        return DB.remove(
            "rooms",
            id
        );
    },

    join(roomId, userId) {

        if (!Users.get(userId)) {
            throw new Error("المستخدم غير موجود");
        }

        if (!this.get(roomId)) {
            throw new Error("الغرفة غير موجودة");
        }

        const exists =
            DB.find(
                "roomMembers",
                m =>
                    m.roomId === roomId &&
                    m.userId === userId
            );

        if (exists) {
            return exists;
        }

        const member =
            DB.insert(
                "roomMembers",
                {
                    roomId,
                    userId,
                    role: "member",
                    joinedAt: DBUtils.now()
                }
            );

        const room =
            this.get(roomId);

        DB.update(
            "rooms",
            roomId,
            {
                membersCount:
                    Math.max(
                        0,
                        (room.membersCount || 0) + 1
                    )
            }
        );

        return member;
    },

    leave(roomId, userId) {

        const member =
            DB.find(
                "roomMembers",
                m =>
                    m.roomId === roomId &&
                    m.userId === userId
            );

        if (!member) {
            return false;
        }

        DB.remove(
            "roomMembers",
            member.id
        );

        const room =
            this.get(roomId);

        if (room) {

            DB.update(
                "rooms",
                roomId,
                {
                    membersCount:
                        Math.max(
                            0,
                            (room.membersCount || 0) - 1
                        )
                }
            );
        }

        return true;
    },

    members(roomId) {

        return DB.filter(
            "roomMembers",
            m => m.roomId === roomId
        );
    }
};

/* =========================================================
   10. MESSAGES
   ========================================================= */

const Messages = {

    send(data = {}) {

        const senderId =
            data.senderId ||
            SessionManager.user()?.id;

        if (!senderId) {
            throw new Error("يجب تسجيل الدخول");
        }

        const content =
            DBUtils.text(
                data.content,
                DB_CONFIG.maxMessageLength
            );

        if (!content) {
            throw new Error("الرسالة فارغة");
        }

        const message =
            DB.insert(
                "messages",
                {
                    roomId:
                        data.roomId || null,

                    senderId,

                    receiverId:
                        data.receiverId || null,

                    content,

                    type:
                        data.type || "text",

                    attachment:
                        data.attachment || null,

                    replyTo:
                        data.replyTo || null,

                    edited: false,

                    deleted: false,

                    readBy: [senderId]
                }
            );

        if (
            data.receiverId &&
            data.receiverId !== senderId
        ) {

            Notifications.create(
                data.receiverId,
                "رسالة جديدة",
                content.slice(0, 120),
                "message",
                {
                    messageId: message.id
                }
            );
        }

        return message;
    },

    get(id) {

        return DB.findById(
            "messages",
            id
        );
    },

    room(roomId, page = 1) {

        const messages =
            DB.filter(
                "messages",
                m =>
                    m.roomId === roomId &&
                    !m.deleted
            ).sort(
                (a, b) =>
                    new Date(a.createdAt) -
                    new Date(b.createdAt)
            );

        return DBUtils.paginate(
            messages,
            page
        );
    },

    edit(id, content) {

        return DB.update(
            "messages",
            id,
            {
                content:
                    DBUtils.text(
                        content,
                        DB_CONFIG.maxMessageLength
                    ),
                edited: true,
                editedAt: DBUtils.now()
            }
        );
    },

    delete(id) {

        return DB.update(
            "messages",
            id,
            {
                deleted: true,
                deletedAt: DBUtils.now(),
                content: "تم حذف هذه الرسالة"
            }
        );
    }
};

/* =========================================================
   11. POSTS
   ========================================================= */

const Posts = {

    create(data = {}) {

        const authorId =
            data.authorId ||
            SessionManager.user()?.id;

        if (!authorId) {
            throw new Error("يجب تسجيل الدخول");
        }

        const content =
            DBUtils.text(
                data.content,
                DB_CONFIG.maxPostLength
            );

        if (!content) {
            throw new Error("المنشور فارغ");
        }

        return DB.insert(
            "posts",
            {
                authorId,

                content,

                media:
                    DBUtils.array(
                        data.media
                    ),

                visibility:
                    data.visibility ||
                    "public",

                commentsEnabled:
                    data.commentsEnabled !== false,

                likesCount: 0,

                commentsCount: 0,

                sharesCount: 0,

                status: "published"
            }
        );
    },

    get(id) {

        return DB.findById(
            "posts",
            id
        );
    },

    feed(page = 1) {

        const posts =
            DB.filter(
                "posts",
                p =>
                    p.status === "published"
            ).sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            );

        return DBUtils.paginate(
            posts,
            page
        );
    },

    delete(id) {

        return DB.update(
            "posts",
            id,
            {
                status: "deleted"
            }
        );
    }
};

/* =========================================================
   12. COMMENTS
   ========================================================= */

const Comments = {

    create(postId, content, userId) {

        const authorId =
            userId ||
            SessionManager.user()?.id;

        if (!authorId) {
            throw new Error("يجب تسجيل الدخول");
        }

        const comment =
            DB.insert(
                "comments",
                {
                    postId,

                    authorId,

                    content:
                        DBUtils.text(
                            content,
                            DB_CONFIG.maxCommentLength
                        ),

                    likesCount: 0,

                    status: "active"
                }
            );

        const post =
            Posts.get(postId);

        if (post) {

            DB.update(
                "posts",
                postId,
                {
                    commentsCount:
                        (post.commentsCount || 0) + 1
                }
            );
        }

        return comment;
    },

    list(postId) {

        return DB.filter(
            "comments",
            c =>
                c.postId === postId &&
                c.status === "active"
        );
    },

    delete(id) {

        return DB.update(
            "comments",
            id,
            {
                status: "deleted"
            }
        );
    }
};

/* =========================================================
   13. LIKES
   ========================================================= */

const Likes = {

    toggle(targetType, targetId, userId) {

        const uid =
            userId ||
            SessionManager.user()?.id;

        if (!uid) {
            throw new Error("يجب تسجيل الدخول");
        }

        const existing =
            DB.find(
                "likes",
                l =>
                    l.targetType === targetType &&
                    l.targetId === targetId &&
                    l.userId === uid
            );

        if (existing) {

            DB.remove(
                "likes",
                existing.id
            );

            this.recalculate(
                targetType,
                targetId
            );

            return {
                liked: false
            };
        }

        DB.insert(
            "likes",
            {
                targetType,
                targetId,
                userId: uid
            }
        );

        this.recalculate(
            targetType,
            targetId
        );

        return {
            liked: true
        };
    },

    count(targetType, targetId) {

        return DB.filter(
            "likes",
            l =>
                l.targetType === targetType &&
                l.targetId === targetId
        ).length;
    },

    hasLiked(targetType, targetId, userId) {

        return Boolean(
            DB.find(
                "likes",
                l =>
                    l.targetType === targetType &&
                    l.targetId === targetId &&
                    l.userId === userId
            )
        );
    },

    recalculate(targetType, targetId) {

        const count =
            this.count(
                targetType,
                targetId
            );

        if (targetType === "post") {

            const post =
                Posts.get(targetId);

            if (post) {

                DB.update(
                    "posts",
                    targetId,
                    {
                        likesCount: count
                    }
                );
            }
        }
    }
};

/* =========================================================
   14. NOTIFICATIONS
   ========================================================= */

const Notifications = {

    create(
        userId,
        title,
        body,
        type = "system",
        data = {}
    ) {

        return DB.insert(
            "notifications",
            {
                userId,

                title:
                    DBUtils.text(
                        title,
                        150
                    ),

                body:
                    DBUtils.text(
                        body,
                        1000
                    ),

                type,

                data,

                read: false
            }
        );
    },

    list(userId, page = 1) {

        const items =
            DB.filter(
                "notifications",
                n => n.userId === userId
            ).sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            );

        return DBUtils.paginate(
            items,
            page
        );
    },

    markRead(id) {

        return DB.update(
            "notifications",
            id,
            {
                read: true
            }
        );
    },

    markAllRead(userId) {

        DB.filter(
            "notifications",
            n =>
                n.userId === userId &&
                !n.read
        ).forEach(n => {

            DB.update(
                "notifications",
                n.id,
                {
                    read: true
                }
            );

        });

        return true;
    },

    unreadCount(userId) {

        return DB.filter(
            "notifications",
            n =>
                n.userId === userId &&
                !n.read
        ).length;
    }
};

/* =========================================================
   15. FOLLOW SYSTEM
   ========================================================= */

const Social = {

    follow(followerId, followingId) {

        if (followerId === followingId) {
            throw new Error(
                "لا يمكنك متابعة نفسك"
            );
        }

        if (
            DB.find(
                "blocks",
                b =>
                    (
                        b.userId === followerId &&
                        b.blockedUserId === followingId
                    ) ||
                    (
                        b.userId === followingId &&
                        b.blockedUserId === followerId
                    )
            )
        ) {
            throw new Error(
                "لا يمكن تنفيذ العملية بسبب الحظر"
            );
        }

        const exists =
            DB.find(
                "follows",
                f =>
                    f.followerId === followerId &&
                    f.followingId === followingId
            );

        if (exists) {
            return false;
        }

        DB.insert(
            "follows",
            {
                followerId,
                followingId
            }
        );

        this.updateCounts(
            followerId,
            followingId
        );

        Notifications.create(
            followingId,
            "متابع جديد",
            "بدأ مستخدم بمتابعتك.",
            "follow",
            {
                userId: followerId
            }
        );

        return true;
    },

    unfollow(followerId, followingId) {

        const relation =
            DB.find(
                "follows",
                f =>
                    f.followerId === followerId &&
                    f.followingId === followingId
            );

        if (!relation) {
            return false;
        }

        DB.remove(
            "follows",
            relation.id
        );

        this.updateCounts(
            followerId,
            followingId
        );

        return true;
    },

    updateCounts(followerId, followingId) {

        const follower =
            Users.get(followerId);

        const following =
            Users.get(followingId);

        if (follower) {

            DB.update(
                "users",
                followerId,
                {
                    followingCount:
                        DB.filter(
                            "follows",
                            f =>
                                f.followerId === followerId
                        ).length
                }
            );
        }

        if (following) {

            DB.update(
                "users",
                followingId,
                {
                    followersCount:
                        DB.filter(
                            "follows",
                            f =>
                                f.followingId === followingId
                        ).length
                }
            );
        }
    },

    block(userId, blockedUserId) {

        if (userId === blockedUserId) {
            return false;
        }

        const exists =
            DB.find(
                "blocks",
                b =>
                    b.userId === userId &&
                    b.blockedUserId === blockedUserId
            );

        if (exists) {
            return false;
        }

        DB.insert(
            "blocks",
            {
                userId,
                blockedUserId
            }
        );

        this.unfollow(
            userId,
            blockedUserId
        );

        this.unfollow(
            blockedUserId,
            userId
        );

        return true;
    },

    unblock(userId, blockedUserId) {

        const block =
            DB.find(
                "blocks",
                b =>
                    b.userId === userId &&
                    b.blockedUserId === blockedUserId
            );

        if (!block) {
            return false;
        }

        return DB.remove(
            "blocks",
            block.id
        );
    }
};

/* =========================================================
   16. FRIEND REQUESTS
   ========================================================= */

const Friends = {

    request(senderId, receiverId) {

        if (senderId === receiverId) {
            throw new Error(
                "لا يمكنك إضافة نفسك"
            );
        }

        const exists =
            DB.find(
                "friendships",
                f =>
                    (
                        f.senderId === senderId &&
                        f.receiverId === receiverId
                    ) ||
                    (
                        f.senderId === receiverId &&
                        f.receiverId === senderId
                    )
            );

        if (exists) {
            return exists;
        }

        const request =
            DB.insert(
                "friendships",
                {
                    senderId,
                    receiverId,
                    status: "pending"
                }
            );

        Notifications.create(
            receiverId,
            "طلب صداقة",
            "لديك طلب صداقة جديد.",
            "friend_request",
            {
                friendshipId: request.id
            }
        );

        return request;
    },

    accept(id) {

        return DB.update(
            "friendships",
            id,
            {
                status: "accepted",
                acceptedAt: DBUtils.now()
            }
        );
    },

    reject(id) {

        return DB.update(
            "friendships",
            id,
            {
                status: "rejected"
            }
        );
    },

    list(userId) {

        return DB.filter(
            "friendships",
            f =>
                (
                    f.senderId === userId ||
                    f.receiverId === userId
                ) &&
                f.status === "accepted"
        );
    }
};

/* =========================================================
   17. WALLET
   ========================================================= */

const Wallet = {

    ensure(userId) {

        const existing =
            DB.find(
                "wallets",
                w => w.userId === userId
            );

        if (existing) {
            return existing;
        }

        return DB.insert(
            "wallets",
            {
                userId,
                coins: 0,
                diamonds: 0
            }
        );
    },

    get(userId) {

        return this.ensure(userId);
    },

    add(userId, currency, amount, reason = "") {

        const wallet =
            this.ensure(userId);

        amount =
            DBUtils.number(
                amount
            );

        if (amount <= 0) {
            throw new Error(
                "القيمة يجب أن تكون أكبر من صفر"
            );
        }

        const balance =
            Math.max(
                0,
                DBUtils.number(
                    wallet[currency]
                ) + amount
            );

        DB.update(
            "wallets",
            wallet.id,
            {
                [currency]: balance
            }
        );

        DB.insert(
            "transactions",
            {
                userId,
                type: "credit",
                currency,
                amount,
                reason,
                balance
            }
        );

        return balance;
    },

    subtract(
        userId,
        currency,
        amount,
        reason = ""
    ) {

        const wallet =
            this.ensure(userId);

        amount =
            DBUtils.number(amount);

        if (
            amount <= 0 ||
            DBUtils.number(wallet[currency]) < amount
        ) {
            throw new Error(
                "الرصيد غير كافٍ"
            );
        }

        const balance =
            wallet[currency] - amount;

        DB.update(
            "wallets",
            wallet.id,
            {
                [currency]: balance
            }
        );

        DB.insert(
            "transactions",
            {
                userId,
                type: "debit",
                currency,
                amount,
                reason,
                balance
            }
        );

        return balance;
    }
};

/* =========================================================
   18. STORE
   ========================================================= */

const Store = {

    createProduct(data = {}) {

        return DB.insert(
            "products",
            {
                name:
                    DBUtils.text(
                        data.name,
                        150
                    ),

                description:
                    DBUtils.text(
                        data.description,
                        1000
                    ),

                image:
                    data.image || "",

                price:
                    Math.max(
                        0,
                        DBUtils.number(
                            data.price
                        )
                    ),

                currency:
                    data.currency ||
                    DB_CONFIG.defaultCurrency,

                stock:
                    data.stock === undefined
                        ? -1
                        : DBUtils.number(
                            data.stock
                        ),

                category:
                    data.category || "general",

                active:
                    data.active !== false,

                metadata:
                    data.metadata || {}
            }
        );
    },

    get(id) {

        return DB.findById(
            "products",
            id
        );
    },

    list() {

        return DB.filter(
            "products",
            p => p.active
        );
    },

    purchase(
        userId,
        productId,
        quantity = 1
    ) {

        const product =
            this.get(productId);

        if (!product || !product.active) {
            throw new Error(
                "المنتج غير متاح"
            );
        }

        quantity =
            Math.max(
                1,
                Math.floor(
                    DBUtils.number(quantity)
                )
            );

        if (
            product.stock >= 0 &&
            product.stock < quantity
        ) {
            throw new Error(
                "الكمية المطلوبة غير متوفرة"
            );
        }

        const total =
            product.price * quantity;

        Wallet.subtract(
            userId,
            product.currency,
            total,
            `شراء ${product.name}`
        );

        if (product.stock >= 0) {

            DB.update(
                "products",
                productId,
                {
                    stock:
                        product.stock - quantity
                }
            );
        }

        return DB.insert(
            "purchases",
            {
                userId,
                productId,
                quantity,
                total,
                currency: product.currency,
                status: "completed"
            }
        );
    }
};

/* =========================================================
   19. REPORTS
   ========================================================= */

const Reports = {

    create(data = {}) {

        const reporterId =
            data.reporterId ||
            SessionManager.user()?.id;

        if (!reporterId) {
            throw new Error(
                "يجب تسجيل الدخول"
            );
        }

        return DB.insert(
            "reports",
            {
                reporterId,

                targetType:
                    data.targetType,

                targetId:
                    data.targetId,

                reason:
                    DBUtils.text(
                        data.reason,
                        500
                    ),

                details:
                    DBUtils.text(
                        data.details,
                        2000
                    ),

                status: "pending",

                assignedTo: null,

                resolution: null
            }
        );
    },

    resolve(
        id,
        adminId,
        resolution
    ) {

        const report =
            DB.update(
                "reports",
                id,
                {
                    status: "resolved",
                    assignedTo: adminId,
                    resolution:
                        DBUtils.text(
                            resolution,
                            1000
                        ),
                    resolvedAt: DBUtils.now()
                }
            );

        Audit.log(
            adminId,
            "report.resolve",
            "report",
            id,
            {
                resolution
            }
        );

        return report;
    }
};

/* =========================================================
   20. BANS
   ========================================================= */

const Moderation = {

    banUser(
        userId,
        adminId,
        reason = "",
        duration = null
    ) {

        const user =
            Users.get(userId);

        if (!user) {
            throw new Error(
                "المستخدم غير موجود"
            );
        }

        if (
            user.role === "owner"
        ) {
            throw new Error(
                "لا يمكن حظر مالك الموقع"
            );
        }

        const ban =
            DB.insert(
                "bans",
                {
                    userId,
                    adminId,
                    reason:
                        DBUtils.text(
                            reason,
                            1000
                        ),
                    duration,
                    active: true
                }
            );

        Users.update(
            userId,
            {
                status: "banned",
                online: false
            }
        );

        Audit.log(
            adminId,
            "user.ban",
            "user",
            userId,
            {
                reason,
                duration
            }
        );

        return ban;
    },

    unbanUser(
        userId,
        adminId
    ) {

        DB.filter(
            "bans",
            b =>
                b.userId === userId &&
                b.active
        ).forEach(b => {

            DB.update(
                "bans",
                b.id,
                {
                    active: false
                }
            );

        });

        Users.update(
            userId,
            {
                status: "active"
            }
        );

        Audit.log(
            adminId,
            "user.unban",
            "user",
            userId
        );

        return true;
    }
};

/* =========================================================
   21. SITE SETTINGS
   ========================================================= */

const Settings = {

    all() {

        return DBUtils.clone(
            DB.db.siteSettings
        );
    },

    get(key) {

        return DB.db.siteSettings[key];
    },

    set(key, value, adminId = null) {

        DB.db.siteSettings[key] =
            DBUtils.clone(value);

        DB.save();

        if (adminId) {

            Audit.log(
                adminId,
                "settings.update",
                "settings",
                key,
                {
                    value
                }
            );
        }

        return value;
    },

    update(values, adminId = null) {

        Object.keys(values || {})
            .forEach(key => {

                DB.db.siteSettings[key] =
                    DBUtils.clone(
                        values[key]
                    );

            });

        DB.save();

        if (adminId) {

            Audit.log(
                adminId,
                "settings.bulk_update",
                "settings",
                "site",
                values
            );
        }

        return this.all();
    }
};

/* =========================================================
   22. AUDIT LOGS
   ========================================================= */

const Audit = {

    log(
        actorId,
        action,
        targetType = null,
        targetId = null,
        metadata = {}
    ) {

        return DB.insert(
            "auditLogs",
            {
                actorId,
                action,
                targetType,
                targetId,
                metadata,
                timestamp: DBUtils.now()
            }
        );
    },

    list(page = 1) {

        const logs =
            DB.filter(
                "auditLogs",
                () => true
            ).sort(
                (a, b) =>
                    new Date(b.timestamp) -
                    new Date(a.timestamp)
            );

        return DBUtils.paginate(
            logs,
            page
        );
    }
};

/* =========================================================
   23. ADMIN API
   ========================================================= */

const Admin = {

    current() {

        const user =
            SessionManager.user();

        if (!user) {
            throw new Error(
                "يجب تسجيل الدخول"
            );
        }

        if (
            user.role !== "owner" &&
            user.role !== "admin"
        ) {
            throw new Error(
                "ليس لديك صلاحية الإدارة"
            );
        }

        return user;
    },

    can(permission) {

        return hasPermission(
            SessionManager.user(),
            permission
        );
    },

    statistics() {

        this.require(
            "statistics.view"
        );

        DB.updateStatistics();

        return DBUtils.clone(
            DB.db.statistics
        );
    },

    users(page = 1) {

        this.require(
            "users.view"
        );

        return DBUtils.paginate(
            DB.db.users
                .map(DBUtils.clone)
                .sort(
                    (a, b) =>
                        new Date(b.createdAt) -
                        new Date(a.createdAt)
                ),
            page
        );
    },

    banUser(
        userId,
        reason,
        duration
    ) {

        const admin =
            this.require(
                "users.ban"
            );

        return Moderation.banUser(
            userId,
            admin.id,
            reason,
            duration
        );
    },

    unbanUser(userId) {

        const admin =
            this.require(
                "users.ban"
            );

        return Moderation.unbanUser(
            userId,
            admin.id
        );
    },

    deleteUser(userId) {

        const admin =
            this.require(
                "users.delete"
            );

        Audit.log(
            admin.id,
            "user.delete",
            "user",
            userId
        );

        return Users.delete(
            userId
        );
    },

    require(permission) {

        const user =
            SessionManager.user();

        if (!user) {
            throw new Error(
                "غير مصرح"
            );
        }

        if (
            !hasPermission(
                user,
                permission
            )
        ) {
            throw new Error(
                "لا تملك هذه الصلاحية"
            );
        }

        return user;
    }
};

/* =========================================================
   24. SEARCH
   ========================================================= */

const Search = {

    all(query, page = 1) {

        const q =
            DBUtils.normalize(query);

        if (!q) {
            return {
                users: [],
                posts: [],
                rooms: []
            };
        }

        return {

            users:
                DBUtils.paginate(
                    DB.filter(
                        "users",
                        u =>
                            DBUtils.normalize(
                                u.username
                            ).includes(q) ||
                            DBUtils.normalize(
                                u.displayName
                            ).includes(q)
                    ),
                    page
                ),

            posts:
                DBUtils.paginate(
                    DB.filter(
                        "posts",
                        p =>
                            DBUtils.normalize(
                                p.content
                            ).includes(q)
                    ),
                    page
                ),

            rooms:
                DBUtils.paginate(
                    DB.filter(
                        "rooms",
                        r =>
                            DBUtils.normalize(
                                r.name
                            ).includes(q) ||
                            DBUtils.normalize(
                                r.description
                            ).includes(q)
                    ),
                    page
                )
        };
    }
};

/* =========================================================
   25. BACKUP SYSTEM
   ========================================================= */

const Backup = {

    create() {

        return {
            name: DB_CONFIG.name,
            version: DB_CONFIG.version,
            createdAt: DBUtils.now(),
            data: DBUtils.clone(DB.db)
        };
    },

    download() {

        const backup =
            this.create();

        const blob =
            new Blob(
                [
                    JSON.stringify(
                        backup,
                        null,
                        2
                    )
                ],
                {
                    type:
                        "application/json"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement("a");

        a.href = url;

        a.download =
            `afandina-backup-${Date.now()}.json`;

        a.click();

        URL.revokeObjectURL(url);
    },

    restore(backup) {

        if (!backup?.data) {
            throw new Error(
                "النسخة الاحتياطية غير صالحة"
            );
        }

        DB.import(
            backup.data
        );

        return true;
    }
};

/* =========================================================
   26. API ADAPTER
   ========================================================= */

const API = {

    async request(
        endpoint,
        options = {}
    ) {

        if (!DB_CONFIG.api.enabled) {
            throw new Error(
                "API غير مفعّل"
            );
        }

        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () =>
                    controller.abort(),
                DB_CONFIG.api.timeout
            );

        try {

            const response =
                await fetch(
                    `${DB_CONFIG.api.baseURL}${endpoint}`,
                    {
                        method:
                            options.method ||
                            "GET",

                        headers: {
                            "Content-Type":
                                "application/json",

                            ...(options.headers || {})
                        },

                        body:
                            options.body
                                ? JSON.stringify(
                                    options.body
                                )
                                : undefined,

                        signal:
                            controller.signal
                    }
                );

            const data =
                await response
                    .json()
                    .catch(() => null);

            if (!response.ok) {

                throw new Error(
                    data?.message ||
                    "حدث خطأ في الاتصال بالخادم"
                );
            }

            return data;

        } finally {

            clearTimeout(
                timeout
            );
        }
    }
};

/* =========================================================
   27. PUBLIC DATABASE API
   ========================================================= */

const AfandinaDB = {

    config: DB_CONFIG,

    engine: DB,

    session: SessionManager,

    auth: Auth,

    users: Users,

    rooms: Rooms,

    messages: Messages,

    posts: Posts,

    comments: Comments,

    likes: Likes,

    notifications: Notifications,

    social: Social,

    friends: Friends,

    wallet: Wallet,

    store: Store,

    reports: Reports,

    moderation: Moderation,

    permissions: {
        all: Permissions,
        check: hasPermission
    },

    admin: Admin,

    settings: Settings,

    audit: Audit,

    search: Search,

    backup: Backup,

    api: API,

    utils: DBUtils
};

/* =========================================================
   28. GLOBAL EXPORT
   ========================================================= */

if (typeof window !== "undefined") {

    window.AfandinaDB =
        AfandinaDB;

    window.DB =
        DB;

    window.Auth =
        Auth;

    window.Users =
        Users;

    window.Rooms =
        Rooms;

    window.Messages =
        Messages;

    window.Posts =
        Posts;

    window.Comments =
        Comments;

    window.Likes =
        Likes;

    window.Notifications =
        Notifications;

    window.Social =
        Social;

    window.Friends =
        Friends;

    window.Wallet =
        Wallet;

    window.Store =
        Store;

    window.Reports =
        Reports;

    window.Moderation =
        Moderation;

    window.Admin =
        Admin;

    window.Settings =
        Settings;

    window.Search =
        Search;

    window.Backup =
        Backup;
}

/* =========================================================
   29. DATABASE READY EVENT
   ========================================================= */

DB.emit(
    "database:ready",
    {
        version:
            DB_CONFIG.version,
        timestamp:
            DBUtils.now()
    }
);

/* =========================================================
   END
   ========================================================= */
