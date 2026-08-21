'use strict';

/*
============================================================
 افـنـدツينا🥀🖤
 server.js
 COMPLETE BACKEND
============================================================

 Node.js
 Express
 PostgreSQL
 Socket.IO
 JWT
 bcrypt
 Helmet
 CORS
 Rate Limit
 Multer

 لا توجد بيانات Demo.
 لا توجد حسابات وهمية.
 لا توجد Coins وهمية.
 لا توجد منشورات وهمية.
 لا توجد هدايا وهمية.

 أول حساب حقيقي يتم تسجيله = OWNER.

============================================================
*/

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const { Pool } = require('pg');
const { Server } = require('socket.io');

/*
============================================================
 CONFIG
============================================================
*/

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3000);

const NODE_ENV =
  process.env.NODE_ENV || 'development';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto.randomBytes(64).toString('hex');

const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || '7d';

const SESSION_DAYS =
  Number(process.env.SESSION_DAYS || 7);

const CLIENT_URL =
  process.env.CLIENT_URL ||
  `http://localhost:${PORT}`;

const DATABASE_URL =
  process.env.DATABASE_URL;

const DATABASE_SSL =
  String(process.env.DATABASE_SSL || 'false')
    .toLowerCase() === 'true';

const MAX_FILE_SIZE =
  Number(
    process.env.MAX_FILE_SIZE ||
    10 * 1024 * 1024
  );

const UPLOAD_DIR =
  path.resolve(
    process.env.UPLOAD_DIR ||
    path.join(__dirname, 'uploads')
  );

if (!DATABASE_URL) {
  console.error(
    '[FATAL] DATABASE_URL is missing.'
  );
  process.exit(1);
}

/*
============================================================
 DATABASE
============================================================
*/

const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl: DATABASE_SSL
    ? { rejectUnauthorized: false }
    : false,

  max: Number(
    process.env.DB_POOL_MAX || 20
  ),

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000
});

pool.on('error', (error) => {
  console.error(
    '[POSTGRES POOL ERROR]',
    error
  );
});

async function dbQuery(
  text,
  params = []
) {
  return pool.query(
    text,
    params
  );
}

async function dbOne(
  text,
  params = []
) {
  const result =
    await dbQuery(text, params);

  return result.rows[0] || null;
}

async function dbMany(
  text,
  params = []
) {
  const result =
    await dbQuery(text, params);

  return result.rows;
}

async function dbTransaction(
  callback
) {
  const client =
    await pool.connect();

  try {

    await client.query('BEGIN');

    const result =
      await callback(client);

    await client.query('COMMIT');

    return result;

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();
  }
}

/*
============================================================
 DIRECTORIES
============================================================
*/

const uploadFolders = [
  UPLOAD_DIR,
  path.join(UPLOAD_DIR, 'avatars'),
  path.join(UPLOAD_DIR, 'covers'),
  path.join(UPLOAD_DIR, 'posts'),
  path.join(UPLOAD_DIR, 'messages'),
  path.join(UPLOAD_DIR, 'rooms')
];

for (const folder of uploadFolders) {

  if (!fs.existsSync(folder)) {

    fs.mkdirSync(
      folder,
      {
        recursive: true
      }
    );
  }
}

/*
============================================================
 SOCKET.IO
============================================================
*/

const io = new Server(
  server,
  {
    cors: {
      origin: CLIENT_URL,
      credentials: true
    },

    maxHttpBufferSize:
      2 * 1024 * 1024
  }
);

/*
============================================================
 BASIC SECURITY
============================================================
*/

app.disable('x-powered-by');

app.set(
  'trust proxy',
  1
);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true
  })
);

app.use(
  express.json({
    limit: '2mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '2mb'
  })
);

app.use(cookieParser());

/*
============================================================
 RATE LIMITERS
============================================================
*/

const generalLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 500,

    standardHeaders: true,

    legacyHeaders: false
  });

const authLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 20,

    standardHeaders: true,

    legacyHeaders: false
  });

const messageLimiter =
  rateLimit({
    windowMs:
      60 * 1000,

    limit: 120,

    standardHeaders: true,

    legacyHeaders: false
  });

const sensitiveLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 30,

    standardHeaders: true,

    legacyHeaders: false
  });

app.use(
  generalLimiter
);

/*
============================================================
 MULTER
============================================================
*/

