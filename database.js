'use strict';

/*
========================================================
 افـنـدツينا🥀🖤
 database.js
 PostgreSQL Database Layer
========================================================

 مسؤول عن:
 - إنشاء وإدارة PostgreSQL Pool
 - فحص إعدادات قاعدة البيانات
 - الاتصال الآمن
 - الاستعلامات
 - المعاملات Transactions
 - تنفيذ العمليات داخل Transaction
 - معالجة أخطاء PostgreSQL
 - Health Check
 - إغلاق الاتصالات بأمان

 لا يحتوي على:
 - مستخدمين وهميين
 - بيانات تجريبية
 - كلمات مرور
 - API Keys
 - بيانات اتصال ثابتة
 - إنشاء جداول
 - بيانات افتراضية

 الجداول يتم إنشاؤها بواسطة schema.sql.
========================================================
*/


/* ======================================================
   DEPENDENCIES
====================================================== */

const { Pool } = require('pg');

require('dotenv').config();


/* ======================================================
   ENVIRONMENT
====================================================== */

const NODE_ENV =
  process.env.NODE_ENV || 'production';

const DATABASE_URL =
  process.env.DATABASE_URL;

const DATABASE_SSL =
  process.env.DATABASE_SSL === 'true';

const DATABASE_SSL_REJECT_UNAUTHORIZED =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

const DB_POOL_MAX =
  Number.parseInt(
    process.env.DB_POOL_MAX || '10',
    10
  );

const DB_IDLE_TIMEOUT =
  Number.parseInt(
    process.env.DB_IDLE_TIMEOUT || '30000',
    10
  );

const DB_CONNECTION_TIMEOUT =
  Number.parseInt(
    process.env.DB_CONNECTION_TIMEOUT || '10000',
    10
  );


/* ======================================================
   ENVIRONMENT VALIDATION
====================================================== */

if (!DATABASE_URL) {

  throw new Error(
    'DATABASE_URL is required.'
  );
}


if (
  !Number.isInteger(DB_POOL_MAX) ||
  DB_POOL_MAX < 1
) {

  throw new Error(
    'DB_POOL_MAX must be a positive integer.'
  );
}


if (
  !Number.isInteger(DB_IDLE_TIMEOUT) ||
  DB_IDLE_TIMEOUT < 0
) {

  throw new Error(
    'DB_IDLE_TIMEOUT must be a valid integer.'
  );
}


if (
  !Number.isInteger(DB_CONNECTION_TIMEOUT) ||
  DB_CONNECTION_TIMEOUT < 1000
) {

  throw new Error(
    'DB_CONNECTION_TIMEOUT must be at least 1000ms.'
  );
}


/* ======================================================
   POOL CONFIGURATION
====================================================== */

const poolConfig = {

  connectionString:
    DATABASE_URL,

  max:
    DB_POOL_MAX,

  idleTimeoutMillis:
    DB_IDLE_TIMEOUT,

  connectionTimeoutMillis:
    DB_CONNECTION_TIMEOUT,

  allowExitOnIdle:
    NODE_ENV === 'test',

  keepAlive:
    true
};


/* ======================================================
   SSL
====================================================== */

if (DATABASE_SSL) {

  poolConfig.ssl = {

    rejectUnauthorized:
      DATABASE_SSL_REJECT_UNAUTHORIZED
  };
}


/* ======================================================
   DATABASE POOL
====================================================== */

const pool =
  new Pool(
    poolConfig
  );


/* ======================================================
   INTERNAL STATE
====================================================== */

let databaseReady =
  false;

let databaseClosing =
  false;


/* ======================================================
   POOL EVENTS
====================================================== */

pool.on(
  'connect',
  client => {

    if (
      NODE_ENV !== 'test'
    ) {

      console.log(
        '[database] PostgreSQL client connected.'
      );
    }
  }
);


pool.on(
  'error',
  error => {

    console.error(
      '[database] Unexpected PostgreSQL pool error:',
      error
    );
  }
);


/* ======================================================
   ERROR NORMALIZATION
====================================================== */

