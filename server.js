'use strict';

/*
========================================================
  افـنـدツينا🥀🖤
  database.js
  PostgreSQL Database Layer
  VERSION: 1.0.0

  مسؤول عن:
  - إنشاء وإدارة PostgreSQL Pool
  - الاتصال الآمن بقاعدة البيانات
  - فحص الاتصال والصحة
  - تنفيذ Queries بطريقة آمنة
  - Transactions
  - التحقق من وجود قاعدة البيانات
  - إدارة الاتصالات
  - دعم عمليات Coins / Gifts / Rooms
  - دعم التسجيل والمستخدمين
  - منع SQL Injection عبر Parameterized Queries

  مهم:
  - لا توجد حسابات تجريبية.
  - لا توجد مستخدمون وهميون.
  - لا توجد أرصدة وهمية.
  - لا توجد غرف وهمية.
  - لا يتم إنشاء أي بيانات مستخدم من هذا الملف.
  - أول Owner يتم تحديده بواسطة schema.sql.
========================================================
*/

const { Pool } = require('pg');

/*
========================================================
  ENVIRONMENT
========================================================
*/

const NODE_ENV = process.env.NODE_ENV || 'development';

const DATABASE_URL = process.env.DATABASE_URL || '';

const DB_HOST = process.env.DB_HOST || '';

const DB_PORT = Number(process.env.DB_PORT || 5432);

const DB_NAME = process.env.DB_NAME || '';

const DB_USER = process.env.DB_USER || '';

const DB_PASSWORD = process.env.DB_PASSWORD || '';

const DB_SSL =
    String(process.env.DB_SSL || '').toLowerCase() === 'true';

const DB_POOL_MAX = Number(
    process.env.DB_POOL_MAX || 10
);

const DB_POOL_MIN = Number(
    process.env.DB_POOL_MIN || 0
);

const DB_IDLE_TIMEOUT = Number(
    process.env.DB_IDLE_TIMEOUT || 30000
);

const DB_CONNECTION_TIMEOUT = Number(
    process.env.DB_CONNECTION_TIMEOUT || 10000
);

const DB_STATEMENT_TIMEOUT = Number(
    process.env.DB_STATEMENT_TIMEOUT || 30000
);

const DB_QUERY_TIMEOUT = Number(
    process.env.DB_QUERY_TIMEOUT || 30000
);

/*
========================================================
  VALIDATION
========================================================
*/

function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

if (!isPositiveInteger(DB_PORT)) {
    throw new Error(
        'DB_PORT يجب أن يكون رقماً صحيحاً أكبر من صفر.'
    );
}

if (!isPositiveInteger(DB_POOL_MAX)) {
    throw new Error(
        'DB_POOL_MAX يجب أن يكون رقماً صحيحاً أكبر من صفر.'
    );
}

if (!Number.isInteger(DB_POOL_MIN) || DB_POOL_MIN < 0) {
    throw new Error(
        'DB_POOL_MIN يجب أن يكون رقماً صحيحاً أو صفر.'
    );
}

if (DB_POOL_MIN > DB_POOL_MAX) {
    throw new Error(
        'DB_POOL_MIN لا يمكن أن يكون أكبر من DB_POOL_MAX.'
    );
}

if (!isPositiveInteger(DB_IDLE_TIMEOUT)) {
    throw new Error(
        'DB_IDLE_TIMEOUT يجب أن يكون رقماً صحيحاً أكبر من صفر.'
    );
}

if (!isPositiveInteger(DB_CONNECTION_TIMEOUT)) {
    throw new Error(
        'DB_CONNECTION_TIMEOUT يجب أن يكون رقماً صحيحاً أكبر من صفر.'
    );
}

if (!isPositiveInteger(DB_STATEMENT_TIMEOUT)) {
    throw new Error(
        'DB_STATEMENT_TIMEOUT يجب أن يكون رقماً صحيحاً أكبر من صفر.'
    );
}

if (!isPositiveInteger(DB_QUERY_TIMEOUT)) {
    throw new Error(
        'DB_QUERY_TIMEOUT يجب أن يكون رقماً صحيحاً أكبر من صفر.'
    );
}

