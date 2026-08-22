'use strict';

/*
============================================================
 افـنـدツينا🥀🖤
 server.js
 COMPLETE BACKEND SERVER
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
 Cookie Parser
 Multer

 المسؤول عن:
 - تشغيل الخادم
 - REST API
 - Authentication
 - Authorization
 - Sessions
 - Users
 - Profiles
 - Rooms
 - Messages
 - Posts
 - Comments
 - Likes
 - Notifications
 - Store
 - Gifts
 - Coins
 - VIP
 - Badges
 - Reports
 - Moderation
 - Owner / Admin
 - Statistics
 - Site Settings
 - Audit Logs
 - Uploads
 - Security
 - Health Check
 - Socket.IO

 مهم:
 - لا توجد بيانات تجريبية.
 - لا يوجد مستخدم وهمي.
 - لا يوجد رصيد وهمي.
 - لا توجد رسائل أو منشورات وهمية.
 - لا يتم إنشاء Owner مسبقًا.
 - أول تسجيل حقيقي يتم التعامل معه لاحقًا
   داخل Transaction آمنة ويصبح Owner تلقائيًا.
============================================================
*/

/*
============================================================
 1. استيراد مكتبات النظام
============================================================
*/

const path = require('path');
const fs = require('fs');

const crypto = require('crypto');

/*
============================================================
 2. استيراد Express
============================================================
*/

const express = require('express');

/*
============================================================
 3. استيراد HTTP
============================================================
*/

const http = require('http');

/*
============================================================
 4. استيراد Socket.IO
============================================================
*/

const {
  Server: SocketIOServer
} = require('socket.io');

/*
============================================================
 5. Middleware للحماية
============================================================
*/

const helmet = require('helmet');

const cors = require('cors');

const cookieParser =
  require('cookie-parser');

/*
============================================================
 6. Rate Limiting
============================================================
*/

const rateLimit =
  require('express-rate-limit');

/*
============================================================
 7. معالجة الملفات
============================================================
*/

const multer =
  require('multer');

/*
============================================================
 8. كلمات المرور
============================================================
*/

const bcrypt =
  require('bcrypt');

/*
============================================================
 9. JWT
============================================================
*/

const jwt =
  require('jsonwebtoken');

/*
============================================================
 10. PostgreSQL Layer
============================================================
*/

const database =
  require('./database');

/*
============================================================
 11. متغيرات البيئة
============================================================
*/

const NODE_ENV =
  String(
    process.env.NODE_ENV ||
    'development'
  ).trim();

const PORT =
  Number.parseInt(
    process.env.PORT || '3000',
    10
  );

/*
============================================================
 12. إعدادات JWT
============================================================
*/

const JWT_SECRET =
  String(
    process.env.JWT_SECRET || ''
  ).trim();

const JWT_EXPIRES_IN =
  String(
    process.env.JWT_EXPIRES_IN ||
    '7d'
  ).trim();

const JWT_ISSUER =
  String(
    process.env.JWT_ISSUER ||
    'afandina'
  ).trim();

const JWT_AUDIENCE =
  String(
    process.env.JWT_AUDIENCE ||
    'afandina-users'
  ).trim();

/*
============================================================
 13. إعدادات كلمات المرور
============================================================
*/

const BCRYPT_ROUNDS =
  Number.parseInt(
    process.env.BCRYPT_ROUNDS ||
    '12',
    10
  );

/*
============================================================
 14. التحقق من إعدادات JWT
============================================================
*/

if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is required.'
  );
}

if (
  JWT_SECRET.length < 32
) {
  throw new Error(
    'JWT_SECRET must contain at least 32 characters.'
  );
}

if (
  !Number.isInteger(
    BCRYPT_ROUNDS
  ) ||
  BCRYPT_ROUNDS < 10 ||
  BCRYPT_ROUNDS > 15
) {
  throw new Error(
    'BCRYPT_ROUNDS must be between 10 and 15.'
  );
}

/*
============================================================
 15. إعدادات CORS
============================================================
*/

const CORS_ORIGINS =
  String(
    process.env.CORS_ORIGINS || ''
  )
    .split(',')
    .map(
      (origin) =>
        origin.trim()
    )
    .filter(Boolean);

/*
============================================================
 16. إنشاء Express Application
============================================================
*/

const app =
  express();

/*
============================================================
 17. إنشاء HTTP Server
============================================================
*/

const server =
  http.createServer(app);

/*
============================================================
 18. إنشاء Socket.IO Server
============================================================
*/

const io =
  new SocketIOServer(
    server,
    {
      cors: {
        origin:
          CORS_ORIGINS.length > 0
            ? CORS_ORIGINS
            : false,

        credentials: true,

        methods: [
          'GET',
          'POST'
        ]
      }
    }
  );

/*
============================================================
 19. إعدادات Express الأساسية
============================================================
*/

app.disable(
  'x-powered-by'
);

app.set(
  'trust proxy',
  process.env.TRUST_PROXY || 1
);

app.set(
  'json spaces',
  NODE_ENV === 'development'
    ? 2
    : 0
);

/*
============================================================
 20. Body Parser
============================================================
*/

app.use(
  express.json({
    limit:
      process.env.JSON_LIMIT ||
      '1mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,

    limit:
      process.env.URLENCODED_LIMIT ||
      '1mb'
  })
);

/*
============================================================
 21. Cookie Parser
============================================================
*/

app.use(
  cookieParser(
    process.env.COOKIE_SECRET ||
    undefined
  )
);

/*
============================================================
 22. Helmet
============================================================
*/

app.use(
  helmet({
    contentSecurityPolicy:
      NODE_ENV === 'production'
        ? undefined
        : false,

    crossOriginEmbedderPolicy:
      false
  })
);

/*
============================================================
 23. CORS
============================================================
*/

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      if (
        CORS_ORIGINS.length === 0
      ) {
        return callback(
          null,
          false
        );
      }

      if (
        CORS_ORIGINS.includes(origin)
      ) {
        return callback(
          null,
          true
        );
      }

      return callback(
        new Error(
          'CORS origin is not allowed.'
        )
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token'
    ]
  })
);

/*
============================================================
 24. Request ID
============================================================
*/

app.use(
  (req, res, next) => {
    const existing =
      req.get(
        'X-Request-ID'
      );

    const requestId =
      existing &&
      existing.length <= 128
        ? existing
        : crypto.randomUUID();

    req.requestId =
      requestId;

    res.setHeader(
      'X-Request-ID',
      requestId
    );

    next();
  }
);

/*
============================================================
 25. Security Headers إضافية
============================================================
*/

app.use(
  (req, res, next) => {
    res.setHeader(
      'X-Content-Type-Options',
      'nosniff'
    );

    res.setHeader(
      'X-Frame-Options',
      'SAMEORIGIN'
    );

    res.setHeader(
      'Referrer-Policy',
      'strict-origin-when-cross-origin'
    );

    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()'
    );

    next();
  }
);

/*
============================================================
 26. Rate Limit عام للـ API
============================================================
*/

const apiLimiter =
  rateLimit({
    windowMs:
      Number.parseInt(
        process.env.API_RATE_WINDOW_MS ||
        '900000',
        10
      ),

    limit:
      Number.parseInt(
        process.env.API_RATE_LIMIT ||
        '300',
        10
      ),

    standardHeaders:
      'draft-7',

    legacyHeaders:
      false,

    handler(req, res) {
      return res.status(
        429
      ).json({
        success: false,

        error: {
          code:
            'RATE_LIMIT_EXCEEDED',

          message:
            'تم تجاوز عدد الطلبات المسموح بها. حاول مرة أخرى لاحقًا.',

          requestId:
            req.requestId
        }
      });
    }
  });

app.use(
  '/api',
  apiLimiter
);

/*
============================================================
 27. Rate Limit للمصادقة
============================================================
*/

const authLimiter =
  rateLimit({
    windowMs:
      Number.parseInt(
        process.env.AUTH_RATE_WINDOW_MS ||
        '900000',
        10
      ),

    limit:
      Number.parseInt(
        process.env.AUTH_RATE_LIMIT ||
        '20',
        10
      ),

    standardHeaders:
      'draft-7',

    legacyHeaders:
      false,

    skipSuccessfulRequests:
      false,

    handler(req, res) {
      return res.status(
        429
      ).json({
        success: false,

        error: {
          code:
            'AUTH_RATE_LIMIT_EXCEEDED',

          message:
            'تم تجاوز محاولات المصادقة المسموح بها.',

          requestId:
            req.requestId
        }
      });
    }
  });

/*
============================================================
 28. إعداد مجلدات المشروع
============================================================
*/

const ROOT_DIR =
  __dirname;

const PUBLIC_DIR =
  path.join(
    ROOT_DIR,
    'public'
  );

const UPLOADS_DIR =
  path.join(
    ROOT_DIR,
    'uploads'
  );

const TEMP_DIR =
  path.join(
    ROOT_DIR,
    'tmp'
  );

/*
============================================================
 29. إنشاء المجلدات المطلوبة
============================================================
*/

for (
  const directory of [
    UPLOADS_DIR,
    TEMP_DIR
  ]
) {
  if (
    !fs.existsSync(
      directory
    )
  ) {
    fs.mkdirSync(
      directory,
      {
        recursive: true
      }
    );
  }
}

/*
============================================================
 30. الملفات الثابتة
============================================================
*/

if (
  fs.existsSync(
    PUBLIC_DIR
  )
) {
  app.use(
    express.static(
      PUBLIC_DIR,
      {
        index:
          false,

        maxAge:
          NODE_ENV === 'production'
            ? '1d'
            : 0
      }
    )
  );
}

/*
============================================================
 31. دوال مساعدة أساسية
============================================================
*/

function isObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function normalizeString(
  value,
  maxLength = 255
) {
  if (
    typeof value !== 'string'
  ) {
    return '';
  }

  return value
    .trim()
    .slice(
      0,
      maxLength
    );
}

function normalizeEmail(
  value
) {
  return normalizeString(
    value,
    320
  ).toLowerCase();
}

function normalizeUsername(
  value
) {
  return normalizeString(
    value,
    30
  ).toLowerCase();
}

function generateSecureToken(
  bytes = 32
) {
  return crypto.randomBytes(
    bytes
  ).toString(
    'hex'
  );
}

/*
============================================================
 32. Response Helpers
============================================================
*/

function success(
  res,
  data = null,
  statusCode = 200
) {
  return res.status(
    statusCode
  ).json({
    success: true,
    data,
    requestId:
      res.req?.requestId ||
      null
  });
}

function failure(
  res,
  statusCode,
  code,
  message,
  details = undefined
) {
  const payload = {
    success: false,

    error: {
      code,
      message
    },

    requestId:
      res.req?.requestId ||
      null
  };

  if (
    details !== undefined &&
    NODE_ENV !== 'production'
  ) {
    payload.error.details =
      details;
  }

  return res.status(
    statusCode
  ).json(
    payload
  );
}

/*
============================================================
 نهاية الجزء 1 من 12
============================================================
*//*
============================================================
 33. أدوات التحقق من المدخلات
============================================================
*/

function requireString(
  value,
  fieldName,
  minLength = 1,
  maxLength = 255
) {
  const normalized =
    normalizeString(
      value,
      maxLength
    );

  if (
    normalized.length <
    minLength
  ) {
    throw new Error(
      `${fieldName} is invalid.`
    );
  }

  return normalized;
}

function requireEmail(
  value
) {
  const email =
    normalizeEmail(
      value
    );

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      'Invalid email address.'
    );
  }

  return email;
}

function requireUsername(
  value
) {
  const username =
    normalizeUsername(
      value
    );

  if (
    !/^[a-z0-9_]{3,30}$/.test(
      username
    )
  ) {
    throw new Error(
      'Username must contain 3-30 lowercase letters, numbers, or underscores.'
    );
  }

  return username;
}

function requirePassword(
  value
) {
  if (
    typeof value !== 'string' ||
    value.length < 8 ||
    value.length > 128
  ) {
    throw new Error(
      'Password must contain between 8 and 128 characters.'
    );
  }

  return value;
}

function parsePositiveInteger(
  value,
  fallback = null,
  max = 1000000
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return fallback;
  }

  const parsed =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > max
  ) {
    return fallback;
  }

  return parsed;
}

/*
============================================================
 34. JWT Helpers
============================================================
*/

function createAccessToken(
  payload
) {
  return jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn:
        JWT_EXPIRES_IN,

      issuer:
        JWT_ISSUER,

      audience:
        JWT_AUDIENCE
    }
  );
}

function verifyAccessToken(
  token
) {
  return jwt.verify(
    token,
    JWT_SECRET,
    {
      issuer:
        JWT_ISSUER,

      audience:
        JWT_AUDIENCE
    }
  );
}

/*
============================================================
 35. استخراج Token من الطلب
============================================================
*/

function getTokenFromRequest(
  req
) {
  const authorization =
    req.get(
      'Authorization'
    );

  if (
    authorization &&
    authorization.startsWith(
      'Bearer '
    )
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  const cookieToken =
    req.cookies?.access_token;

  if (
    cookieToken &&
    typeof cookieToken === 'string'
  ) {
    return cookieToken.trim();
  }

  return null;
}

/*
============================================================
 36. إعداد Cookie للمصادقة
============================================================
*/

function setAuthCookie(
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

      sameSite:
        process.env.COOKIE_SAME_SITE ||
        'lax',

      maxAge:
        7 * 24 * 60 * 60 * 1000,

      path: '/'
    }
  );
}

/*
============================================================
 37. إزالة Cookie
============================================================
*/

function clearAuthCookie(
  res
) {
  res.clearCookie(
    'access_token',
    {
      httpOnly: true,

      secure:
        NODE_ENV ===
        'production',

      sameSite:
        process.env.COOKIE_SAME_SITE ||
        'lax',

      path: '/'
    }
  );
}

/*
============================================================
 38. Middleware المصادقة
============================================================
*/

async function authenticate(
  req,
  res,
  next
) {
  try {
    const token =
      getTokenFromRequest(
        req
      );

    if (!token) {
      return failure(
        res,
        401,
        'AUTH_REQUIRED',
        'يجب تسجيل الدخول أولًا.'
      );
    }

    let decoded;

    try {
      decoded =
        verifyAccessToken(
          token
        );
    } catch (error) {
      return failure(
        res,
        401,
        'INVALID_TOKEN',
        'جلسة الدخول غير صالحة أو منتهية.'
      );
    }

    if (
      !decoded ||
      !decoded.sub
    ) {
      return failure(
        res,
        401,
        'INVALID_TOKEN',
        'رمز المصادقة غير صالح.'
      );
    }

    const user =
      await database.queryOne(
        `
          SELECT
            u.id,
            u.username,
            u.email,
            u.role,
            u.status,
            u.is_active,
            u.is_verified,
            u.created_at,
            u.updated_at
          FROM users u
          WHERE u.id = $1
          LIMIT 1
        `,
        [decoded.sub]
      );

    if (!user) {
      return failure(
        res,
        401,
        'USER_NOT_FOUND',
        'الحساب غير موجود.'
      );
    }

    if (
      user.is_active === false
    ) {
      return failure(
        res,
        403,
        'ACCOUNT_DISABLED',
        'هذا الحساب غير نشط.'
      );
    }

    if (
      user.status &&
      ![
        'active',
        'online'
      ].includes(
        String(
          user.status
        ).toLowerCase()
      )
    ) {
      return failure(
        res,
        403,
        'ACCOUNT_UNAVAILABLE',
        'الحساب غير متاح حاليًا.'
      );
    }

    req.user =
      user;

    req.auth =
      decoded;

    next();
  } catch (error) {
    console.error(
      '[AUTH] Authentication error:',
      error
    );

    return failure(
      res,
      500,
      'AUTH_ERROR',
      'حدث خطأ أثناء التحقق من الحساب.'
    );
  }
}

/*
============================================================
 39. Optional Authentication
============================================================
*/

async function optionalAuthenticate(
  req,
  res,
  next
) {
  try {
    const token =
      getTokenFromRequest(
        req
      );

    if (!token) {
      req.user = null;
      req.auth = null;

      return next();
    }

    let decoded;

    try {
      decoded =
        verifyAccessToken(
          token
        );
    } catch {
      req.user = null;
      req.auth = null;

      return next();
    }

    if (
      !decoded ||
      !decoded.sub
    ) {
      req.user = null;
      req.auth = null;

      return next();
    }

    const user =
      await database.queryOne(
        `
          SELECT
            u.id,
            u.username,
            u.email,
            u.role,
            u.status,
            u.is_active,
            u.is_verified,
            u.created_at,
            u.updated_at
          FROM users u
          WHERE u.id = $1
          LIMIT 1
        `,
        [decoded.sub]
      );

    if (
      user &&
      user.is_active !== false
    ) {
      req.user =
        user;

      req.auth =
        decoded;
    } else {
      req.user = null;
      req.auth = null;
    }

    next();
  } catch (error) {
    console.error(
      '[AUTH] Optional authentication error:',
      error
    );

    req.user = null;
    req.auth = null;

    next();
  }
}

/*
============================================================
 40. التحقق من الصلاحيات
============================================================
*/

function requireRoles(
  ...allowedRoles
) {
  const normalizedRoles =
    allowedRoles
      .filter(
        (role) =>
          typeof role ===
          'string'
      )
      .map(
        (role) =>
          role
            .trim()
            .toLowerCase()
      );

  return (
    req,
    res,
    next
  ) => {
    if (!req.user) {
      return failure(
        res,
        401,
        'AUTH_REQUIRED',
        'يجب تسجيل الدخول أولًا.'
      );
    }

    const userRole =
      String(
        req.user.role || ''
      )
        .trim()
        .toLowerCase();

    if (
      !normalizedRoles.includes(
        userRole
      )
    ) {
      return failure(
        res,
        403,
        'FORBIDDEN',
        'ليس لديك صلاحية لتنفيذ هذا الإجراء.'
      );
    }

    next();
  };
}

/*
============================================================
 41. Owner Middleware
============================================================
*/

const requireOwner =
  requireRoles(
    'owner'
  );

/*
============================================================
 42. Admin أو Owner Middleware
============================================================
*/

const requireAdmin =
  requireRoles(
    'owner',
    'admin'
  );

/*
============================================================
 43. تسجيل الأحداث الأمنية
============================================================
*/