function normalizeDatabaseError(
  error
) {

  if (!error) {

    return {
      code:
        'UNKNOWN_DATABASE_ERROR',

      message:
        'Unknown database error.'
    };
  }


  return {

    code:
      error.code ||
      'DATABASE_ERROR',

    message:
      error.message ||
      'Database operation failed.',

    detail:
      NODE_ENV === 'production'
        ? undefined
        : error.detail,

    constraint:
      error.constraint,

    table:
      error.table,

    column:
      error.column
  };
}


/* ======================================================
   QUERY
====================================================== */

/**
 * Execute a parameterized PostgreSQL query.
 *
 * @param {string} text
 * @param {Array} params
 * @returns {Promise<import('pg').QueryResult>}
 */

async function query(
  text,
  params = []
) {

  if (
    databaseClosing
  ) {

    throw new Error(
      'Database is shutting down.'
    );
  }


  if (
    typeof text !== 'string' ||
    text.trim().length === 0
  ) {

    throw new TypeError(
      'Database query must be a non-empty string.'
    );
  }


  if (
    !Array.isArray(params)
  ) {

    throw new TypeError(
      'Database query parameters must be an array.'
    );
  }


  try {

    return await pool.query(
      text,
      params
    );

  } catch (error) {

    error.database =
      normalizeDatabaseError(
        error
      );

    throw error;
  }
}


/* ======================================================
   GET CLIENT
====================================================== */

/**
 * Acquire a dedicated PostgreSQL client.
 *
 * Caller MUST call client.release().
 */

async function getClient() {

  if (
    databaseClosing
  ) {

    throw new Error(
      'Database is shutting down.'
    );
  }


  return pool.connect();
}


/* ======================================================
   TRANSACTION
====================================================== */

/**
 * Execute callback inside a PostgreSQL transaction.
 *
 * Automatic:
 * BEGIN
 * COMMIT
 * ROLLBACK
 *
 * @param {Function} callback
 */

async function transaction(
  callback
) {

  if (
    typeof callback !== 'function'
  ) {

    throw new TypeError(
      'Transaction callback must be a function.'
    );
  }


  const client =
    await getClient();


  try {

    await client.query(
      'BEGIN'
    );


    const result =
      await callback(
        client
      );


    await client.query(
      'COMMIT'
    );


    return result;

  } catch (error) {

    try {

      await client.query(
        'ROLLBACK'
      );

    } catch (rollbackError) {

      console.error(
        '[database] Transaction rollback failed:',
        rollbackError
      );
    }


    error.database =
      normalizeDatabaseError(
        error
      );


    throw error;

  } finally {

    client.release();
  }
}


/* ======================================================
   TRANSACTION ISOLATION
====================================================== */

/**
 * Execute a transaction with a selected isolation level.
 *
 * Supported:
 * READ COMMITTED
 * REPEATABLE READ
 * SERIALIZABLE
 */

