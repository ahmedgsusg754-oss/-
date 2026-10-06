'use strict';

const jwt = require('jsonwebtoken');
const { query } = require('../database');

const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const JWT_ISSUER = String(process.env.JWT_ISSUER || 'afn-edinah').trim();
const JWT_AUDIENCE = String(
  process.env.JWT_AUDIENCE || 'afn-edinah-users'
).trim();

const COOKIE_NAME = String(
  process.env.COOKIE_NAME || 'afn_session'
).trim();

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET غير مضبوط أو قصير جداً. يجب استخدام مفتاح سري قوي وطويل.'
  );
}

function getTokenFromRequest(req) {
  const authorization = req.headers.authorization;

  if (authorization) {
    const parts = authorization.trim().split(/\s+/);

    if (
      parts.length === 2 &&
      parts[0].toLowerCase() === 'bearer' &&
      parts[1]
    ) {
      return parts[1];
    }
  }

  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }

  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    const cookies = {};

    cookieHeader.split(';').forEach((item) => {
      const separatorIndex = item.indexOf('=');

      if (separatorIndex === -1) {
        return;
      }

      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();

      if (!key) {
        return;
      }

      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    });

    if (cookies[COOKIE_NAME]) {
      return cookies[COOKIE_NAME];
    }
  }

  return null;
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: ['HS256']
  });
}

function createAuthError(message = 'يجب تسجيل الدخول أولاً.') {
  const error = new Error(message);

  error.statusCode = 401;
  error.code = 'AUTH_REQUIRED';

  return error;
}

function createForbiddenError(
  message = 'ليس لديك صلاحية للوصول إلى هذا المورد.'
) {
  const error = new Error(message);

  error.statusCode = 403;
  error.code = 'FORBIDDEN';

  return error;
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    id: String(user.id),
    role: user.role ? String(user.role).toUpperCase() : 'USER'
  };
}

async function loadUser(userId) {
  if (!userId) {
    return null;
  }

  const result = await query(
    `
      SELECT *
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

function isUserDisabled(user) {
  if (!user) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(user, 'is_active') &&
    user.is_active === false
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(user, 'is_banned') &&
    user.is_banned === true
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(user, 'status') &&
    ['banned', 'disabled', 'suspended', 'deleted'].includes(
      String(user.status).toLowerCase()
    )
  ) {
    return true;
  }

  return false;
}

async function authenticate(req, res, next) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return next(createAuthError());
    }

    let payload;

    try {
      payload = verifyToken(token);
    } catch (error) {
      const authError = createAuthError(
        'جلسة الدخول غير صالحة أو منتهية.'
      );

      authError.cause = error;

      return next(authError);
    }

    const userId =
      payload.userId ||
      payload.user_id ||
      payload.sub;

    if (!userId) {
      return next(
        createAuthError('بيانات جلسة الدخول غير صالحة.')
      );
    }

    const user = await loadUser(userId);

    if (!user) {
      return next(createAuthError('الحساب غير موجود.'));
    }

    if (isUserDisabled(user)) {
      return next(
        createAuthError('هذا الحساب غير متاح حالياً.')
      );
    }

    const normalizedUser = normalizeUser(user);

    req.auth = {
      token,
      payload,
      userId: normalizedUser.id
    };

    req.user = normalizedUser;

    return next();
  } catch (error) {
    return next(error);
  }
}

async function optionalAuthenticate(req, res, next) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      req.auth = null;
      req.user = null;

      return next();
    }

    let payload;

    try {
      payload = verifyToken(token);
    } catch {
      req.auth = null;
      req.user = null;

      return next();
    }

    const userId =
      payload.userId ||
      payload.user_id ||
      payload.sub;

    if (!userId) {
      req.auth = null;
      req.user = null;

      return next();
    }

    const user = await loadUser(userId);

    if (!user || isUserDisabled(user)) {
      req.auth = null;
      req.user = null;

      return next();
    }

    const normalizedUser = normalizeUser(user);

    req.auth = {
      token,
      payload,
      userId: normalizedUser.id
    };

    req.user = normalizedUser;

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(...allowedRoles) {
  const normalizedRoles = allowedRoles
    .flat()
    .filter(Boolean)
    .map((role) => String(role).trim().toUpperCase());

  return (req, res, next) => {
    if (!req.user) {
      return next(createAuthError());
    }

    if (normalizedRoles.length === 0) {
      return next();
    }

    const userRole = String(
      req.user.role || 'USER'
    ).toUpperCase();

    if (!normalizedRoles.includes(userRole)) {
      return next(
        createForbiddenError(
          'لا تملك الدور المطلوب لتنفيذ هذا الإجراء.'
        )
      );
    }

    return next();
  };
}

function requireOwner(req, res, next) {
  if (!req.user) {
    return next(createAuthError());
  }

  const role = String(
    req.user.role || ''
  ).toUpperCase();

  if (role !== 'OWNER') {
    return next(
      createForbiddenError(
        'هذا الإجراء متاح لمالك المنصة فقط.'
      )
    );
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(createAuthError());
  }

  const role = String(
    req.user.role || ''
  ).toUpperCase();

  if (!['OWNER', 'ADMIN'].includes(role)) {
    return next(
      createForbiddenError(
        'ليس لديك صلاحية الإدارة.'
      )
    );
  }

  return next();
}

function getAuthenticatedUser(req) {
  if (!req.user) {
    throw createAuthError();
  }

  return req.user;
}

module.exports = {
  authenticate,
  requireAuth: authenticate,
  auth: authenticate,
  optionalAuthenticate,
  optionalAuth: optionalAuthenticate,
  requireRole,
  requireOwner,
  requireAdmin,
  getAuthenticatedUser,
  getTokenFromRequest,
  verifyToken
};