/*
========================================================
  DATABASE CONFIG
========================================================
*/

const databaseConfig = DATABASE_URL
    ? {
          connectionString: DATABASE_URL,

          max: DB_POOL_MAX,

          min: DB_POOL_MIN,

          idleTimeoutMillis: DB_IDLE_TIMEOUT,

          connectionTimeoutMillis:
              DB_CONNECTION_TIMEOUT,

          statement_timeout:
              DB_STATEMENT_TIMEOUT,

          query_timeout:
              DB_QUERY_TIMEOUT,

          ssl: DB_SSL
              ? {
                    rejectUnauthorized:
                        NODE_ENV === 'production'
                            ? true
                            : false
                }
              : false
      }
    : {
          host: DB_HOST || undefined,

          port: DB_PORT,

          database: DB_NAME || undefined,

          user: DB_USER || undefined,

          password: DB_PASSWORD || undefined,

          max: DB_POOL_MAX,

          min: DB_POOL_MIN,

          idleTimeoutMillis: DB_IDLE_TIMEOUT,

          connectionTimeoutMillis:
              DB_CONNECTION_TIMEOUT,

          statement_timeout:
              DB_STATEMENT_TIMEOUT,

          query_timeout:
              DB_QUERY_TIMEOUT,

          ssl: DB_SSL
              ? {
                    rejectUnauthorized:
                        NODE_ENV === 'production'
                            ? true
                            : false
                }
              : false
      };

/*
========================================================
  POOL
========================================================
*/

const pool = new Pool(databaseConfig);

/*
========================================================
  INTERNAL STATE
========================================================
*/

let isShuttingDown = false;

let poolError = null;

/*
========================================================
  POOL ERROR HANDLER
========================================================
*/

pool.on('error', (error) => {
    poolError = error;

    console.error(
        '[DATABASE] PostgreSQL pool error:',
        error.message
    );
});

/*
========================================================
  CLIENT CONNECT HANDLER
========================================================
*/

pool.on('connect', (client) => {
    client.on('error', (error) => {
        console.error(
            '[DATABASE] PostgreSQL client error:',
            error.message
        );
    });
});

/*
========================================================
  INTERNAL QUERY NORMALIZATION
========================================================
*/

function normalizeQueryConfig(text, values = [], options = {}) {
    if (typeof text !== 'string' || text.trim() === '') {
        throw new TypeError(
            'SQL query يجب أن يكون نصاً غير فارغ.'
        );
    }

    if (!Array.isArray(values)) {
        throw new TypeError(
            'SQL values يجب أن تكون Array.'
        );
    }

    return {
        text,
        values,
        name: options.name,
        rowMode: options.rowMode
    };
}

/*
========================================================
  QUERY
========================================================
*/

async function query(text, values = [], options = {}) {
    if (isShuttingDown) {
        throw new Error(
            'قاعدة البيانات قيد الإغلاق.'
        );
    }

    const config = normalizeQueryConfig(
        text,
        values,
        options
    );

    const startedAt = Date.now();

    try {
        const result = await pool.query(config);

        return result;
    } catch (error) {
        error.queryDurationMs =
            Date.now() - startedAt;

        throw error;
    }
}

/*
========================================================
  QUERY ONE
========================================================
*/

async function queryOne(
    text,
    values = [],
    options = {}
) {
    const result = await query(
        text,
        values,
        options
    );

    return result.rows[0] || null;
}

/*
========================================================
  QUERY MANY
========================================================
*/

async function queryMany(
    text,
    values = [],
    options = {}
) {
    const result = await query(
        text,
        values,
        options
    );

    return result.rows;
}

/*
========================================================
  EXECUTE
========================================================
*/

async function execute(
    text,
    values = [],
    options = {}
) {
    const result = await query(
        text,
        values,
        options
    );

    return {
        rowCount: result.rowCount,
        rows: result.rows
    };
}

/*
========================================================
  GET CLIENT
========================================================
*/

async function getClient() {
    if (isShuttingDown) {
        throw new Error(
            'قاعدة البيانات قيد الإغلاق.'
        );
    }

    return pool.connect();
}

/*
========================================================
  TRANSACTION
========================================================
*/

