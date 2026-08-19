"use strict";

require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const fs = require("fs");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || "development";

if (!JWT_SECRET) {
    console.error("JWT_SECRET غير موجود في ملف .env");
    process.exit(1);
}

/* =========================
   DIRECTORIES
========================= */

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/* =========================
   SECURITY
========================= */

app.disable("x-powered-by");

app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        }
    })
);

app.use(
    cors({
        origin: process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(",")
            : true,
        credentials: true
    })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

/* =========================
   STATIC FILES
========================= */

app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

/* =========================
   RATE LIMIT
========================= */

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "طلبات كثيرة جدًا، حاول لاحقًا."
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "محاولات كثيرة جدًا، حاول لاحقًا."
    }
});

app.use("/api", apiLimiter);

/* =========================
   DEVELOPMENT DATABASE
========================= */

const db = {
    users: new Map(),
    rooms: new Map(),
    messages: new Map(),
    posts: new Map(),
    comments: new Map(),
    notifications: new Map(),
    follows: new Set(),
    blocks: new Set(),
    reports: new Map(),
    products: new Map(),
    purchases: new Map(),
    wallets: new Map(),
    bans: new Map(),
    auditLogs: new Map(),

    settings: {
        siteName: "افـنـدツينا🥀🖤",
        maintenance: false,
        registrationEnabled: true,
        guestEnabled: true,
        chatEnabled: true,
        postsEnabled: true,
        storeEnabled: true,
        notificationsEnabled: true
    }
};

/*
   تنبيه:
   هذه قاعدة بيانات مؤقتة داخل الذاكرة.
   سيتم استبدالها لاحقًا بقاعدة بيانات حقيقية.
*/

/* =========================
   HELPERS
========================= */

function createId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
    return new Date().toISOString();
}

function cleanText(value, max = 5000) {
    return String(value ?? "")
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, max);
}

function normalizeUsername(value) {
    return cleanText(value, 50).toLowerCase();
}

function normalizeEmail(value) {
    return cleanText(value, 200).toLowerCase();
}

function sanitizeUser(user) {
    if (!user) return null;

    const copy = { ...user };
    delete copy.passwordHash;

    return copy;
}

function paginate(items, page = 1, limit = 30) {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 30));

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
}

/* =========================
   JWT
========================= */

function createToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            role: user.role,
            username: user.username
        },
        JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "7d"
        }
    );
}

/* =========================
   AUTH MIDDLEWARE
========================= */

function auth(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول."
            });
        }

        const token = header.substring(7);

        const payload = jwt.verify(token, JWT_SECRET);

        const user = db.users.get(payload.sub);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "الحساب غير موجود."
            });
        }

        if (user.status === "banned") {
            return res.status(403).json({
                success: false,
                message: "الحساب محظور."
            });
        }

        req.user = user;
        next();

    } catch {
        return res.status(401).json({
            success: false,
            message: "جلسة غير صالحة."
        });
    }
}

/* =========================
   PERMISSIONS
========================= */

const permissions = {
    owner: ["*"],

    admin: [
        "users.view",
        "users.edit",
        "users.ban",
        "rooms.view",
        "rooms.edit",
        "rooms.delete",
        "messages.view",
        "messages.delete",
        "posts.view",
        "posts.delete",
        "posts.moderate",
        "reports.view",
        "reports.resolve",
        "store.view",
        "store.manage",
        "statistics.view",
        "settings.view",
        "settings.manage",
        "logs.view"
    ],

    moderator: [
        "users.view",
        "rooms.view",
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
    if (!user) return false;

    const list = permissions[user.role] || [];

    return list.includes("*") || list.includes(permission);
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!hasPermission(req.user, permission)) {
            return res.status(403).json({
                success: false,
                message: "لا تملك الصلاحية المطلوبة."
            });
        }

        next();
    };
}

/* =========================
   AUDIT LOG
========================= */

function audit(
    actorId,
    action,
    targetType = null,
    targetId = null,
    metadata = {}
) {
    const record = {
        id: createId("audit"),
        actorId,
        action,
        targetType,
        targetId,
        metadata,
        createdAt: now()
    };

    db.auditLogs.set(record.id, record);

    return record;
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        status: "online",
        service: "afandina",
        environment: NODE_ENV,
        time: now()
    });
});

