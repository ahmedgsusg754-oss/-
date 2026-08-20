'use strict';

/*
========================================================
 افـنـدツينا🥀🖤
 server.js
 Authentication + API Server
========================================================

 يعمل مع:
 - database.js
 - PostgreSQL
 - auth.html
 - index.html

 الوظائف:
 - تشغيل Express
 - Health Check
 - تسجيل حساب حقيقي
 - تسجيل دخول حقيقي
 - جلسات آمنة
 - تسجيل خروج
 - معرفة المستخدم الحالي
 - حماية كلمات المرور باستخدام bcrypt
 - Rate Limit
 - CORS
 - Helmet
 - معالجة الأخطاء
 - Graceful Shutdown

 لا توجد:
 - حسابات وهمية
 - كلمات مرور ثابتة
 - API Keys ثابتة
 - مستخدمون تجريبيون

 المتطلبات:
 npm install express pg bcryptjs express-session connect-pg-simple
             cors helmet express-rate-limit dotenv
========================================================
*/


/* ======================================================
   DEPENDENCIES
====================================================== */

const express =
  require('express');

const cors =
  require('cors');

const helmet =
  require('helmet');

const rateLimit =
  require('express-rate-limit');

const session =
  require('express-session');

const pgSession =
  require('connect-pg-simple')(
    session
  );

const bcrypt =
  require('bcryptjs');

const crypto =
  require('crypto');

require('dotenv').config();

const database =
  require('./database');


/* ======================================================
   ENVIRONMENT
====================================================== */

const NODE_ENV =
  process.env.NODE_ENV ||
  'production';

const PORT =
  Number.parseInt(
    process.env.PORT || '3000',
    10
  );

const HOST =
  process.env.HOST ||
  '0.0.0.0';

const SESSION_SECRET =
  process.env.SESSION_SECRET;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  '';

const COOKIE_SECURE =
  process.env.COOKIE_SECURE !== 'false';

const COOKIE_SAME_SITE =
  process.env.COOKIE_SAME_SITE ||
  'lax';

const SESSION_MAX_AGE =
  Number.parseInt(
    process.env.SESSION_MAX_AGE ||
      String(
        1000 *
        60 *
        60 *
        24 *
        30
      ),
    10
  );

const BCRYPT_ROUNDS =
  Number.parseInt(
    process.env.BCRYPT_ROUNDS ||
      '12',
    10
  );


/* ======================================================
   VALIDATION
====================================================== */

if (
  !Number.isInteger(PORT) ||
  PORT < 1 ||
  PORT > 65535
) {

  throw new Error(
    'PORT must be a valid TCP port.'
  );
}


if (
  !SESSION_SECRET ||
  SESSION_SECRET.length < 32
) {

  throw new Error(
    'SESSION_SECRET must exist and contain at least 32 characters.'
  );
}


if (
  !Number.isInteger(BCRYPT_ROUNDS) ||
  BCRYPT_ROUNDS < 10 ||
  BCRYPT_ROUNDS > 15
) {

  throw new Error(
    'BCRYPT_ROUNDS must be between 10 and 15.'
  );
}


/* ======================================================
   APP
====================================================== */

const app =
  express();


app.disable(
  'x-powered-by'
);


app.set(
  'trust proxy',
  1
);


/* ======================================================
   SECURITY
====================================================== */

app.use(
  helmet({
    crossOriginResourcePolicy:
      {
        policy:
          'cross-origin'
      }
  })
);


/* ======================================================
   CORS
====================================================== */

const allowedOrigins =
  FRONTEND_URL
    ? FRONTEND_URL
        .split(',')
        .map(
          value =>
            value.trim()
        )
        .filter(Boolean)
    : [];


