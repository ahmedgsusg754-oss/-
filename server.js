'use strict';

const path = require('path');
const fs = require('fs');

const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { Server } = require('socket.io');

require('dotenv').config();

const {
  query,
  transaction,
  initializeDatabase,
  closeDatabase
} = require('./database');


/* ======================================================
   CONFIG
====================================================== */

const app = express();
const server = http.createServer(app);

const PORT =
  Number.parseInt(process.env.PORT || '3000', 10);

const HOST =
  process.env.HOST || '0.0.0.0';

const APP_NAME =
  process.env.APP_NAME || 'افـنـدツينا🥀🖤';

const JWT_SECRET =
  process.env.JWT_SECRET;

const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || '7d';

const JWT_ISSUER =
  process.env.JWT_ISSUER || 'afendina';

const JWT_AUDIENCE =
  process.env.JWT_AUDIENCE || 'afendina-users';

const COOKIE_NAME =
  process.env.COOKIE_NAME || 'afendina_session';

const UPLOAD_DIR =
  path.resolve(
    process.env.UPLOAD_DIR || 'uploads'
  );

const MAX_FILE_SIZE =
  Number.parseInt(
    process.env.MAX_FILE_SIZE || '10485760',
    10
  );

const BCRYPT_ROUNDS =
  Number.parseInt(
    process.env.BCRYPT_ROUNDS || '12',
    10
  );


if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is required.'
  );
}


/* ======================================================
   DIRECTORIES
====================================================== */

fs.mkdirSync(
  UPLOAD_DIR,
  {
    recursive: true
  }
);


/* ======================================================
   SECURITY
====================================================== */

app.disable('x-powered-by');

if (
  process.env.TRUST_PROXY === 'true'
) {
  app.set('trust proxy', 1);
}


app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);


app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN ||
      false,

    credentials:
      process.env.CORS_CREDENTIALS === 'true'
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
   RATE LIMITING
====================================================== */

const generalLimiter =
  rateLimit({
    windowMs:
      Number.parseInt(
        process.env.RATE_LIMIT_WINDOW_MS ||
        '900000',
        10
      ),

    max:
      Number.parseInt(
        process.env.RATE_LIMIT_MAX ||
        '100',
        10
      ),

    standardHeaders: true,
    legacyHeaders: false
  });


const authLimiter =
  rateLimit({
    windowMs:
      Number.parseInt(
        process.env.AUTH_RATE_LIMIT_WINDOW_MS ||
        '900000',
        10
      ),

    max:
      Number.parseInt(
        process.env.AUTH_RATE_LIMIT_MAX ||
        '10',
        10
      ),

    standardHeaders: true,
    legacyHeaders: false
  });


app.use(
  generalLimiter
);


/* ======================================================
   STATIC FILES
====================================================== */

app.use(
  express.static(
    path.join(__dirname),
    {
      index: 'index.html'
    }
  )
);


/* ======================================================
   FILE UPLOAD
====================================================== */

const allowedImageTypes =
  new Set(
    (
      process.env.ALLOWED_IMAGE_TYPES ||
      'image/jpeg,image/png,image/webp'
    )
      .split(',')
      .map(
        value => value.trim().toLowerCase()
      )
      .filter(Boolean)
  );