async function writeAuditLog(
  {
    userId = null,
    action,
    entityType = null,
    entityId = null,
    metadata = null,
    ipAddress = null,
    userAgent = null
  } = {}
) {
  try {
    await database.query(
      `
        INSERT INTO audit_logs (
          user_id,
          action,
          entity_type,
          entity_id,
          metadata,
          ip_address,
          user_agent
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
      `,
      [
        userId,
        action,
        entityType,
        entityId,
        metadata
          ? JSON.stringify(
              metadata
            )
          : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    /*
    لا نوقف العملية الأساسية إذا فشل
    تسجيل Audit Log، لكن نسجل الخطأ.
    */

    console.error(
      '[AUDIT] Failed to write audit log:',
      error
    );
  }
}

/*
============================================================
 44. استخراج IP الحقيقي
============================================================
*/

function getClientIp(
  req
) {
  const forwarded =
    req.get(
      'X-Forwarded-For'
    );

  if (
    forwarded
  ) {
    return forwarded
      .split(',')[0]
      .trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}

/*
============================================================
 45. Multer Storage
============================================================
*/

const storage =
  multer.diskStorage({
    destination(
      req,
      file,
      callback
    ) {
      callback(
        null,
        UPLOADS_DIR
      );
    },

    filename(
      req,
      file,
      callback
    ) {
      const extension =
        path.extname(
          file.originalname || ''
        ).toLowerCase();

      const safeExtension =
        /^[.][a-z0-9]{1,10}$/.test(
          extension
        )
          ? extension
          : '';

      callback(
        null,
        `${crypto.randomUUID()}${safeExtension}`
      );
    }
  });

/*
============================================================
 46. Multer File Filter
============================================================
*/

const allowedMimeTypes =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]);

function imageFileFilter(
  req,
  file,
  callback
) {
  if (
    !allowedMimeTypes.has(
      file.mimetype
    )
  ) {
    return callback(
      new Error(
        'نوع الصورة غير مسموح.'
      )
    );
  }

  callback(
    null,
    true
  );
}

/*
============================================================
 47. Upload Middleware
============================================================
*/

const upload =
  multer({
    storage,

    fileFilter:
      imageFileFilter,

    limits: {
      fileSize:
        Number.parseInt(
          process.env.MAX_UPLOAD_SIZE_BYTES ||
          String(
            5 * 1024 * 1024
          ),
          10
        ),

      files: 1
    }
  });

/*
============================================================
 48. معالجة أخطاء Upload
============================================================
*/

function handleUploadError(
  error,
  req,
  res,
  next
) {
  if (
    error instanceof
    multer.MulterError
  ) {
    return failure(
      res,
      400,
      'UPLOAD_ERROR',
      'فشل رفع الملف.',
      error.code
    );
  }

  if (error) {
    return failure(
      res,
      400,
      'INVALID_UPLOAD',
      error.message ||
        'الملف غير صالح.'
    );
  }

  next();
}

/*
============================================================
 49. Health Check
============================================================
*/

app.get(
  '/health',
  async (
    req,
    res
  ) => {
    try {
      const health =
        await database.healthCheck();

      if (!health.ok) {
        return failure(
          res,
          503,
          'DATABASE_UNAVAILABLE',
          'قاعدة البيانات غير متاحة.'
        );
      }

      return success(
        res,
        {
          status:
            'ok',

          database:
            health.ok,

          latencyMs:
            health.latencyMs,

          environment:
            NODE_ENV
        }
      );
    } catch (error) {
      console.error(
        '[HEALTH] Error:',
        error
      );

      return failure(
        res,
        503,
        'HEALTH_CHECK_FAILED',
        'الخدمة غير جاهزة حاليًا.'
      );
    }
  }
);

/*
============================================================
 50. Readiness Check
============================================================
*/

app.get(
  '/ready',
  async (
    req,
    res
  ) => {
    try {
      const readiness =
        await database.readinessCheck();

      if (
        !readiness.ready
      ) {
        return failure(
          res,
          503,
          'SERVICE_NOT_READY',
          'الخدمة غير جاهزة حاليًا.'
        );
      }

      return success(
        res,
        readiness
      );
    } catch (error) {
      console.error(
        '[READY] Error:',
        error
      );

      return failure(
        res,
        503,
        'READINESS_CHECK_FAILED',
        'فشل فحص جاهزية الخدمة.'
      );
    }
  }
);

/*
============================================================
 نهاية الجزء 2 من 12
============================================================
*//*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 3 من 12
============================================================
*/

/*
============================================================
 51. Health API
============================================================
*/

app.get(
  '/api/health',
  async (req, res) => {
    try {
      const health =
        await database.healthCheck();

      return success(
        res,
        {
          status:
            health.ok
              ? 'ok'
              : 'unavailable',

          database:
            health.ok,

          latencyMs:
            health.latencyMs
        },
        health.ok
          ? 200
          : 503
      );
    } catch (error) {
      console.error(
        '[API HEALTH]',
        error
      );

      return failure(
        res,
        503,
        'HEALTH_CHECK_FAILED',
        'تعذر فحص حالة الخادم.'
      );
    }
  }
);

/*
============================================================
 52. معلومات النظام الأساسية
============================================================
*/

app.get(
  '/api/system/status',
  async (req, res) => {
    try {
      const diagnostics =
        await database.databaseDiagnostics();

      return success(
        res,
        {
          online: true,

          database:
            diagnostics.ok,

          environment:
            NODE_ENV,

          uptime:
            process.uptime(),

          memory: {
            rss:
              process.memoryUsage().rss,

            heapUsed:
              process.memoryUsage().heapUsed,

            heapTotal:
              process.memoryUsage().heapTotal
          }
        },
        diagnostics.ok
          ? 200
          : 503
      );
    } catch (error) {
      console.error(
        '[SYSTEM STATUS]',
        error
      );

      return failure(
        res,
        503,
        'SYSTEM_STATUS_FAILED',
        'تعذر الحصول على حالة النظام.'
      );
    }
  }
);

/*
============================================================
 53. معلومات الإصدار
============================================================
*/

app.get(
  '/api/system/version',
  (req, res) => {
    return success(
      res,
      {
        name:
          'افـنـدツينا🥀🖤',

        environment:
          NODE_ENV,

        node:
          process.version
      }
    );
  }
);

/*
============================================================
 54. صفحة API الرئيسية
============================================================
*/

app.get(
  '/api',
  (req, res) => {
    return success(
      res,
      {
        name:
          'افـنـدツينا🥀🖤',

        status:
          'online',

        version:
          '1.0.0'
      }
    );
  }
);

/*
============================================================
 55. POST /api/auth/register
============================================================

 أول حساب حقيقي:
 - يتم فحص عدد المستخدمين داخل Transaction.
 - إذا لم يوجد أي مستخدم:
   يصبح الحساب Owner.
 - إذا كان هناك مستخدمون:
   يصبح الحساب مستخدمًا عاديًا.
 - لا يوجد حساب Owner مسبق.
 - لا يوجد Seed.
============================================================
*/

app.post(
  '/api/auth/register',
  authLimiter,
  async (req, res) => {
    try {
      if (
        !isObject(req.body)
      ) {
        return failure(
          res,
          400,
          'INVALID_BODY',
          'بيانات التسجيل غير صالحة.'
        );
      }

      const username =
        requireUsername(
          req.body.username
        );

      const email =
        requireEmail(
          req.body.email
        );

      const password =
        requirePassword(
          req.body.password
        );

      const existing =
        await database.queryOne(
          `
            SELECT id
            FROM users
            WHERE username = $1
               OR email = $2
            LIMIT 1
          `,
          [
            username,
            email
          ]
        );

      if (existing) {
        return failure(
          res,
          409,
          'ACCOUNT_EXISTS',
          'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.'
        );
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          BCRYPT_ROUNDS
        );

      const result =
        await database.transaction(
          async (client) => {
            const userCountResult =
              await client.query(
                `
                  SELECT
                    COUNT(*)::BIGINT AS count
                  FROM users
                `
              );

            const userCount =
              Number(
                userCountResult
                  .rows[0]
                  ?.count || 0
              );

            const isFirstUser =
              userCount === 0;

            const role =
              isFirstUser
                ? 'owner'
                : 'user';

            const userResult =
              await client.query(
                `
                  INSERT INTO users (
                    username,
                    email,
                    password_hash,
                    role,
                    is_active,
                    is_verified
                  )
                  VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    TRUE,
                    FALSE
                  )
                  RETURNING
                    id,
                    username,
                    email,
                    role,
                    is_active,
                    is_verified,
                    created_at
                `,
                [
                  username,
                  email,
                  passwordHash,
                  role
                ]
              );

            return {
              user:
                userResult
                  .rows[0],

              isFirstUser
            };
          }
        );

      const user =
        result.user;

      const token =
        createAccessToken({
          sub:
            String(
              user.id
            ),

          role:
            user.role,

          username:
            user.username
        });

      setAuthCookie(
        res,
        token
      );

      await writeAuditLog({
        userId:
          user.id,

        action:
          result.isFirstUser
            ? 'owner_account_created'
            : 'user_account_created',

        entityType:
          'user',

        entityId:
          user.id,

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          user: {
            id:
              user.id,

            username:
              user.username,

            email:
              user.email,

            role:
              user.role,

            isActive:
              user.is_active,

            isVerified:
              user.is_verified
          },

          token
        },
        201
      );
    } catch (error) {
      console.error(
        '[REGISTER]',
        error
      );

      if (
        error.code ===
        '23505'
      ) {
        return failure(
          res,
          409,
          'ACCOUNT_EXISTS',
          'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.'
        );
      }

      return failure(
        res,
        500,
        'REGISTER_FAILED',
        'تعذر إنشاء الحساب.'
      );
    }
  }
);

/*
============================================================
 56. POST /api/auth/login
============================================================
*/

app.post(
  '/api/auth/login',
  authLimiter,
  async (req, res) => {
    try {
      if (
        !isObject(req.body)
      ) {
        return failure(
          res,
          400,
          'INVALID_BODY',
          'بيانات تسجيل الدخول غير صالحة.'
        );
      }

      const identifier =
        normalizeString(
          req.body.identifier ||
          req.body.email ||
          req.body.username,
          320
        );

      const password =
        requirePassword(
          req.body.password
        );

      if (
        !identifier
      ) {
        return failure(
          res,
          400,
          'INVALID_IDENTIFIER',
          'أدخل اسم المستخدم أو البريد الإلكتروني.'
        );
      }

      const user =
        await database.queryOne(
          `
            SELECT
              id,
              username,
              email,
              password_hash,
              role,
              status,
              is_active,
              is_verified,
              created_at
            FROM users
            WHERE
              LOWER(email) = LOWER($1)
              OR LOWER(username) = LOWER($1)
            LIMIT 1
          `,
          [
            identifier
          ]
        );

      if (!user) {
        return failure(
          res,
          401,
          'INVALID_CREDENTIALS',
          'بيانات تسجيل الدخول غير صحيحة.'
        );
      }

      if (
        user.is_active === false
      ) {
        return failure(
          res,
          403,
          'ACCOUNT_DISABLED',
          'هذا الحساب غير نشط.'
        );
      }

      const passwordValid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (
        !passwordValid
      ) {
        await writeAuditLog({
          userId:
            user.id,

          action:
            'failed_login',

          entityType:
            'user',

          entityId:
            user.id,

          metadata: {
            reason:
              'invalid_password'
          },

          ipAddress:
            getClientIp(req),

          userAgent:
            req.get(
              'User-Agent'
            )
        });

        return failure(
          res,
          401,
          'INVALID_CREDENTIALS',
          'بيانات تسجيل الدخول غير صحيحة.'
        );
      }

      const token =
        createAccessToken({
          sub:
            String(
              user.id
            ),

          role:
            user.role,

          username:
            user.username
        });

      setAuthCookie(
        res,
        token
      );

      /*
      تحديث آخر دخول فقط إذا كان
      العمود موجودًا في قاعدة البيانات.
      */

      const hasLastLogin =
        await database.columnExists(
          'users',
          'last_login_at'
        );

      if (
        hasLastLogin
      ) {
        await database.query(
          `
            UPDATE users
            SET last_login_at = NOW()
            WHERE id = $1
          `,
          [
            user.id
          ]
        );
      }

      await writeAuditLog({
        userId:
          user.id,

        action:
          'login',

        entityType:
          'user',

        entityId:
          user.id,

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          user: {
            id:
              user.id,

            username:
              user.username,

            email:
              user.email,

            role:
              user.role,

            isActive:
              user.is_active,

            isVerified:
              user.is_verified
          },

          token
        }
      );
    } catch (error) {
      console.error(
        '[LOGIN]',
        error
      );

      return failure(
        res,
        500,
        'LOGIN_FAILED',
        'تعذر تسجيل الدخول.'
      );
    }
  }
);

/*
============================================================
 57. POST /api/auth/logout
============================================================
*/

app.post(
  '/api/auth/logout',
  optionalAuthenticate,
  async (req, res) => {
    try {
      if (
        req.user
      ) {
        await writeAuditLog({
          userId:
            req.user.id,

          action:
            'logout',

          entityType:
            'user',

          entityId:
            req.user.id,

          ipAddress:
            getClientIp(req),

          userAgent:
            req.get(
              'User-Agent'
            )
        });
      }

      clearAuthCookie(
        res
      );

      return success(
        res,
        {
          loggedOut:
            true
        }
      );
    } catch (error) {
      console.error(
        '[LOGOUT]',
        error
      );

      clearAuthCookie(
        res
      );

      return success(
        res,
        {
          loggedOut:
            true
        }
      );
    }
  }
);

/*
============================================================
 58. GET /api/auth/me
============================================================
*/

app.get(
  '/api/auth/me',
  authenticate,
  async (req, res) => {
    try {
      const user =
        await database.queryOne(
          `
            SELECT
              id,
              username,
              email,
              role,
              status,
              is_active,
              is_verified,
              created_at,
              updated_at
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [
            req.user.id
          ]
        );

      if (!user) {
        clearAuthCookie(
          res
        );

        return failure(
          res,
          401,
          'USER_NOT_FOUND',
          'الحساب غير موجود.'
        );
      }

      return success(
        res,
        {
          user
        }
      );
    } catch (error) {
      console.error(
        '[ME]',
        error
      );

      return failure(
        res,
        500,
        'PROFILE_LOAD_FAILED',
        'تعذر تحميل بيانات الحساب.'
      );
    }
  }
);

/*
============================================================
 59. GET /api/auth/session
============================================================
*/

app.get(
  '/api/auth/session',
  optionalAuthenticate,
  (req, res) => {
    return success(
      res,
      {
        authenticated:
          Boolean(
            req.user
          ),

        user:
          req.user ||
          null
      }
    );
  }
);

/*
============================================================
 60. حماية معلومات الحساب
============================================================
*/

app.get(
  '/api/account',
  authenticate,
  async (req, res) => {
    try {
      const user =
        await database.queryOne(
          `
            SELECT
              id,
              username,
              email,
              role,
              status,
              is_active,
              is_verified,
              created_at,
              updated_at
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [
            req.user.id
          ]
        );

      return success(
        res,
        {
          user
        }
      );
    } catch (error) {
      console.error(
        '[ACCOUNT]',
        error
      );

      return failure(
        res,
        500,
        'ACCOUNT_LOAD_FAILED',
        'تعذر تحميل الحساب.'
      );
    }
  }
);

/*
============================================================
 نهاية الجزء 3 من 12
============================================================
*//*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 4 من 12
============================================================
*/

/*
============================================================
 61. تحديث الملف الشخصي
============================================================
*/

app.patch(
  '/api/profile',
  authenticate,
  async (req, res) => {
    try {
      if (!isObject(req.body)) {
        return failure(
          res,
          400,
          'INVALID_BODY',
          'بيانات الملف الشخصي غير صالحة.'
        );
      }

      const allowedFields = {
        display_name: 80,
        bio: 1000,
        avatar_url: 500,
        cover_url: 500,
        gender: 30,
        country: 100,
        city: 100,
        website: 500
      };

      const updates = {};

      for (const [
        field,
        maxLength
      ] of Object.entries(
        allowedFields
      )) {
        if (
          Object.prototype.hasOwnProperty.call(
            req.body,
            field
          )
        ) {
          if (
            req.body[field] === null
          ) {
            updates[field] = null;
          } else {
            updates[field] =
              normalizeString(
                req.body[field],
                maxLength
              );
          }
        }
      }

      if (
        Object.keys(updates).length === 0
      ) {
        return failure(
          res,
          400,
          'NO_CHANGES',
          'لم يتم إرسال أي بيانات للتحديث.'
        );
      }

      const profileExists =
        await database.exists(
          'profiles',
          'user_id = $1',
          [req.user.id]
        );

      let profile;

      if (!profileExists) {
        profile =
          await database.insert(
            'profiles',
            {
              user_id:
                req.user.id,
              ...updates
            }
          );
      } else {
        profile =
          await database.updateOne(
            'profiles',
            updates,
            'user_id = $1',
            [req.user.id]
          );
      }

      await writeAuditLog({
        userId:
          req.user.id,

        action:
          'profile_updated',

        entityType:
          'profile',

        entityId:
          req.user.id,

        metadata: {
          fields:
            Object.keys(
              updates
            )
        },

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          profile
        }
      );
    } catch (error) {
      console.error(
        '[PROFILE UPDATE]',
        error
      );

      return failure(
        res,
        500,
        'PROFILE_UPDATE_FAILED',
        'تعذر تحديث الملف الشخصي.'
      );
    }
  }
);

/*
============================================================
 62. الحصول على الملف الشخصي
============================================================
*/

app.get(
  '/api/profile/:userId',
  optionalAuthenticate,
  async (req, res) => {
    try {
      const userId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const profile =
        await database.queryOne(
          `
            SELECT
              u.id,
              u.username,
              u.role,
              u.status,
              u.is_active,
              u.is_verified,
              u.created_at,
              p.display_name,
              p.bio,
              p.avatar_url,
              p.cover_url,
              p.gender,
              p.country,
              p.city,
              p.website
            FROM users u
            LEFT JOIN profiles p
              ON p.user_id = u.id
            WHERE u.id = $1
            LIMIT 1
          `,
          [userId]
        );

      if (!profile) {
        return failure(
          res,
          404,
          'USER_NOT_FOUND',
          'المستخدم غير موجود.'
        );
      }

      return success(
        res,
        {
          profile
        }
      );
    } catch (error) {
      console.error(
        '[PROFILE]',
        error
      );

      return failure(
        res,
        400,
        'INVALID_PROFILE_REQUEST',
        'بيانات المستخدم غير صالحة.'
      );
    }
  }
);

/*
============================================================
 63. رفع صورة الملف الشخصي
============================================================
*/

app.post(
  '/api/profile/avatar',
  authenticate,
  upload.single('avatar'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return failure(
          res,
          400,
          'FILE_REQUIRED',
          'يجب اختيار صورة.'
        );
      }

      const relativePath =
        `/uploads/${req.file.filename}`;

      const hasAvatarColumn =
        await database.columnExists(
          'profiles',
          'avatar_url'
        );

      if (!hasAvatarColumn) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}

        return failure(
          res,
          500,
          'PROFILE_SCHEMA_ERROR',
          'إعدادات الملف الشخصي لا تحتوي على حقل الصورة المطلوب.'
        );
      }

      const oldProfile =
        await database.queryOne(
          `
            SELECT avatar_url
            FROM profiles
            WHERE user_id = $1
            LIMIT 1
          `,
          [req.user.id]
        );

      const exists =
        await database.exists(
          'profiles',
          'user_id = $1',
          [req.user.id]
        );

      if (exists) {
        await database.query(
          `
            UPDATE profiles
            SET avatar_url = $1
            WHERE user_id = $2
          `,
          [
            relativePath,
            req.user.id
          ]
        );
      } else {
        await database.query(
          `
            INSERT INTO profiles (
              user_id,
              avatar_url
            )
            VALUES (
              $1,
              $2
            )
          `,
          [
            req.user.id,
            relativePath
          ]
        );
      }

      /*
      حذف الصورة القديمة فقط إذا كانت
      موجودة داخل مجلد uploads.
      */

      if (
        oldProfile?.avatar_url &&
        oldProfile.avatar_url.startsWith(
          '/uploads/'
        )
      ) {
        const oldName =
          path.basename(
            oldProfile.avatar_url
          );

        const oldPath =
          path.join(
            UPLOADS_DIR,
            oldName
          );

        if (
          fs.existsSync(
            oldPath
          )
        ) {
          try {
            fs.unlinkSync(
              oldPath
            );
          } catch {}
        }
      }

      await writeAuditLog({
        userId:
          req.user.id,

        action:
          'avatar_updated',

        entityType:
          'profile',

        entityId:
          req.user.id,

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          avatarUrl:
            relativePath
        }
      );
    } catch (error) {
      if (
        req.file?.path &&
        fs.existsSync(
          req.file.path
        )
      ) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}
      }

      console.error(
        '[AVATAR]',
        error
      );

      return failure(
        res,
        500,
        'AVATAR_UPLOAD_FAILED',
        'تعذر رفع الصورة.'
      );
    }
  }
);

