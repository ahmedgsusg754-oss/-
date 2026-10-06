'use strict';

require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { Server } = require('socket.io');

const database = require('./database');

const app = express();
const httpServer = http.createServer(app);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v1';
const API_BASE = `${API_PREFIX}/${API_VERSION}`;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;

const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

if (String(process.env.TRUST_PROXY).toLowerCase() === 'true') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

if (String(process.env.ENABLE_COMPRESSION).toLowerCase() !== 'false') {
  app.use(compression());
}

const allowedOrigins = String(process.env.CORS_ORIGINS || FRONTEND_URL)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin غير مسموح به.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

app.use(
  express.json({
    limit: process.env.MAX_JSON_SIZE || '1mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.MAX_URLENCODED_SIZE || '1mb'
  })
);

app.use(
  express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    extensions: ['html'],
    maxAge: isProduction ? '1d' : 0
  })
);

app.get('/health', async (req, res) => {
  try {
    await database.query('SELECT 1');

    return res.status(200).json({
      success: true,
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: 'error',
      database: 'disconnected'
    });
  }
});

app.get(`${API_BASE}/health`, async (req, res) => {
  try {
    await database.query('SELECT 1');

    return res.status(200).json({
      success: true,
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: 'error',
      database: 'disconnected'
    });
  }
});

app.get(`${API_BASE}`, (req, res) => {
  res.status(200).json({
    success: true,
    name: process.env.APP_NAME || 'افـنـدツ⁠يـنـا🥀🖤',
    version: API_VERSION
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

const io = new Server(httpServer, {
  path: process.env.SOCKET_PATH || '/socket.io',
  cors: {
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  },
  pingInterval: Number(process.env.SOCKET_PING_INTERVAL || 25000),
  pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT || 20000)
});

app.set('io', io);

const routeModules = [
  ['auth', './routes/auth'],
  ['users', './routes/users'],
  ['profile', './routes/profile'],
  ['settings', './routes/settings'],
  ['uploads', './routes/uploads'],
  ['rooms', './routes/rooms'],
  ['room-members', './routes/roomMembers'],
  ['room-settings', './routes/roomSettings'],
  ['posts', './routes/posts'],
  ['comments', './routes/comments'],
  ['reactions', './routes/reactions'],
  ['wallet', './routes/wallet'],
  ['transfers', './routes/transfers'],
  ['gifts', './routes/gifts'],
  ['store', './routes/store'],
  ['levels', './routes/levels'],
  ['notifications', './routes/notifications'],
  ['admin', './routes/admin'],
  ['admin-users', './routes/adminUsers'],
  ['admin-rooms', './routes/adminRooms'],
  ['admin-settings', './routes/adminSettings']
];

function loadRoutes() {
  for (const [name, modulePath] of routeModules) {
    try {
      const routeModule = require(modulePath);

      if (typeof routeModule === 'function') {
        app.use(`${API_BASE}/${name}`, routeModule);
      } else if (routeModule && typeof routeModule.router === 'function') {
        app.use(`${API_BASE}/${name}`, routeModule.router);
      } else {
        throw new TypeError(`ملف المسار ${modulePath} لا يصدّر Router صالحًا.`);
      }
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND' && error.message.includes(modulePath)) {
        if (process.env.NODE_ENV === 'development') {
          return;
        }
        throw error;
      }

      throw error;
    }
  }
}

function loadSocketModule() {
  try {
    const socketModule = require('./socket');

    if (typeof socketModule === 'function') {
      socketModule(io);
      return;
    }

    if (socketModule && typeof socketModule.initialize === 'function') {
      socketModule.initialize(io);
      return;
    }

    if (socketModule && typeof socketModule.setup === 'function') {
      socketModule.setup(io);
      return;
    }

    throw new TypeError('./socket.js لا يصدّر دالة تهيئة صالحة.');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('./socket')) {
      if (process.env.NODE_ENV === 'development') {
        return;
      }
      throw error;
    }

    throw error;
  }
}

app.use((req, res) => {
  if (req.path.startsWith(API_PREFIX)) {
    return res.status(404).json({
      success: false,
      message: 'المسار غير موجود.'
    });
  }

  return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({
        success: false,
        message: 'الصفحة غير موجودة.'
      });
    }
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status =
    Number.isInteger(error.statusCode) && error.statusCode >= 400
      ? error.statusCode
      : Number.isInteger(error.status) && error.status >= 400
        ? error.status
        : 500;

  if (process.env.ENABLE_SECURITY_LOGGING === 'true' && process.env.LOG_LEVEL !== 'silent') {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, error);
  }

  return res.status(status).json({
    success: false,
    message:
      status === 500
        ? 'حدث خطأ داخلي في الخادم.'
        : error.message || 'حدث خطأ أثناء تنفيذ الطلب.'
  });
});

let serverStarted = false;

async function startServer() {
  if (serverStarted) {
    return httpServer;
  }

  await database.query('SELECT 1');

  loadRoutes();
  loadSocketModule();

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);

    httpServer.listen(PORT, HOST, () => {
      httpServer.removeListener('error', reject);
      resolve();
    });
  });

  serverStarted = true;

  console.log(
    `${process.env.APP_NAME || 'افـنـدツ⁠يـنـا🥀🖤'} يعمل على http://${HOST}:${PORT}`
  );

  return httpServer;
}

async function shutdown(signal) {
  if (!serverStarted) {
    return;
  }

  console.log(`إيقاف الخادم بسبب ${signal}...`);

  await new Promise((resolve) => {
    io.close(() => resolve());
  });

  await new Promise((resolve) => {
    httpServer.close(() => resolve());
  });

  if (database && typeof database.end === 'function') {
    await database.end();
  }

  serverStarted = false;
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(() => process.exit(1));
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  startServer().catch((error) => {
    console.error('تعذر تشغيل الخادم:', error);
    process.exit(1);
  });
}

module.exports = {
  app,
  httpServer,
  io,
  startServer
};