const storage =
  multer.diskStorage({

    destination:
      (_req, _file, callback) => {

        callback(
          null,
          UPLOAD_DIR
        );
      },

    filename:
      (_req, file, callback) => {

        const extension =
          path.extname(
            file.originalname
          ).toLowerCase();

        const name =
          `${Date.now()}-${cryptoRandomId()}${extension}`;

        callback(
          null,
          name
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

    fileFilter:
      (_req, file, callback) => {

        const mime =
          String(
            file.mimetype || ''
          ).toLowerCase();

        if (
          !allowedImageTypes.has(
            mime
          )
        ) {

          return callback(
            new Error(
              'File type is not allowed.'
            )
          );
        }

        callback(
          null,
          true
        );
      }
  });


function cryptoRandomId() {

  return Math.random()
    .toString(36)
    .slice(2) +
    Date.now()
      .toString(36);
}


/* ======================================================
   SOCKET.IO
====================================================== */

const io =
  new Server(
    server,
    {
      cors: {
        origin:
          process.env.SOCKET_CORS_ORIGIN ||
          false,

        credentials:
          process.env.SOCKET_CREDENTIALS ===
          'true'
      }
    }
  );


/* ======================================================
   HELPERS
====================================================== */

function normalizeEmail(
  email
) {

  return String(
    email || ''
  )
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


function createToken(
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
        JWT_EXPIRES_IN,

      issuer:
        JWT_ISSUER,

      audience:
        JWT_AUDIENCE
    }
  );
}


function setAuthCookie(
  res,
  token
) {

  res.cookie(
    COOKIE_NAME,
    token,
    {
      httpOnly:
        process.env.COOKIE_HTTP_ONLY !==
        'false',

      secure:
        process.env.COOKIE_SECURE ===
        'true',

      sameSite:
        process.env.COOKIE_SAME_SITE ||
        'lax',

      maxAge:
        Number.parseInt(
          process.env.COOKIE_MAX_AGE ||
          '604800000',
          10
        ),

      path: '/'
    }
  );
}


function clearAuthCookie(
  res
) {

  res.clearCookie(
    COOKIE_NAME,
    {
      httpOnly: true,
      path: '/'
    }
  );
}


function getTokenFromRequest(
  req
) {

  if (
    req.cookies &&
    req.cookies[COOKIE_NAME]
  ) {

    return req.cookies[
      COOKIE_NAME
    ];
  }


  const header =
    req.headers.authorization || '';


  if (
    header.startsWith(
      'Bearer '
    )
  ) {

    return header.slice(7);
  }


  return null;
}


function verifyToken(
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


/* ======================================================
   AUTH MIDDLEWARE
====================================================== */

async function requireAuth(
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

      return res.status(401)
        .json({
          success: false,
          error:
            'Authentication required.'
        });
    }


    const payload =
      verifyToken(
        token
      );


    const result =
      await query(
        `
        SELECT
          id,
          username,
          email,
          display_name,
          role,
          avatar_url,
          cover_url,
          bio,
          birth_date,
          gender,
          country,
          city,
          is_verified,
          is_active,
          is_banned,
          created_at
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [
          payload.sub
        ]
      );


    if (
      result.rowCount !== 1
    ) {

      return res.status(401)
        .json({
          success: false,
          error:
            'User not found.'
        });
    }


    const user =
      result.rows[0];


    if (
      !user.is_active ||
      user.is_banned
    ) {

      return res.status(403)
        .json({
          success: false,
          error:
            'Account is unavailable.'
        });
    }


    req.user =
      user;


    next();

  } catch (error) {

    return res.status(401)
      .json({
        success: false,
        error:
          'Invalid or expired session.'
      });
  }
}


/* ======================================================
   ROLE MIDDLEWARE
====================================================== */

function requireRole(
  ...roles
) {

  return (
    req,
    res,
    next
  ) => {

    if (
      !req.user ||
      !roles.includes(
        req.user.role
      )
    ) {

      return res.status(403)
        .json({
          success: false,
          error:
            'Insufficient permissions.'
        });
    }


    next();
  };
}


/* ======================================================
   HEALTH
====================================================== */

app.get(
  '/api/health',
  async (
    _req,
    res
  ) => {

    try {

      await initializeDatabase();

      res.json({
        success: true,
        service: APP_NAME,
        database: 'connected'
      });

    } catch (error) {

      res.status(503)
        .json({
          success: false,
          error:
            'Database unavailable.'
        });
    }
  }
);


/* ======================================================
   AUTH - REGISTER
====================================================== */

app.post(
  '/api/auth/register',
  authLimiter,
  async (
    req,
    res,
    next
  ) => {

    try {

      const username =
        normalizeUsername(
          req.body.username
        );

      const email =
        normalizeEmail(
          req.body.email
        );

      const password =
        String(
          req.body.password || ''
        );

      const displayName =
        String(
          req.body.display_name ||
          req.body.displayName ||
          username
        ).trim();


      if (
        !/^[a-z0-9_.-]{3,30}$/i.test(
          username
        )
      ) {

        return res.status(400)
          .json({
            success: false,
            error:
              'Invalid username.'
          });
      }


      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {

        return res.status(400)
          .json({
            success: false,
            error:
              'Invalid email.'
          });
      }


      if (
        password.length <
        Number.parseInt(
          process.env.PASSWORD_MIN_LENGTH ||
          '8',
          10
        )
      ) {

        return res.status(400)
          .json({
            success: false,
            error:
              'Password is too short.'
          });
      }


      if (
        displayName.length < 1 ||
        displayName.length > 80
      ) {

        return res.status(400)
          .json({
            success: false,
            error:
              'Invalid display name.'
          });
      }


      const passwordHash =
        await bcrypt.hash(
          password,
          BCRYPT_ROUNDS
        );


      const result =
        await transaction(
          async client => {

            const inserted =
              await client.query(
                `
                INSERT INTO users (
                  username,
                  email,
                  password_hash,
                  display_name
                )
                VALUES (
                  $1,
                  $2,
                  $3,
                  $4
                )
                RETURNING
                  id,
                  username,
                  email,
                  display_name,
                  role,
                  created_at
                `,
                [
                  username,
                  email,
                  passwordHash,
                  displayName
                ]
              );


            const user =
              inserted.rows[0];


            await client.query(
              `
              INSERT INTO user_settings (
                user_id
              )
              VALUES ($1)
              ON CONFLICT (
                user_id
              )
              DO NOTHING
              `,
              [
                user.id
              ]
            );


            return user;
          }
        );


      const token =
        createToken(
          result
        );


      setAuthCookie(
        res,
        token
      );


      return res.status(201)
        .json({
          success: true,
          user: result
        });

    } catch (error) {

      if (
        error.code ===
        '23505'
      ) {

        return res.status(409)
          .json({
            success: false,
            error:
              'Username or email already exists.'
          });
      }


      next(error);
    }
  }
);


/* ======================================================
   AUTH - LOGIN
====================================================== */

app.post(
  '/api/auth/login',
  authLimiter,
  async (
    req,
    res,
    next
  ) => {

    try {

      const identifier =
        String(
          req.body.identifier ||
          req.body.email ||
          req.body.username ||
          ''
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ''
        );


      if (
        !identifier ||
        !password
      ) {

        return res.status(400)
          .json({
            success: false,
            error:
              'Identifier and password are required.'
          });
      }


      const result =
        await query(
          `
          SELECT
            id,
            username,
            email,
            display_name,
            password_hash,
            role,
            avatar_url,
            cover_url,
            bio,
            birth_date,
            gender,
            country,
            city,
            is_verified,
            is_active,
            is_banned,
            created_at
          FROM users
          WHERE
            LOWER(email) = $1
            OR LOWER(username) = $1
          LIMIT 1
          `,
          [
            identifier
          ]
        );


      if (
        result.rowCount !== 1
      ) {

        return res.status(401)
          .json({
            success: false,
            error:
              'Invalid login credentials.'
          });
      }


      const user =
        result.rows[0];


      if (
        !user.is_active ||
        user.is_banned
      ) {

        return res.status(403)
          .json({
            success: false,
            error:
              'Account is unavailable.'
          });
      }


      const validPassword =
        await bcrypt.compare(
          password,
          user.password_hash
        );


      if (!validPassword) {

        return res.status(401)
          .json({
            success: false,
            error:
              'Invalid login credentials.'
          });
      }


      await query(
        `
        UPDATE users
        SET last_seen_at = NOW()
        WHERE id = $1
        `,
        [
          user.id
        ]
      );


      delete user.password_hash;


      const token =
        createToken(
          user
        );


      setAuthCookie(
        res,
        token
      );


      return res.json({
        success: true,
        user
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ======================================================
   AUTH - CURRENT USER
====================================================== */

app.get(
  '/api/auth/me',
  requireAuth,
  (
    req,
    res
  ) => {

    res.json({
      success: true,
      user: req.user
    });
  }
);


/* ======================================================
   AUTH - LOGOUT
====================================================== */

app.post(
  '/api/auth/logout',
  (
    _req,
    res
  ) => {

    clearAuthCookie(
      res
    );


    res.json({
      success: true
    });
  }
);


/* ======================================================
   PROFILE
====================================================== */

app.get(
  '/api/users/:id',
  async (
    req,
    res,
    next
  ) => {

    try {

      const result =
        await query(
          `
          SELECT
            id,
            username,
            display_name,
            role,
            avatar_url,
            cover_url,
            bio,
            birth_date,
            gender,
            country,
            city,
            is_verified,
            created_at
          FROM users
          WHERE id = $1
          LIMIT 1
          `,
          [
            req.params.id
          ]
        );


      if (
        result.rowCount !== 1
      ) {

        return res.status(404)
          .json({
            success: false,
            error:
              'User not found.'
          });
      }


      res.json({
        success: true,
        user:
          result.rows[0]
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ======================================================
   UPDATE PROFILE
====================================================== */

app.patch(
  '/api/users/me',
  requireAuth,
  async (
    req,
    res,
    next
  ) => {

    try {

      const displayName =
        req.body.display_name !== undefined
          ? String(
              req.body.display_name
            ).trim()
          : null;

      const bio =
        req.body.bio !== undefined
          ? String(
              req.body.bio
            ).trim()
          : null;

      const country =
        req.body.country !== undefined
          ? String(
              req.body.country
            ).trim()
          : null;

      const city =
        req.body.city !== undefined
          ? String(
              req.body.city
            ).trim()
          : null;


      const result =
        await query(
          `
          UPDATE users
          SET
            display_name =
              COALESCE($1, display_name),

            bio =
              COALESCE($2, bio),

            country =
              COALESCE($3, country),

            city =
              COALESCE($4, city)

          WHERE id = $5

          RETURNING
            id,
            username,
            email,
            display_name,
            role,
            avatar_url,
            cover_url,
            bio,
            birth_date,
            gender,
            country,
            city,
            is_verified,
            created_at
          `,
          [
            displayName,
            bio,
            country,
            city,
            req.user.id
          ]
        );


      res.json({
        success: true,
        user:
          result.rows[0]
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ======================================================
   UPLOAD IMAGE
====================================================== */

app.post(
  '/api/uploads/image',
  requireAuth,
  upload.single('image'),
  (
    req,
    res
  ) => {

    if (!req.file) {

      return res.status(400)
        .json({
          success: false,
          error:
            'Image is required.'
        });
    }


    const relativePath =
      `/uploads/${req.file.filename}`;


    return res.status(201)
      .json({
        success: true,
        url: relativePath,
        filename:
          req.file.filename,
        mimeType:
          req.file.mimetype,
        size:
          req.file.size
      });
  }
);


/* ======================================================
   ADMIN - USERS
====================================================== */

app.get(
  '/api/admin/users',
  requireAuth,
  requireRole(
    'owner',
    'admin'
  ),
  async (
    req,
    res,
    next
  ) => {

    try {

      const limit =
        Math.min(
          Math.max(
            Number.parseInt(
              req.query.limit ||
              '50',
              10
            ),
            1
          ),
          100
        );

      const offset =
        Math.max(
          Number.parseInt(
            req.query.offset ||
            '0',
            10
          ),
          0
        );


      const result =
        await query(
          `
          SELECT
            id,
            username,
            email,
            display_name,
            role,
            is_verified,
            is_active,
            is_banned,
            created_at,
            last_seen_at
          FROM users
          ORDER BY created_at ASC
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
        users:
          result.rows
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ======================================================
   ADMIN - CHANGE ROLE
====================================================== */

app.patch(
  '/api/admin/users/:id/role',
  requireAuth,
  requireRole(
    'owner'
  ),
  async (
    req,
    res,
    next
  ) => {

    try {

      const role =
        String(
          req.body.role || ''
        ).trim();


      const allowed =
        new Set([
          'admin',
          'moderator',
          'user'
        ]);


      if (
        !allowed.has(
          role
        )
      ) {

        return res.status(400)
          .json({
            success: false,
            error:
              'Invalid role.'
          });
      }


      if (
        req.params.id ===
        req.user.id
      ) {

        return res.status(400)
          .json({
            success: false,
            error:
              'Owner cannot change their own role here.'
          });
      }


      const result =
        await query(
          `
          UPDATE users
          SET role = $1
          WHERE id = $2
          RETURNING
            id,
            username,
            role
          `,
          [
            role,
            req.params.id
          ]
        );


      if (
        result.rowCount !== 1
      ) {

        return res.status(404)
          .json({
            success: false,
            error:
              'User not found.'
          });
      }


      res.json({
        success: true,
        user:
          result.rows[0]
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ======================================================
   SOCKET AUTH
====================================================== */

io.use(
  async (
    socket,
    next
  ) => {

    try {

      const token =
        socket.handshake.auth &&
        socket.handshake.auth.token;


      if (!token) {

        return next(
          new Error(
            'Authentication required.'
          )
        );
      }


      const payload =
        verifyToken(
          token
        );


      const result =
        await query(
          `
          SELECT
            id,
            username,
            display_name,
            role,
            avatar_url,
            is_active,
            is_banned
          FROM users
          WHERE id = $1
          LIMIT 1
          `,
          [
            payload.sub
          ]
        );


      if (
        result.rowCount !== 1 ||
        !result.rows[0].is_active ||
        result.rows[0].is_banned
      ) {

        return next(
          new Error(
            'Account unavailable.'
          )
        );
      }


      socket.user =
        result.rows[0];


      next();

    } catch (_error) {

      next(
        new Error(
          'Invalid authentication.'
        )
      );
    }
  }
);


/* ======================================================
   SOCKET CONNECTION
====================================================== */

io.on(
  'connection',
  socket => {

    socket.join(
      `user:${socket.user.id}`
    );


    socket.emit(
      'connected',
      {
        success: true,
        user:
          socket.user
      }
    );


    socket.on(
      'presence',
      async () => {

        try {

          await query(
            `
            UPDATE users
            SET last_seen_at = NOW()
            WHERE id = $1
            `,
            [
              socket.user.id
            ]
          );

        } catch (_error) {
          // لا يتم إسقاط الاتصال بسبب فشل تحديث الحالة.
        }
      }
    );


    socket.on(
      'disconnect',
      () => {

        // حالة الاتصال تُستنتج من آخر نشاط محفوظ.
      }
    );
  }
);


/* ======================================================
   404
====================================================== */

app.use(
  (
    req,
    res,
    next
  ) => {

    if (
      req.path.startsWith(
        '/api/'
      )
    ) {

      return res.status(404)
        .json({
          success: false,
          error:
            'API endpoint not found.'
        });
    }


    next();
  }
);


app.get(
  '/404',
  (
    _req,
    res
  ) => {

    res.sendFile(
      path.join(
        __dirname,
        '404.html'
      )
    );
  }
);


/* ======================================================
   ERROR HANDLER
====================================================== */

app.use(
  (
    error,
    _req,
    res,
    _next
  ) => {

    console.error(
      '[server]',
      error
    );


    if (
      error.code ===
      'LIMIT_FILE_SIZE'
    ) {

      return res.status(413)
        .json({
          success: false,
          error:
            'Uploaded file is too large.'
        });
    }


    if (
      error.message ===
      'File type is not allowed.'
    ) {

      return res.status(400)
        .json({
          success: false,
          error:
            error.message
        });
    }


    if (
      error.code ===
      '23505'
    ) {

      return res.status(409)
        .json({
          success: false,
          error:
            'Resource already exists.'
        });
    }


    res.status(500)
      .json({
        success: false,
        error:
          'Internal server error.'
      });
  }
);


/* ======================================================
   START SERVER
====================================================== */

let shuttingDown =
  false;


async function start() {

  await initializeDatabase();


  server.listen(
    PORT,
    HOST,
    () => {

      console.log(
        `${APP_NAME} server running on ${HOST}:${PORT}`
      );
    }
  );
}


/* ======================================================
   GRACEFUL SHUTDOWN
====================================================== */

async function shutdown(
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
    `${signal} received. Shutting down...`
  );


  server.close(
    async () => {

      try {

        await closeDatabase();

        process.exit(0);

      } catch (error) {

        console.error(
          'Shutdown error:',
          error
        );

        process.exit(1);
      }
    }
  );
}


process.once(
  'SIGINT',
  () => {
    shutdown('SIGINT');
  }
);


process.once(
  'SIGTERM',
  () => {
    shutdown('SIGTERM');
  }
);


/* ======================================================
   START
====================================================== */

start()
  .catch(
    error => {

      console.error(
        'Failed to start server:',
        error
      );

      process.exit(1);
    }
  );


module.exports = {
  app,
  server,
  io
};