/*
============================================================
 64. تغيير كلمة المرور
============================================================
*/

app.patch(
  '/api/auth/password',
  authenticate,
  async (req, res) => {
    try {
      const currentPassword =
        requirePassword(
          req.body.currentPassword
        );

      const newPassword =
        requirePassword(
          req.body.newPassword
        );

      if (
        currentPassword ===
        newPassword
      ) {
        return failure(
          res,
          400,
          'PASSWORD_UNCHANGED',
          'كلمة المرور الجديدة يجب أن تكون مختلفة.'
        );
      }

      const user =
        await database.queryOne(
          `
            SELECT
              id,
              password_hash
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [req.user.id]
        );

      if (!user) {
        return failure(
          res,
          404,
          'USER_NOT_FOUND',
          'الحساب غير موجود.'
        );
      }

      const valid =
        await bcrypt.compare(
          currentPassword,
          user.password_hash
        );

      if (!valid) {
        return failure(
          res,
          401,
          'INVALID_PASSWORD',
          'كلمة المرور الحالية غير صحيحة.'
        );
      }

      const passwordHash =
        await bcrypt.hash(
          newPassword,
          BCRYPT_ROUNDS
        );

      await database.query(
        `
          UPDATE users
          SET password_hash = $1
          WHERE id = $2
        `,
        [
          passwordHash,
          req.user.id
        ]
      );

      clearAuthCookie(
        res
      );

      await writeAuditLog({
        userId:
          req.user.id,

        action:
          'password_changed',

        entityType:
          'user',

        entityId:
          req.user.id,

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          changed:
            true,

          requiresLogin:
            true
        }
      );
    } catch (error) {
      console.error(
        '[PASSWORD]',
        error
      );

      return failure(
        res,
        400,
        'PASSWORD_CHANGE_FAILED',
        'تعذر تغيير كلمة المرور.'
      );
    }
  }
);

/*
============================================================
 65. البحث عن المستخدمين
============================================================
*/

app.get(
  '/api/users/search',
  authenticate,
  async (req, res) => {
    try {
      const q =
        normalizeString(
          req.query.q,
          100
        );

      if (
        q.length < 2
      ) {
        return failure(
          res,
          400,
          'SEARCH_TOO_SHORT',
          'اكتب حرفين على الأقل للبحث.'
        );
      }

      const limit =
        parsePositiveInteger(
          req.query.limit,
          20,
          50
        );

      const search =
        `%${q}%`;

      const users =
        await database.queryRows(
          `
            SELECT
              u.id,
              u.username,
              u.role,
              u.status,
              u.is_active,
              u.is_verified,
              p.display_name,
              p.avatar_url
            FROM users u
            LEFT JOIN profiles p
              ON p.user_id = u.id
            WHERE
              u.is_active = TRUE
              AND (
                u.username ILIKE $1
                OR COALESCE(
                  p.display_name,
                  ''
                ) ILIKE $1
              )
            ORDER BY
              u.username ASC
            LIMIT $2
          `,
          [
            search,
            limit
          ]
        );

      return success(
        res,
        {
          users
        }
      );
    } catch (error) {
      console.error(
        '[USER SEARCH]',
        error
      );

      return failure(
        res,
        500,
        'USER_SEARCH_FAILED',
        'تعذر البحث عن المستخدمين.'
      );
    }
  }
);

/*
============================================================
 66. متابعة مستخدم
============================================================
*/

app.post(
  '/api/social/follow/:userId',
  authenticate,
  async (req, res) => {
    try {
      const targetUserId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      if (
        String(
          targetUserId
        ) ===
        String(
          req.user.id
        )
      ) {
        return failure(
          res,
          400,
          'SELF_FOLLOW',
          'لا يمكنك متابعة حسابك بنفسك.'
        );
      }

      const target =
        await database.queryOne(
          `
            SELECT
              id,
              is_active
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [
            targetUserId
          ]
        );

      if (!target) {
        return failure(
          res,
          404,
          'USER_NOT_FOUND',
          'المستخدم غير موجود.'
        );
      }

      if (
        target.is_active === false
      ) {
        return failure(
          res,
          403,
          'USER_DISABLED',
          'هذا الحساب غير نشط.'
        );
      }

      const friendshipTableExists =
        await database.tableExists(
          'follows'
        );

      if (
        !friendshipTableExists
      ) {
        return failure(
          res,
          500,
          'SOCIAL_SCHEMA_ERROR',
          'جدول المتابعة غير موجود في قاعدة البيانات.'
        );
      }

      const alreadyFollowing =
        await database.exists(
          'follows',
          `
            follower_id = $1
            AND following_id = $2
          `,
          [
            req.user.id,
            targetUserId
          ]
        );

      if (
        alreadyFollowing
      ) {
        return failure(
          res,
          409,
          'ALREADY_FOLLOWING',
          'أنت تتابع هذا المستخدم بالفعل.'
        );
      }

      await database.insert(
        'follows',
        {
          follower_id:
            req.user.id,

          following_id:
            targetUserId
        },
        {
          returning:
            false
        }
      );

      await writeAuditLog({
        userId:
          req.user.id,

        action:
          'follow_user',

        entityType:
          'user',

        entityId:
          targetUserId,

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          following:
            true
        },
        201
      );
    } catch (error) {
      console.error(
        '[FOLLOW]',
        error
      );

      if (
        error.code ===
        '23505'
      ) {
        return failure(
          res,
          409,
          'ALREADY_FOLLOWING',
          'أنت تتابع هذا المستخدم بالفعل.'
        );
      }

      return failure(
        res,
        500,
        'FOLLOW_FAILED',
        'تعذر متابعة المستخدم.'
      );
    }
  }
);

/*
============================================================
 67. إلغاء متابعة مستخدم
============================================================
*/

app.delete(
  '/api/social/follow/:userId',
  authenticate,
  async (req, res) => {
    try {
      const targetUserId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const result =
        await database.query(
          `
            DELETE FROM follows
            WHERE follower_id = $1
              AND following_id = $2
          `,
          [
            req.user.id,
            targetUserId
          ]
        );

      return success(
        res,
        {
          following:
            false,

          removed:
            result.rowCount > 0
        }
      );
    } catch (error) {
      console.error(
        '[UNFOLLOW]',
        error
      );

      return failure(
        res,
        500,
        'UNFOLLOW_FAILED',
        'تعذر إلغاء المتابعة.'
      );
    }
  }
);

/*
============================================================
 68. قائمة المتابعين
============================================================
*/

app.get(
  '/api/users/:userId/followers',
  authenticate,
  async (req, res) => {
    try {
      const userId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const offset =
        Number.parseInt(
          req.query.offset || '0',
          10
        );

      const safeOffset =
        Number.isInteger(
          offset
        ) &&
        offset >= 0
          ? offset
          : 0;

      const followers =
        await database.queryRows(
          `
            SELECT
              u.id,
              u.username,
              u.role,
              u.status,
              u.is_verified,
              p.display_name,
              p.avatar_url
            FROM follows f
            INNER JOIN users u
              ON u.id = f.follower_id
            LEFT JOIN profiles p
              ON p.user_id = u.id
            WHERE
              f.following_id = $1
              AND u.is_active = TRUE
            ORDER BY
              f.created_at DESC
            LIMIT $2
            OFFSET $3
          `,
          [
            userId,
            limit,
            safeOffset
          ]
        );

      return success(
        res,
        {
          followers
        }
      );
    } catch (error) {
      console.error(
        '[FOLLOWERS]',
        error
      );

      return failure(
        res,
        500,
        'FOLLOWERS_LOAD_FAILED',
        'تعذر تحميل المتابعين.'
      );
    }
  }
);

/*
============================================================
 69. قائمة من تتم متابعتهم
============================================================
*/

app.get(
  '/api/users/:userId/following',
  authenticate,
  async (req, res) => {
    try {
      const userId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const offset =
        Number.parseInt(
          req.query.offset || '0',
          10
        );

      const safeOffset =
        Number.isInteger(
          offset
        ) &&
        offset >= 0
          ? offset
          : 0;

      const following =
        await database.queryRows(
          `
            SELECT
              u.id,
              u.username,
              u.role,
              u.status,
              u.is_verified,
              p.display_name,
              p.avatar_url
            FROM follows f
            INNER JOIN users u
              ON u.id = f.following_id
            LEFT JOIN profiles p
              ON p.user_id = u.id
            WHERE
              f.follower_id = $1
              AND u.is_active = TRUE
            ORDER BY
              f.created_at DESC
            LIMIT $2
            OFFSET $3
          `,
          [
            userId,
            limit,
            safeOffset
          ]
        );

      return success(
        res,
        {
          following
        }
      );
    } catch (error) {
      console.error(
        '[FOLLOWING]',
        error
      );

      return failure(
        res,
        500,
        'FOLLOWING_LOAD_FAILED',
        'تعذر تحميل قائمة المتابعة.'
      );
    }
  }
);

/*
============================================================
 نهاية الجزء 4 من 12
============================================================
*//*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 5 من 12
============================================================
*/

/*
============================================================
 70. إنشاء منشور
============================================================
*/

app.post(
  '/api/posts',
  authenticate,
  async (req, res) => {
    try {
      const content =
        requireString(
          req.body.content,
          'content',
          1,
          5000
        );

      const visibility =
        normalizeString(
          req.body.visibility ||
            'public',
          20
        ).toLowerCase();

      const allowedVisibility =
        new Set([
          'public',
          'followers',
          'private'
        ]);

      if (
        !allowedVisibility.has(
          visibility
        )
      ) {
        return failure(
          res,
          400,
          'INVALID_VISIBILITY',
          'خصوصية المنشور غير صالحة.'
        );
      }

      const post =
        await database.insert(
          'posts',
          {
            user_id:
              req.user.id,

            content,

            visibility
          }
        );

      await writeAuditLog({
        userId:
          req.user.id,

        action:
          'post_created',

        entityType:
          'post',

        entityId:
          post?.id || null,

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          post
        },
        201
      );
    } catch (error) {
      console.error(
        '[POST CREATE]',
        error
      );

      return failure(
        res,
        500,
        'POST_CREATE_FAILED',
        'تعذر إنشاء المنشور.'
      );
    }
  }
);

/*
============================================================
 71. عرض المنشورات
============================================================
*/

app.get(
  '/api/posts',
  optionalAuthenticate,
  async (req, res) => {
    try {
      const limit =
        parsePositiveInteger(
          req.query.limit,
          20,
          50
        );

      const offset =
        Number.parseInt(
          req.query.offset || '0',
          10
        );

      const safeOffset =
        Number.isInteger(
          offset
        ) &&
        offset >= 0
          ? offset
          : 0;

      const posts =
        await database.queryRows(
          `
            SELECT
              p.id,
              p.user_id,
              p.content,
              p.visibility,
              p.created_at,
              p.updated_at,
              u.username,
              u.role,
              u.is_verified,
              pr.display_name,
              pr.avatar_url,

              (
                SELECT COUNT(*)
                FROM likes l
                WHERE
                  l.post_id = p.id
              ) AS likes_count,

              (
                SELECT COUNT(*)
                FROM comments c
                WHERE
                  c.post_id = p.id
              ) AS comments_count

            FROM posts p

            INNER JOIN users u
              ON u.id = p.user_id

            LEFT JOIN profiles pr
              ON pr.user_id = u.id

            WHERE
              u.is_active = TRUE
              AND (
                p.visibility = 'public'
                OR (
                  $1::TEXT IS NOT NULL
                  AND p.user_id = $1
                )
              )

            ORDER BY
              p.created_at DESC

            LIMIT $2
            OFFSET $3
          `,
          [
            req.user?.id || null,
            limit,
            safeOffset
          ]
        );

      return success(
        res,
        {
          posts
        }
      );
    } catch (error) {
      console.error(
        '[POSTS]',
        error
      );

      return failure(
        res,
        500,
        'POSTS_LOAD_FAILED',
        'تعذر تحميل المنشورات.'
      );
    }
  }
);

/*
============================================================
 72. حذف منشور
============================================================
*/

app.delete(
  '/api/posts/:postId',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const post =
        await database.queryOne(
          `
            SELECT
              id,
              user_id
            FROM posts
            WHERE id = $1
            LIMIT 1
          `,
          [postId]
        );

      if (!post) {
        return failure(
          res,
          404,
          'POST_NOT_FOUND',
          'المنشور غير موجود.'
        );
      }

      const isOwner =
        String(
          post.user_id
        ) ===
        String(
          req.user.id
        );

      const isAdmin =
        [
          'owner',
          'admin'
        ].includes(
          String(
            req.user.role
          ).toLowerCase()
        );

      if (
        !isOwner &&
        !isAdmin
      ) {
        return failure(
          res,
          403,
          'FORBIDDEN',
          'ليس لديك صلاحية حذف هذا المنشور.'
        );
      }

      await database.query(
        `
          DELETE FROM posts
          WHERE id = $1
        `,
        [postId]
      );

      await writeAuditLog({
        userId:
          req.user.id,

        action:
          'post_deleted',

        entityType:
          'post',

        entityId:
          postId,

        metadata: {
          owner:
            isOwner,
          moderator:
            isAdmin
        },

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          deleted:
            true
        }
      );
    } catch (error) {
      console.error(
        '[POST DELETE]',
        error
      );

      return failure(
        res,
        500,
        'POST_DELETE_FAILED',
        'تعذر حذف المنشور.'
      );
    }
  }
);

/*
============================================================
 73. الإعجاب بمنشور
============================================================
*/

app.post(
  '/api/posts/:postId/like',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const postExists =
        await database.exists(
          'posts',
          'id = $1',
          [postId]
        );

      if (!postExists) {
        return failure(
          res,
          404,
          'POST_NOT_FOUND',
          'المنشور غير موجود.'
        );
      }

      const alreadyLiked =
        await database.exists(
          'likes',
          `
            user_id = $1
            AND post_id = $2
          `,
          [
            req.user.id,
            postId
          ]
        );

      if (
        alreadyLiked
      ) {
        return success(
          res,
          {
            liked:
              true
          }
        );
      }

      await database.insert(
        'likes',
        {
          user_id:
            req.user.id,

          post_id:
            postId
        },
        {
          returning:
            false
        }
      );

      return success(
        res,
        {
          liked:
            true
        },
        201
      );
    } catch (error) {
      console.error(
        '[LIKE]',
        error
      );

      if (
        error.code ===
        '23505'
      ) {
        return success(
          res,
          {
            liked:
              true
          }
        );
      }

      return failure(
        res,
        500,
        'LIKE_FAILED',
        'تعذر تسجيل الإعجاب.'
      );
    }
  }
);

/*
============================================================
 74. إزالة الإعجاب
============================================================
*/

app.delete(
  '/api/posts/:postId/like',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const result =
        await database.query(
          `
            DELETE FROM likes
            WHERE
              user_id = $1
              AND post_id = $2
          `,
          [
            req.user.id,
            postId
          ]
        );

      return success(
        res,
        {
          liked:
            false,

          removed:
            result.rowCount > 0
        }
      );
    } catch (error) {
      console.error(
        '[UNLIKE]',
        error
      );

      return failure(
        res,
        500,
        'UNLIKE_FAILED',
        'تعذر إزالة الإعجاب.'
      );
    }
  }
);

/*
============================================================
 75. إضافة تعليق
============================================================
*/

app.post(
  '/api/posts/:postId/comments',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const content =
        requireString(
          req.body.content,
          'content',
          1,
          2000
        );

      const postExists =
        await database.exists(
          'posts',
          'id = $1',
          [postId]
        );

      if (!postExists) {
        return failure(
          res,
          404,
          'POST_NOT_FOUND',
          'المنشور غير موجود.'
        );
      }

      const comment =
        await database.insert(
          'comments',
          {
            post_id:
              postId,

            user_id:
              req.user.id,

            content
          }
        );

      return success(
        res,
        {
          comment
        },
        201
      );
    } catch (error) {
      console.error(
        '[COMMENT CREATE]',
        error
      );

      return failure(
        res,
        500,
        'COMMENT_CREATE_FAILED',
        'تعذر إضافة التعليق.'
      );
    }
  }
);

/*
============================================================
 76. عرض تعليقات منشور
============================================================
*/

app.get(
  '/api/posts/:postId/comments',
  optionalAuthenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const offset =
        Number.parseInt(
          req.query.offset || '0',
          10
        );

      const safeOffset =
        Number.isInteger(
          offset
        ) &&
        offset >= 0
          ? offset
          : 0;

      const comments =
        await database.queryRows(
          `
            SELECT
              c.id,
              c.post_id,
              c.user_id,
              c.content,
              c.created_at,
              c.updated_at,
              u.username,
              u.role,
              u.is_verified,
              p.display_name,
              p.avatar_url
            FROM comments c

            INNER JOIN users u
              ON u.id = c.user_id

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              c.post_id = $1
              AND u.is_active = TRUE

            ORDER BY
              c.created_at ASC

            LIMIT $2
            OFFSET $3
          `,
          [
            postId,
            limit,
            safeOffset
          ]
        );

      return success(
        res,
        {
          comments
        }
      );
    } catch (error) {
      console.error(
        '[COMMENTS]',
        error
      );

      return failure(
        res,
        500,
        'COMMENTS_LOAD_FAILED',
        'تعذر تحميل التعليقات.'
      );
    }
  }
);