const storage =
  multer.diskStorage({

    destination(
      req,
      file,
      cb
    ) {

      const type =
        String(
          req.body.type ||
          'post'
        ).toLowerCase();

      let folder =
        path.join(
          UPLOAD_DIR,
          'posts'
        );

      if (type === 'avatar') {

        folder =
          path.join(
            UPLOAD_DIR,
            'avatars'
          );
      }

      if (type === 'cover') {

        folder =
          path.join(
            UPLOAD_DIR,
            'covers'
          );
      }

      if (type === 'message') {

        folder =
          path.join(
            UPLOAD_DIR,
            'messages'
          );
      }

      if (type === 'room') {

        folder =
          path.join(
            UPLOAD_DIR,
            'rooms'
          );
      }

      fs.mkdirSync(
        folder,
        {
          recursive: true
        }
      );

      cb(null, folder);
    },

    filename(
      req,
      file,
      cb
    ) {

      const extension =
        path.extname(
          file.originalname
        ).toLowerCase();

      cb(
        null,
        crypto.randomUUID() +
          extension
      );
    }
  });

const upload =
  multer({

    storage,

    limits: {
      fileSize:
        MAX_FILE_SIZE
    },

    fileFilter(
      req,
      file,
      cb
    ) {

      const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/ogg',
        'audio/wav'
      ];

      if (
        !allowed.includes(
          file.mimetype
        )
      ) {

        return cb(
          new Error(
            'FILE_TYPE_NOT_ALLOWED'
          )
        );
      }

      cb(null, true);
    }
  });

/*
============================================================
 HELPERS
============================================================
*/

function normalizeEmail(
  email
) {

  if (!email) {
    return null;
  }

  return String(email)
    .trim()
    .toLowerCase();
}

function normalizeUsername(
  username
) {

  return String(
    username || ''
  )
    .trim()
    .toLowerCase();
}

function isValidUUID(value) {

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      String(value || '')
    );
}

function isValidUsername(
  username
) {

  return /^[a-zA-Z0-9_\u0600-\u06FF]{3,32}$/
    .test(username);
}

function isValidPassword(
  password
) {

  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    password.length <= 128
  );
}

function hashToken(
  token
) {

  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

function randomToken() {

  return crypto
    .randomBytes(48)
    .toString('hex');
}

function getIP(req) {

  return (
    req.ip ||
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    null
  );
}

function pagination(
  req
) {

  let page =
    Number(req.query.page || 1);

  let limit =
    Number(req.query.limit || 20);

  page =
    Number.isFinite(page)
      ? Math.max(1, Math.floor(page))
      : 1;

  limit =
    Number.isFinite(limit)
      ? Math.min(
          100,
          Math.max(
            1,
            Math.floor(limit)
          )
        )
      : 20;

  return {
    page,
    limit,
    offset:
      (page - 1) * limit
  };
}

function publicUser(
  user
) {

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    level: user.level,
    xp: user.xp,
    coins: user.coins,
    vip_until:
      user.vip_until,
    last_seen_at:
      user.last_seen_at,
    created_at:
      user.created_at
  };
}

function publicProfile(
  profile
) {

  if (!profile) {
    return null;
  }

  return {
    user_id:
      profile.user_id,
    display_name:
      profile.display_name,
    bio:
      profile.bio,
    avatar_url:
      profile.avatar_url,
    cover_url:
      profile.cover_url,
    gender:
      profile.gender,
    country:
      profile.country,
    city:
      profile.city,
    birth_date:
      profile.birth_date,
    website:
      profile.website
  };
}

function signToken(
  user
) {

  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn:
        JWT_EXPIRES_IN
    }
  );
}

function setCookie(
  res,
  token
) {

  res.cookie(
    'access_token',
    token,
    {
      httpOnly: true,

      secure:
        NODE_ENV ===
        'production',

      sameSite: 'lax',

      maxAge:
        SESSION_DAYS *
        24 *
        60 *
        60 *
        1000,

      path: '/'
    }
  );
}

function clearCookie(
  res
) {

  res.clearCookie(
    'access_token',
    {
      httpOnly: true,

      secure:
        NODE_ENV ===
        'production',

      sameSite: 'lax',

      path: '/'
    }
  );
}

function levelFromXP(
  xp
) {

  return (
    Math.floor(
      Math.sqrt(
        Math.max(
          0,
          Number(xp || 0)
        ) / 100
      )
    ) + 1
  );
}

function sendSuccess(
  res,
  data = {},
  status = 200
) {

  return res
    .status(status)
    .json({
      success: true,
      ...data
    });
}

function sendError(
  res,
  status,
  code,
  message = null
) {

  const body = {
    success: false,
    error: code
  };

  if (
    NODE_ENV !==
    'production' &&
    message
  ) {

    body.message =
      message;
  }

  return res
    .status(status)
    .json(body);
}

/*
============================================================
 AUDIT LOG
============================================================
*/

