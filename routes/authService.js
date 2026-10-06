'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../database');

const JWT_SECRET = String(process.env.JWT_SECRET || '');
const BCRYPT_ROUNDS = Number.parseInt(
  process.env.BCRYPT_ROUNDS || '12',
  10
);

const COOKIE_MAX_AGE_MS = Number.parseInt(
  process.env.COOKIE_MAX_AGE_MS || '604800000',
  10
);

const SESSION_MAX_AGE_MS = COOKIE_MAX_AGE_MS;

function createError(message, statusCode = 400, code = 'AUTH_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim();
}

function cleanUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName:
      user.display_name ??
      user.displayName ??
      user.username,
    avatarUrl:
      user.avatar_url ??
      user.avatarUrl ??
      null,
    coverUrl:
      user.cover_url ??
      user.coverUrl ??
      null,
    bio: user.bio ?? '',
    role: user.role,
    status: user.status,
    level: user.level ?? 1,
    coins: user.coins ?? 0,
    experience:
      user.experience ??
      user.xp ??
      0,
    isOwner:
      user.role === 'OWNER',
    createdAt:
      user.created_at ??
      user.createdAt ??
      null,
    updatedAt:
      user.updated_at ??
      user.updatedAt ??
      null
  };
}

function getClientIp(ipAddress) {
  if (!ipAddress) {
    return null;
  }

  return String(ipAddress)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[0] || null;
}

function createSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashSessionToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token))
    .digest('hex');
}

function getTokenService() {
  try {
    return require('./tokenService');
  } catch (error) {
    return null;
  }
}

async function createAccessToken(user, sessionId = null) {
  const tokenService = getTokenService();

  if (tokenService) {
    if (typeof tokenService.createAccessToken === 'function') {
      return tokenService.createAccessToken({
        userId: user.id,
        role: user.role,
        sessionId
      });
    }

    if (typeof tokenService.generateAccessToken === 'function') {
      return tokenService.generateAccessToken({
        userId: user.id,
        role: user.role,
        sessionId
      });
    }

    if (typeof tokenService.signToken === 'function') {
      return tokenService.signToken({
        userId: user.id,
        role: user.role,
        sessionId
      });
    }
  }

  if (!JWT_SECRET) {
    throw createError(
      'JWT_SECRET غير مضبوط في ملف البيئة.',
      500,
      'JWT_SECRET_MISSING'
    );
  }

  const jwt = require('jsonwebtoken');

  return jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      role: user.role,
      sessionId
    },
    JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN || '7d',
      issuer:
        process.env.JWT_ISSUER || 'afn-edinah',
      audience:
        process.env.JWT_AUDIENCE || 'afn-edinah-users'
    }
  );
}