app.use(
  cors({

    origin:
      function(
        origin,
        callback
      ){

        /*
          الطلبات بدون Origin مثل curl
          أو بعض أدوات الخادم مسموحة.
        */

        if(!origin){

          return callback(
            null,
            true
          );

        }


        if(
          allowedOrigins.length === 0
        ){

          /*
            لا نسمح بمصدر خارجي إذا لم
            يتم تعريف FRONTEND_URL.
          */

          return callback(
            new Error(
              'CORS origin is not configured.'
            )
          );

        }


        if(
          allowedOrigins.includes(
            origin
          )
        ){

          return callback(
            null,
            true
          );

        }


        return callback(
          new Error(
            'Origin not allowed by CORS.'
          )
        );

      },

    credentials:
      true
  })
);


/* ======================================================
   BODY
====================================================== */

app.use(
  express.json({
    limit:
      '100kb'
  })
);


app.use(
  express.urlencoded({
    extended:
      false,

    limit:
      '100kb'
  })
);


/* ======================================================
   SESSION
====================================================== */

app.use(
  session({

    name:
      'afendina.sid',

    store:
      new pgSession({

        pool:
          database.pool,

        tableName:
          'user_sessions',

        createTableIfMissing:
          true
      }),

    secret:
      SESSION_SECRET,

    resave:
      false,

    saveUninitialized:
      false,

    rolling:
      true,

    cookie:{

      httpOnly:
        true,

      secure:
        COOKIE_SECURE,

      sameSite:
        COOKIE_SAME_SITE,

      maxAge:
        SESSION_MAX_AGE
    }
  })
);


/* ======================================================
   RATE LIMITERS
====================================================== */

const generalLimiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    max:
      300,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message:{
      success:
        false,

      message:
        'عدد الطلبات كبير جدًا. حاول لاحقًا.'
    }
  });


const authLimiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    max:
      15,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message:{
      success:
        false,

      message:
        'محاولات المصادقة كثيرة. حاول بعد قليل.'
    }
  });


app.use(
  generalLimiter
);


/* ======================================================
   HELPERS
====================================================== */

function normalizeEmail(
  email
){

  return String(
    email || ''
  )
    .trim()
    .toLowerCase();

}


function normalizeUsername(
  username
){

  return String(
    username || ''
  )
    .trim();

}


