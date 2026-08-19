'use strict';

/*
========================================================
  افـنـدツينا🥀🖤
  SERVER.JS
  Production-oriented backend foundation
========================================================

  هذا الخادم مسؤول عن:
  - الحسابات
  - تسجيل الدخول والخروج
  - الجلسات
  - حماية كلمات المرور
  - استعادة كلمة المرور
  - الحسابات الزائرة
  - الملف الشخصي
  - المنشورات
  - التعليقات والإعجابات
  - الجروبات
  - العضوية في الجروبات
  - الرسائل الخاصة
  - الإشعارات
  - البحث
  - المستخدمون الموجودون حاليًا
  - رفع الصور
  - النقاط/الكوينز
  - المحفظة
  - الإحصائيات
  - نظام التقارير والحظر
  - WebSocket للدردشة المباشرة

  لا توجد:
  - حسابات وهمية
  - غرف وهمية
  - رسائل وهمية
  - أرصدة وهمية
  - كلمات مرور داخل الكود
  - مفاتيح API داخل الكود
  - بيانات تجريبية

  يجب وضع القيم الحقيقية داخل ملف .env
========================================================
*/


/* ======================================================
   DEPENDENCIES
====================================================== */

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { Pool } = require('pg');

const multer = require('multer');

const cookieParser = require('cookie-parser');

const { Server } = require('socket.io');


/* ======================================================
   ENVIRONMENT
====================================================== */

require('dotenv').config();


const NODE_ENV =
  process.env.NODE_ENV || 'production';


const PORT =
  Number(process.env.PORT || 3000);


const HOST =
  process.env.HOST || '0.0.0.0';


const DATABASE_URL =
  process.env.DATABASE_URL;


const JWT_SECRET =
  process.env.JWT_SECRET;


const SESSION_SECRET =
  process.env.SESSION_SECRET;


const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN;


const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  path.join(__dirname, 'uploads');


const MAX_FILE_SIZE =
  Number(
    process.env.MAX_FILE_SIZE ||
    8 * 1024 * 1024
  );


/* ======================================================
   REQUIRED ENVIRONMENT VALIDATION
====================================================== */

const requiredEnvironment = {
  DATABASE_URL,
  JWT_SECRET,
  SESSION_SECRET,
  CLIENT_ORIGIN
};


for (const [key, value] of Object.entries(
  requiredEnvironment
)) {

  if (!value) {

    console.error(
      `Missing required environment variable: ${key}`
    );

    process.exit(1);
  }
}


/* ======================================================
   APPLICATION
====================================================== */

const app =
  express();


const server =
  http.createServer(app);


const io =
  new Server(server, {
    cors: {
      origin: CLIENT_ORIGIN,
      credentials: true
    }
  });


/* ======================================================
   DATABASE
====================================================== */

const pool =
  new Pool({
    connectionString: DATABASE_URL,

    ssl:
      process.env.DATABASE_SSL === 'true'
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
          }
        : false,

    max:
      Number(
        process.env.DB_POOL_MAX || 10
      ),

    idleTimeoutMillis:
      Number(
        process.env.DB_IDLE_TIMEOUT || 30000
      ),

    connectionTimeoutMillis:
      Number(
        process.env.DB_CONNECTION_TIMEOUT || 10000
      )
  });


pool.on(
  'error',
  error => {

    console.error(
      'PostgreSQL pool error:',
      error
    );
  }
);


/* ======================================================
   MIDDLEWARE
====================================================== */

app.disable('x-powered-by');


app.set(
  'trust proxy',
  process.env.TRUST_PROXY === 'true'
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
    origin: CLIENT_ORIGIN,
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


app.use(
  express.json({
    limit: '1mb'
  })
);


app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb'
  })
);


app.use(
  cookieParser()
);


/* ======================================================
   RATE LIMITERS
====================================================== */

const generalLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      300,

    standardHeaders:
      'draft-7',

    legacyHeaders:
      false,

    message: {
      success: false,
      message:
        'عدد الطلبات كبير جدًا، حاول لاحقًا.'
    }
  });


const authLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      20,

    standardHeaders:
      'draft-7',

    legacyHeaders:
      false,

    message: {
      success: false,
      message:
        'محاولات المصادقة كثيرة جدًا، حاول لاحقًا.'
    }
  });


app.use(
  '/api',
  generalLimiter
);


/* ======================================================
   STATIC FILES
====================================================== */

app.use(
  express.static(
    path.join(__dirname, 'public'),
    {
      index: 'index.html',
      maxAge:
        NODE_ENV === 'production'
          ? '1h'
          : 0
    }
  )
);


/* ======================================================
   UPLOAD CONFIGURATION
====================================================== */

const storage =
  multer.diskStorage({

    destination:
      function (
        req,
        file,
        callback
      ) {

        callback(
          null,
          UPLOAD_DIR
        );
      },


    filename:
      function (
        req,
        file,
        callback
      ) {

        const extension =
          path.extname(
            file.originalname
          ).toLowerCase();


        const safeExtension =
          extension &&
          /^[.a-z0-9]+$/.test(extension)
            ? extension
            : '';


        const filename =
          `${crypto.randomUUID()}${safeExtension}`;


        callback(
          null,
          filename
        );
      }
  });


const allowedMimeTypes =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]);


const upload =
  multer({

    storage,

    limits: {
      fileSize:
        MAX_FILE_SIZE,

      files: 1
    },


    fileFilter:
      function (
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
              'نوع الملف غير مسموح.'
            )
          );
        }


        callback(
          null,
          true
        );
      }
  });


/* ======================================================
   HELPERS
====================================================== */

function asyncHandler(
  handler
) {

  return function (
    req,
    res,
    next
  ) {

    Promise
      .resolve(
        handler(req, res, next)
      )
      .catch(next);
  };
}


function normalizeEmail(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .toLowerCase();
}


function normalizeUsername(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .toLowerCase();
}


function cleanString(
  value,
  maxLength = 500
) {

  return String(
    value || ''
  )
    .trim()
    .slice(
      0,
      maxLength
    );
}