/*
============================================================
 77. حذف تعليق
============================================================
*/

app.delete(
  '/api/comments/:commentId',
  authenticate,
  async (req, res) => {
    try {
      const commentId =
        requireString(
          req.params.commentId,
          'commentId',
          1,
          100
        );

      const comment =
        await database.queryOne(
          `
            SELECT
              id,
              user_id
            FROM comments
            WHERE id = $1
            LIMIT 1
          `,
          [commentId]
        );

      if (!comment) {
        return failure(
          res,
          404,
          'COMMENT_NOT_FOUND',
          'التعليق غير موجود.'
        );
      }

      const isOwner =
        String(
          comment.user_id
        ) ===
        String(
          req.user.id
        );

      const isModerator =
        [
          'owner',
          'admin',
          'moderator'
        ].includes(
          String(
            req.user.role
          ).toLowerCase()
        );

      if (
        !isOwner &&
        !isModerator
      ) {
        return failure(
          res,
          403,
          'FORBIDDEN',
          'ليس لديك صلاحية حذف هذا التعليق.'
        );
      }

      await database.query(
        `
          DELETE FROM comments
          WHERE id = $1
        `,
        [commentId]
      );

      return success(
        res,
        {
          deleted:
            true
        }
      );
    } catch (error) {
      console.error(
        '[COMMENT DELETE]',
        error
      );

      return failure(
        res,
        500,
        'COMMENT_DELETE_FAILED',
        'تعذر حذف التعليق.'
      );
    }
  }
);

/*
============================================================
 78. إنشاء غرفة دردشة
============================================================
*/

app.post(
  '/api/rooms',
  authenticate,
  async (req, res) => {
    try {
      const name =
        requireString(
          req.body.name,
          'name',
          2,
          100
        );

      const description =
        normalizeString(
          req.body.description,
          1000
        );

      const room =
        await database.insert(
          'rooms',
          {
            name,
            description,
            owner_id:
              req.user.id
          }
        );

      return success(
        res,
        {
          room
        },
        201
      );
    } catch (error) {
      console.error(
        '[ROOM CREATE]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_CREATE_FAILED',
        'تعذر إنشاء الغرفة.'
      );
    }
  }
);

/*
============================================================
 79. قائمة الغرف
============================================================
*/

app.get(
  '/api/rooms',
  authenticate,
  async (req, res) => {
    try {
      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const rooms =
        await database.queryRows(
          `
            SELECT
              r.*,

              u.username AS owner_username,

              (
                SELECT COUNT(*)
                FROM room_members rm
                WHERE
                  rm.room_id = r.id
              ) AS members_count

            FROM rooms r

            LEFT JOIN users u
              ON u.id = r.owner_id

            WHERE
              COALESCE(
                r.is_active,
                TRUE
              ) = TRUE

            ORDER BY
              r.created_at DESC

            LIMIT $1
          `,
          [limit]
        );

      return success(
        res,
        {
          rooms
        }
      );
    } catch (error) {
      console.error(
        '[ROOMS]',
        error
      );

      return failure(
        res,
        500,
        'ROOMS_LOAD_FAILED',
        'تعذر تحميل الغرف.'
      );
    }
  }
);

/*
============================================================
 80. الانضمام إلى غرفة
============================================================
*/

app.post(
  '/api/rooms/:roomId/join',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      const room =
        await database.queryOne(
          `
            SELECT
              id,
              owner_id,
              is_active
            FROM rooms
            WHERE id = $1
            LIMIT 1
          `,
          [roomId]
        );

      if (!room) {
        return failure(
          res,
          404,
          'ROOM_NOT_FOUND',
          'الغرفة غير موجودة.'
        );
      }

      if (
        room.is_active === false
      ) {
        return failure(
          res,
          403,
          'ROOM_DISABLED',
          'الغرفة غير متاحة حاليًا.'
        );
      }

      const memberExists =
        await database.exists(
          'room_members',
          `
            room_id = $1
            AND user_id = $2
          `,
          [
            roomId,
            req.user.id
          ]
        );

      if (!memberExists) {
        await database.insert(
          'room_members',
          {
            room_id:
              roomId,

            user_id:
              req.user.id
          },
          {
            returning:
              false
          }
        );
      }

      return success(
        res,
        {
          joined:
            true
        }
      );
    } catch (error) {
      console.error(
        '[ROOM JOIN]',
        error
      );

      if (
        error.code ===
        '23505'
      ) {
        return success(
          res,
          {
            joined:
              true
          }
        );
      }

      return failure(
        res,
        500,
        'ROOM_JOIN_FAILED',
        'تعذر الانضمام إلى الغرفة.'
      );
    }
  }
);

/*
============================================================
 نهاية الجزء 5 من 12
============================================================
*//*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 6 من 12
============================================================
*/

/*
============================================================
 81. مغادرة الغرفة
============================================================
*/

app.delete(
  '/api/rooms/:roomId/join',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      const room =
        await database.queryOne(
          `
            SELECT
              id,
              owner_id
            FROM rooms
            WHERE id = $1
            LIMIT 1
          `,
          [roomId]
        );

      if (!room) {
        return failure(
          res,
          404,
          'ROOM_NOT_FOUND',
          'الغرفة غير موجودة.'
        );
      }

      if (
        String(room.owner_id) ===
        String(req.user.id)
      ) {
        return failure(
          res,
          400,
          'ROOM_OWNER_CANNOT_LEAVE',
          'مالك الغرفة لا يمكنه مغادرتها قبل نقل الملكية أو حذف الغرفة.'
        );
      }

      const result =
        await database.query(
          `
            DELETE FROM room_members
            WHERE
              room_id = $1
              AND user_id = $2
          `,
          [
            roomId,
            req.user.id
          ]
        );

      return success(
        res,
        {
          left:
            result.rowCount > 0
        }
      );
    } catch (error) {
      console.error(
        '[ROOM LEAVE]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_LEAVE_FAILED',
        'تعذر مغادرة الغرفة.'
      );
    }
  }
);

/*
============================================================
 82. رسائل الغرفة
============================================================
*/

app.get(
  '/api/rooms/:roomId/messages',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      const isMember =
        await database.exists(
          'room_members',
          `
            room_id = $1
            AND user_id = $2
          `,
          [
            roomId,
            req.user.id
          ]
        );

      const room =
        await database.queryOne(
          `
            SELECT
              id,
              owner_id
            FROM rooms
            WHERE id = $1
            LIMIT 1
          `,
          [roomId]
        );

      if (!room) {
        return failure(
          res,
          404,
          'ROOM_NOT_FOUND',
          'الغرفة غير موجودة.'
        );
      }

      if (
        !isMember &&
        String(room.owner_id) !==
          String(req.user.id)
      ) {
        return failure(
          res,
          403,
          'ROOM_ACCESS_DENIED',
          'يجب الانضمام إلى الغرفة أولًا.'
        );
      }

      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const before =
        req.query.before || null;

      const messages =
        await database.queryRows(
          `
            SELECT
              m.id,
              m.room_id,
              m.user_id,
              m.content,
              m.created_at,
              u.username,
              u.role,
              p.display_name,
              p.avatar_url
            FROM messages m
            INNER JOIN users u
              ON u.id = m.user_id
            LEFT JOIN profiles p
              ON p.user_id = u.id
            WHERE
              m.room_id = $1
              AND u.is_active = TRUE
              AND (
                $2::TIMESTAMPTZ IS NULL
                OR m.created_at < $2
              )
            ORDER BY
              m.created_at DESC
            LIMIT $3
          `,
          [
            roomId,
            before,
            limit
          ]
        );

      return success(
        res,
        {
          messages:
            messages.reverse()
        }
      );
    } catch (error) {
      console.error(
        '[ROOM MESSAGES]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_MESSAGES_FAILED',
        'تعذر تحميل رسائل الغرفة.'
      );
    }
  }
);

/*
============================================================
 83. إرسال رسالة داخل الغرفة
============================================================
*/

app.post(
  '/api/rooms/:roomId/messages',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      const content =
        requireString(
          req.body.content,
          'content',
          1,
          5000
        );

      const room =
        await database.queryOne(
          `
            SELECT
              id,
              owner_id,
              is_active
            FROM rooms
            WHERE id = $1
            LIMIT 1
          `,
          [roomId]
        );

      if (!room) {
        return failure(
          res,
          404,
          'ROOM_NOT_FOUND',
          'الغرفة غير موجودة.'
        );
      }

      if (
        room.is_active === false
      ) {
        return failure(
          res,
          403,
          'ROOM_DISABLED',
          'الغرفة غير متاحة حاليًا.'
        );
      }

      const isMember =
        await database.exists(
          'room_members',
          `
            room_id = $1
            AND user_id = $2
          `,
          [
            roomId,
            req.user.id
          ]
        );

      if (
        !isMember &&
        String(room.owner_id) !==
          String(req.user.id)
      ) {
        return failure(
          res,
          403,
          'ROOM_ACCESS_DENIED',
          'يجب الانضمام إلى الغرفة أولًا.'
        );
      }

      const message =
        await database.insert(
          'messages',
          {
            room_id:
              roomId,

            user_id:
              req.user.id,

            content
          }
        );

      const messagePayload = {
        id:
          message.id,

        roomId,

        userId:
          req.user.id,

        username:
          req.user.username,

        content,

        createdAt:
          message.created_at ||
          new Date()
      };

      io.to(
        `room:${roomId}`
      ).emit(
        'message:new',
        messagePayload
      );

      return success(
        res,
        {
          message:
            messagePayload
        },
        201
      );
    } catch (error) {
      console.error(
        '[ROOM MESSAGE CREATE]',
        error
      );

      return failure(
        res,
        500,
        'MESSAGE_CREATE_FAILED',
        'تعذر إرسال الرسالة.'
      );
    }
  }
);

/*
============================================================
 84. الانضمام إلى Socket Room
============================================================
*/

io.use(
  async (
    socket,
    next
  ) => {
    try {
      const token =
        socket.handshake
          ?.auth
          ?.token ||
        socket.handshake
          ?.headers
          ?.authorization
          ?.replace(
            /^Bearer\s+/i,
            ''
          );

      if (!token) {
        return next(
          new Error(
            'Authentication required.'
          )
        );
      }

      const decoded =
        verifyAccessToken(
          token
        );

      if (
        !decoded ||
        !decoded.sub
      ) {
        return next(
          new Error(
            'Invalid authentication token.'
          )
        );
      }

      const user =
        await database.queryOne(
          `
            SELECT
              id,
              username,
              role,
              is_active,
              is_verified
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [decoded.sub]
        );

      if (
        !user ||
        user.is_active === false
      ) {
        return next(
          new Error(
            'Account is unavailable.'
          )
        );
      }

      socket.user =
        user;

      socket.auth =
        decoded;

      next();
    } catch (error) {
      console.error(
        '[SOCKET AUTH]',
        error
      );

      next(
        new Error(
          'Socket authentication failed.'
        )
      );
    }
  }
);

/*
============================================================
 85. Socket.IO Connections
============================================================
*/

io.on(
  'connection',
  (socket) => {
    console.log(
      `[SOCKET] Connected: ${socket.user.id}`
    );

    /*
    --------------------------------------------------------
     85.1 دخول المستخدم إلى غرفته الخاصة
    --------------------------------------------------------
    */

    socket.join(
      `user:${socket.user.id}`
    );

    /*
    --------------------------------------------------------
     85.2 الانضمام إلى غرفة دردشة
    --------------------------------------------------------
    */

    socket.on(
      'room:join',
      async (
        roomId,
        callback
      ) => {
        try {
          const safeRoomId =
            requireString(
              roomId,
              'roomId',
              1,
              100
            );

          const room =
            await database.queryOne(
              `
                SELECT
                  id,
                  owner_id,
                  is_active
                FROM rooms
                WHERE id = $1
                LIMIT 1
              `,
              [safeRoomId]
            );

          if (!room) {
            throw new Error(
              'Room not found.'
            );
          }

          if (
            room.is_active === false
          ) {
            throw new Error(
              'Room is disabled.'
            );
          }

          const member =
            await database.exists(
              'room_members',
              `
                room_id = $1
                AND user_id = $2
              `,
              [
                safeRoomId,
                socket.user.id
              ]
            );

          if (
            !member &&
            String(room.owner_id) !==
              String(socket.user.id)
          ) {
            throw new Error(
              'You are not a room member.'
            );
          }

          socket.join(
            `room:${safeRoomId}`
          );

          if (
            typeof callback ===
            'function'
          ) {
            callback({
              success:
                true
            });
          }
        } catch (error) {
          if (
            typeof callback ===
            'function'
          ) {
            callback({
              success:
                false,

              error:
                error.message
            });
          }
        }
      }
    );

    /*
    --------------------------------------------------------
     85.3 مغادرة غرفة Socket
    --------------------------------------------------------
    */

    socket.on(
      'room:leave',
      (
        roomId,
        callback
      ) => {
        try {
          const safeRoomId =
            requireString(
              roomId,
              'roomId',
              1,
              100
            );

          socket.leave(
            `room:${safeRoomId}`
          );

          if (
            typeof callback ===
            'function'
          ) {
            callback({
              success:
                true
            });
          }
        } catch (error) {
          if (
            typeof callback ===
            'function'
          ) {
            callback({
              success:
                false,

              error:
                error.message
            });
          }
        }
      }
    );

    /*
    --------------------------------------------------------
     85.4 حالة الكتابة
    --------------------------------------------------------
    */

    socket.on(
      'room:typing',
      (
        data
      ) => {
        try {
          if (
            !isObject(data)
          ) {
            return;
          }

          const roomId =
            normalizeString(
              data.roomId,
              100
            );

          const typing =
            Boolean(
              data.typing
            );

          if (!roomId) {
            return;
          }

          socket.to(
            `room:${roomId}`
          ).emit(
            'room:typing',
            {
              roomId,

              userId:
                socket.user.id,

              username:
                socket.user.username,

              typing
            }
          );
        } catch (error) {
          console.error(
            '[SOCKET TYPING]',
            error
          );
        }
      }
    );

    /*
    --------------------------------------------------------
     85.5 حالة الاتصال
    --------------------------------------------------------
    */

    socket.on(
      'presence:update',
      async (
        status
      ) => {
        try {
          const allowed =
            new Set([
              'online',
              'away',
              'busy',
              'offline'
            ]);

          const normalized =
            normalizeString(
              status,
              20
            ).toLowerCase();

          if (
            !allowed.has(
              normalized
            )
          ) {
            return;
          }

          const hasStatus =
            await database.columnExists(
              'users',
              'status'
            );

          if (!hasStatus) {
            return;
          }

          await database.query(
            `
              UPDATE users
              SET status = $1
              WHERE id = $2
            `,
            [
              normalized,
              socket.user.id
            ]
          );

          io.emit(
            'presence:update',
            {
              userId:
                socket.user.id,

              username:
                socket.user.username,

              status:
                normalized
            }
          );
        } catch (error) {
          console.error(
            '[PRESENCE]',
            error
          );
        }
      }
    );

    /*
    --------------------------------------------------------
     85.6 إغلاق الاتصال
    --------------------------------------------------------
    */

    socket.on(
      'disconnect',
      () => {
        console.log(
          `[SOCKET] Disconnected: ${socket.user.id}`
        );
      }
    );
  }
);

/*
============================================================
 86. حذف الرسالة
============================================================
*/

app.delete(
  '/api/messages/:messageId',
  authenticate,
  async (req, res) => {
    try {
      const messageId =
        requireString(
          req.params.messageId,
          'messageId',
          1,
          100
        );

      const message =
        await database.queryOne(
          `
            SELECT
              id,
              user_id,
              room_id
            FROM messages
            WHERE id = $1
            LIMIT 1
          `,
          [messageId]
        );

      if (!message) {
        return failure(
          res,
          404,
          'MESSAGE_NOT_FOUND',
          'الرسالة غير موجودة.'
        );
      }

      const ownMessage =
        String(
          message.user_id
        ) ===
        String(
          req.user.id
        );

      const moderator =
        [
          'owner',
          'admin',
          'moderator'
        ].includes(
          String(
            req.user.role
          ).toLowerCase()
        );

      if (
        !ownMessage &&
        !moderator
      ) {
        return failure(
          res,
          403,
          'FORBIDDEN',
          'ليس لديك صلاحية حذف هذه الرسالة.'
        );
      }

      await database.query(
        `
          DELETE FROM messages
          WHERE id = $1
        `,
        [messageId]
      );

      io.to(
        `room:${message.room_id}`
      ).emit(
        'message:deleted',
        {
          messageId
        }
      );

      await writeAuditLog({
        userId:
          req.user.id,

        action:
          'message_deleted',

        entityType:
          'message',

        entityId:
          messageId,

        metadata: {
          moderator:
            moderator
        },

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          deleted:
            true
        }
      );
    } catch (error) {
      console.error(
        '[MESSAGE DELETE]',
        error
      );

      return failure(
        res,
        500,
        'MESSAGE_DELETE_FAILED',
        'تعذر حذف الرسالة.'
      );
    }
  }
);

/*
============================================================
 نهاية الجزء 6 من 12
============================================================
*//*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 7 من 12
============================================================
*/

/*
============================================================
 87. إرسال رسالة خاصة
============================================================
*/

app.post(
  '/api/messages',
  authenticate,
  async (req, res) => {
    try {
      const receiverId =
        requireString(
          req.body.receiverId,
          'receiverId',
          1,
          100
        );

      const content =
        requireString(
          req.body.content,
          'content',
          1,
          5000
        );

      if (
        String(receiverId) ===
        String(req.user.id)
      ) {
        return failure(
          res,
          400,
          'SELF_MESSAGE',
          'لا يمكنك إرسال رسالة إلى نفسك.'
        );
      }

      const receiver =
        await database.queryOne(
          `
            SELECT
              id,
              username,
              role,
              is_active
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [receiverId]
        );

      if (!receiver) {
        return failure(
          res,
          404,
          'USER_NOT_FOUND',
          'المستخدم غير موجود.'
        );
      }

      if (
        receiver.is_active === false
      ) {
        return failure(
          res,
          403,
          'USER_DISABLED',
          'هذا الحساب غير متاح.'
        );
      }

      const message =
        await database.insert(
          'messages',
          {
            sender_id:
              req.user.id,

            receiver_id:
              receiverId,

            content
          }
        );

      const payload = {
        id:
          message.id,

        senderId:
          req.user.id,

        receiverId,

        content,

        createdAt:
          message.created_at ||
          new Date()
      };

      io.to(
        `user:${receiverId}`
      ).emit(
        'private_message:new',
        payload
      );

      io.to(
        `user:${req.user.id}`
      ).emit(
        'private_message:sent',
        payload
      );

      return success(
        res,
        {
          message:
            payload
        },
        201
      );
    } catch (error) {
      console.error(
        '[PRIVATE MESSAGE]',
        error
      );

      return failure(
        res,
        500,
        'PRIVATE_MESSAGE_FAILED',
        'تعذر إرسال الرسالة.'
      );
    }
  }
);

