'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = String(process.env.JWT_SECRET || '');
const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || '7d';
const JWT_ISSUER =
  process.env.JWT_ISSUER || 'afn-edinah';
const JWT_AUDIENCE =
  process.env.JWT_AUDIENCE || 'afn-edinah-users';

function serviceError(
  message,
  statusCode = 500,
  code = 'TOKEN_ERROR'
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function ensureSecret() {
  if (!JWT_SECRET) {
    throw serviceError(
      'JWT_SECRET غير مضبوط في ملف البيئة.',
      500,
      'JWT_SECRET_MISSING'
    );
  }

  if (JWT_SECRET.length < 32) {
    throw serviceError(
      'JWT_SECRET قصير جداً.',
      500,
      'JWT_SECRET_TOO_SHORT'
    );
  }
}

function normalizeExpiresIn(value) {
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0
  ) {
    return value;
  }

  const text = String(value || '').trim();

  if (!text) {
    return '7d';
  }

  return text;
}

function createJti() {
  return crypto
    .randomBytes(24)
    .toString('hex');
}

function createAccessToken({
  userId,
  role = 'USER',
  sessionId = null,
  expiresIn = JWT_EXPIRES_IN
}) {
  ensureSecret();

  if (!userId) {
    throw serviceError(
      'معرّف المستخدم مطلوب لإنشاء رمز الدخول.',
      400,
      'USER_ID_REQUIRED'
    );
  }

  const payload = {
    sub: String(userId),
    userId: String(userId),
    role: String(role || 'USER'),
    type: 'access',
    jti: createJti()
  };

  if (sessionId) {
    payload.sessionId =
      String(sessionId);
  }

  return jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn:
        normalizeExpiresIn(expiresIn),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    }
  );
}

function generateAccessToken(options) {
  return createAccessToken(options);
}

function signToken(payload, options = {}) {
  ensureSecret();

  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    throw serviceError(
      'بيانات الرمز غير صحيحة.',
      400,
      'INVALID_TOKEN_PAYLOAD'
    );
  }

  const finalPayload = {
    ...payload,
    type:
      payload.type || 'access',
    jti:
      payload.jti || createJti()
  };

  if (!finalPayload.sub && finalPayload.userId) {
    finalPayload.sub =
      String(finalPayload.userId);
  }

  if (!finalPayload.userId && finalPayload.sub) {
    finalPayload.userId =
      String(finalPayload.sub);
  }

  return jwt.sign(
    finalPayload,
    JWT_SECRET,
    {
      expiresIn:
        normalizeExpiresIn(
          options.expiresIn ||
          JWT_EXPIRES_IN
        ),
      issuer:
        options.issuer ||
        JWT_ISSUER,
      audience:
        options.audience ||
        JWT_AUDIENCE
    }
  );
}

function verifyToken(token) {
  ensureSecret();

  if (
    typeof token !== 'string' ||
    !token.trim()
  ) {
    throw serviceError(
      'رمز الدخول غير موجود.',
      401,
      'TOKEN_MISSING'
    );
  }

  try {
    const payload =
      jwt.verify(
        token.trim(),
        JWT_SECRET,
        {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE
        }
      );

    if (
      !payload ||
      typeof payload !== 'object'
    ) {
      throw serviceError(
        'رمز الدخول غير صالح.',
        401,
        'INVALID_TOKEN'
      );
    }

    if (
      payload.type &&
      payload.type !== 'access'
    ) {
      throw serviceError(
        'نوع رمز الدخول غير صالح.',
        401,
        'INVALID_TOKEN_TYPE'
      );
    }

    if (
      !payload.sub &&
      !payload.userId
    ) {
      throw serviceError(
        'رمز الدخول لا يحتوي على معرّف المستخدم.',
        401,
        'TOKEN_USER_MISSING'
      );
    }

    return payload;
  } catch (error) {
    if (
      error &&
      error.code &&
      error.statusCode
    ) {
      throw error;
    }

    if (
      error instanceof jwt.TokenExpiredError
    ) {
      throw serviceError(
        'انتهت صلاحية جلسة الدخول.',
        401,
        'TOKEN_EXPIRED'
      );
    }

    if (
      error instanceof jwt.NotBeforeError
    ) {
      throw serviceError(
        'رمز الدخول غير متاح بعد.',
        401,
        'TOKEN_NOT_ACTIVE'
      );
    }

    if (
      error instanceof jwt.JsonWebTokenError
    ) {
      throw serviceError(
        'رمز الدخول غير صالح.',
        401,
        'INVALID_TOKEN'
      );
    }

    throw error;
  }
}

function decodeToken(token) {
  if (
    typeof token !== 'string' ||
    !token.trim()
  ) {
    return null;
  }

  try {
    return jwt.decode(
      token.trim()
    );
  } catch {
    return null;
  }
}

function getUserIdFromPayload(payload) {
  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    return null;
  }

  return (
    payload.userId ||
    payload.sub ||
    null
  );
}

function getSessionIdFromPayload(payload) {
  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    return null;
  }

  return (
    payload.sessionId ||
    payload.session_id ||
    null
  );
}

function getRoleFromPayload(payload) {
  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    return null;
  }

  return payload.role || null;
}

function isTokenExpired(token) {
  const payload =
    decodeToken(token);

  if (
    !payload ||
    typeof payload.exp !== 'number'
  ) {
    return true;
  }

  return (
    payload.exp * 1000 <=
    Date.now()
  );
}

function getTokenExpiration(token) {
  const payload =
    decodeToken(token);

  if (
    !payload ||
    typeof payload.exp !== 'number'
  ) {
    return null;
  }

  return new Date(
    payload.exp * 1000
  );
}

function getRemainingLifetime(token) {
  const expiration =
    getTokenExpiration(token);

  if (!expiration) {
    return 0;
  }

  return Math.max(
    0,
    expiration.getTime() -
      Date.now()
  );
}

function extractBearerToken(
  authorizationHeader
) {
  if (
    typeof authorizationHeader !==
    'string'
  ) {
    return null;
  }

  const match =
    authorizationHeader.match(
      /^Bearer\s+(.+)$/i
    );

  if (!match) {
    return null;
  }

  const token =
    String(match[1] || '').trim();

  return token || null;
}

function createRefreshToken() {
  return crypto
    .randomBytes(64)
    .toString('hex');
}

function hashRefreshToken(token) {
  if (
    typeof token !== 'string' ||
    !token
  ) {
    throw serviceError(
      'رمز التحديث غير صالح.',
      400,
      'INVALID_REFRESH_TOKEN'
    );
  }

  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

function createTokenPair({
  userId,
  role = 'USER',
  sessionId = null,
  accessExpiresIn = JWT_EXPIRES_IN
}) {
  const accessToken =
    createAccessToken({
      userId,
      role,
      sessionId,
      expiresIn:
        accessExpiresIn
    });

  const refreshToken =
    createRefreshToken();

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt:
      getTokenExpiration(
        accessToken
      ),
    refreshTokenHash:
      hashRefreshToken(
        refreshToken
      )
  };
}

module.exports = {
  createAccessToken,
  generateAccessToken,
  signToken,
  verifyToken,
  decodeToken,
  getUserIdFromPayload,
  getSessionIdFromPayload,
  getRoleFromPayload,
  isTokenExpired,
  getTokenExpiration,
  getRemainingLifetime,
  extractBearerToken,
  createRefreshToken,
  hashRefreshToken,
  createTokenPair
};