function isValidEmail(
  email
) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);
}


function isValidUsername(
  username
) {

  return /^[A-Za-z0-9_\u0600-\u06FF]{3,30}$/
    .test(username);
}


function parsePositiveInteger(
  value,
  fallback,
  maximum
) {

  const number =
    Number.parseInt(
      value,
      10
    );


  if (
    !Number.isInteger(number) ||
    number < 1
  ) {

    return fallback;
  }


  return Math.min(
    number,
    maximum
  );
}


function getBearerToken(
  req
) {

  const header =
    req.headers.authorization;


  if (
    !header ||
    !header.startsWith('Bearer ')
  ) {

    return null;
  }


  return header.slice(7);
}


/* ======================================================
   JWT
====================================================== */

function createAccessToken(
  user
) {

  return jwt.sign(
    {
      sub:
        String(user.id),

      username:
        user.username,

      role:
        user.role
    },

    JWT_SECRET,

    {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        '7d',

      issuer:
        'afendina'
    }
  );
}


/* ======================================================
   AUTH MIDDLEWARE
====================================================== */

async function authenticate(
  req,
  res,
  next
) {

  try {

    const token =
      getBearerToken(req) ||
      req.cookies.afendina_token;


    if (!token) {

      return res
        .status(401)
        .json({
          success: false,
          message:
            'يجب تسجيل الدخول أولًا.'
        });
    }


    const payload =
      jwt.verify(
        token,
        JWT_SECRET,
        {
          issuer:
            'afendina'
        }
      );


    const result =
      await pool.query(
        `
        SELECT
          id,
          username,
          display_name,
          email,
          role,
          avatar_url,
          is_guest,
          is_active,
          is_verified
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [
          payload.sub
        ]
      );


    if (
      result.rowCount === 0 ||
      !result.rows[0].is_active
    ) {

      return res
        .status(401)
        .json({
          success: false,
          message:
            'الحساب غير متاح.'
        });
    }


    req.user =
      result.rows[0];


    next();

  } catch (error) {

    return res
      .status(401)
      .json({
        success: false,
        message:
          'جلسة الدخول غير صالحة أو منتهية.'
      });
  }
}


/* ======================================================
   OPTIONAL AUTH
====================================================== */

async function optionalAuth(
  req,
  res,
  next
) {

  try {

    const token =
      getBearerToken(req) ||
      req.cookies.afendina_token;


    if (!token) {

      return next();
    }


    const payload =
      jwt.verify(
        token,
        JWT_SECRET,
        {
          issuer:
            'afendina'
        }
      );


    const result =
      await pool.query(
        `
        SELECT
          id,
          username,
          display_name,
          email,
          role,
          avatar_url,
          is_guest,
          is_active,
          is_verified
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [
          payload.sub
        ]
      );


    if (
      result.rowCount > 0 &&
      result.rows[0].is_active
    ) {

      req.user =
        result.rows[0];
    }

  } catch (_) {
    // Guest/public request continues without authentication.
  }


  next();
}


/* ======================================================
   HEALTH
====================================================== */

app.get(
  '/api/health',
  asyncHandler(
    async (
      req,
      res
    ) => {

      await pool.query(
        'SELECT 1'
      );


      res.json({
        success: true,
        service:
          'افـنـدツينا🥀🖤',
        database:
          'connected',
        timestamp:
          new Date().toISOString()
      });
    }
  )
);


/* ======================================================
   AUTH: REGISTER
====================================================== */

app.post(
  '/api/auth/register',
  authLimiter,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const username =
        normalizeUsername(
          req.body.username
        );


      const displayName =
        cleanString(
          req.body.displayName,
          50
        );


      const email =
        normalizeEmail(
          req.body.email
        );


      const gender =
        cleanString(
          req.body.gender,
          20
        );


      const age =
        Number(
          req.body.age
        );


      const password =
        String(
          req.body.password || ''
        );


      const passwordConfirm =
        String(
          req.body.passwordConfirm || ''
        );


      if (
        !isValidUsername(
          username
        )
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'اسم المستخدم غير صالح.'
          });
      }


      if (
        displayName.length < 2
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'الاسم الظاهر غير صالح.'
          });
      }


      if (
        !isValidEmail(
          email
        )
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'البريد الإلكتروني غير صالح.'
          });
      }


      if (
        !Number.isInteger(age) ||
        age < 13 ||
        age > 120
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'العمر غير صالح.'
          });
      }


      if (
        password.length < 8
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.'
          });
      }


      if (
        password !== passwordConfirm
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'كلمتا المرور غير متطابقتين.'
          });
      }


      const existing =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE
            username = $1
            OR email = $2
          LIMIT 1
          `,
          [
            username,
            email
          ]
        );


      if (
        existing.rowCount > 0
      ) {

        return res
          .status(409)
          .json({
            success: false,
            message:
              'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.'
          });
      }


      const passwordHash =
        await bcrypt.hash(
          password,
          Number(
            process.env.BCRYPT_ROUNDS ||
            12
          )
        );


      const result =
        await pool.query(
          `
          INSERT INTO users (
            username,
            display_name,
            email,
            password_hash,
            gender,
            age,
            role,
            is_guest,
            is_active,
            is_verified,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            'user',
            FALSE,
            TRUE,
            FALSE,
            NOW(),
            NOW()
          )
          RETURNING
            id,
            username,
            display_name,
            email,
            role,
            is_guest,
            is_verified
          `,
          [
            username,
            displayName,
            email,
            passwordHash,
            gender,
            age
          ]
        );


      const user =
        result.rows[0];


      const token =
        createAccessToken(
          user
        );


      res
        .cookie(
          'afendina_token',
          token,
          {
            httpOnly: true,
            secure:
              NODE_ENV === 'production',
            sameSite:
              'lax',
            maxAge:
              7 * 24 * 60 * 60 * 1000
          }
        )
        .status(201)
        .json({
          success: true,
          message:
            'تم إنشاء الحساب.',
          user,
          redirect:
            '/index.html'
        });
    }
  )
);


/* ======================================================
   AUTH: LOGIN
====================================================== */

app.post(
  '/api/auth/login',
  authLimiter,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const identifier =
        cleanString(
          req.body.identifier,
          100
        );


      const password =
        String(
          req.body.password || ''
        );


      if (
        !identifier ||
        !password
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'بيانات الدخول ناقصة.'
          });
      }


      const normalized =
        identifier.toLowerCase();


      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            display_name,
            email,
            password_hash,
            role,
            avatar_url,
            is_guest,
            is_active,
            is_verified
          FROM users
          WHERE
            LOWER(username) = $1
            OR LOWER(email) = $1
          LIMIT 1
          `,
          [
            normalized
          ]
        );


      if (
        result.rowCount === 0
      ) {

        return res
          .status(401)
          .json({
            success: false,
            message:
              'بيانات الدخول غير صحيحة.'
          });
      }


      const user =
        result.rows[0];


      if (!user.is_active) {

        return res
          .status(403)
          .json({
            success: false,
            message:
              'الحساب موقوف أو غير فعال.'
          });
      }


      const validPassword =
        await bcrypt.compare(
          password,
          user.password_hash
        );


      if (!validPassword) {

        return res
          .status(401)
          .json({
            success: false,
            message:
              'بيانات الدخول غير صحيحة.'
          });
      }


      await pool.query(
        `
        UPDATE users
        SET
          last_login_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        `,
        [
          user.id
        ]
      );


      delete user.password_hash;


      const token =
        createAccessToken(
          user
        );


      const remember =
        Boolean(
          req.body.remember
        );


      res
        .cookie(
          'afendina_token',
          token,
          {
            httpOnly: true,
            secure:
              NODE_ENV === 'production',
            sameSite:
              'lax',
            maxAge:
              remember
                ? 30 * 24 * 60 * 60 * 1000
                : 7 * 24 * 60 * 60 * 1000
          }
        )
        .json({
          success: true,
          message:
            'تم تسجيل الدخول.',
          user,
          redirect:
            '/index.html'
        });
    }
  )
);