async function transactionWithIsolation(
  isolationLevel,
  callback
) {

  const allowedLevels =
    new Set([
      'READ COMMITTED',
      'REPEATABLE READ',
      'SERIALIZABLE'
    ]);


  if (
    !allowedLevels.has(
      isolationLevel
    )
  ) {

    throw new Error(
      'Invalid transaction isolation level.'
    );
  }


  if (
    typeof callback !== 'function'
  ) {

    throw new TypeError(
      'Transaction callback must be a function.'
    );
  }


  const client =
    await getClient();


  try {

    await client.query(
      'BEGIN'
    );


    await client.query(
      `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
    );


    const result =
      await callback(
        client
      );


    await client.query(
      'COMMIT'
    );


    return result;

  } catch (error) {

    try {

      await client.query(
        'ROLLBACK'
      );

    } catch (rollbackError) {

      console.error(
        '[database] Rollback failed:',
        rollbackError
      );
    }


    error.database =
      normalizeDatabaseError(
        error
      );


    throw error;

  } finally {

    client.release();
  }
}


/* ======================================================
   HEALTH CHECK
====================================================== */

async function healthCheck() {

  try {

    const result =
      await pool.query(
        `
        SELECT
          NOW() AS server_time,
          current_database() AS database_name,
          current_user AS database_user
        `
      );


    databaseReady =
      true;


    return {

      connected:
        true,

      serverTime:
        result.rows[0].server_time,

      database:
        result.rows[0].database_name,

      user:
        result.rows[0].database_user
    };

  } catch (error) {

    databaseReady =
      false;


    error.database =
      normalizeDatabaseError(
        error
      );


    throw error;
  }
}


/* ======================================================
   CHECK CONNECTION
====================================================== */

async function checkConnection() {

  try {

    await pool.query(
      'SELECT 1'
    );


    databaseReady =
      true;


    return true;

  } catch (error) {

    databaseReady =
      false;


    return false;
  }
}


/* ======================================================
   GET STATUS
====================================================== */

function getStatus() {

  return {

    ready:
      databaseReady,

    closing:
      databaseClosing,

    poolSize:
      pool.totalCount,

    idleConnections:
      pool.idleCount,

    waitingClients:
      pool.waitingCount
  };
}


/* ======================================================
   DATABASE TIME
====================================================== */

async function getDatabaseTime() {

  const result =
    await query(
      'SELECT NOW() AS current_time'
    );


  return result.rows[0]
    .current_time;
}


/* ======================================================
   BEGIN
====================================================== */

async function begin(
  client
) {

  if (!client) {

    throw new TypeError(
      'A PostgreSQL client is required.'
    );
  }


  await client.query(
    'BEGIN'
  );
}


/* ======================================================
   COMMIT
====================================================== */

async function commit(
  client
) {

  if (!client) {

    throw new TypeError(
      'A PostgreSQL client is required.'
    );
  }


  await client.query(
    'COMMIT'
  );
}


/* ======================================================
   ROLLBACK
====================================================== */

async function rollback(
  client
) {

  if (!client) {

    throw new TypeError(
      'A PostgreSQL client is required.'
    );
  }


  await client.query(
    'ROLLBACK'
  );
}


/* ======================================================
   RELEASE CLIENT
====================================================== */

function releaseClient(
  client
) {

  if (
    client &&
    typeof client.release ===
      'function'
  ) {

    client.release();
  }
}


/* ======================================================
   CLOSE DATABASE
====================================================== */

async function closeDatabase() {

  if (
    databaseClosing
  ) {

    return;
  }


  databaseClosing =
    true;


  databaseReady =
    false;


  try {

    await pool.end();

    console.log(
      '[database] PostgreSQL pool closed.'
    );

  } catch (error) {

    console.error(
      '[database] Failed to close PostgreSQL pool:',
      error
    );

    throw error;
  }
}


/* ======================================================
   INITIALIZE DATABASE CONNECTION
====================================================== */

async function initializeDatabase() {

  if (
    databaseClosing
  ) {

    throw new Error(
      'Database is shutting down.'
    );
  }


  const status =
    await healthCheck();


  databaseReady =
    status.connected;


  return status;
}


/* ======================================================
   PROCESS SHUTDOWN
====================================================== */

let shutdownStarted =
  false;


async function handleShutdown(
  signal
) {

  if (
    shutdownStarted
  ) {

    return;
  }


  shutdownStarted =
    true;


  console.log(
    `[database] ${signal} received.`
  );


  try {

    await closeDatabase();

  } catch (error) {

    console.error(
      '[database] Shutdown failed:',
      error
    );
  }
}


/* ======================================================
   PROCESS SIGNALS
====================================================== */

process.once(
  'SIGINT',
  () => {

    handleShutdown(
      'SIGINT'
    );
  }
);


process.once(
  'SIGTERM',
  () => {

    handleShutdown(
      'SIGTERM'
    );
  }
);


/* ======================================================
   EXPORTS
====================================================== */

module.exports = {

  pool,

  query,

  getClient,

  transaction,

  transactionWithIsolation,

  healthCheck,

  checkConnection,

  getStatus,

  getDatabaseTime,

  begin,

  commit,

  rollback,

  releaseClient,

  initializeDatabase,

  closeDatabase

};