async function transaction(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError(
            'transaction تحتاج إلى callback function.'
        );
    }

    if (isShuttingDown) {
        throw new Error(
            'قاعدة البيانات قيد الإغلاق.'
        );
    }

    const client = await getClient();

    let completed = false;

    try {
        await client.query('BEGIN');

        await client.query(
            'SET TRANSACTION ISOLATION LEVEL READ COMMITTED'
        );

        const transactionApi = {
            query: async (
                text,
                values = [],
                options = {}
            ) => {
                const config =
                    normalizeQueryConfig(
                        text,
                        values,
                        options
                    );

                return client.query(config);
            },

            queryOne: async (
                text,
                values = [],
                options = {}
            ) => {
                const result =
                    await transactionApi.query(
                        text,
                        values,
                        options
                    );

                return result.rows[0] || null;
            },

            queryMany: async (
                text,
                values = [],
                options = {}
            ) => {
                const result =
                    await transactionApi.query(
                        text,
                        values,
                        options
                    );

                return result.rows;
            }
        };

        const result =
            await callback(transactionApi);

        await client.query('COMMIT');

        completed = true;

        return result;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(
                '[DATABASE] Rollback failed:',
                rollbackError.message
            );
        }

        throw error;
    } finally {
        client.release();

        if (!completed) {
            /*
             * لا يوجد إجراء إضافي هنا.
             * الاتصال تم تحريره بعد ROLLBACK.
             */
        }
    }
}

/*
========================================================
  TRANSACTION WITH SERIALIZABLE
========================================================

تُستخدم للعمليات الحساسة جداً مثل:
- تحويل Coins
- شراء غرفة
- شراء هدية
- خصم رصيد
- عمليات مالية
========================================================
*/