/* ======================================================
   AUTH: LOGOUT
====================================================== */

app.post(
  '/api/auth/logout',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      res
        .clearCookie(
          'afendina_token'
        )
        .json({
          success: true,
          message:
            'تم تسجيل الخروج.'
        });
    }
  )
);


/* ======================================================
   AUTH: CURRENT USER
====================================================== */

app.get(
  '/api/auth/me',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      res.json({
        success: true,
        user:
          req.user
      });
    }
  )
);


/* ======================================================
   AUTH: GUEST
====================================================== */

app.post(
  '/api/auth/guest',
  authLimiter,
  asyncHandler(
    async (
      req,
      res
    ) => {

      /*
        لا ننشئ بيانات وهمية.

        إذا كان النظام يريد دعم الزائر،
        يتم إنشاء سجل حقيقي في قاعدة البيانات.
      */

      const guestUsername =
        `guest_${crypto.randomUUID()
          .replace(/-/g, '')
          .slice(0, 16)}`;


      const guestName =
        'زائر';


      const result =
        await pool.query(
          `
          INSERT INTO users (
            username,
            display_name,
            password_hash,
            role,
            is_guest,
            is_active,
            is_verified,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            NULL,
            'guest',
            TRUE,
            TRUE,
            FALSE,
            NOW(),
            NOW()
          )
          RETURNING
            id,
            username,
            display_name,
            role,
            is_guest,
            is_verified
          `,
          [
            guestUsername,
            guestName
          ]
        );


      const user =
        result.rows[0];


      const token =
        createAccessToken(
          user
        );


      res
        .cookie(
          'afendina_token',
          token,
          {
            httpOnly: true,
            secure:
              NODE_ENV === 'production',
            sameSite:
              'lax',
            maxAge:
              24 * 60 * 60 * 1000
          }
        )
        .status(201)
        .json({
          success: true,
          user,
          redirect:
            '/index.html'
        });
    }
  )
);


/* ======================================================
   PROFILE
====================================================== */

app.get(
  '/api/profile/me',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            display_name,
            email,
            gender,
            age,
            bio,
            avatar_url,
            cover_url,
            role,
            is_guest,
            is_verified,
            created_at,
            last_login_at
          FROM users
          WHERE id = $1
          LIMIT 1
          `,
          [
            req.user.id
          ]
        );


      res.json({
        success: true,
        profile:
          result.rows[0]
      });
    }
  )
);


/* ======================================================
   UPDATE PROFILE
====================================================== */

app.patch(
  '/api/profile/me',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const displayName =
        cleanString(
          req.body.displayName,
          50
        );


      const bio =
        cleanString(
          req.body.bio,
          500
        );


      const age =
        req.body.age === undefined
          ? null
          : Number(req.body.age);


      if (
        displayName &&
        displayName.length < 2
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'الاسم غير صالح.'
          });
      }


      if (
        age !== null &&
        (
          !Number.isInteger(age) ||
          age < 13 ||
          age > 120
        )
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'العمر غير صالح.'
          });
      }


      const result =
        await pool.query(
          `
          UPDATE users
          SET
            display_name =
              COALESCE(NULLIF($1, ''), display_name),

            bio =
              CASE
                WHEN $2 IS NULL THEN bio
                ELSE $2
              END,

            age =
              CASE
                WHEN $3 IS NULL THEN age
                ELSE $3
              END,

            updated_at = NOW()

          WHERE id = $4

          RETURNING
            id,
            username,
            display_name,
            email,
            gender,
            age,
            bio,
            avatar_url,
            cover_url,
            is_verified
          `,
          [
            displayName,
            bio,
            age,
            req.user.id
          ]
        );


      res.json({
        success: true,
        profile:
          result.rows[0]
      });
    }
  )
);


/* ======================================================
   PROFILE IMAGE
====================================================== */

app.post(
  '/api/profile/avatar',
  authenticate,
  upload.single('avatar'),
  asyncHandler(
    async (
      req,
      res
    ) => {

      if (!req.file) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'لم يتم اختيار صورة.'
          });
      }


      const publicPath =
        `/uploads/${req.file.filename}`;


      await pool.query(
        `
        UPDATE users
        SET
          avatar_url = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [
          publicPath,
          req.user.id
        ]
      );


      res.json({
        success: true,
        avatarUrl:
          publicPath
      });
    }
  )
);