/* =========================
   SETTINGS
========================= */

app.get("/api/settings", (req, res) => {
    res.json({
        success: true,
        settings: db.settings
    });
});

app.put(
    "/api/admin/settings",
    auth,
    requirePermission("settings.manage"),
    (req, res) => {
        const allowed = [
            "maintenance",
            "registrationEnabled",
            "guestEnabled",
            "chatEnabled",
            "postsEnabled",
            "storeEnabled",
            "notificationsEnabled"
        ];

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                db.settings[key] = Boolean(req.body[key]);
            }
        }

        audit(
            req.user.id,
            "settings.update",
            "settings",
            "site"
        );

        res.json({
            success: true,
            settings: db.settings
        });
    }
);

/* =========================
   REGISTER
========================= */

app.post(
    "/api/auth/register",
    authLimiter,
    async (req, res) => {
        try {
            if (!db.settings.registrationEnabled) {
                return res.status(403).json({
                    success: false,
                    message: "التسجيل مغلق حاليًا."
                });
            }

            const username = cleanText(req.body.username, 40);
            const email = normalizeEmail(req.body.email);
            const password = String(req.body.password || "");

            if (username.length < 3) {
                return res.status(400).json({
                    success: false,
                    message: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل."
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
                });
            }

            for (const existing of db.users.values()) {
                if (
                    normalizeUsername(existing.username) ===
                    normalizeUsername(username)
                ) {
                    return res.status(409).json({
                        success: false,
                        message: "اسم المستخدم مستخدم بالفعل."
                    });
                }

                if (email && existing.email === email) {
                    return res.status(409).json({
                        success: false,
                        message: "البريد الإلكتروني مستخدم بالفعل."
                    });
                }
            }

            const passwordHash = await bcrypt.hash(password, 12);

            const user = {
                id: createId("user"),
                username,
                email,
                passwordHash,

                displayName: cleanText(
                    req.body.displayName || username,
                    80
                ),

                avatar: cleanText(req.body.avatar, 500),

                bio: cleanText(req.body.bio, 500),

                age: Number(req.body.age) || null,

                gender: cleanText(req.body.gender, 30),

                country: cleanText(req.body.country, 80),

                role: "user",

                status: "active",

                verified: false,

                online: true,

                createdAt: now(),
                updatedAt: now(),
                lastSeen: now()
            };

            db.users.set(user.id, user);

            db.wallets.set(user.id, {
                userId: user.id,
                coins: 0,
                diamonds: 0
            });

            const token = createToken(user);

            audit(
                user.id,
                "auth.register",
                "user",
                user.id
            );

            res.status(201).json({
                success: true,
                token,
                user: sanitizeUser(user)
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "حدث خطأ أثناء إنشاء الحساب."
            });
        }
    }
);

/* =========================
   LOGIN
========================= */

app.post(
    "/api/auth/login",
    authLimiter,
    async (req, res) => {
        try {
            const username = normalizeUsername(req.body.username);
            const password = String(req.body.password || "");

            let user = null;

            for (const item of db.users.values()) {
                if (normalizeUsername(item.username) === username) {
                    user = item;
                    break;
                }
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "بيانات الدخول غير صحيحة."
                });
            }

            if (user.status === "banned") {
                return res.status(403).json({
                    success: false,
                    message: "هذا الحساب محظور."
                });
            }

            const valid = await bcrypt.compare(
                password,
                user.passwordHash
            );

            if (!valid) {
                return res.status(401).json({
                    success: false,
                    message: "بيانات الدخول غير صحيحة."
                });
            }

            user.online = true;
            user.lastSeen = now();
            user.updatedAt = now();

            const token = createToken(user);

            audit(
                user.id,
                "auth.login",
                "user",
                user.id
            );

            res.json({
                success: true,
                token,
                user: sanitizeUser(user)
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "حدث خطأ أثناء تسجيل الدخول."
            });
        }
    }
);

/* =========================
   LOGOUT
========================= */

app.post("/api/auth/logout", auth, (req, res) => {
    req.user.online = false;
    req.user.lastSeen = now();

    audit(
        req.user.id,
        "auth.logout",
        "user",
        req.user.id
    );

    res.json({
        success: true
    });
});

