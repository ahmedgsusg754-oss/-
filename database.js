'use strict';

const { Pool } = require('pg');

const requiredEnv = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
];

const missingEnv = requiredEnv.filter((key) => {
  return !process.env[key] || String(process.env[key]).trim() === '';
});

if (missingEnv.length > 0) {
  throw new Error(
    `متغيرات قاعدة البيانات غير مكتملة: ${missingEnv.join(', ')}`
  );
}

const sslEnabled =
  String(process.env.DB_SSL || 'false').toLowerCase() === 'true';

const poolConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(
    process.env.DB_CONNECTION_TIMEOUT_MS || 10000
  ),
  allowExitOnIdle: false,
  ssl: sslEnabled
    ? {
        rejectUnauthorized:
          String(process.env.NODE_ENV).toLowerCase() === 'production'
      }
    : false
};

if (
  !Number.isInteger(poolConfig.port) ||
  poolConfig.port < 1 ||
  poolConfig.port > 65535
) {
  throw new Error('DB_PORT غير صالح.');
}

if (!Number.isInteger(poolConfig.max) || poolConfig.max < 1) {
  throw new Error('DB_POOL_MAX غير صالح.');
}

const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  console.error('خطأ غير متوقع في اتصال قاعدة البيانات:', error);
});

async function query(text, params = []) {
  const client = await pool.connect();

  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('فشل التراجع عن المعاملة:', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

async function getClient() {
  return pool.connect();
}

async function checkConnection() {
  const result = await pool.query('SELECT 1 AS connected');

  return result.rows[0]?.connected === 1;
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  transaction,
  getClient,
  checkConnection,
  end: closeDatabase
};