async function serializableTransaction(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError(
            'serializableTransaction تحتاج إلى callback function.'
        );
    }

    if (isShuttingDown) {
        throw new Error(
            'قاعدة البيانات قيد الإغلاق.'
        );
    }

    const client = await getClient();

    try {
        await client.query('BEGIN');

        await client.query(
            'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'
        );

        const transactionApi = {
            query: async (
                text,
                values = [],
                options = {}
            ) => {
                const config =
                    normalizeQueryConfig(
                        text,
                        values,
                        options
                    );

                return client.query(config);
            },

            queryOne: async (
                text,
                values = [],
                options = {}
            ) => {
                const result =
                    await transactionApi.query(
                        text,
                        values,
                        options
                    );

                return result.rows[0] || null;
            },

            queryMany: async (
                text,
                values = [],
                options = {}
            ) => {
                const result =
                    await transactionApi.query(
                        text,
                        values,
                        options
                    );

                return result.rows;
            }
        };

        const result =
            await callback(transactionApi);

        await client.query('COMMIT');

        return result;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(
                '[DATABASE] Serializable rollback failed:',
                rollbackError.message
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

/*
========================================================
  DATABASE HEALTH CHECK
========================================================
*/

async function healthCheck() {
    const startedAt = Date.now();

    try {
        const result = await pool.query(
            `
            SELECT
                NOW() AS database_time,
                current_database() AS database_name,
                current_user AS database_user,
                version() AS version
            `
        );

        return {
            ok: true,

            latencyMs:
                Date.now() - startedAt,

            databaseTime:
                result.rows[0].database_time,

            databaseName:
                result.rows[0].database_name,

            databaseUser:
                result.rows[0].database_user,

            version:
                result.rows[0].version,

            pool: {
                total:
                    pool.totalCount,

                idle:
                    pool.idleCount,

                waiting:
                    pool.waitingCount
            }
        };
    } catch (error) {
        return {
            ok: false,

            latencyMs:
                Date.now() - startedAt,

            error: error.message,

            pool: {
                total:
                    pool.totalCount,

                idle:
                    pool.idleCount,

                waiting:
                    pool.waitingCount
            }
        };
    }
}

/*
========================================================
  REQUIRE DATABASE
========================================================
*/

async function requireDatabase() {
    const result = await healthCheck();

    if (!result.ok) {
        throw new Error(
            `تعذر الاتصال بقاعدة البيانات: ${result.error}`
        );
    }

    return result;
}

/*
========================================================
  CHECK SCHEMA
========================================================
*/

async function checkSchema() {
    const requiredTables = [
        'users',
        'profiles',
        'user_stats',
        'wallets',
        'levels',
        'level_rewards',
        'level_reward_claims',
        'badges',
        'user_badges',
        'vip_plans',
        'user_vip',
        'vip_benefits',
        'gifts',
        'gift_effects',
        'gift_inventory',
        'gift_transactions',
        'rooms',
        'room_members',
        'conversations',
        'conversation_members',
        'messages',
        'posts',
        'comments',
        'post_likes',
        'follows',
        'friend_requests',
        'blocks',
        'wallet_transactions',
        'coin_transfers',
        'notifications',
        'reports',
        'sessions',
        'password_reset_tokens',
        'verification_tokens',
        'permissions',
        'role_permissions',
        'site_settings',
        'audit_logs'
    ];

    const result = await query(
        `
        SELECT
            table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name
        `,
        [requiredTables]
    );

    const existing = new Set(
        result.rows.map(
            (row) => row.table_name
        )
    );

    const missing =
        requiredTables.filter(
            (table) => !existing.has(table)
        );

    return {
        ok: missing.length === 0,

        requiredCount:
            requiredTables.length,

        existingCount:
            existing.size,

        missing
    };
}

/*
========================================================
  GET POOL STATS
========================================================
*/

function getPoolStats() {
    return {
        total:
            pool.totalCount,

        idle:
            pool.idleCount,

        waiting:
            pool.waitingCount,

        max:
            DB_POOL_MAX,

        min:
            DB_POOL_MIN,

        hasError:
            Boolean(poolError)
    };
}

/*
========================================================
  LOCK HELPERS
========================================================
*/

async function advisoryLock(key) {
    if (
        typeof key !== 'string' ||
        key.trim() === ''
    ) {
        throw new TypeError(
            'advisoryLock key يجب أن يكون نصاً غير فارغ.'
        );
    }

    await query(
        `
        SELECT pg_advisory_lock(hashtext($1))
        `,
        [key]
    );
}

async function advisoryUnlock(key) {
    if (
        typeof key !== 'string' ||
        key.trim() === ''
    ) {
        throw new TypeError(
            'advisoryUnlock key يجب أن يكون نصاً غير فارغ.'
        );
    }

    await query(
        `
        SELECT pg_advisory_unlock(hashtext($1))
        `,
        [key]
    );
}

/*
========================================================
  DATABASE VALUE HELPERS
========================================================
*/

function toSafeInteger(
    value,
    fieldName = 'value'
) {
    const number = Number(value);

    if (
        !Number.isSafeInteger(number)
    ) {
        throw new TypeError(
            `${fieldName} يجب أن يكون رقماً صحيحاً آمناً.`
        );
    }

    return number;
}

function requirePositiveInteger(
    value,
    fieldName = 'value'
) {
    const number =
        toSafeInteger(
            value,
            fieldName
        );

    if (number <= 0) {
        throw new RangeError(
            `${fieldName} يجب أن يكون أكبر من صفر.`
        );
    }

    return number;
}

/*
========================================================
  COINS
========================================================

هذه الدوال لا تنشئ Coins وهمية.
أي تغيير يتم داخل Transaction حقيقي.
========================================================
*/

/*
  قراءة رصيد المستخدم.
*/

async function getWallet(userId) {
    if (!userId) {
        throw new TypeError(
            'userId مطلوب.'
        );
    }

    return queryOne(
        `
        SELECT
            user_id,
            balance,
            lifetime_earned,
            lifetime_spent,
            updated_at
        FROM wallets
        WHERE user_id = $1
        `,
        [userId]
    );
}

/*
========================================================
  إضافة Coins

  تُستخدم فقط من Backend بعد التحقق من سبب العملية.
========================================================
*/

async function creditCoins({
    userId,
    amount,
    type = 'adjustment',
    referenceId = null,
    referenceType = null,
    description = null,
    createdBy = null
}) {
    const safeAmount =
        requirePositiveInteger(
            amount,
            'amount'
        );

    return serializableTransaction(
        async (tx) => {

            const wallet =
                a