/* ======================================================
   SEARCH USERS
====================================================== */

app.get(
  '/api/users/search',
  optionalAuth,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const query =
        cleanString(
          req.query.q,
          50
        );


      if (
        query.length < 2
      ) {

        return res.json({
          success: true,
          users: []
        });
      }


      const limit =
        parsePositiveInteger(
          req.query.limit,
          20,
          50
        );


      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            display_name,
            avatar_url,
            is_verified,
            is_guest
          FROM users
          WHERE
            is_active = TRUE
            AND (
              username ILIKE $1
              OR display_name ILIKE $1
            )
          ORDER BY
            is_verified DESC,
            display_name ASC
          LIMIT $2
          `,
          [
            `%${query}%`,
            limit
          ]
        );


      res.json({
        success: true,
        users:
          result.rows
      });
    }
  )
);


/* ======================================================
   ONLINE USERS
====================================================== */

app.get(
  '/api/users/online',
  optionalAuth,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const limit =
        parsePositiveInteger(
          req.query.limit,
          30,
          100
        );


      const result =
        await pool.query(
          `
          SELECT
            u.id,
            u.username,
            u.display_name,
            u.avatar_url,
            u.is_verified
          FROM users u
          WHERE
            u.is_active = TRUE
            AND u.last_seen_at >=
              NOW() - INTERVAL '5 minutes'
          ORDER BY
            u.last_seen_at DESC
          LIMIT $1
          `,
          [
            limit
          ]
        );


      res.json({
        success: true,
        users:
          result.rows
      });
    }
  )
);


/* ======================================================
   POSTS: CREATE
====================================================== */

app.post(
  '/api/posts',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const content =
        cleanString(
          req.body.content,
          5000
        );


      if (!content) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'المنشور فارغ.'
          });
      }


      const result =
        await pool.query(
          `
          INSERT INTO posts (
            user_id,
            content,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            NOW(),
            NOW()
          )
          RETURNING
            id,
            user_id,
            content,
            created_at
          `,
          [
            req.user.id,
            content
          ]
        );


      res
        .status(201)
        .json({
          success: true,
          post:
            result.rows[0]
        });
    }
  )
);


/* ======================================================
   POSTS: FEED
====================================================== */

app.get(
  '/api/posts',
  optionalAuth,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const limit =
        parsePositiveInteger(
          req.query.limit,
          20,
          50
        );


      const offset =
        Math.max(
          0,
          Number.parseInt(
            req.query.offset || 0,
            10
          ) || 0
        );


      const result =
        await pool.query(
          `
          SELECT
            p.id,
            p.content,
            p.created_at,

            u.id AS user_id,
            u.username,
            u.display_name,
            u.avatar_url,
            u.is_verified,

            (
              SELECT COUNT(*)
              FROM post_likes pl
              WHERE pl.post_id = p.id
            ) AS likes_count,

            (
              SELECT COUNT(*)
              FROM post_comments pc
              WHERE pc.post_id = p.id
            ) AS comments_count

          FROM posts p

          INNER JOIN users u
            ON u.id = p.user_id

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


      res.json({
        success: true,
        posts:
          result.rows
      });
    }
  )
);


/* ======================================================
   POSTS: DELETE
====================================================== */

app.delete(
  '/api/posts/:id',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const postId =
        Number(
          req.params.id
        );


      if (
        !Number.isInteger(postId)
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'معرف المنشور غير صالح.'
          });
      }


      const result =
        await pool.query(
          `
          DELETE FROM posts
          WHERE
            id = $1
            AND user_id = $2
          RETURNING id
          `,
          [
            postId,
            req.user.id
          ]
        );


      if (
        result.rowCount === 0
      ) {

        return res
          .status(404)
          .json({
            success: false,
            message:
              'المنشور غير موجود أو لا تملك صلاحية حذفه.'
          });
      }


      res.json({
        success: true,
        message:
          'تم حذف المنشور.'
      });
    }
  )
);


/* ======================================================
   POST LIKE
====================================================== */

app.post(
  '/api/posts/:id/like',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const postId =
        Number(
          req.params.id
        );


      const client =
        await pool.connect();


      try {

        await client.query(
          'BEGIN'
        );


        const post =
          await client.query(
            `
            SELECT id
            FROM posts
            WHERE id = $1
            LIMIT 1
            `,
            [
              postId
            ]
          );


        if (
          post.rowCount === 0
        ) {

          await client.query(
            'ROLLBACK'
          );


          return res
            .status(404)
            .json({
              success: false,
              message:
                'المنشور غير موجود.'
            });
        }


        const existing =
          await client.query(
            `
            SELECT 1
            FROM post_likes
            WHERE
              post_id = $1
              AND user_id = $2
            LIMIT 1
            `,
            [
              postId,
              req.user.id
            ]
          );


        let liked;


        if (
          existing.rowCount > 0
        ) {

          await client.query(
            `
            DELETE FROM post_likes
            WHERE
              post_id = $1
              AND user_id = $2
            `,
            [
              postId,
              req.user.id
            ]
          );


          liked = false;

        } else {

          await client.query(
            `
            INSERT INTO post_likes (
              post_id,
              user_id,
              created_at
            )
            VALUES (
              $1,
              $2,
              NOW()
            )
            `,
            [
              postId,
              req.user.id
            ]
          );


          liked = true;
        }


        const count =
          await client.query(
            `
            SELECT COUNT(*)::int AS count
            FROM post_likes
            WHERE post_id = $1
            `,
            [
              postId
            ]
          );


        await client.query(
          'COMMIT'
        );


        res.json({
          success: true,
          liked,
          count:
            count.rows[0].count
        });

      } catch (error) {

        await client.query(
          'ROLLBACK'
        );

        throw error;

      } finally {

        client.release();
      }
    }
  )
);