/* =========================
   CURRENT USER
========================= */

app.get("/api/auth/me", auth, (req, res) => {
    res.json({
        success: true,
        user: sanitizeUser(req.user)
    });
});

/* =========================
   USERS
========================= */

app.get(
    "/api/users",
    auth,
    requirePermission("users.view"),
    (req, res) => {
        const users = Array.from(db.users.values())
            .map(sanitizeUser);

        res.json({
            success: true,
            ...paginate(
                users,
                req.query.page,
                req.query.limit
            )
        });
    }
);

app.get("/api/users/:id", auth, (req, res) => {
    const user = db.users.get(req.params.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "المستخدم غير موجود."
        });
    }

    res.json({
        success: true,
        user: sanitizeUser(user)
    });
});

app.patch("/api/users/:id", auth, (req, res) => {
    if (
        req.user.id !== req.params.id &&
        !hasPermission(req.user, "users.edit")
    ) {
        return res.status(403).json({
            success: false,
            message: "غير مصرح."
        });
    }

    const user = db.users.get(req.params.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "المستخدم غير موجود."
        });
    }

    const fields = [
        "displayName",
        "avatar",
        "bio",
        "age",
        "gender",
        "country"
    ];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            user[field] =
                field === "bio"
                    ? cleanText(req.body[field], 500)
                    : req.body[field];
        }
    }

    user.updatedAt = now();

    audit(
        req.user.id,
        "user.update",
        "user",
        user.id
    );

    res.json({
        success: true,
        user: sanitizeUser(user)
    });
});

/* =========================
   ROOMS
========================= */

app.get("/api/rooms", (req, res) => {
    const rooms = Array.from(db.rooms.values());

    res.json({
        success: true,
        ...paginate(
            rooms,
            req.query.page,
            req.query.limit
        )
    });
});

app.post(
    "/api/rooms",
    auth,
    requirePermission("rooms.create"),
    (req, res) => {
        const name = cleanText(req.body.name, 100);

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "اسم الغرفة مطلوب."
            });
        }

        const room = {
            id: createId("room"),
            name,
            description: cleanText(req.body.description, 500),
            ownerId: req.user.id,
            type: req.body.type || "public",
            image: cleanText(req.body.image, 500),
            active: true,
            membersCount: 0,
            createdAt: now(),
            updatedAt: now()
        };

        db.rooms.set(room.id, room);

        audit(
            req.user.id,
            "room.create",
            "room",
            room.id
        );

        res.status(201).json({
            success: true,
            room
        });
    }
);

app.patch(
    "/api/rooms/:id",
    auth,
    requirePermission("rooms.edit"),
    (req, res) => {
        const room = db.rooms.get(req.params.id);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "الغرفة غير موجودة."
            });
        }

        const fields = [
            "name",
            "description",
            "type",
            "image",
            "active"
        ];

        for (const field of fields) {
            if (req.body[field] !== undefined) {
                room[field] = req.body[field];
            }
        }

        room.updatedAt = now();

        res.json({
            success: true,
            room
        });
    }
);

app.delete(
    "/api/rooms/:id",
    auth,
    requirePermission("rooms.delete"),
    (req, res) => {
        const room = db.rooms.get(req.params.id);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "الغرفة غير موجودة."
            });
        }

        db.rooms.delete(room.id);

        audit(
            req.user.id,
            "room.delete",
            "room",
            room.id
        );

        res.json({
            success: true
        });
    }
);

/* =========================
   MESSAGES
========================= */

app.get(
    "/api/rooms/:roomId/messages",
    auth,
    (req, res) => {
        const messages = Array.from(db.messages.values())
            .filter(
                message =>
                    message.roomId === req.params.roomId &&
                    !message.deleted
            );

        res.json({
            success: true,
            ...paginate(
                messages,
                req.query.page,
                req.query.limit
            )
        });
    }
);

app.post(
    "/api/rooms/:roomId/messages",
    auth,
    (req, res) => {
        if (!db.settings.chatEnabled) {
            return res.status(403).json({
                success: false,
                message: "الدردشة مغلقة."
            });
        }

        const content = cleanText(
            req.body.content,
            5000
        );

        if (!content) {
            return res.status(400).json({
                success: false,
                m