/*
============================================================
 88. المحادثة الخاصة
============================================================
*/

app.get(
  '/api/messages/:userId',
  authenticate,
  async (req, res) => {
    try {
      const otherUserId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const offset =
        Number.parseInt(
          req.query.offset || '0',
          10
        );

      const safeOffset =
        Number.isInteger(
          offset
        ) &&
        offset >= 0
          ? offset
          : 0;

      const messages =
        await database.queryRows(
          `
            SELECT
              m.id,
              m.sender_id,
              m.receiver_id,
              m.content,
              m.created_at,
              m.updated_at
            FROM messages m
            WHERE
              (
                m.sender_id = $1
                AND m.receiver_id = $2
              )
              OR
              (
                m.sender_id = $2
                AND m.receiver_id = $1
              )
            ORDER BY
              m.created_at DESC
            LIMIT $3
            OFFSET $4
          `,
          [
            req.user.id,
            otherUserId,
            limit,
            safeOffset
          ]
        );

      return success(
        res,
        {
          messages:
            messages.reverse()
        }
      );
    } catch (error) {
      console.error(
        '[PRIVATE MESSAGES]',
        error
      );

      return failure(
        res,
        500,
        'PRIVATE_MESSAGES_FAILED',
        'تعذر تحميل المحادثة.'
      );
    }
  }
);

/*
============================================================
 89. تعليم الرسائل كمقروءة
============================================================
*/

app.patch(
  '/api/messages/:userId/read',
  authenticate,
  async (req, res) => {
    try {
      const otherUserId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const hasReadColumn =
        await database.columnExists(
          'messages',
          'read_at'
        );

      if (!hasReadColumn) {
        return failure(
          res,
          500,
          'MESSAGE_SCHEMA_ERROR',
          'حقل قراءة الرسائل غير موجود في قاعدة البيانات.'
        );
      }

      const result =
        await database.query(
          `
            UPDATE messages
            SET read_at = NOW()
            WHERE
              sender_id = $1
              AND receiver_id = $2
              AND read_at IS NULL
          `,
          [
            otherUserId,
            req.user.id
          ]
        );

      return success(
        res,
        {
          marked:
            result.rowCount
        }
      );
    } catch (error) {
      console.error(
        '[MESSAGE READ]',
        error
      );

      return failure(
        res,
        500,
        'MESSAGE_READ_FAILED',
        'تعذر تحديث حالة الرسائل.'
      );
    }
  }
);

/*
============================================================
 90. قائمة المحادثات
============================================================
*/

app.get(
  '/api/conversations',
  authenticate,
  async (req, res) => {
    try {
      const conversations =
        await database.queryRows(
          `
            SELECT DISTINCT ON (
              CASE
                WHEN m.sender_id = $1
                  THEN m.receiver_id
                ELSE m.sender_id
              END
            )
              CASE
                WHEN m.sender_id = $1
                  THEN m.receiver_id
                ELSE m.sender_id
              END AS user_id,

              m.id AS message_id,
              m.content,
              m.created_at,

              u.username,
              u.role,
              u.is_verified,

              p.display_name,
              p.avatar_url

            FROM messages m

            INNER JOIN users u
              ON u.id =
                CASE
                  WHEN m.sender_id = $1
                    THEN m.receiver_id
                  ELSE m.sender_id
                END

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              (
                m.sender_id = $1
                OR m.receiver_id = $1
              )
              AND u.is_active = TRUE

            ORDER BY
              CASE
                WHEN m.sender_id = $1
                  THEN m.receiver_id
                ELSE m.sender_id
              END,
              m.created_at DESC
          `,
          [req.user.id]
        );

      conversations.sort(
        (a, b) =>
          new Date(
            b.created_at
          ) -
          new Date(
            a.created_at
          )
      );

      return success(
        res,
        {
          conversations
        }
      );
    } catch (error) {
      console.error(
        '[CONVERSATIONS]',
        error
      );

      return failure(
        res,
        500,
        'CONVERSATIONS_FAILED',
        'تعذر تحميل المحادثات.'
      );
    }
  }
);

/*
============================================================
 91. الإشعارات
============================================================
*/

app.get(
  '/api/notifications',
  authenticate,
  async (req, res) => {
    try {
      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const notifications =
        await database.queryRows(
          `
            SELECT
              n.*
            FROM notifications n
            WHERE
              n.user_id = $1
            ORDER BY
              n.created_at DESC
            LIMIT $2
          `,
          [
            req.user.id,
            limit
          ]
        );

      return success(
        res,
        {
          notifications
        }
      );
    } catch (error) {
      console.error(
        '[NOTIFICATIONS]',
        error
      );

      return failure(
        res,
        500,
        'NOTIFICATIONS_FAILED',
        'تعذر تحميل الإشعارات.'
      );
    }
  }
);

/*
============================================================
 92. عدد الإشعارات غير المقروءة
============================================================
*/

app.get(
  '/api/notifications/unread-count',
  authenticate,
  async (req, res) => {
    try {
      const hasReadColumn =
        await database.columnExists(
          'notifications',
          'read_at'
        );

      if (!hasReadColumn) {
        return success(
          res,
          {
            count:
              0
          }
        );
      }

      const result =
        await database.queryOne(
          `
            SELECT
              COUNT(*)::INTEGER AS count
            FROM notifications
            WHERE
              user_id = $1
              AND read_at IS NULL
          `,
          [req.user.id]
        );

      return success(
        res,
        {
          count:
            Number(
              result?.count || 0
            )
        }
      );
    } catch (error) {
      console.error(
        '[UNREAD NOTIFICATIONS]',
        error
      );

      return failure(
        res,
        500,
        'UNREAD_COUNT_FAILED',
        'تعذر حساب الإشعارات غير المقروءة.'
      );
    }
  }
);

/*
============================================================
 93. تعليم إشعار كمقروء
============================================================
*/

app.patch(
  '/api/notifications/:notificationId/read',
  authenticate,
  async (req, res) => {
    try {
      const notificationId =
        requireString(
          req.params.notificationId,
          'notificationId',
          1,
          100
        );

      const hasReadColumn =
        await database.columnExists(
          'notifications',
          'read_at'
        );

      if (!hasReadColumn) {
        return failure(
          res,
          500,
          'NOTIFICATION_SCHEMA_ERROR',
          'حقل قراءة الإشعارات غير موجود.'
        );
      }

      const result =
        await database.query(
          `
            UPDATE notifications
            SET read_at = NOW()
            WHERE
              id = $1
              AND user_id = $2
          `,
          [
            notificationId,
            req.user.id
          ]
        );

      return success(
        res,
        {
          read:
            result.rowCount > 0
        }
      );
    } catch (error) {
      console.error(
        '[NOTIFICATION READ]',
        error
      );

      return failure(
        res,
        500,
        'NOTIFICATION_READ_FAILED',
        'تعذر تحديث الإشعار.'
      );
    }
  }
);

/*
============================================================
 94. تعليم كل الإشعارات كمقروءة
============================================================
*/

app.patch(
  '/api/notifications/read-all',
  authenticate,
  async (req, res) => {
    try {
      const hasReadColumn =
        await database.columnExists(
          'notifications',
          'read_at'
        );

      if (!hasReadColumn) {
        return success(
          res,
          {
            updated:
              0
          }
        );
      }

      const result =
        await database.query(
          `
            UPDATE notifications
            SET read_at = NOW()
            WHERE
              user_id = $1
              AND read_at IS NULL
          `,
          [req.user.id]
        );

      return success(
        res,
        {
          updated:
            result.rowCount
        }
      );
    } catch (error) {
      console.error(
        '[NOTIFICATIONS READ ALL]',
        error
      );

      return failure(
        res,
        500,
        'NOTIFICATIONS_READ_ALL_FAILED',
        'تعذر تحديث الإشعارات.'
      );
    }
  }
);

/*
============================================================
 95. حذف إشعار
============================================================
*/

app.delete(
  '/api/notifications/:notificationId',
  authenticate,
  async (req, res) => {
    try {
      const notificationId =
        requireString(
          req.params.notificationId,
          'notificationId',
          1,
          100
        );

      const result =
        await database.query(
          `
            DELETE FROM notifications
            WHERE
              id = $1
              AND user_id = $2
          `,
          [
            notificationId,
            req.user.id
          ]
        );

      return success(
        res,
        {
          deleted:
            result.rowCount > 0
        }
      );
    } catch (error) {
      console.error(
        '[NOTIFICATION DELETE]',
        error
      );

      return failure(
        res,
        500,
        'NOTIFICATION_DELETE_FAILED',
        'تعذر حذف الإشعار.'
      );
    }
  }
);

/*
============================================================
 96. إرسال إشعار داخلي
============================================================
*/