/* ======================================================
   COMMENTS
====================================================== */

app.post(
  '/api/posts/:id/comments',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const postId =
        Number(
          req.params.id
        );


      const content =
        cleanString(
          req.body.content,
          1000
        );


      if (!content) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'التعليق فارغ.'
          });
      }


      const result =
        await pool.query(
          `
          INSERT INTO post_comments (
            post_id,
            user_id,
            content,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            NOW(),
            NOW()
          )
          RETURNING
            id,
            post_id,
            user_id,
            content,
            created_at
          `,
          [
            postId,
            req.user.id,
            content
          ]
        );


      res
        .status(201)
        .json({
          success: true,
          comment:
            result.rows[0]
        });
    }
  )
);


/* ======================================================
   GROUPS
====================================================== */

app.get(
  '/api/groups',
  optionalAuth,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const limit =
        parsePositiveInteger(
          req.query.limit,
          30,
          100
        );


      const result =
        await pool.query(
          `
          SELECT
            g.id,
            g.name,
            g.description,
            g.avatar_url,
            g.cover_url,
            g.is_private,
            g.owner_id,
            g.created_at,

            (
              SELECT COUNT(*)
              FROM group_members gm
              WHERE gm.group_id = g.id
            ) AS members_count

          FROM groups g

          WHERE
            g.is_active = TRUE
            AND (
              g.is_private = FALSE
              OR g.owner_id = $1
              OR EXISTS (
                SELECT 1
                FROM group_members gm2
                WHERE
                  gm2.group_id = g.id
                  AND gm2.user_id = $1
              )
            )

          ORDER BY
            g.created_at DESC

          LIMIT $2
          `,
          [
            req.user?.id || null,
            limit
          ]
        );


      res.json({
        success: true,
        groups:
          result.rows
      });
    }
  )
);


/* ======================================================
   CREATE GROUP
====================================================== */

app.post(
  '/api/groups',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const name =
        cleanString(
          req.body.name,
          80
        );


      const description =
        cleanString(
          req.body.description,
          1000
        );


      const isPrivate =
        Boolean(
          req.body.isPrivate
        );


      if (
        name.length < 2
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'اسم الجروب غير صالح.'
          });
      }


      const client =
        await pool.connect();


      try {

        await client.query(
          'BEGIN'
        );


        const group =
          await client.query(
            `
            INSERT INTO groups (
              name,
              description,
              owner_id,
              is_private,
              is_active,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              TRUE,
              NOW(),
              NOW()
            )
            RETURNING
              id,
              name,
              description,
              owner_id,
              is_private,
              created_at
            `,
            [
              name,
              description,
              req.user.id,
              isPrivate
            ]
          );


        const created =
          group.rows[0];


        await client.query(
          `
          INSERT INTO group_members (
            group_id,
            user_id,
            role,
            joined_at
          )
          VALUES (
            $1,
            $2,
            'owner',
            NOW()
          )
          `,
          [
            created.id,
            req.user.id
          ]
        );


        await client.query(
          'COMMIT'
        );


        res
          .status(201)
          .json({
            success: true,
            group:
              created
          });

      } catch (error) {

        await client.query(
          'ROLLBACK'
        );

        throw error;

      } finally {

        client.release();
      }
    }
  )
);


/* ======================================================
   JOIN GROUP
====================================================== */

app.post(
  '/api/groups/:id/join',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const groupId =
        Number(
          req.params.id
        );


      const group =
        await pool.query(
          `
          SELECT
            id,
            is_private,
            is_active
          FROM groups
          WHERE id = $1
          LIMIT 1
          `,
          [
            groupId
          ]
        );


      if (
        group.rowCount === 0 ||
        !group.rows[0].is_active
      ) {

        return res
          .status(404)
          .json({
            success: false,
            message:
              'الجروب غير موجود.'
          });
      }


      if (
        group.rows[0].is_private
      ) {

        return res
          .status(403)
          .json({
            success: false,
            message:
              'هذا الجروب خاص ويتطلب موافقة.'
          });
      }


      await pool.query(
        `
        INSERT INTO group_members (
          group_id,
          user_id,
          role,
          joined_at
        )
        VALUES (
          $1,
          $2,
          'member',
          NOW()
        )
        ON CONFLICT (
          group_id,
          user_id
        )
        DO NOTHING
        `,
        [
          groupId,
          req.user.id
        ]
      );


      res.json({
        success: true,
        message:
          'تم الانضمام إلى الجروب.'
      });
    }
  )
);


/* ======================================================
   LEAVE GROUP
====================================================== */

app.delete(
  '/api/groups/:id/membership',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const groupId =
        Number(
          req.params.id
        );


      const result =
        await pool.query(
          `
          DELETE FROM group_members
          WHERE
            group_id = $1
            AND user_id = $2
            AND role <> 'owner'
          RETURNING id
          `,
          [
            groupId,
            req.user.id
          ]
        );


      if (
        result.rowCount === 0
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'لا يمكن مغادرة هذا الجروب بهذه الصلاحية.'
          });
      }


      res.json({
        success: true,
        message:
          'تمت مغادرة الجروب.'
      });
    }
  )
);


/* ======================================================
   GROUP MEMBERS
====================================================== */

app.get(
  '/api/groups/:id/members',
  optionalAuth,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const groupId =
        Number(
          req.params.id
        );


      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );


      const result =
        await pool.query(
          `
          SELECT
            u.id,
            u.username,
            u.display_name,
            u.avatar_url,
            u.is_verified,
            gm.role,
            gm.joined_at
          FROM group_members gm

          INNER JOIN users u
            ON u.id = gm.user_id

          WHERE
            gm.group_id = $1
            AND u.is_active = TRUE

          ORDER BY
            CASE gm.role
              WHEN 'owner' THEN 0
              WHEN 'admin' THEN 1
              ELSE 2
            END,
            gm.joined_at ASC

          LIMIT $2
          `,
          [
            groupId,
            limit
          ]
        );


      res.json({
        success: true,
        members:
          result.rows
      });
    }
  )
);


/* ======================================================
   PRIVATE CONVERSATIONS
====================================================== */