async function findUserById(client, userId) {
  const result = await client.query(
    `
      SELECT
        id,
        username,
        email,
        password_hash,
        display_name,
        avatar_url,
        cover_url,
        bio,
        role,
        status,
        level,
        coins,
        experience,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findUserByEmail(client, email) {
  const result = await client.query(
    `
      SELECT
        id,
        username,
        email,
        password_hash,
        display_name,
        avatar_url,
        cover_url,
        bio,
        role,
        status,
        level,
        coins,
        experience,
        created_at,
        updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function findUserByUsername(client, username) {
  const result = await client.query(
    `
      SELECT
        id,
        username,
        email,
        password_hash,
        display_name,
        avatar_url,
        cover_url,
        bio,
        role,
        status,
        level,
        coins,
        experience,
        created_at,
        updated_at
      FROM users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
    `,
    [username]
  );

  return result.rows[0] || null;
}

function ensureUserCanAuthenticate(user) {
  if (!user) {
    throw createError(
      'بيانات الدخول غير صحيحة.',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  if (
    user.status &&
    ['BANNED', 'DISABLED', 'SUSPENDED', 'DELETED']
      .includes(String(user.status).toUpperCase())
  ) {
    throw createError(
      'هذا الحساب غير متاح حالياً.',
      403,
      'ACCOUNT_UNAVAILABLE'
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(user, 'is_active') &&
    user.is_active === false
  ) {
    throw createError(
      'هذا الحساب غير نشط.',
      403,
      'ACCOUNT_INACTIVE'
    );
  }
}

async function createSession(
  client,
  user,
  {
    ipAddress = null,
    userAgent = null
  } = {}
) {
  const rawToken = createSessionToken();
  const tokenHash = hashSessionToken(rawToken);

  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_MS
  );

  let sessionId = null;

  try {
    const result = await client.query(
      `
        INSERT INTO sessions (
          user_id,
          token_hash,
          ip_address,
          user_agent,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        user.id,
        tokenHash,
        getClientIp(ipAddress),
        userAgent || null,
        expiresAt
      ]
    );

    sessionId = result.rows[0]?.id || null;
  } catch (error) {
    if (error.code === '42703') {
      const result = await client.query(
        `
          INSERT INTO sessions (
            user_id,
            token_hash,
            expires_at
          )
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [
          user.id,
          tokenHash,
          expiresAt
        ]
      );

      sessionId = result.rows[0]?.id || null;
    } else {
      throw error;
    }
  }

  const accessToken = await createAccessToken(
    user,
    sessionId
  );

  return {
    accessToken,
    token: accessToken,
    sessionId,
    expiresAt
  };
}

async function register({
  username,
  email,
  password,
  displayName,
  ipAddress,
  userAgent
}) {
  const normalizedUsername =
    normalizeUsername(username);

  const normalizedEmail =
    normalizeEmail(email);

  if (
    !normalizedUsername ||
    !normalizedEmail ||
    !password
  ) {
    throw createError(
      'بيانات إنشاء الحساب غير مكتملة.',
      400,
      'INVALID_REGISTER_DATA'
    );
  }

  return db.transaction(async (client) => {
    const existingEmail =
      await findUserByEmail(
        client,
        normalizedEmail
      );

    if (existingEmail) {
      throw createError(
        'البريد الإلكتروني مستخدم بالفعل.',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    const existingUsername =
      await findUserByUsername(
        client,
        normalizedUsername
      );

    if (existingUsername) {
      throw createError(
        'اسم المستخدم مستخدم بالفعل.',
        409,
        'USERNAME_ALREADY_EXISTS'
      );
    }

    const passwordHash =
      await bcrypt.hash(
        String(password),
        BCRYPT_ROUNDS
      );

    /*
     * يتم قفل عملية التسجيل الأولى لمنع إنشاء
     * أكثر من OWNER في نفس اللحظة.
     */
    await client.query(
      `SELECT pg_advisory_xact_lock($1)`,
      [734829104]
    );

    const ownerCountResult =
      await client.query(
        `
          SELECT COUNT(*)::integer AS count
          FROM users
          WHERE role = 'OWNER'
        `
      );

    const ownerCount =
      Number(ownerCountResult.rows[0]?.count || 0);

    const totalUsersResult =
      await client.query(
        `
          SELECT COUNT(*)::integer AS count
          FROM users
        `
      );

    const totalUsers =
      Number(totalUsersResult.rows[0]?.count || 0);

    const shouldBecomeOwner =
      process.env.AUTO_FIRST_OWNER !== 'false' &&
      ownerCount === 0 &&
      totalUsers === 0;

    const role =
      shouldBecomeOwner
        ? 'OWNER'
        : 'USER';

    let userResult;

    try {
      userResult = await client.query(
        `
          INSERT INTO users (
            username,
            email,
            password_hash,
            display_name,
            role,
            status,
            level,
            coins,
            experience
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'ACTIVE',
            1,
            0,
            0
          )
          RETURNING
            id,
            username,
            email,
            display_name,
            avatar_url,
            cover_url,
            bio,
            role,
            status,
            level,
            coins,
            experience,
            created_at,
            updated_at
        `,
        [
          normalizedUsername,
          normalizedEmail,
          passwordHash,
          displayName
            ? String(displayName).trim()
            : normalizedUsername,
          role
        ]
      );
    } catch (error) {
      if (error.code === '42703') {
        userResult = await client.query(
          `
            INSERT INTO users (
              username,
              email,
              password_hash,
              role,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              'ACTIVE'
            )
            RETURNING
              id,
              username,
              email,
              password_hash,
              role,
              status,
              created_at,
              updated_at
          `,
          [
            normalizedUsername,
            normalizedEmail,
            passwordHash,
            role
          ]
        );
      } else {
        throw error;
      }
    }

    const user =
      userResult.rows[0];

    if (!user) {
      throw createError(
        'تعذر إنشاء الحساب.',
        500,
        'USER_CREATION_FAILED'
      );
    }

    /*
     * التأكيد النهائي من الخادم أن أول حساب حقيقي
     * هو OWNER، وليس اعتماداً على الواجهة.
     */
    if (shouldBecomeOwner) {
      await client.query(
        `
          UPDATE users
          SET role = 'OWNER'
          WHERE id = $1
        `,
        [user.id]
      );

      user.role = 'OWNER';
    }

    const session =
      await createSession(
        client,
        user,
        {
          ipAddress,
          userAgent
        }
      );

    return {
      user: cleanUser(user),
      accessToken: session.accessToken,
      token: session.token,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      isOwner: user.role === 'OWNER'
    };
  });
}

async function login({
  identifier,
  username,
  email,
  password,
  ipAddress,
  userAgent
}) {
  const loginIdentifier =
    normalizeEmail(
      email ||
      identifier ||
      username
    );

  if (!loginIdentifier || !password) {
    throw createError(
      'بيانات تسجيل الدخول غير مكتملة.',
      400,
      'INVALID_LOGIN_DATA'
    );
  }

  return db.transaction(async (client) => {
    let user =
      await findUserByEmail(
        client,
        loginIdentifier
      );

    if (!user) {
      user =
        await findUserByUsername(
          client,
          loginIdentifier
        );
    }

    ensureUserCanAuthenticate(user);

    const passwordValid =
      await bcrypt.compare(
        String(password),
        String(user.password_hash || '')
      );

    if (!passwordValid) {
      throw createError(
        'بيانات الدخول غير صحيحة.',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    const session =
      await createSession(
        client,
        user,
        {
          ipAddress,
          userAgent
        }
      );

    return {
      user: cleanUser(user),
      accessToken: session.accessToken,
      token: session.token,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      isOwner: user.role === 'OWNER'
    };
  });
}

async function logout({
  userId,
  token = null,
  sessionId = null
}) {
  if (!userId) {
    throw createError(
      'المستخدم غير معروف.',
      401,
      'UNAUTHORIZED'
    );
  }

  if (sessionId) {
    await db.query(
      `
        UPDATE sessions
        SET revoked_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND revoked_at IS NULL
      `,
      [sessionId, userId]
    );
  } else if (token) {
    const tokenHash =
      hashSessionToken(token);

    await db.query(
      `
        UPDATE sessions
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND token_hash = $2
          AND revoked_at IS NULL
      `,
      [userId, tokenHash]
    );
  }

  return {
    loggedOut: true
  };
}

async function refreshSession({
  token,
  ipAddress,
  userAgent
}) {
  if (!token) {
    throw createError(
      'جلسة الدخول غير موجودة.',
      401,
      'REFRESH_TOKEN_MISSING'
    );
  }

  const tokenHash =
    hashSessionToken(token);

  return db.transaction(async (client) => {
    const result =
      await client.query(
        `
          SELECT
            s.id AS session_id,
            s.user_id,
            s.expires_at,
            s.revoked_at
          FROM sessions s
          WHERE s.token_hash = $1
          LIMIT 1
        `,
        [tokenHash]
      );

    const session =
      result.rows[0];

    if (!session) {
      throw createError(
        'جلسة الدخول غير صالحة.',
        401,
        'INVALID_SESSION'
      );
    }

    if (session.revoked_at) {
      throw createError(
        'جلسة الدخول منتهية أو ملغاة.',
        401,
        'SESSION_REVOKED'
      );
    }

    if (
      session.expires_at &&
      new Date(session.expires_at).getTime() <=
        Date.now()
    ) {
      throw createError(
        'انتهت جلسة الدخول.',
        401,
        'SESSION_EXPIRED'
      );
    }

    const user =
      await findUserById(
        client,
        session.user_id
      );

    ensureUserCanAuthenticate(user);

    await client.query(
      `
        UPDATE sessions
        SET revoked_at = NOW()
        WHERE id = $1
      `,
      [session.session_id]
    );

    const newSession =
      await createSession(
        client,
        user,
        {
          ipAddress,
          userAgent
        }
      );

    return {
      user: cleanUser(user),
      accessToken:
        newSession.accessToken,
      token:
        newSession.token,
      sessionId:
        newSession.sessionId,
      expiresAt:
        newSession.expiresAt,
      isOwner:
        user.role === 'OWNER'
    };
  });
}

async function getCurrentUser(userId) {
  if (!userId) {
    throw createError(
      'يجب تسجيل الدخول.',
      401,
      'UNAUTHORIZED'
    );
  }

  const result = await db.query(
    `
      SELECT
        id,
        username,
        email,
        display_name,
        avatar_url,
        cover_url,
        bio,
        role,
        status,
        level,
        coins,
        experience,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const user =
    result.rows[0];

  if (!user) {
    throw createError(
      'الحساب غير موجود.',
      404,
      'USER_NOT_FOUND'
    );
  }

  ensureUserCanAuthenticate(user);

  return cleanUser(user);
}

async function changePassword({
  userId,
  currentPassword,
  newPassword,
  ipAddress,
  userAgent
}) {
  if (
    !userId ||
    !currentPassword ||
    !newPassword
  ) {
    throw createError(
      'بيانات تغيير كلمة المرور غير مكتملة.',
      400,
      'INVALID_PASSWORD_DATA'
    );
  }

  if (
    String(newPassword) ===
    String(currentPassword)
  ) {
    throw createError(
      'كلمة المرور الجديدة يجب أن تكون مختلفة.',
      400,
      'PASSWORD_UNCHANGED'
    );
  }

  return db.transaction(async (client) => {
    const user =
      await findUserById(
        client,
        userId
      );

    ensureUserCanAuthenticate(user);

    const valid =
      await bcrypt.compare(
        String(currentPassword),
        String(user.password_hash || '')
      );

    if (!valid) {
      throw createError(
        'كلمة المرور الحالية غير صحيحة.',
        401,
        'CURRENT_PASSWORD_INVALID'
      );
    }

    const passwordHash =
      await bcrypt.hash(
        String(newPassword),
        BCRYPT_ROUNDS
      );

    await client.query(
      `
        UPDATE users
        SET
          password_hash = $1,
          updated_at = NOW()
        WHERE id = $2
      `,
      [
        passwordHash,
        userId
      ]
    );

    /*
     * إلغاء الجلسات القديمة بعد تغيير كلمة المرور
     * لحماية الحساب من الجلسات المفتوحة سابقاً.
     */
    await client.query(
      `
        UPDATE sessions
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
      `,
      [userId]
    );

    const refreshedUser =
      await findUserById(
        client,
        userId
      );

    const session =
      await createSession(
        client,
        refreshedUser,
        {
          ipAddress,
          userAgent
        }
      );

    return {
      changed: true,
      user: cleanUser(refreshedUser),
      accessToken:
        session.accessToken,
      token:
        session.token,
      sessionId:
        session.sessionId,
      expiresAt:
        session.expiresAt
    };
  });
}

async function revokeAllSessions(userId) {
  if (!userId) {
    throw createError(
      'المستخدم غير معروف.',
      400,
      'USER_ID_REQUIRED'
    );
  }

  const result = await db.query(
    `
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
    `,
    [userId]
  );

  return {
    revoked: true,
    count: result.rowCount
  };
}

module.exports = {
  register,
  login,
  logout,
  refreshSession,
  getCurrentUser,
  changePassword,
  revokeAllSessions,
  cleanUser,
  createError
};