async function audit({
  userId = null,
  action,
  targetType = null,
  targetId = null,
  req = null,
  metadata = {}
}) {

  try {

    await dbQuery(
      `
        INSERT INTO audit_logs
        (
          user_id,
          action,
          target_type,
          target_id,
          ip_address,
          user_agent,
          metadata
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        userId,
        action,
        targetType,
        targetId,
        req
          ? getIP(req)
          : null,
        req
          ? req.headers[
              'user-agent'
            ]
          : null,
        JSON.stringify(
          metadata
        )
      ]
    );

  } catch (error) {

    console.error(
      '[AUDIT]',
      error.message
    );
  }
}

/*
============================================================
 NOTIFICATIONS
============================================================
*/

async function createNotification({
  userId,
  actorId = null,
  type,
  title = null,
  body = null,
  data = {}
}) {

  const notification =
    await dbOne(
      `
        INSERT INTO notifications
        (
          user_id,
          actor_id,
          type,
          title,
          body,
          data
        )
        VALUES
        ($1,$2,$3,$4,$5,$6)
        RETURNING *
      `,
      [
        userId,
        actorId,
        type,
        title,
        body,
        JSON.stringify(data)
      ]
    );

  io.to(
    `user:${userId}`
  ).emit(
    'notification:new',
    notification
  );

  return notification;
}

/*
============================================================
 AUTHENTICATION
============================================================
*/

async function authenticate(
  req,
  res,
  next
) {

  try {

    let token =
      req.cookies.access_token;

    const authorization =
      req.headers.authorization ||
      '';

    if (
      !token &&
      authorization.startsWith(
        'Bearer '
      )
    ) {

      token =
        authorization.slice(7);
    }

    if (!token) {

      return sendError(
        res,
        401,
        'AUTH_REQUIRED'
      );
    }

    let decoded;

    try {

      decoded =
        jwt.verify(
          token,
          JWT_SECRET
        );

    } catch {

      return sendError(
        res,
        401,
        'INVALID_TOKEN'
      );
    }

    const session =
      await dbOne(
        `
          SELECT
            s.id AS session_id,
            s.expires_at,
            u.*
          FROM sessions s
          JOIN users u
            ON u.id = s.user_id
          WHERE
            s.token_hash = $1
            AND s.expires_at > NOW()
          LIMIT 1
        `,
        [
          hashToken(token)
        ]
      );

    if (!session) {

      return sendError(
        res,
        401,
        'SESSION_EXPIRED'
      );
    }

    if (
      decoded.sub !==
      session.id
    ) {

      /*
       decoded.sub must be user id.
       This comparison is intentionally
       corrected below through user id.
      */
    }

    if (
      decoded.sub !==
      session.id
    ) {

      const actual =
        await dbOne(
          `
            SELECT id
            FROM users
            WHERE id=$1
          `,
          [
            decoded.sub
          ]
        );

      if (
        !actual ||
        actual.id !==
        session.id
      ) {

        return sendError(
          res,
          401,
          'INVALID_SESSION'
        );
      }
    }

    if (
      session.status !==
      'ACTIVE'
    ) {

      return sendError(
        res,
        403,
        'ACCOUNT_NOT_ACTIVE'
      );
    }

    req.user =
      session;

    req.token =
      token;

    next();

  } catch (error) {

    next(error);
  }
}

/*
============================================================
 ROLE MIDDLEWARE
============================================================
*/

function requireRole(
  ...roles
) {

  return (
    req,
    res,
    next
  ) => {

    if (!req.user) {

      return sendError(
        res,
        401,
        'AUTH_REQUIRED'
      );
    }

    if (
      !roles.includes(
        req.user.role
      )
    ) {

      return sendError(
        res,
        403,
        'FORBIDDEN'
      );
    }

    next();
  };
}

const requireModerator =
  requireRole(
    'MODERATOR',
    'ADMIN',
    'OWNER'
  );

const requireAdmin =
  requireRole(
    'ADMIN',
    'OWNER'
  );

const requireOwner =
  requireRole(
    'OWNER'
  );

/*
============================================================
 DATABASE INITIALIZATION
============================================================
*/

async function initializeDatabase() {

  await dbQuery(
    `
      CREATE EXTENSION IF NOT EXISTS pgcrypto
    `
  );

  /*
  NOTE:
  schema.sql remains the authoritative
  database structure.
  These CREATE statements provide
  protection when the server is started
  before schema.sql has been applied.
  */

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(32) NOT NULL UNIQUE,
      email VARCHAR(255) UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'USER',
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      coins BIGINT NOT NULL DEFAULT 0,
      xp BIGINT NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      vip_until TIMESTAMPTZ,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      last_login_at TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name VARCHAR(80),
      bio TEXT,
      avatar_url TEXT,
      cover_url TEXT,
      gender VARCHAR(30),
      country VARCHAR(100),
      city VARCHAR(100),
      birth_date DATE,
      website TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      ip_address INET,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id)
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS blocks (
      blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id)
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      avatar_url TEXT,
      is_private BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS room_members (
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, user_id)
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
      room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
      body TEXT,
      attachment_url TEXT,
      message_type VARCHAR(30) NOT NULL DEFAULT 'TEXT',
      is_delivered BOOLEAN NOT NULL DEFAULT FALSE,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users