app.get(
  '/api/conversations',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const result =
        await pool.query(
          `
          SELECT
            c.id,
            c.created_at,

            CASE
              WHEN c.user_one_id = $1
                THEN u2.id
              ELSE u1.id
            END AS other_user_id,

            CASE
              WHEN c.user_one_id = $1
                THEN u2.username
              ELSE u1.username
            END AS other_username,

            CASE
              WHEN c.user_one_id = $1
                THEN u2.display_name
              ELSE u1.display_name
            END AS other_display_name,

            CASE
              WHEN c.user_one_id = $1
                THEN u2.avatar_url
              ELSE u1.avatar_url
            END AS other_avatar_url

          FROM conversations c

          INNER JOIN users u1
            ON u1.id = c.user_one_id

          INNER JOIN users u2
            ON u2.id = c.user_two_id

          WHERE
            c.user_one_id = $1
            OR c.user_two_id = $1

          ORDER BY
            c.updated_at DESC
          `,
          [
            req.user.id
          ]
        );


      res.json({
        success: true,
        conversations:
          result.rows
      });
    }
  )
);


/* ======================================================
   CREATE / GET CONVERSATION
====================================================== */

app.post(
  '/api/conversations',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const otherUserId =
        Number(
          req.body.userId
        );


      if (
        !Number.isInteger(
          otherUserId
        ) ||
        otherUserId ===
          req.user.id
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'المستخدم غير صالح.'
          });
      }


      const one =
        Math.min(
          req.user.id,
          otherUserId
        );


      const two =
        Math.max(
          req.user.id,
          otherUserId
        );


      const result =
        await pool.query(
          `
          INSERT INTO conversations (
            user_one_id,
            user_two_id,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            NOW(),
            NOW()
          )
          ON CONFLICT (
            user_one_id,
            user_two_id
          )
          DO UPDATE SET
            updated_at = conversations.updated_at

          RETURNING
            id,
            user_one_id,
            user_two_id
          `,
          [
            one,
            two
          ]
        );


      res
        .status(201)
        .json({
          success: true,
          conversation:
            result.rows[0]
        });
    }
  )
);


/* ======================================================
   CONVERSATION MESSAGES
====================================================== */

app.get(
  '/api/conversations/:id/messages',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const conversationId =
        Number(
          req.params.id
        );


      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );


      const membership =
        await pool.query(
          `
          SELECT id
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


      if (
        membership.rowCount === 0
      ) {

        return res
          .status(403)
          .json({
            success: false,
            message:
              'ليس لديك صلاحية الوصول إلى هذه المحادثة.'
          });
      }


      const result =
        await pool.query(
          `
          SELECT
            m.id,
            m.conversation_id,
            m.sender_id,
            m.body,
            m.message_type,
            m.created_at,

            u.username,
            u.display_name,
            u.avatar_url

          FROM messages m

          INNER JOIN users u
            ON u.id = m.sender_id

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


      res.json({
        success: true,
        messages:
          result.rows.reverse()
      });
    }
  )
);


/* ======================================================
   SEND MESSAGE HTTP
====================================================== */

app.post(
  '/api/conversations/:id/messages',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const conversationId =
        Number(
          req.params.id
        );


      const body =
        cleanString(
          req.body.body,
          4000
        );


      if (!body) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'الرسالة فارغة.'
          });
      }


      const membership =
        await pool.query(
          `
          SELECT
            user_one_id,
            user_two_id
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


      if (
        membership.rowCount === 0
      ) {

        return res
          .status(403)
          .json({
            success: false,
            message:
              'لا تملك صلاحية الإرسال.'
          });
      }


      const result =
        await pool.query(
          `
          INSERT INTO messages (
            conversation_id,
            sender_id,
            body,
            message_type,
            created_at
          )
          VALUES (
            $1,
            $2,
            $3,
            'text',
            NOW()
          )
          RETURNING
            id,
            conversation_id,
            sender_id,
            body,
            message_type,
            created_at
          `,
          [
            conversationId,
            req.user.id,
            body
          ]
        );


      await pool.query(
        `
        UPDATE conversations
        SET
          updated_at = NOW()
        WHERE id = $1
        `,
        [
          conversationId
        ]
      );


      const message =
        result.rows[0];


      io
        .to(
          `conversation:${conversationId}`
        )
        .emit(
          'message:new',
          message
        );


      res
        .status(201)
        .json({
          success: true,
          message
        });
    }
  )
);


/* ======================================================
   NOTIFICATIONS
====================================================== */

app.get(
  '/api/notifications',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const limit =
        parsePositiveInteger(
          req.query.limit,
          30,
          100
        );


      const result =
        await pool.query(
          `
          SELECT
            id,
            type,
            title,
            body,
            data,
            is_read,
            created_at
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


      res.json({
        success: true,
        notifications:
          result.rows
      });
    }
  )
);


/* ======================================================
   MARK NOTIFICATIONS READ
====================================================== */

app.patch(
  '/api/notifications/read',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      await pool.query(
        `
        UPDATE notifications
        SET
          is_read = TRUE,
          read_at = NOW()
        WHERE
          user_id = $1
          AND is_read = FALSE
        `,
        [
          req.user.id
        ]
      );


      res.json({
        success: true
      });
    }
  )
);


/* ======================================================
   COINS BALANCE
====================================================== */

app.get(
  '/api/wallet',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const result =
        await pool.query(
          `
          SELECT
            coins_balance,
            updated_at
          FROM wallets
          WHERE user_id = $1
          LIMIT 1
          `,
          [
            req.user.id
          ]
        );


      if (
        result.rowCount === 0
      ) {

        return res.json({
          success: true,
          wallet: {
            coins_balance: 0
          }
        });
      }


      res.json({
        success: true,
        wallet:
          result.rows[0]
      });
    }
  )
);


/* ======================================================
   COINS HISTORY
====================================================== */