function isValidEmail(
  email
){

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


function isValidUsername(
  username
){

  return /^[a-zA-Z0-9_\u0600-\u06FF]{3,30}$/
    .test(username);

}


function isValidPassword(
  password
){

  return (
    typeof password ===
      'string' &&
    password.length >= 6 &&
    password.length <= 128
  );

}


function publicUser(
  user
){

  if(!user){

    return null;

  }


  return {

    id:
      user.id,

    username:
      user.username,

    email:
      user.email,

    avatar:
      user.avatar || null,

    level:
      Number(
        user.level || 1
      ),

    xp:
      Number(
        user.xp || 0
      ),

    coins:
      Number(
        user.coins || 0
      ),

    createdAt:
      user.created_at,

    lastLoginAt:
      user.last_login_at
  };

}


function generateId(){

  return crypto
    .randomUUID();

}


/* ======================================================
   DATABASE INITIALIZATION
====================================================== */

async function initializeSchema(){

  /*
    ننشئ جدول المستخدمين الأساسي فقط إذا لم يكن موجودًا.

    هذا لا يضع أي مستخدم تجريبي.
  */

  await database.query(`

    CREATE TABLE IF NOT EXISTS users (

      id UUID PRIMARY KEY,

      username VARCHAR(30)
        NOT NULL,

      email VARCHAR(320)
        NOT NULL,

      password_hash TEXT
        NOT NULL,

      avatar TEXT,

      level INTEGER
        NOT NULL
        DEFAULT 1,

      xp BIGINT
        NOT NULL
        DEFAULT 0,

      coins BIGINT
        NOT NULL
        DEFAULT 0,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      last_login_at TIMESTAMPTZ

    );

  `);


  await database.query(`

    CREATE UNIQUE INDEX IF NOT EXISTS
    users_email_unique_idx
    ON users (LOWER(email));

  `);


  await database.query(`

    CREATE UNIQUE INDEX IF NOT EXISTS
    users_username_unique_idx
    ON users (LOWER(username));

  `);

}


/* ======================================================
   HEALTH
====================================================== */

app.get(
  '/health',
  async (
    req,
    res
  ) => {

    try{

      const health =
        await database.healthCheck();


      return res.status(
        200
      ).json({

        success:
          true,

        server:
          'online',

        database:
          health.connected,

        time:
          health.serverTime
      });

    }catch(error){

      console.error(
        '[health]',
        error
      );


      return res.status(
        503
      ).json({

        success:
          false,

        server:
          'online',

        database:
          false
      });

    }

  }
);


/* ======================================================
   API STATUS
====================================================== */

app.get(
  '/api',
  (
    req,
    res
  ) => {

    res.json({

      success:
        true,

      name:
        'افـنـدツينا🥀🖤',

      api:
        'online',

      version:
        '1.0.0'
    });

  }
);


/* ======================================================
   REGISTER
====================================================== */

app.post(
  '/api/auth/register',
  authLimiter,
  async (
    req,
    res
  ) => {

    try{

      const username =
        normalizeUsername(
          req.body.username
        );

      const email =
        normalizeEmail(
          req.body.email
        );

      const password =
        req.body.password;


      /* =========================
         VALIDATION
      ========================= */

      if(
        !isValidUsername(
          username
        )
      ){

        return res.status(
          400
        ).json({

          success:
            false,

          message:
            'اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا.'
        });

      }


      if(
        !isValidEmail(
          email
        )
      ){

        return res.status(
          400
        ).json({

          success:
            false,

          message:
            'البريد الإلكتروني غير صحيح.'
        });

      }


      if(
        !isValidPassword(
          password
        )
      ){

        return res.status(
          400
        ).json({

          success:
            false,

          message:
            'كلمة المرور يجب أن تكون بين 6 و128 حرفًا.'
        });

      }


      /* =========================
         CHECK EXISTING USER
      ========================= */

      const existing =
        await database.query(

          `
          SELECT
            id
          FROM users
          WHERE
            LOWER(email) =
              LOWER($1)
            OR
            LOWER(username) =
              LOWER($2)
          LIMIT 1
          `,

          [
            email,
            username
          ]

        );


      if(
        existing.rows.length > 0
      ){

        return res.status(
          409
        ).json({

          success:
            false,

          message:
            'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل.'
        });

      }


      /* =========================
         HASH PASSWORD
      ========================= */

      const passwordHash =
        await bcrypt.hash(
          password,
          BCRYPT_ROUNDS
        );


      /* =========================
         CREATE USER
      ========================= */

      const userId =
        generateId();


      const result =
        await database.query(

          `
          INSERT INTO users (
            id,
            username,
            email,
            password_hash,
            level,
            xp,
            coins
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            1,
            0,
            0
          )

          RETURNING
            id,
            username,
            email,
            avatar,
            level,
            xp,
            coins,
            created_at,
            last_login_at
          `,

          [
            userId,
            username,
            email,
            passwordHash
          ]

        );


      const user =
        result.rows[0];


      /* =========================
         CREATE SESSION
      ========================= */

      await new Promise(
        (
          resolve,
          reject
        ) => {

          req.session.regenerate(
            error => {

              if(error){

                return reject(
                  error
                );

              }


              req.session.userId =
                user.id;


              req.session.authenticated =
                true;


              req.session.save(
                saveError => {

                  if(saveError){

                    return reject(
                      saveError
                    );

                  }


                  resolve();

                }
              );

            }
          );

        }
      );


      return res.status(
        201
      ).json({

        success:
          true,

        authenticated:
          true,

        user:
          publicUser(
            user
          )
      });


    }catch(error){

      console.error(
        '[register]',
        error
      );


      if(
        error.code ===
        '23505'
      ){

        return res.status(
          409
        ).json({

          success:
            false,

          message:
            'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل.'
        });

      }


      return res.status(
        500
      ).json({

        success:
          false,

        message:
          'حدث خطأ أثناء إنشاء الحساب.'
      });

    }

  }
);


/* ======================================================
   LOGIN
====================================================== */

app.post(
  '/api/auth/login',
  authLimiter,
  async (
    req,
    res
  ) => {

    try{

      const email =
        normalizeEmail(
          req.body.email
        );

      const password =
        req.body.password;


      if(
        !isValidEmail(
          email
        )
      ){

        return res.status(
          400
        ).json({

          success:
            false,

          message:
            'بيانات تسجيل الدخول غير صحيحة.'
        });

      }


      if(
        !isValidPassword(
          password
        )
      ){

        return res.status(
          400
        ).json({

          success:
            false,

          message:
            'بيانات تسجيل الدخول غير صحيحة.'
        });

      }


      const result =
        await database.query(

          `
          SELECT
            id,
            username,
            email,
            password_hash,
            avatar,
            level,
            xp,
            coins,
            created_at,
            last_login_at
          FROM users
          WHERE
            LOWER(email) =
              LOWER($1)
          LIMIT 1
          `,

          [
            email
          ]

        );


      if(
        result.rows.length === 0
      ){

        return res.status(
          401
        ).json({

          success:
            false,

          message:
            'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
        });

      }


      const user =
        result.rows[0];


      const passwordValid =
        await bcrypt.compare(
          password,
          user.password_hash
        );


      if(!passwordValid){

        return res.status(
          401
        ).json({

          success:
            false,

          message:
            'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
        });

      }


      /* =========================
         UPDATE LOGIN TIME
      ========================= */

      const updated =
        await database.query(

          `
          UPDATE users

          SET
            last_login_at =
              NOW()

          WHERE
            id = $1

          RETURNING
            id,
            username,
            email,
            avatar,
            level,
            xp,
            coins,
            created_at,
            last_login_at
          `,

          [
            user.id
          ]

        );


      const safeUser =
        updated.rows[0] ||
        user;


      /* =========================
         REGENERATE SESSION
      ========================= */

      await new Promise(
        (
          resolve,
          reject
        ) => {

          req.session.regenerate(
            error => {

              if(error){

                return reject(
                  error
                );

              }


              req.session.userId =
                safeUser.id;


              req.session.authenticated =
                true;


              req.session.save(
                saveError => {

                  if(saveError){

                    return reject(
                      saveError
                    );

                  }


                  resolve();

                }
              );

            }
          );

        }
      );


      return res.status(
        200
      ).json({

        success:
          true,

        authenticated:
          true,

        user:
          publicUser(
            safeUser
          )
      });


    }catch(error){

      console.error(
        '[login]',
        error
      );


      return res.status(
        500
      ).json({

        success:
          false,

        message:
          'حدث خطأ أثناء تسجيل الدخول.'
      });

    }

  }
);


/* ======================================================
   CURRENT USER
====================================================== */

app.get(
  '/api/auth/me',
  async (
    req,
    res
  ) => {

    try{

      if(
        !req.session ||
        !req.session.authenticated ||
        !req.session.userId
      ){

        return res.status(
          401
        ).json({

          success:
            false,

          authenticated:
            false,

          user:
            null
        });

      }


      const result =
        await database.query(

          `
          SELECT
            id,
            username,
            email,
            avatar,
            level,
            xp,
            coins,
            created_at,
            last_login_at
          FROM users
          WHERE
            id = $1
          LIMIT 1
          `,

          [
            req.session.userId
          ]

        );


      if(
        result.rows.length === 0
      ){

        req.session.destroy(
          () => {}
        );


        return res.status(
          401
        ).json({

          success:
            false,

          authenticated:
            false,

          user:
            null
        });

      }


      return res.status(
        200
      ).json({

        success:
          true,

        authenticated:
          true,

        user:
          publicUser(
            result.rows[0]
          )
      });


    }catch(error){

      console.error(
        '[auth/me]',
        error
      );


      return res.status(
        500
      ).json({

        success:
          false,

        authenticated:
          false,

        message:
          'تعذر التحقق من الجلسة.'
      });

    }

  }
);


/* ======================================================
   LOGOUT
====