async function createNotification({
  userId,
  type,
  title,
  message,
  data = null
}) {
  if (!userId) {
    return null;
  }

  const notification =
    await database.insert(
      'notifications',
      {
        user_id:
          userId,

        type:
          normalizeString(
            type,
            50
          ),

        title:
          normalizeString(
            title,
            200
          ),

        message:
          normalizeString(
            message,
            2000
          ),

        data
      }
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
 97. حذف الحساب الشخصي
============================================================
*/

app.delete(
  '/api/account',
  authenticate,
  async (req, res) => {
    try {
      const password =
        requirePassword(
          req.body.password
        );

      const user =
        await database.queryOne(
          `
            SELECT
              id,
              password_hash
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [req.user.id]
        );

      if (!user) {
        return failure(
          res,
          404,
          'USER_NOT_FOUND',
          'الحساب غير موجود.'
        );
      }

      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!valid) {
        return failure(
          res,
          401,
          'INVALID_PASSWORD',
          'كلمة المرور غير صحيحة.'
        );
      }

      /*
      لا يسمح بحذف آخر Owner
      إذا كان سيؤدي إلى فقدان إدارة
      النظام بالكامل.
      */

      const ownerCount =
        await database.queryOne(
          `
            SELECT
              COUNT(*)::INTEGER AS count
            FROM users
            WHERE
              LOWER(role) = 'owner'
              AND is_active = TRUE
          `
        );

      const isOwner =
        String(
          req.user.role
        ).toLowerCase() ===
        'owner';

      if (
        isOwner &&
        Number(
          ownerCount?.count || 0
        ) <= 1
      ) {
        return failure(
          res,
          400,
          'LAST_OWNER',
          'لا يمكن حذف آخر حساب Owner قبل نقل صلاحيات الملكية إلى Owner آخر.'
        );
      }

      await database.query(
        `
          DELETE FROM users
          WHERE id = $1
        `,
        [req.user.id]
      );

      await writeAuditLog({
        userId:
          req.user.id,

        action:
          'account_deleted',

        entityType:
          'user',

        entityId:
          req.user.id,

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      clearAuthCookie(
        res
      );

      return success(
        res,
        {
          deleted:
            true
        }
      );
    } catch (error) {
      console.error(
        '[ACCOUNT DELETE]',
        error
      );

      return failure(
        res,
        500,
        'ACCOUNT_DELETE_FAILED',
        'تعذر حذف الحساب.'
      );
    }
  }
);

/*
============================================================
 98. إحصائيات المستخدم الشخصية
============================================================
*/

app.get(
  '/api/account/statistics',
  authenticate,
  async (req, res) => {
    try {
      const statistics =
        await database.queryOne(
          `
            SELECT
              (
                SELECT COUNT(*)
                FROM posts
                WHERE user_id = $1
              ) AS posts_count,

              (
                SELECT COUNT(*)
                FROM comments
                WHERE user_id = $1
              ) AS comments_count,

              (
                SELECT COUNT(*)
                FROM likes
                WHERE user_id = $1
              ) AS likes_count,

              (
                SELECT COUNT(*)
                FROM follows
                WHERE follower_id = $1
              ) AS following_count,

              (
                SELECT COUNT(*)
                FROM follows
                WHERE following_id = $1
              ) AS followers_count
          `,
          [req.user.id]
        );

      return success(
        res,
        {
          statistics
        }
      );
    } catch (error) {
      console.error(
        '[ACCOUNT STATISTICS]',
        error
      );

      return failure(
        res,
        500,
        'ACCOUNT_STATISTICS_FAILED',
        'تعذر تحميل إحصائيات الحساب.'
      );
    }
  }
);

/*
============================================================
 نهاية الجزء 7 من 12
============================================================
*//*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 8 من 12
============================================================
*/

/*
============================================================
 99. نظام المتجر
============================================================
*/

app.get(
  '/api/store/items',
  authenticate,
  async (req, res) => {
    try {
      const items =
        await database.queryRows(
          `
            SELECT
              *
            FROM store_items
            WHERE
              COALESCE(is_active, TRUE) = TRUE
            ORDER BY
              created_at DESC
          `
        );

      return success(
        res,
        {
          items
        }
      );
    } catch (error) {
      console.error(
        '[STORE ITEMS]',
        error
      );

      return failure(
        res,
        500,
        'STORE_ITEMS_FAILED',
        'تعذر تحميل المتجر.'
      );
    }
  }
);

/*
============================================================
 100. شراء عنصر من المتجر
============================================================
*/

app.post(
  '/api/store/purchase',
  authenticate,
  async (req, res) => {
    try {
      const itemId =
        requireString(
          req.body.itemId,
          'itemId',
          1,
          100
        );

      const result =
        await database.transaction(
          async (client) => {
            const itemResult =
              await client.query(
                `
                  SELECT
                    *
                  FROM store_items
                  WHERE
                    id = $1
                    AND COALESCE(
                      is_active,
                      TRUE
                    ) = TRUE
                  FOR UPDATE
                `,
                [itemId]
              );

            const item =
              itemResult.rows[0];

            if (!item) {
              throw new AppError(
                404,
                'ITEM_NOT_FOUND',
                'العنصر غير موجود أو غير متاح.'
              );
            }

            const coinColumn =
              Object.prototype.hasOwnProperty.call(
                item,
                'price_coins'
              )
                ? 'price_coins'
                : 'price';

            const price =
              Number(
                item[coinColumn]
              );

            if (
              !Number.isFinite(price) ||
              price < 0
            ) {
              throw new AppError(
                500,
                'INVALID_ITEM_PRICE',
                'سعر العنصر غير صالح.'
              );
            }

            const balanceResult =
              await client.query(
                `
                  SELECT
                    *
                  FROM user_balances
                  WHERE user_id = $1
                  FOR UPDATE
                `,
                [req.user.id]
              );

            const balance =
              balanceResult.rows[0];

            if (!balance) {
              throw new AppError(
                400,
                'BALANCE_NOT_FOUND',
                'لا يوجد رصيد حقيقي لهذا الحساب.'
              );
            }

            const currentCoins =
              Number(
                balance.coins || 0
              );

            if (
              currentCoins < price
            ) {
              throw new AppError(
                400,
                'INSUFFICIENT_COINS',
                'رصيد الكوينز غير كافٍ.'
              );
            }

            const newBalance =
              currentCoins - price;

            await client.query(
              `
                UPDATE user_balances
                SET coins = $1
                WHERE user_id = $2
              `,
              [
                newBalance,
                req.user.id
              ]
            );

            const purchaseResult =
              await client.query(
                `
                  INSERT INTO purchases (
                    user_id,
                    item_id,
                    price_coins
                  )
                  VALUES (
                    $1,
                    $2,
                    $3
                  )
                  RETURNING *
                `,
                [
                  req.user.id,
                  itemId,
                  price
                ]
              );

            return {
              item,
              purchase:
                purchaseResult.rows[0],

              remainingCoins:
                newBalance
            };
          }
        );

      return success(
        res,
        result,
        201
      );
    } catch (error) {
      if (
        error instanceof AppError
      ) {
        return failure(
          res,
          error.status,
          error.code,
          error.message
        );
      }

      console.error(
        '[STORE PURCHASE]',
        error
      );

      return failure(
        res,
        500,
        'STORE_PURCHASE_FAILED',
        'تعذر تنفيذ عملية الشراء.'
      );
    }
  }
);

/*
============================================================
 101. رصيد المستخدم
============================================================
*/

app.get(
  '/api/wallet',
  authenticate,
  async (req, res) => {
    try {
      const balance =
        await database.queryOne(
          `
            SELECT
              *
            FROM user_balances
            WHERE user_id = $1
            LIMIT 1
          `,
          [req.user.id]
        );

      if (!balance) {
        return success(
          res,
          {
            balance:
              null
          }
        );
      }

      return success(
        res,
        {
          balance
        }
      );
    } catch (error) {
      console.error(
        '[WALLET]',
        error
      );

      return failure(
        res,
        500,
        'WALLET_FAILED',
        'تعذر تحميل الرصيد.'
      );
    }
  }
);

/*
============================================================
 102. إرسال الكوينز
============================================================
*/

app.post(
  '/api/wallet/transfer',
  authenticate,
  async (req, res) => {
    try {
      const receiverId =
        requireString(
          req.body.receiverId,
          'receiverId',
          1,
          100
        );

      const amount =
        parsePositiveInteger(
          req.body.amount,
          1,
          1000000000
        );

      if (
        String(receiverId) ===
        String(req.user.id)
      ) {
        return failure(
          res,
          400,
          'SELF_TRANSFER',
          'لا يمكنك إرسال الكوينز إلى نفسك.'
        );
      }

      const transfer =
        await database.transaction(
          async (client) => {
            const receiverResult =
              await client.query(
                `
                  SELECT
                    id,
                    username,
                    is_active
                  FROM users
                  WHERE id = $1
                  LIMIT 1
                `,
                [receiverId]
              );

            const receiver =
              receiverResult.rows[0];

            if (!receiver) {
              throw new AppError(
                404,
                'USER_NOT_FOUND',
                'المستخدم المستلم غير موجود.'
              );
            }

            if (
              receiver.is_active === false
            ) {
              throw new AppError(
                403,
                'USER_DISABLED',
                'الحساب المستلم غير نشط.'
              );
            }

            const senderBalanceResult =
              await client.query(
                `
                  SELECT
                    *
                  FROM user_balances
                  WHERE user_id = $1
                  FOR UPDATE
                `,
                [req.user.id]
              );

            const senderBalance =
              senderBalanceResult.rows[0];

            if (!senderBalance) {
              throw new AppError(
                400,
                'SENDER_BALANCE_NOT_FOUND',
                'لا يوجد رصيد حقيقي لحسابك.'
              );
            }

            const senderCoins =
              Number(
                senderBalance.coins || 0
              );

            if (
              senderCoins < amount
            ) {
              throw new AppError(
                400,
                'INSUFFICIENT_COINS',
                'رصيد الكوينز غير كافٍ.'
              );
            }

            const receiverBalanceResult =
              await client.query(
                `
                  SELECT
                    *
                  FROM user_balances
                  WHERE user_id = $1
                  FOR UPDATE
                `,
                [receiverId]
              );

            const receiverBalance =
              receiverBalanceResult.rows[0];

            if (!receiverBalance) {
              throw new AppError(
                400,
                'RECEIVER_BALANCE_NOT_FOUND',
                'المستخدم المستلم لا يملك محفظة فعلية.'
              );
            }

            const newSenderCoins =
              senderCoins - amount;

            const receiverCoins =
              Number(
                receiverBalance.coins || 0
              );

            const newReceiverCoins =
              receiverCoins + amount;

            await client.query(
              `
                UPDATE user_balances
                SET coins = $1
                WHERE user_id = $2
              `,
              [
                newSenderCoins,
                req.user.id
              ]
            );

            await client.query(
              `
                UPDATE user_balances
                SET coins = $1
                WHERE user_id = $2
              `,
              [
                newReceiverCoins,
                receiverId
              ]
            );

            const transactionResult =
              await client.query(
                `
                  INSERT INTO coin_transactions (
                    sender_id,
                    receiver_id,
                    amount,
                    type
                  )
                  VALUES (
                    $1,
                    $2,
                    $3,
                    'transfer'
                  )
                  RETURNING *
                `,
                [
                  req.user.id,
                  receiverId,
                  amount
                ]
              );

            return {
              transaction:
                transactionResult.rows[0],

              remainingCoins:
                newSenderCoins,

              receiver:
                {
                  id:
                    receiver.id,

                  username:
                    receiver.username
                }
            };
          }
        );

      await createNotification({
        userId:
          receiverId,

        type:
          'coin_transfer',

        title:
          'تحويل كوينز',

        message:
          `تم تحويل ${amount} كوينز إلى حسابك.`,

        data: {
          amount
        }
      });

      return success(
        res,
        transfer,
        201
      );
    } catch (error) {
      if (
        error instanceof AppError
      ) {
        return failure(
          res,
          error.status,
          error.code,
          error.message
        );
      }

      console.error(
        '[COIN TRANSFER]',
        error
      );

      return failure(
        res,
        500,
        'COIN_TRANSFER_FAILED',
        'تعذر تحويل الكوينز.'
      );
    }
  }
);

/*
============================================================
 103. سجل معاملات الكوينز
============================================================
*/

app.get(
  '/api/wallet/transactions',
  authenticate,
  async (req, res) => {
    try {
      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const transactions =
        await database.queryRows(
          `
            SELECT
              ct.*,

              sender.username
                AS sender_username,

              receiver.username
                AS receiver_username

            FROM coin_transactions ct

            LEFT JOIN users sender
              ON sender.id =
                ct.sender_id

            LEFT JOIN users receiver
              ON receiver.id =
                ct.receiver_id

            WHERE
              ct.sender_id = $1
              OR ct.receiver_id = $1

            ORDER BY
              ct.created_at DESC

            LIMIT $2
          `,
          [
            req.user.id,
            limit
          ]
        );

      return success(
        res,
        {
          transactions
        }
      );
    } catch (error) {
      console.error(
        '[COIN TRANSACTIONS]',
        error
      );

      return failure(
        res,
        500,
        'COIN_TRANSACTIONS_FAILED',
        'تعذر تحميل معاملات الكوينز.'
      );
    }
  }
);

/*
============================================================
 104. الهدايا المتاحة
============================================================
*/

app.get(
  '/api/gifts',
  authenticate,
  async (req, res) => {
    try {
      const gifts =
        await database.queryRows(
          `
            SELECT
              *
            FROM gifts
            WHERE
              COALESCE(
                is_active,
                TRUE
              ) = TRUE
            ORDER BY
              price_coins ASC,
              created_at ASC
          `
        );

      return success(
        res,
        {
          gifts
        }
      );
    } catch (error) {
      console.error(
        '[GIFTS]',
        error
      );

      return failure(
        res,
        500,
        'GIFTS_LOAD_FAILED',
        'تعذر تحميل الهدايا.'
      );
    }
  }
);

/*
============================================================
 105. إرسال هدية
============================================================
*/

app.post(
  '/api/gifts/send',
  authenticate,
  async (req, res) => {
    try {
      const receiverId =
        requireString(
          req.body.receiverId,
          'receiverId',
          1,
          100
        );

      const giftId =
        requireString(
          req.body.giftId,
          'giftId',
          1,
          100
        );

      const quantity =
        parsePositiveInteger(
          req.body.quantity,
          1,
          100
        );

      if (
        String(receiverId) ===
        String(req.user.id)
      ) {
        return failure(
          res,
          400,
          'SELF_GIFT',
          'لا يمكنك إرسال هدية إلى نفسك.'
        );
      }

      const result =
        await database.transaction(
          async (client) => {
            const giftResult =
              await client.query(
                `
                  SELECT
                    *
                  FROM gifts
                  WHERE
                    id = $1
                    AND COALESCE(
                      is_active,
                      TRUE
                    ) = TRUE
                  FOR UPDATE
                `,
                [giftId]
              );

            const gift =
              giftResult.rows[0];

            if (!gift) {
              throw new AppError(
                404,
                'GIFT_NOT_FOUND',
                'الهدية غير موجودة أو غير متاحة.'
              );
            }

            const receiverResult =
              await client.query(
                `
                  SELECT
                    id,
                    username,
                    is_active
                  FROM users
                  WHERE id = $1
                  LIMIT 1
                `,
                [receiverId]
              );

            const receiver =
              receiverResult.rows[0];

            if (!receiver) {
              throw new AppError(
                404,
                'USER_NOT_FOUND',
                'المستخدم المستلم غير موجود.'
              );
            }

            if (
              receiver.is_active === false
            ) {
              throw new AppError(
                403,
                'USER_DISABLED',
                'الحساب المستلم غير نشط.'
              );
            }

            const price =
              Number(
                gift.price_coins
              );

            if (
              !Number.isFinite(price) ||
              price < 0
            ) {
              throw new AppError(
                500,
                'INVALID_GIFT_PRICE',
                'سعر الهدية غير صالح.'
              );
            }

            const total =
              price * quantity;

            const balanceResult =
              await client.query(
                `
                  SELECT
                    *
                  FROM user_balances
                  WHERE user_id = $1
                  FOR UPDATE
                `,
                [req.user.id]
              );

            const balance =
              balanceResult.rows[0];

            if (!balance) {
              throw new AppError(
                400,
                'BALANCE_NOT_FOUND',
                'لا يوجد رصيد حقيقي لهذا الحساب.'
              );
            }

            const coins =
              Number(
                balance.coins || 0
              );

            if (
              coins < total
            ) {
              throw new AppError(
                400,
                'INSUFFICIENT_COINS',
                'رصيد الكوينز غير كافٍ لإرسال الهدية.'
              );
            }

            const remaining =
              coins - total;

            await client.query(
              `
                UPDATE user_balances
                SET coins = $1
                WHERE user_id = $2
              `,
              [
                remaining,
                req.user.id
              ]
            );

            const giftTransaction =
              await client.query(
                `
                  INSERT INTO gift_transactions (
                    sender_id,
                    receiver_id,
                    gift_id,
                    quantity,
                    total_coins
                  )
                  VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                  )
                  RETURNING *
                `,
                [
                  req.user.id,
                  receiverId,
                  giftId,
                  quantity,
                  total
                ]
              );

            return {
              gift:
                gift,

              receiver:
                {
                  id:
                    receiver.id,

                  username:
                    receiver.username
                },

              transaction:
                giftTransaction.rows[0],

              remainingCoins:
                remaining
            };
          }
        );

      await createNotification({
        userId:
          receiverId,

        type:
          'gift_received',

        title:
          'هدية جديدة',

        message:
          `استلمت هدية جديدة من ${req.user.username}.`,

        data: {
          giftId,
          quantity
        }
      });

      io.to(
        `user:${receiverId}`
      ).emit(
        'gift:received',
        {
          senderId:
            req.user.id,

          senderUsername:
            req.user.username,

          receiverId,

          giftId,

          quantity
        }
      );

      r/*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 9 من 12
============================================================
*/

/*
============================================================
 108. المنشورات
============================================================
*/

app.get(
  '/api/posts',
  authenticate,
  async (req, res) => {
    try {
      const limit =
        parsePositiveInteger(
          req.query.limit,
          20,
          50
        );

      const offset =
        parseNonNegativeInteger(
          req.query.offset,
          0
        );

      const posts =
        await database.queryRows(
          `
            SELECT
              p.*,

              u.username,

              u.role,

              u.is_verified,

              pr.display_name,

              pr.avatar_url

            FROM posts p

            INNER JOIN users u
              ON u.id = p.user_id

            LEFT JOIN profiles pr
              ON pr.user_id = u.id

            WHERE
              u.is_active = TRUE

            ORDER BY
              p.created_at DESC

            LIMIT $1
            OFFSET $2
          `,
          [
            limit,
            offset
          ]
        );

      return success(
        res,
        {
          posts
        }
      );

    } catch (error) {
      console.error(
        '[POSTS LIST]',
        error
      );

      return failure(
        res,
        500,
        'POSTS_LOAD_FAILED',
        'تعذر تحميل المنشورات.'
      );
    }
  }
);

/*
============================================================
 109. إنشاء منشور
============================================================
*/

app.post(
  '/api/posts',
  authenticate,
  async (req, res) => {
    try {
      const content =
        requireString(
          req.body.content,
          'content',
          1,
          10000
        );

      const mediaUrl =
        req.body.mediaUrl
          ? requireString(
              req.body.mediaUrl,
              'mediaUrl',
              1,
              2000
            )
          : null;

      const post =
        await database.insert(
          'posts',
          {
            user_id:
              req.user.id,

            content,

            media_url:
              mediaUrl
          }
        );

      return success(
        res,
        {
          post
        },
        201
      );

    } catch (error) {
      console.error(
        '[POST CREATE]',
        error
      );

      return failure(
        res,
        500,
        'POST_CREATE_FAILED',
        'تعذر إنشاء المنشور.'
      );
    }
  }
);

/*
============================================================
 110. منشور واحد
============================================================
*/

app.get(
  '/api/posts/:postId',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const post =
        await database.queryOne(
          `
            SELECT
              p.*,

              u.username,

              u.role,

              u.is_verified,

              pr.display_name,

              pr.avatar_url

            FROM posts p

            INNER JOIN users u
              ON u.id = p.user_id

            LEFT JOIN profiles pr
              ON pr.user_id = u.id

            WHERE
              p.id = $1

            LIMIT 1
          `,
          [postId]
        );

      if (!post) {
        return failure(
          res,
          404,
          'POST_NOT_FOUND',
          'المنشور غير موجود.'
        );
      }

      return success(
        res,
        {
          post
        }
      );

    } catch (error) {
      console.error(
        '[POST GET]',
        error
      );

      return failure(
        res,
        500,
        'POST_LOAD_FAILED',
        'تعذر تحميل المنشور.'
      );
    }
  }
);

/*
============================================================
 111. تعديل منشور
============================================================
*/

app.patch(
  '/api/posts/:postId',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const content =
        requireString(
          req.body.content,
          'content',
          1,
          10000
        );

      const post =
        await database.queryOne(
          `
            SELECT
              id,
              user_id
            FROM posts
            WHERE id = $1
            LIMIT 1
          `,
          [postId]
        );

      if (!post) {
        return failure(
          res,
          404,
          'POST_NOT_FOUND',
          'المنشور غير موجود.'
        );
      }

      const isOwner =
        String(
          post.user_id
        ) ===
        String(
          req.user.id
        );

      const isModerator =
        [
          'owner',
          'admin',
          'moderator'
        ].includes(
          String(
            req.user.role
          ).toLowerCase()
        );

      if (
        !isOwner &&
        !isModerator
      ) {
        return failure(
          res,
          403,
          'FORBIDDEN',
          'ليس لديك صلاحية تعديل هذا المنشور.'
        );
      }

      const updated =
        await database.queryOne(
          `
            UPDATE posts
            SET
              content = $1,
              updated_at = NOW()
            WHERE id = $2
            RETURNING *
          `,
          [
            content,
            postId
          ]
        );

      return success(
        res,
        {
          post:
            updated
        }
      );

    } catch (error) {
      console.error(
        '[POST UPDATE]',
        error
      );

      return failure(
        res,
        500,
        'POST_UPDATE_FAILED',
        'تعذر تعديل المنشور.'
      );
    }
  }
);

/*
============================================================
 112. حذف منشور
============================================================
*/

app.delete(
  '/api/posts/:postId',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const post =
        await database.queryOne(
          `
            SELECT
              id,
              user_id
            FROM posts
            WHERE id = $1
            LIMIT 1
          `,
          [postId]
        );

      if (!post) {
        return failure(
          res,
          404,
          'POST_NOT_FOUND',
          'المنشور غير موجود.'
        );
      }

      const isOwner =
        String(
          post.user_id
        ) ===
        String(
          req.user.id
        );

      const isModerator =
        [
          'owner',
          'admin',
          'moderator'
        ].includes(
          String(
            req.user.role
          ).toLowerCase()
        );

      if (
        !isOwner &&
        !isModerator
      ) {
        return failure(
          res,
          403,
          'FORBIDDEN',
          'ليس لديك صلاحية حذف هذا المنشور.'
        );
      }

      await database.query(
        `
          DELETE FROM posts
          WHERE id = $1
        `,
        [postId]
      );

      await writeAuditLog({
        userId:
          req.user.id,

        action:
          'post_deleted',

        entityType:
          'post',

        entityId:
          postId,

        metadata: {
          moderator:
            isModerator
        },

        ipAddress:
          getClientIp(req),

        userAgent:
          req.get(
            'User-Agent'
          )
      });

      return success(
        res,
        {
          deleted:
            true
        }
      );

    } catch (error) {
      console.error(
        '[POST DELETE]',
        error
      );

      return failure(
        res,
        500,
        'POST_DELETE_FAILED',
        'تعذر حذف المنشور.'
      );
    }
  }
);

/*
============================================================
 113. الإعجاب بمنشور
============================================================
*/

app.post(
  '/api/posts/:postId/like',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const post =
        await database.queryOne(
          `
            SELECT
              id,
              user_id
            FROM posts
            WHERE id = $1
            LIMIT 1
          `,
          [postId]
        );

      if (!post) {
        return failure(
          res,
          404,
          'POST_NOT_FOUND',
          'المنشور غير موجود.'
        );
      }

      const existing =
        await database.queryOne(
          `
            SELECT
              id
            FROM likes
            WHERE
              user_id = $1
              AND post_id = $2
            LIMIT 1
          `,
          [
            req.user.id,
            postId
          ]
        );

      if (existing) {
        return success(
          res,
          {
            liked:
              true,

            alreadyLiked:
              true
          }
        );
      }

      await database.insert(
        'likes',
        {
          user_id:
            req.user.id,

          post_id:
            postId
        }
      );

      if (
        String(post.user_id) !==
        String(req.user.id)
      ) {
        await createNotification({
          userId:
            post.user_id,

          type:
            'post_like',

          title:
            'إعجاب جديد',

          message:
            `${req.user.username} أعجب بمنشورك.`,

          data: {
            postId
          }
        });
      }

      return success(
        res,
        {
          liked:
            true
        },
        201
      );

    } catch (error) {
      console.error(
        '[POST LIKE]',
        error
      );

      return failure(
        res,
        500,
        'POST_LIKE_FAILED',
        'تعذر تسجيل الإعجاب.'
      );
    }
  }
);

/*
============================================================
 114. إزالة الإعجاب
============================================================
*/

app.delete(
  '/api/posts/:postId/like',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const result =
        await database.query(
          `
            DELETE FROM likes
            WHERE
              user_id = $1
              AND post_id = $2
          `,
          [
            req.user.id,
            postId
          ]
        );

      return success(
        res,
        {
          liked:
            false,

          removed:
            result.rowCount > 0
        }
      );

    } catch (error) {
      console.error(
        '[POST UNLIKE]',
        error
      );

      return failure(
        res,
        500,
        'POST_UNLIKE_FAILED',
        'تعذر إزالة الإعجاب.'
      );
    }
  }
);

/*
============================================================
 115. التعليقات
============================================================
*/

app.get(
  '/api/posts/:postId/comments',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const comments =
        await database.queryRows(
          `
            SELECT
              c.*,

              u.username,

              u.role,

              pr.display_name,

              pr.avatar_url

            FROM comments c

            INNER JOIN users u
              ON u.id = c.user_id

            LEFT JOIN profiles pr
              ON pr.user_id = u.id

            WHERE
              c.post_id = $1
              AND u.is_active = TRUE

            ORDER BY
              c.created_at ASC

            LIMIT $2
          `,
          [
            postId,
            limit
          ]
        );

      return success(
        res,
        {
          comments
        }
      );

    } catch (error) {
      console.error(
        '[COMMENTS]',
        error
      );

      return failure(
        res,
        500,
        'COMMENTS_LOAD_FAILED',
        'تعذر تحميل التعليقات.'
      );
    }
  }
);

/*
============================================================
 116. إضافة تعليق
============================================================
*/

app.post(
  '/api/posts/:postId/comments',
  authenticate,
  async (req, res) => {
    try {
      const postId =
        requireString(
          req.params.postId,
          'postId',
          1,
          100
        );

      const content =
        requireString(
          req.body.content,
          'content',
          1,
          3000
        );

      const post =
        await database.queryOne(
          `
            SELECT
              id,
              user_id
            FROM posts
            WHERE id = $1
            LIMIT 1
          `,
          [postId]
        );

      if (!post) {
        return failure(
          res,
          404,
          'POST_NOT_FOUND',
          'المنشور غير موجود.'
        );
      }

      const comment =
        await database.insert(
          'comments',
          {
            post_id:
              postId,

            user_id:
              req.user.id,

            content
          }
        );

      if (
        String(post.user_id) !==
        String(req.user.id)
      ) {
        await createNotification({
          userId:
            post.user_id,

          type:
            'post_comment',

          title:
            'تعليق جديد',

          message:
            `${req.user.username} علّق على منشورك.`,

          data: {
            postId,
            commentId:
              comment.id
          }
        });
      }

      return success(
        res,
        {
          comment
        },
        201
      );

    } catch (error) {
      console.error(
        '[COMMENT CREATE]',
        error
      );

      return failure(
        res,
        500,
        'COMMENT_CREATE_FAILED',
        'تعذر إضافة التعليق.'
      );
    }
  }
);

/*
============================================================
 117. حذف تعليق
============================================================
*/

app.delete(
  '/api/comments/:commentId',
  authenticate,
  async (req, res) => {
    try {
      const commentId =
        requireString(
          req.params.commentId,
          'commentId',
          1,
          100
        );

      const comment =
        await database.queryOne(
          `
            SELECT
              id,
              user_id
            FROM comments
            WHERE id = $1
            LIMIT 1
          `,
          [commentId]
        );

      if (!comment) {
        return failure(
          res,
          404,
          'COMMENT_NOT_FOUND',
          'التعليق غير موجود.'
        );
      }

      const isOwner =
        String(
          comment.user_id
        ) ===
        String(
          req.user.id
        );

      const isModerator =
        [
          'owner',
          'admin',
          'moderator'
        ].includes(
          String(
            req.user.role
          ).toLowerCase()
        );

      if (
        !isOwner &&
        !isModerator
      ) {
        return failure(
          res,
          403,
          'FORBIDDEN',
          'ليس لديك صلاحية حذف هذا التعليق.'
        );
      }

      await database.query(
        `
          DELETE FROM comments
          WHERE id = $1
        `,
        [commentId]
      );

      return success(
        res,
        {
          deleted:
            true
        }
      );

    } catch (error) {
      console.error(
        '[COMMENT DELETE]',
        error
      );

      return failure(
        res,
        500,
        'COMMENT_DELETE_FAILED',
        'تعذر حذف التعليق.'
      );
    }
  }
);

/*
============================================================
 نهاية الجزء 9 من 12
============================================================
*//*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 10 من 12
============================================================
*/

/*
============================================================
 118. الإشعارات
============================================================
*/

app.get(
  '/api/notifications',
  authenticate,
  async (req, res) => {
    try {
      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const notifications =
        await database.queryRows(
          `
            SELECT
              *
            FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
          `,
          [
            req.user.id,
            limit
          ]
        );

      return success(
        res,
        {
          notifications
        }
      );
    } catch (error) {
      console.error(
        '[NOTIFICATIONS]',
        error
      );

      return failure(
        res,
        500,
        'NOTIFICATIONS_LOAD_FAILED',
        'تعذر تحميل الإشعارات.'
      );
    }
  }
);

/*
============================================================
 119. عدد الإشعارات غير المقروءة
============================================================
*/

app.get(
  '/api/notifications/unread-count',
  authenticate,
  async (req, res) => {
    try {
      const result =
        await database.queryOne(
          `
            SELECT
              COUNT(*)::INTEGER AS count
            FROM notifications
            WHERE
              user_id = $1
              AND COALESCE(
                is_read,
                FALSE
              ) = FALSE
          `,
          [req.user.id]
        );

      return success(
        res,
        {
          count:
            Number(
              result?.count || 0
            )
        }
      );
    } catch (error) {
      console.error(
        '[NOTIFICATIONS COUNT]',
        error
      );

      return failure(
        res,
        500,
        'NOTIFICATIONS_COUNT_FAILED',
        'تعذر تحميل عدد الإشعارات.'
      );
    }
  }
);

/*
============================================================
 120. تعليم إشعار كمقروء
============================================================
*/

app.patch(
  '/api/notifications/:notificationId/read',
  authenticate,
  async (req, res) => {
    try {
      const notificationId =
        requireString(
          req.params.notificationId,
          'notificationId',
          1,
          100
        );

      const notification =
        await database.queryOne(
          `
            UPDATE notifications
            SET
              is_read = TRUE,
              read_at = COALESCE(
                read_at,
                NOW()
              )
            WHERE
              id = $1
              AND user_id = $2
            RETURNING *
          `,
          [
            notificationId,
            req.user.id
          ]
        );

      if (!notification) {
        return failure(
          res,
          404,
          'NOTIFICATION_NOT_FOUND',
          'الإشعار غير موجود.'
        );
      }

      return success(
        res,
        {
          notification
        }
      );
    } catch (error) {
      console.error(
        '[NOTIFICATION READ]',
        error
      );

      return failure(
        res,
        500,
        'NOTIFICATION_READ_FAILED',
        'تعذر تحديث الإشعار.'
      );
    }
  }
);

/*
============================================================
 121. تعليم جميع الإشعارات كمقروءة
============================================================
*/

app.patch(
  '/api/notifications/read-all',
  authenticate,
  async (req, res) => {
    try {
      const result =
        await database.query(
          `
            UPDATE notifications
            SET
              is_read = TRUE,
              read_at = COALESCE(
                read_at,
                NOW()
              )
            WHERE
              user_id = $1
              AND COALESCE(
                is_read,
                FALSE
              ) = FALSE
          `,
          [req.user.id]
        );

      return success(
        res,
        {
          updated:
            result.rowCount
        }
      );
    } catch (error) {
      console.error(
        '[NOTIFICATIONS READ ALL]',
        error
      );

      return failure(
        res,
        500,
        'NOTIFICATIONS_READ_ALL_FAILED',
        'تعذر تحديث الإشعارات.'
      );
    }
  }
);

/*
============================================================
 122. حذف إشعار
============================================================
*/

app.delete(
  '/api/notifications/:notificationId',
  authenticate,
  async (req, res) => {
    try {
      const notificationId =
        requireString(
          req.params.notificationId,
          'notificationId',
          1,
          100
        );

      const result =
        await database.query(
          `
            DELETE FROM notifications
            WHERE
              id = $1
              AND user_id = $2
          `,
          [
            notificationId,
            req.user.id
          ]
        );

      return success(
        res,
        {
          deleted:
            result.rowCount > 0
        }
      );
    } catch (error) {
      console.error(
        '[NOTIFICATION DELETE]',
        error
      );

      return failure(
        res,
        500,
        'NOTIFICATION_DELETE_FAILED',
        'تعذر حذف الإشعار.'
      );
    }
  }
);

/*
============================================================
 123. البحث عن المستخدمين
============================================================
*/

app.get(
  '/api/users/search',
  authenticate,
  async (req, res) => {
    try {
      const search =
        requireString(
          req.query.q,
          'q',
          2,
          100
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          20,
          50
        );

      const users =
        await database.queryRows(
          `
            SELECT
              u.id,
              u.username,
              u.role,
              u.is_verified,

              p.display_name,
              p.avatar_url,
              p.bio

            FROM users u

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              u.is_active = TRUE

              AND (
                u.username ILIKE
                  '%' || $1 || '%'

                OR p.display_name ILIKE
                  '%' || $1 || '%'
              )

            ORDER BY
              CASE
                WHEN
                  u.username ILIKE $1
                THEN 0
                ELSE 1
              END,

              u.created_at DESC

            LIMIT $2
          `,
          [
            search,
            limit
          ]
        );

      return success(
        res,
        {
          users
        }
      );
    } catch (error) {
      console.error(
        '[USER SEARCH]',
        error
      );

      return failure(
        res,
        500,
        'USER_SEARCH_FAILED',
        'تعذر البحث عن المستخدمين.'
      );
    }
  }
);

/*
============================================================
 124. الملف الشخصي
============================================================
*/

app.get(
  '/api/profile',
  authenticate,
  async (req, res) => {
    try {
      const profile =
        await database.queryOne(
          `
            SELECT
              u.id,
              u.username,
              u.email,
              u.role,
              u.is_verified,
              u.is_active,
              u.created_at,

              p.display_name,
              p.avatar_url,
              p.cover_url,
              p.bio,
              p.gender,
              p.birth_date,
              p.country,
              p.city,
              p.website

            FROM users u

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              u.id = $1

            LIMIT 1
          `,
          [req.user.id]
        );

      if (!profile) {
        return failure(
          res,
          404,
          'PROFILE_NOT_FOUND',
          'الملف الشخصي غير موجود.'
        );
      }

      return success(
        res,
        {
          profile
        }
      );
    } catch (error) {
      console.error(
        '[PROFILE]',
        error
      );

      return failure(
        res,
        500,
        'PROFILE_LOAD_FAILED',
        'تعذر تحميل الملف الشخصي.'
      );
    }
  }
);

/*
============================================================
 125. تعديل الملف الشخصي
============================================================
*/

app.patch(
  '/api/profile',
  authenticate,
  async (req, res) => {
    try {
      const allowedFields = {
        display_name:
          req.body.displayName,

        avatar_url:
          req.body.avatarUrl,

        cover_url:
          req.body.coverUrl,

        bio:
          req.body.bio,

        gender:
          req.body.gender,

        birth_date:
          req.body.birthDate,

        country:
          req.body.country,

        city:
          req.body.city,

        website:
          req.body.website
      };

      const updates = {};

      for (
        const [
          key,
          value
        ]
        of Object.entries(
          allowedFields
        )
      ) {
        if (
          value !== undefined
        ) {
          updates[key] =
            value === null
              ? null
              : String(
                  value
                ).trim();
        }
      }

      if (
        Object.keys(
          updates
        ).length === 0
      ) {
        return failure(
          res,
          400,
          'NO_PROFILE_CHANGES',
          'لم يتم إرسال أي تغييرات.'
        );
      }

      const profile =
        await database.update(
          'profiles',
          updates,
          {
            user_id:
              req.user.id
          }
        );

      return success(
        res,
        {
          profile
        }
      );
    } catch (error) {
      console.error(
        '[PROFILE UPDATE]',
        error
      );

      return failure(
        res,
        500,
        'PROFILE_UPDATE_FAILED',
        'تعذر تحديث الملف الشخصي.'
      );
    }
  }
);

/*
============================================================
 126. المستخدم العام
============================================================
*/

app.get(
  '/api/users/:userId',
  authenticate,
  async (req, res) => {
    try {
      const userId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const user =
        await database.queryOne(
          `
            SELECT
              u.id,
              u.username,
              u.role,
              u.is_verified,
              u.created_at,

              p.display_name,
              p.avatar_url,
              p.cover_url,
              p.bio,
              p.gender,
              p.country,
              p.city

            FROM users u

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              u.id = $1
              AND u.is_active = TRUE

            LIMIT 1
          `,
          [userId]
        );

      if (!user) {
        return failure(
          res,
          404,
          'USER_NOT_FOUND',
          'المستخدم غير موجود.'
        );
      }

      return success(
        res,
        {
          user
        }
      );
    } catch (error) {
      console.error(
        '[PUBLIC USER]',
        error
      );

      return failure(
        res,
        500,
        'USER_LOAD_FAILED',
        'تعذر تحميل بيانات المستخدم.'
      );
    }
  }
);

/*
============================================================
 127. متابعة مستخدم
============================================================
*/

app.post(
  '/api/users/:userId/follow',
  authenticate,
  async (req, res) => {
    try {
      const userId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      if (
        String(userId) ===
        String(req.user.id)
      ) {
        return failure(
          res,
          400,
          'SELF_FOLLOW',
          'لا يمكنك متابعة نفسك.'
        );
      }

      const target =
        await database.queryOne(
          `
            SELECT
              id,
              username
            FROM users
            WHERE
              id = $1
              AND is_active = TRUE
            LIMIT 1
          `,
          [userId]
        );

      if (!target) {
        return failure(
          res,
          404,
          'USER_NOT_FOUND',
          'المستخدم غير موجود.'
        );
      }

      const existing =
        await database.queryOne(
          `
            SELECT
              id
            FROM follows
            WHERE
              follower_id = $1
              AND following_id = $2
            LIMIT 1
          `,
          [
            req.user.id,
            userId
          ]
        );

      if (existing) {
        return success(
          res,
          {
            following:
              true,

            alreadyFollowing:
              true
          }
        );
      }

      const follow =
        await database.insert(
          'follows',
          {
            follower_id:
              req.user.id,

            following_id:
              userId
          }
        );

      await createNotification({
        userId,

        type:
          'new_follower',

        title:
          'متابع جديد',

        message:
          `${req.user.username} بدأ بمتابعتك.`,

        data: {
          followerId:
            req.user.id
        }
      });

      return success(
        res,
        {
          following:
            true,

          follow
        },
        201
      );
    } catch (error) {
      console.error(
        '[FOLLOW]',
        error
      );

      return failure(
        res,
        500,
        'FOLLOW_FAILED',
        'تعذر متابعة المستخدم.'
      );
    }
  }
);

/*
============================================================
 128. إلغاء المتابعة
============================================================
*/

app.delete(
  '/api/users/:userId/follow',
  authenticate,
  async (req, res) => {
    try {
      const userId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const result =
        await database.query(
          `
            DELETE FROM follows
            WHERE
              follower_id = $1
              AND following_id = $2
          `,
          [
            req.user.id,
            userId
          ]
        );

      return success(
        res,
        {
          following:
            false,

          removed:
            result.rowCount > 0
        }
      );
    } catch (error) {
      console.error(
        '[UNFOLLOW]',
        error
      );

      return failure(
        res,
        500,
        'UNFOLLOW_FAILED',
        'تعذر إلغاء المتابعة.'
      );
    }
  }
);

/*
============================================================
 129. المتابعون
============================================================
*/

app.get(
  '/api/users/:userId/followers',
  authenticate,
  async (req, res) => {
    try {
      const userId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const followers =
        await database.queryRows(
          `
            SELECT
              u.id,
              u.username,
              u.role,
              u.is_verified,

              p.display_name,
              p.avatar_url

            FROM follows f

            INNER JOIN users u
              ON u.id = f.follower_id

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              f.following_id = $1
              AND u.is_active = TRUE

            ORDER BY
              f.created_at DESC
          `,
          [userId]
        );

      return success(
        res,
        {
          followers
        }
      );
    } catch (error) {
      console.error(
        '[FOLLOWERS]',
        error
      );

      return failure(
        res,
        500,
        'FOLLOWERS_FAILED',
        'تعذر تحميل المتابعين.'
      );
    }
  }
);

/*
============================================================
 130. الذين يتابعهم المستخدم
============================================================
*/

app.get(
  '/api/users/:userId/following',
  authenticate,
  async (req, res) => {
    try {
      const userId =
        requireString(
          req.params.userId,
          'userId',
          1,
          100
        );

      const following =
        await database.queryRows(
          `
            SELECT
              u.id,
              u.username,
              u.role,
              u.is_verified,

              p.display_name,
              p.avatar_url

            FROM follows f

            INNER JOIN users u
              ON u.id = f.following_id

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              f.follower_id = $1
              AND u.is_active = TRUE

            ORDER BY
              f.created_at DESC
          `,
          [userId]
        );

      return success(
        res,
        {
          following
        }
      );
    } catch (error) {
      console.error(
        '[FOLLOWING]',
        error
      );

      return failure(
        res,
        500,
        'FOLLOWING_FAILED',
        'تعذر تحميل قائمة المتابَعة.'
      );
    }
  }
);

/*
============================================================
 نهاية الجزء 10 من 12
============================================================
*//*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 11 من 12
============================================================
*/

/*
============================================================
 131. الغرف
============================================================
*/

app.get(
  '/api/rooms',
  authenticate,
  async (req, res) => {
    try {
      const rooms =
        await database.queryRows(
          `
            SELECT
              r.*,

              u.username AS owner_username

            FROM rooms r

            LEFT JOIN users u
              ON u.id = r.owner_id

            WHERE
              COALESCE(
                r.is_active,
                TRUE
              ) = TRUE

            ORDER BY
              r.created_at DESC
          `
        );

      return success(
        res,
        {
          rooms
        }
      );
    } catch (error) {
      console.error(
        '[ROOMS]',
        error
      );

      return failure(
        res,
        500,
        'ROOMS_LOAD_FAILED',
        'تعذر تحميل الغرف.'
      );
    }
  }
);

/*
============================================================
 132. غرفة واحدة
============================================================
*/

app.get(
  '/api/rooms/:roomId',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      const room =
        await database.queryOne(
          `
            SELECT
              r.*,

              u.username AS owner_username

            FROM rooms r

            LEFT JOIN users u
              ON u.id = r.owner_id

            WHERE
              r.id = $1
              AND COALESCE(
                r.is_active,
                TRUE
              ) = TRUE

            LIMIT 1
          `,
          [roomId]
        );

      if (!room) {
        return failure(
          res,
          404,
          'ROOM_NOT_FOUND',
          'الغرفة غير موجودة.'
        );
      }

      return success(
        res,
        {
          room
        }
      );
    } catch (error) {
      console.error(
        '[ROOM GET]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_LOAD_FAILED',
        'تعذر تحميل الغرفة.'
      );
    }
  }
);

/*
============================================================
 133. إنشاء غرفة
============================================================
*/

app.post(
  '/api/rooms',
  authenticate,
  async (req, res) => {
    try {
      const name =
        requireString(
          req.body.name,
          'name',
          2,
          120
        );

      const description =
        req.body.description
          ? requireString(
              req.body.description,
              'description',
              1,
              1000
            )
          : null;

      const room =
        await database.insert(
          'rooms',
          {
            name,

            description,

            owner_id:
              req.user.id,

            is_active:
              true
          }
        );

      return success(
        res,
        {
          room
        },
        201
      );
    } catch (error) {
      console.error(
        '[ROOM CREATE]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_CREATE_FAILED',
        'تعذر إنشاء الغرفة.'
      );
    }
  }
);

/*
============================================================
 134. دخول غرفة
============================================================
*/

app.post(
  '/api/rooms/:roomId/join',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      const room =
        await database.queryOne(
          `
            SELECT
              id,
              name,
              is_active
            FROM rooms
            WHERE
              id = $1
            LIMIT 1
          `,
          [roomId]
        );

      if (!room) {
        return failure(
          res,
          404,
          'ROOM_NOT_FOUND',
          'الغرفة غير موجودة.'
        );
      }

      if (
        room.is_active === false
      ) {
        return failure(
          res,
          403,
          'ROOM_DISABLED',
          'الغرفة غير نشطة.'
        );
      }

      const membership =
        await database.queryOne(
          `
            SELECT
              *
            FROM room_members
            WHERE
              room_id = $1
              AND user_id = $2
            LIMIT 1
          `,
          [
            roomId,
            req.user.id
          ]
        );

      if (!membership) {
        await database.insert(
          'room_members',
          {
            room_id:
              roomId,

            user_id:
              req.user.id
          }
        );
      }

      return success(
        res,
        {
          joined:
            true,

          room
        }
      );
    } catch (error) {
      console.error(
        '[ROOM JOIN]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_JOIN_FAILED',
        'تعذر دخول الغرفة.'
      );
    }
  }
);

/*
============================================================
 135. الخروج من غرفة
============================================================
*/

app.post(
  '/api/rooms/:roomId/leave',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      await database.query(
        `
          DELETE FROM room_members
          WHERE
            room_id = $1
            AND user_id = $2
        `,
        [
          roomId,
          req.user.id
        ]
      );

      return success(
        res,
        {
          left:
            true
        }
      );
    } catch (error) {
      console.error(
        '[ROOM LEAVE]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_LEAVE_FAILED',
        'تعذر الخروج من الغرفة.'
      );
    }
  }
);

/*
============================================================
 136. أعضاء الغرفة
============================================================
*/

app.get(
  '/api/rooms/:roomId/members',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      const members =
        await database.queryRows(
          `
            SELECT
              u.id,
              u.username,
              u.role,
              u.is_verified,

              p.display_name,
              p.avatar_url,

              rm.joined_at

            FROM room_members rm

            INNER JOIN users u
              ON u.id = rm.user_id

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              rm.room_id = $1
              AND u.is_active = TRUE

            ORDER BY
              rm.joined_at ASC
          `,
          [roomId]
        );

      return success(
        res,
        {
          members
        }
      );
    } catch (error) {
      console.error(
        '[ROOM MEMBERS]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_MEMBERS_FAILED',
        'تعذر تحميل أعضاء الغرفة.'
      );
    }
  }
);

/*
============================================================
 137. رسائل الغرفة
============================================================
*/

app.get(
  '/api/rooms/:roomId/messages',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const messages =
        await database.queryRows(
          `
            SELECT
              m.*,

              u.username,

              p.display_name,

              p.avatar_url

            FROM messages m

            INNER JOIN users u
              ON u.id = m.user_id

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              m.room_id = $1

            ORDER BY
              m.created_at DESC

            LIMIT $2
          `,
          [
            roomId,
            limit
          ]
        );

      messages.reverse();

      return success(
        res,
        {
          messages
        }
      );
    } catch (error) {
      console.error(
        '[ROOM MESSAGES]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_MESSAGES_FAILED',
        'تعذر تحميل رسائل الغرفة.'
      );
    }
  }
);

/*
============================================================
 138. إرسال رسالة غرفة عبر REST
============================================================
*/

app.post(
  '/api/rooms/:roomId/messages',
  authenticate,
  async (req, res) => {
    try {
      const roomId =
        requireString(
          req.params.roomId,
          'roomId',
          1,
          100
        );

      const content =
        requireString(
          req.body.content,
          'content',
          1,
          5000
        );

      const membership =
        await database.queryOne(
          `
            SELECT
              id
            FROM room_members
            WHERE
              room_id = $1
              AND user_id = $2
            LIMIT 1
          `,
          [
            roomId,
            req.user.id
          ]
        );

      if (!membership) {
        return failure(
          res,
          403,
          'ROOM_MEMBERSHIP_REQUIRED',
          'يجب دخول الغرفة أولاً.'
        );
      }

      const message =
        await database.insert(
          'messages',
          {
            room_id:
              roomId,

            user_id:
              req.user.id,

            content,

            message_type:
              'text'
          }
        );

      io.to(
        `room:${roomId}`
      ).emit(
        'message:new',
        message
      );

      return success(
        res,
        {
          message
        },
        201
      );
    } catch (error) {
      console.error(
        '[ROOM MESSAGE]',
        error
      );

      return failure(
        res,
        500,
        'ROOM_MESSAGE_FAILED',
        'تعذر إرسال الرسالة.'
      );
    }
  }
);

/*
============================================================
 139. المحادثات الخاصة
============================================================
*/

app.get(
  '/api/conversations',
  authenticate,
  async (req, res) => {
    try {
      const conversations =
        await database.queryRows(
          `
            SELECT
              c.*,

              CASE
                WHEN c.user_one_id = $1
                THEN c.user_two_id
                ELSE c.user_one_id
              END AS other_user_id,

              u.username AS other_username,

              p.display_name,

              p.avatar_url

            FROM conversations c

            INNER JOIN users u
              ON u.id =
                CASE
                  WHEN c.user_one_id = $1
                  THEN c.user_two_id
                  ELSE c.user_one_id
                END

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              c.user_one_id = $1
              OR c.user_two_id = $1

            ORDER BY
              c.updated_at DESC
          `,
          [req.user.id]
        );

      return success(
        res,
        {
          conversations
        }
      );
    } catch (error) {
      console.error(
        '[CONVERSATIONS]',
        error
      );

      return failure(
        res,
        500,
        'CONVERSATIONS_FAILED',
        'تعذر تحميل المحادثات.'
      );
    }
  }
);

/*
============================================================
 140. إنشاء أو استرجاع محادثة
============================================================
*/

app.post(
  '/api/conversations',
  authenticate,
  async (req, res) => {
    try {
      const otherUserId =
        requireString(
          req.body.userId,
          'userId',
          1,
          100
        );

      if (
        String(otherUserId) ===
        String(req.user.id)
      ) {
        return failure(
          res,
          400,
          'SELF_CONVERSATION',
          'لا يمكنك إنشاء محادثة مع نفسك.'
        );
      }

      const otherUser =
        await database.queryOne(
          `
            SELECT
              id,
              username,
              is_active
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [otherUserId]
        );

      if (!otherUser) {
        return failure(
          res,
          404,
          'USER_NOT_FOUND',
          'المستخدم غير موجود.'
        );
      }

      if (
        otherUser.is_active === false
      ) {
        return failure(
          res,
          403,
          'USER_DISABLED',
          'الحساب غير نشط.'
        );
      }

      const firstId =
        String(req.user.id) <
        String(otherUserId)
          ? req.user.id
          : otherUserId;

      const secondId =
        String(req.user.id) <
        String(otherUserId)
          ? otherUserId
          : req.user.id;

      let conversation =
        await database.queryOne(
          `
            SELECT
              *
            FROM conversations
            WHERE
              user_one_id = $1
              AND user_two_id = $2
            LIMIT 1
          `,
          [
            firstId,
            secondId
          ]
        );

      if (!conversation) {
        conversation =
          await database.insert(
            'conversations',
            {
              user_one_id:
                firstId,

              user_two_id:
                secondId
            }
          );
      }

      return success(
        res,
        {
          conversation
        },
        201
      );
    } catch (error) {
      console.error(
        '[CONVERSATION CREATE]',
        error
      );

      return failure(
        res,
        500,
        'CONVERSATION_CREATE_FAILED',
        'تعذر إنشاء المحادثة.'
      );
    }
  }
);

/*
============================================================
 141. رسائل المحادثة الخاصة
============================================================
*/

app.get(
  '/api/conversations/:conversationId/messages',
  authenticate,
  async (req, res) => {
    try {
      const conversationId =
        requireString(
          req.params.conversationId,
          'conversationId',
          1,
          100
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );

      const conversation =
        await database.queryOne(
          `
            SELECT
              *
            FROM conversations
            WHERE
              id = $1
              AND (
                user_one_id = $2
                OR user_two_id = $2
              )
            LIMIT 1
          `,
          [
            conversationId,
            req.user.id
          ]
        );

      if (!conversation) {
        return failure(
          res,
          404,
          'CONVERSATION_NOT_FOUND',
          'المحادثة غير موجودة.'
        );
      }

      const messages =
        await database.queryRows(
          `
            SELECT
              m.*,

              u.username,

              p.display_name,

              p.avatar_url

            FROM messages m

            INNER JOIN users u
              ON u.id = m.user_id

            LEFT JOIN profiles p
              ON p.user_id = u.id

            WHERE
              m.conversation_id = $1

            ORDER BY
              m.created_at DESC

            LIMIT $2
          `,
          [
            conversationId,
            limit
          ]
        );

      messages.reverse();

      return success(
        res,
        {
          conversation,
          messages
        }
      );
    } catch (error) {
      console.error(
        '[PRIVATE MESSAGES]',
        error
      );

      return failure(
        res,
        500,
        'PRIVATE_MESSAGES_FAILED',
        'تعذر تحميل الرسائل.'
      );
    }
  }
);

/*
============================================================
 142. إرسال رسالة خاصة
============================================================
*/

app.post(
  '/api/conversations/:conversationId/messages',
  authenticate,
  async (req, res) => {
    try {
      const conversationId =
        requireString(
          req.params.conversationId,
          'conversationId',
          1,
          100
        );

      const content =
        requireString(
          req.body.content,
          'content',
          1,
          5000
        );

      const conversation =
        await database.queryOne(
          `
            SELECT
              *
            FROM conversations
            WHERE
              id = $1
              AND (
                user_one_id = $2
                OR user_two_id = $2
              )
            LIMIT 1
          `,
          [
            conversationId,
            req.user.id
          ]
        );

      if (!conversation) {
        return failure(
          res,
          404,
          'CONVERSATION_NOT_FOUND',
          'المحادثة غير موجودة.'
        );
      }

      const receiverId =
        String(
          conversation.user_one_id
        ) ===
        String(
          req.user.id
        )
          ? conversation.user_two_id
          : conversation.user_one_id;

      const message =
        await database.transaction(
          async (client) => {
            const result =
              await client.query(
                `
                  INSERT INTO messages (
                    conversation_id,
                    user_id,
                    content,
                    message_type
                  )
                  VALUES (
                    $1,
                    $2,
                    $3,
                    'text'
                  )
                  RETURNING *
                `,
                [
                  conversationId,
                  req.user.id,
                  content
                ]
              );

            await client.query(
              `
                UPDATE conversations
                SET
                  updated_at = NOW()
                WHERE id = $1
              `,
              [conversationId]
            );

            return result.rows[0];
          }
        );

      await createNotification({
        userId:
          receiverId,

        type:
          'private_message',

        title:
          'رسالة جديدة',

        message:
          `لديك رسالة جديدة من ${req.user.username}.`,

        data: {
          conversationId,
          messageId:
            message.id
        }
      });

      io.to(
        `user:${receiverId}`
      ).emit(
        'private_message:new',
        message
      );

      return success(
        res,
        {
          message
        },
        201
      );
    } catch (error) {
      console.error(
        '[PRIVATE MESSAGE SEND]',
        error
      );

      return failure(
        res,
        500,
        'PRIVATE_MESSAGE_SEND_FAILED',
        'تعذر إرسال الرسالة.'
      );
    }
  }
);

/*
============================================================
 143. الصحة العامة للـ API
============================================================
*/

app.get(
  '/api/health',
  async (req, res) => {
    try {
      const databaseHealth =
        await database.readinessCheck();

 /*
============================================================
 افـنـدツينا🥀🖤
 server.js
 الجزء 12 من 12 — النهاية
============================================================
*/

/*
============================================================
 147. معالجة أخطاء API العامة
============================================================
*/

app.use(
  (error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    console.error(
      '[API ERROR]',
      error
    );

    if (
      error instanceof AppError
    ) {
      return failure(
        res,
        error.status,
        error.code,
        error.message
      );
    }

    return failure(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'حدث خطأ داخلي في الخادم.'
    );
  }
);

/*
============================================================
 148. مسار 404 للـ API
============================================================
*/

app.use(
  '/api',
  (req, res) => {
    return failure(
      res,
      404,
      'API_ROUTE_NOT_FOUND',
      'مسار API غير موجود.'
    );
  }
);

/*
============================================================
 149. تقديم الملفات العامة
============================================================
*/

const publicDirectory =
  path.join(
    __dirname,
    'public'
  );

if (
  fs.existsSync(
    publicDirectory
  )
) {
  app.use(
    express.static(
      publicDirectory,
      {
        index:
          false,

        dotfiles:
          'deny',

        maxAge:
          NODE_ENV === 'production'
            ? '1d'
            : 0
      }
    )
  );
}

/*
============================================================
 150. الصفحة الرئيسية
============================================================
*/

app.get(
  '/',
  (req, res) => {
    const indexFile =
      path.join(
        publicDirectory,
        'index.html'
      );

    if (
      fs.existsSync(indexFile)
    ) {
      return res.sendFile(
        indexFile
      );
    }

    return res.status(
      404
    ).json({
      success:
        false,

      code:
        'FRONTEND_NOT_FOUND',

      message:
        'ملف الواجهة الرئيسية غير موجود.'
    });
  }
);

/*
============================================================
 151. صفحة المصادقة
============================================================
*/

app.get(
  '/auth',
  (req, res) => {
    const authFile =
      path.join(
        publicDirectory,
        'auth.html'
      );

    if (
      fs.existsSync(authFile)
    ) {
      return res.sendFile(
        authFile
      );
    }

    return res.status(
      404
    ).json({
      success:
        false,

      code:
        'AUTH_PAGE_NOT_FOUND',

      message:
        'صفحة المصادقة غير موجودة.'
    });
  }
);

/*
============================================================
 152. صفحة 404
============================================================
*/

app.use(
  (req, res) => {
    const notFoundFile =
      path.join(
        publicDirectory,
        '404.html'
      );

    if (
      fs.existsSync(
        notFoundFile
      )
    ) {
      return res.status(
        404
      ).sendFile(
        notFoundFile
      );
    }

    return res.status(
      404
    ).json({
      success:
        false,

      code:
        'NOT_FOUND',

      message:
        'الصفحة المطلوبة غير موجودة.'
    });
  }
);

/*
============================================================
 153. إنشاء مجلد الرفع
============================================================
*/

const uploadsDirectory =
  path.join(
    __dirname,
    'uploads'
  );

try {
  fs.mkdirSync(
    uploadsDirectory,
    {
      recursive:
        true
    }
  );
} catch (error) {
  console.error(
    '[UPLOAD DIRECTORY]',
    error
  );
}

/*
============================================================
 154. التحقق من بيئة التشغيل
============================================================
*/

function validateEnvironment() {
  const required =
    [
      'DATABASE_URL',
      'JWT_SECRET'
    ];

  const missing =
    required.filter(
      (key) =>
        !process.env[key] ||
        String(
          process.env[key]
        ).trim() === ''
    );

  if (
    missing.length > 0
  ) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  if (
    String(
      process.env.JWT_SECRET
    ).length < 32
  ) {
    throw new Error(
      'JWT_SECRET must contain at least 32 characters.'
    );
  }
}

/*
============================================================
 155. فحص البيئة قبل تشغيل الخادم
============================================================
*/

try {
  validateEnvironment();
} catch (error) {
  console.error(
    '[ENVIRONMENT]',
    error.message
  );

  if (
    NODE_ENV === 'production'
  ) {
    process.exit(1);
  }
}

/*
============================================================
 156. تشغيل الخادم
============================================================
*/

let serverStarted =
  false;

async function startServer() {
  if (
    serverStarted
  ) {
    return;
  }

  try {
    await database.testConnection();

    server.listen(
      PORT,
      HOST,
      () => {
        serverStarted =
          true;

        console.log(
          '============================================================'
        );

        console.log(
          ' افـنـدツينا🥀🖤'
        );

        console.log(
          ' Server started successfully'
        );

        console.log(
          ` Environment: ${NODE_ENV}`
        );

        console.log(
          ` Host: ${HOST}`
        );

        console.log(
          ` Port: ${PORT}`
        );

        console.log(
          ` API: /api`
        );

        console.log(
          ` Health: /api/health`
        );

        console.log(
          '============================================================'
        );
      }
    );

  } catch (error) {
    console.error(
      '[SERVER START]',
      error
    );

    process.exit(1);
  }
}

/*
============================================================
 157. إغلاق الخادم بأمان
============================================================
*/

let shuttingDown =
  false;

async function gracefulShutdown(
  signal
) {
  if (
    shuttingDown
  ) {
    return;
  }

  shuttingDown =
    true;

  console.log(
    `[SERVER] Received ${signal}. Shutting down...`
  );

  try {
    await new Promise(
      (resolve) => {
        server.close(
          () => {
            resolve();
          }
        );
      }
    );
  } catch (error) {
    console.error(
      '[SERVER CLOSE]',
      error
    );
  }

  try {
    await database.shutdownDatabase(
      signal
    );
  } catch (error) {
    console.error(
      '[DATABASE SHUTDOWN]',
      error
    );
  }

  process.exit(0);
}

/*
============================================================
 158. إشارات إغلاق الخادم
============================================================
*/

process.once(
  'SIGINT',
  () => {
    gracefulShutdown(
      'SIGINT'
    );
  }
);

process.once(
  'SIGTERM',
  () => {
    gracefulShutdown(
      'SIGTERM'
    );
  }
);

/*
============================================================
 159. التعامل مع أخطاء الخادم
============================================================
*/

server.on(
  'error',
  (error) => {
    console.error(
      '[HTTP SERVER ERROR]',
      error
    );

    if (
      error.code ===
      'EADDRINUSE'
    ) {
      console.error(
        `Port ${PORT} is already in use.`
      );
    }
  }
);

/*
============================================================
 160. حماية من أخطاء غير متوقعة
============================================================
*/

process.on(
  'uncaughtException',
  (error) => {
    console.error(
      '[UNCAUGHT EXCEPTION]',
      error
    );

    if (
      NODE_ENV === 'production'
    ) {
      gracefulShutdown(
        'uncaughtException'
      );
    }
  }
);

/*
============================================================
 161. مراقبة الذاكرة
============================================================
*/

function getMemoryUsage() {
  const memory =
    process.memoryUsage();

  return {
    rss:
      memory.rss,

    heapTotal:
      memory.heapTotal,

    heapUsed:
      memory.heapUsed,

    external:
      memory.external,

    arrayBuffers:
      memory.arrayBuffers
  };
}

/*
============================================================
 162. إحصائيات الخادم
============================================================
*/

app.get(
  '/api/system/status',
  authenticate,
  async (req, res) => {
    try {
      const databaseHealth =
        await database.readinessCheck();

      return success(
        res,
        {
          service:
            'افـنـدツينا🥀🖤',

          environment:
            NODE_ENV,

          uptime:
            process.uptime(),

          memory:
            getMemoryUsage(),

          database:
            databaseHealth,

          timestamp:
            new Date().toISOString()
        }
      );
    } catch (error) {
      console.error(
        '[SYSTEM STATUS]',
        error
      );

      return failure(
        res,
        500,
        'SYSTEM_STATUS_FAILED',
        'تعذر تحميل حالة النظام.'
      );
    }
  }
);

/*
============================================================
 163. اختبار نهائي قبل التشغيل
============================================================
*/

async function performStartupChecks() {
  console.log(
    '[STARTUP] Running startup checks...'
  );

  const databaseHealth =
    await database.readinessCheck();

  if (
    !databaseHealth.ready
  ) {
    throw new Error(
      'Database readiness check failed.'
    );
  }

  console.log(
    '[STARTUP] Database check passed.'
  );

  console.log(
    '[STARTUP] Startup checks completed.'
  );
}

/*
============================================================
 164. بدء التطبيق
============================================================
*/

if (
  require.main === module
) {
  performStartupChecks()
    .then(
      () => startServer()
    )
    .catch(
      (error) => {
        console.error(
          '[STARTUP FAILED]',
          error
        );

        process.exit(1);
      }
    );
}

/*
============================================================
 165. التصدير
============================================================
*/

module.exports =
  {
    app,

    server,

    io,

    startServer,

    gracefulShutdown,

    performStartupChecks
  };

/*
============================================================
 166. النهاية الرسمية لـ server.js
============================================================

 الملف لا ينشئ:
 - مستخدمين وهميين
 - حسابات تجريبية
 - أرصدة وهمية
 - رسائل تجريبية
 - منشورات وهمية
 - هدايا وهمية
 - عمليات شراء وهمية

 جميع البيانات تعتمد على PostgreSQL الفعلية.

 أول حساب Owner يجب أن يتم إنشاؤه داخل
 نظام التسجيل Transactionياً، بحيث يتم منح
 أول حساب حقيقي الصلاحيات المناسبة وفق
 قواعد schema.sql.

 لا توجد بيانات Seed تجريبية داخل server.js.

============================================================
 افـنـدツينا🥀🖤
 SERVER.JS — END
============================================================
*/