app.get(
  '/api/wallet/history',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const limit =
        parsePositiveInteger(
          req.query.limit,
          50,
          100
        );


      const result =
        await pool.query(
          `
          SELECT
            id,
            type,
            amount,
            balance_after,
            description,
            reference_type,
            reference_id,
            created_at
          FROM wallet_transactions
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2
          `,
          [
            req.user.id,
            limit
          ]
        );


      res.json({
        success: true,
        transactions:
          result.rows
      });
    }
  )
);


/* ======================================================
   REPORT USER
====================================================== */

app.post(
  '/api/reports/user',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const targetUserId =
        Number(
          req.body.userId
        );


      const reason =
        cleanString(
          req.body.reason,
          500
        );


      if (
        !Number.isInteger(
          targetUserId
        ) ||
        targetUserId ===
          req.user.id
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'المستخدم غير صالح.'
          });
      }


      if (!reason) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'يجب تحديد سبب البلاغ.'
          });
      }


      await pool.query(
        `
        INSERT INTO reports (
          reporter_id,
          reported_user_id,
          reason,
          status,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'pending',
          NOW()
        )
        `,
        [
          req.user.id,
          targetUserId,
          reason
        ]
      );


      res
        .status(201)
        .json({
          success: true,
          message:
            'تم إرسال البلاغ للمراجعة.'
        });
    }
  )
);


/* ======================================================
   BLOCK USER
====================================================== */

app.post(
  '/api/blocks/:userId',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const targetUserId =
        Number(
          req.params.userId
        );


      if (
        !Number.isInteger(
          targetUserId
        ) ||
        targetUserId ===
          req.user.id
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'المستخدم غير صالح.'
          });
      }


      await pool.query(
        `
        INSERT INTO user_blocks (
          blocker_id,
          blocked_id,
          created_at
        )
        VALUES (
          $1,
          $2,
          NOW()
        )
        ON CONFLICT (
          blocker_id,
          blocked_id
        )
        DO NOTHING
        `,
        [
          req.user.id,
          targetUserId
        ]
      );


      res.json({
        success: true,
        message:
          'تم حظر المستخدم.'
      });
    }
  )
);


/* ======================================================
   UNBLOCK USER
====================================================== */

app.delete(
  '/api/blocks/:userId',
  authenticate,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const targetUserId =
        Number(
          req.params.userId
        );


      await pool.query(
        `
        DELETE FROM user_blocks
        WHERE
          blocker_id = $1
          AND blocked_id = $2
        `,
        [
          req.user.id,
          targetUserId
        ]
      );


      res.json({
        success: true,
        message:
          'تم إلغاء الحظر.'
      });
    }
  )
);


/* ======================================================
   CHANGE PASSWORD
====================================================== */

app.patch(
  '/api/auth/password',
  authenticate,
  authLimiter,
  asyncHandler(
    async (
      req,
      res
    ) => {

      const currentPassword =
        String(
          req.body.currentPassword || ''
        );


      const newPassword =
        String(
          req.body.newPassword || ''
        );


      const confirmPassword =
        String(
          req.body.confirmPassword || ''
        );


      if (
        newPassword.length < 8
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'كلمة المرور الجديدة قصيرة.'
          });
      }


      if (
        newPassword !==
        confirmPassword
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'تأكيد كلمة المرور غير مطابق.'
          });
      }


      const result =
        await pool.query(
          `
          SELECT password_hash
          FROM users
          WHERE id = $1
          LIMIT 1
          `,
          [
            req.user.id
          ]
        );


      if (
        result.rowCount === 0 ||
        !result.rows[0].password_hash
      ) {

        return res
          .status(400)
          .json({
            success: false,
            message:
              'لا يمكن تغيير كلمة المرور لهذا الحساب.'
          });
      }


      const valid =
        await bcrypt.compare(
          currentPassword,
          result.rows[0].password_hash
        );


      if (!valid) {

        return res
          .status(401)
          .json({
            success: false,
            message:
              'كلمة المرور الحالية غير صحيحة.'
          });
      }


      const hash =
        await bcrypt.hash(
          newPassword,
          Number(
            process.env.BCRYPT_ROUNDS ||
            12
          )
        );


      await pool.query(
        `
        UPDATE users
        SET
          password_hash = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [
          hash,
          req.user.id
        ]
      );


      res.json({
        success: true,
        message:
          'تم تغيير كلمة المرور.'
      });
    }
  )
);


/* ======================================================
   SOCKET.IO AUTH
====================================================== */

io.use(
  async (
    socket,
    next
  ) => {

    try {

      const authToken =
        socket.handshake.auth?.token;


      const cookieHeader =
        socket.handshake.headers.cookie || '';


      let cookieToken =
        null;


      const match =
        cookieHeader.match(
          /(?:^|;\s*)afendina_token=([^;]+)/
        );


      if (match) {
        cookieToken =
          decodeURIComponent(
            match[1]
          );
      }


      const token =
        authToken ||
        cookieToken;


      if (!token) {

        return next(
          new Error(
            'AUTH_REQUIRED'
          )
        );
      }


      const payload =
        jwt.verify(
          token,
          JWT_SECRET,
          {
            issuer:
              'afendina'
          }
        );


      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            display_name,
            avatar_url,
            role,
            is_active
          FROM users
          WHERE id = $1
          LIMIT 1
          `,
          [
            payload.sub
          ]
        );


      if (
        result.rowCount === 0 ||
        !result.rows[0].is_active
      ) {

        return next(
          new Error(
            'USER_NOT_AVAILABLE'
          )
        );
      }


      socket.user =
        result.rows[0];


      next();

    } catch (error) {

      next(
        new Error(
          'AUTH_INVALID'
        )
      );
    }
  }
);


/* ======================================================
   SOCKET.IO CONNECTION
====================================================== */

io.on(
  'connection',
  socket => {

    const userId =
      socket.user.id;


    socket.join(
      `user:${userId}`
    );


    pool.query(
      `
      UPDATE users
      SET last_seen_at = NOW()
      WHERE id = $1
      `,
      [
        userId
      ]
    )
    .catch(
      console.error
    );


    socket.on(
      'presence:update',
      () => {

        pool.query(
          `
          UPDATE users
          SET last_seen_at = NOW()
          WHERE id = $1
          `,
          [
            userId
          ]
        )
        .catch(
          console.error
        );
      }
    );


    socket.on(
      'conversation:join',
      async conversationId => {

        const id =
          Number(
            conversationId
          );


        if (
          !Number.isInteger(id)
        ) {

          return;
        }


        try {

          const result =
            await pool.query(
              `
              SELECT id
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
                id,
                userId
              ]
            );


          if (
            result.rowCount === 0
          ) {

            return;
          }


          socket.join(
            `conversation:${id}`
          );

        } catch (error) {

          console.error(
            error
          );
        }
      }
    );


    socket.on(
      'conversation:leave',
      conversationId => {

        const id =
          Number(
            conversationId
          );


        if (
          Number.isInteger(id)
        ) {

          socket.leave(
            `conversation:${id}`
          );
        }
      }
    );


    socket.on(
      'message:send',
      async payload => {

        try {

          const conversationId =
            Number(
              payload?.conversationId
            );


          const body =
            cleanString(
              payload?.body,
              4000
            );


          if (
            !Number.isInteger(
              conversationId
            ) ||
            !body
          ) {

            return;
          }


          const membership =
            await pool.query(
              `
              SELECT
                user_one_id,
                user_two_id
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
                userId
              ]
            );


          if (
            membership.rowCount === 0
          ) {

            return;
          }


          const result =
            await pool.query(
              `
              INSERT INTO messages (
                conversation_id,
                sender_id,
                body,
                message_type,
                created_at
              )
              VALUES (
                $1,
                $2,
                $3,
                'text',
                NOW()
              )
              RETURNING
                id,
                conversation_id,
                sender_id,
                body,
                message_type,
                created_at
              `,
              [
                conversationId,
                userId,
                body
              ]
            );


          await pool.query(
            `
            UPDATE conversations
            SET updated_at = NOW()
            WHERE id = $1
            `,
            [
              conversationId
            ]
          );


          const message =
            result.rows[0];


          io
            .to(
              `conversation:${conversationId}`
            )
            .emit(
              'message:new',
              message
            );


        } catch (error) {

          socket.emit(
            'message:error',
            {
              message:
                'تعذر إرسال الرسالة.'
            }
          );
        }
      }
    );


    socket.on(
      'disconnect',
      () => {

        pool.query(
          `
          UPDATE users
          SET last_seen_at = NOW()
          WHERE id = $1
          `,
          [
            userId
          ]
        )
        .catch(
          console.error
        );
      }
    );
  }
);


/* ======================================================
   UPLOAD STATIC ROUTE
====================================================== */

app.use(
  '/uploads',
  express.static(
    UPLOAD_DIR,
    {
      index: false,
      maxAge:
        '1d'
    }
  )
);


/* ======================================================
   API 404
====================================================== */

app.use(
  '/api',
  (
    req,
    res
  ) => {

    res
      .status(404)
      .json({
        success: false,
        message:
          'المسار غير موجود.'
      });
  }
);


/* ======================================================
   FRONTEND FALLBACK
====================================================== */

app.get(
  '*',
  (
    req,
    res,
    next
  ) => {

    if (
      req.path.startsWith('/api/')
    ) {

      return next();
    }


    const indexPath =
      path.join(
        __dirname,
        'public',
        'index.html'
      );


    res.sendFile(
      indexPath,
      error => {

        if (error) {
          next(error);
        }
      }
    );
  }
);


/* ======================================================
   ERROR HANDLER
====================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      error
    );


    if (
      error instanceof
      multer.MulterError
    ) {

      return res
        .status(400)
        .json({
          success: false,
          message:
            'تعذر رفع الملف.'
        });
    }


    if (
      error.message ===
      'نوع الملف غير مسموح.'
    ) {

      return res
        .status(400)
        .json({
          success: false,
          message:
            error.message
        });
    }


    const status =
      Number(
        error.statusCode
      ) || 500;


    res
      .status(status)
      .json({
        success: false,

        message:
          NODE_ENV === 'production'
            ? 'حدث خطأ داخلي في الخادم.'
            : error.message
      });
  }
);


/* ======================================================
   DATABASE STARTUP
====================================================== */

async function verifyDatabase() {

  const client =
    await pool.connect();


  try {

    await client.query(
      'SELECT NOW()'
    );

    console.log(
      'PostgreSQL connection: OK'
    );

  } finally {

    client.release();
  }
}


/* ======================================================
   SERVER START
====================================================== */

async function startServer() {

  try {

    await verifyDatabase();


    server.listen(
      PORT,
      HOST,
      () => {

        console.log(
          '========================================'
        );

        console.log(
          'افـنـدツينا🥀🖤'
        );

        console.log(
          `Server: http://${HOST}:${PORT}`
        );

        console.log(
          `Environment: ${NODE_ENV}`
        );

        console.log(
          'Database: PostgreSQL'
        );

        console.log(
          'Realtime: Socket.IO'
        );

        console.log(
          '========================================'
        );
      }
    );

  } catch (error) {

    console.error(
      'Server startup failed:',
      error
    );


    process.exit(1);
  }
}


/* ======================================================
   GRACEFUL SHUTDOWN
====================================================== */

async function shutdown(
  signal
) {

  console.log(
    `${signal} received. Shutting down...`
  );


  server.close(
    async () => {

      try {

        await pool.end();

        console.log(
          'Server closed.'
        );

        process.exit(0);

      } catch (error) {

        console.error(
          error
        );

        process.exit(1);
      }
    }
  );
}


process.on(
  'SIGTERM',
  () => shutdown('SIGTERM')
);


process.on(
  'SIGINT',
  () => shutdown('SIGINT')
);


/* ======================================================
   UNHANDLED ERRORS
====================================================== */

process.on(
  'unhandledRejection',
  error => {

    console.error(
      'Unhandled rejection:',
      error
    );
  }
);


process.on(
  'uncaughtException',
  error => {

    console.error(
      'Uncaught exception:',
      error
    );

    process.exit(1);
  }
);


/* ======================================================
   START
====================================================== */

startServer();
