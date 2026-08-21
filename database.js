'use strict';

/*
========================================================
  افـنـدツينا🥀🖤
  database.js
  PostgreSQL Database Layer
  VERSION: 1.1.0

  هذا الملف هو طبقة التعامل مع PostgreSQL.

  مسؤول عن:
  - PostgreSQL Pool
  - الاتصال الآمن
  - Queries آمنة
  - Transactions
  - Serializable Transactions
  - فحص قاعدة البيانات
  - فحص الجداول
  - Coins
  - تحويل Coins
  - شراء الغرف
  - إرسال الهدايا
  - مستويات المستخدمين
  - المكافآت اليومية من Level 5
  - إغلاق الاتصالات

  قواعد المشروع:
  - لا ينشئ مستخدمين وهميين.
  - لا ينشئ غرفاً وهمية.
  - لا ينشئ أرصدة وهمية.
  - لا يضيف بيانات Demo.
  - لا يضع Owner ثابتاً.
  - أول Owner يتم تحديده في منطق التسجيل داخل server.js
    بالاعتماد على قاعدة البيانات.
  - شراء الغرفة = 50,000 Coins.
  - أعلى سعر هدية يجب أن يكون 200,000 Coins.
  - لا يتم تعديل الرصيد خارج Transaction للعمليات الحساسة.
========================================================
*/

const { Pool } = require('pg');

/*
========================================================
  ENVIRONMENT
========================================================
*/

const NODE_ENV =
    process.env.NODE_ENV || 'development';

const DATABASE_URL =
    process.env.DATABASE_URL || '';

const DB_HOST =
    process.env.DB_HOST || '';

const DB_PORT =
    Number(process.env.DB_PORT || 5432);

const DB_NAME =
    process.env.DB_NAME || '';

const DB_USER =
    process.env.DB_USER || '';

const DB_PASSWORD =
    process.env.DB_PASSWORD || '';

const DB_SSL =
    String(
        process.env.DB_SSL || ''
    ).toLowerCase() === 'true';

const DB_POOL_MAX =
    Number(
        process.env.DB_POOL_MAX || 10
    );

const DB_POOL_MIN =
    Number(
        process.env.DB_POOL_MIN || 0
    );

const DB_IDLE_TIMEOUT =
    Number(
        process.env.DB_IDLE_TIMEOUT || 30000
    );

const DB_CONNECTION_TIMEOUT =
    Number(
        process.env.DB_CONNECTION_TIMEOUT || 10000
    );

const DB_STATEMENT_TIMEOUT =
    Number(
        process.env.DB_STATEMENT_TIMEOUT || 30000
    );

const DB_QUERY_TIMEOUT =
    Number(
        process.env.DB_QUERY_TIMEOUT || 30000
    );

/*
========================================================
  BUSINESS CONSTANTS
========================================================
*/

const ROOM_PURCHASE_PRICE =
    50000;

const MAX_GIFT_PRICE =
    200000;

const DAILY_REWARD_MIN_LEVEL =
    5;

/*
========================================================
  VALIDATION
========================================================
*/

function isPositiveInteger(value) {
    return (
        Number.isInteger(value) &&
        value > 0
    );
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

if (
    !Number.isInteger(DB_POOL_MIN) ||
    DB_POOL_MIN < 0
) {
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
  DATABASE CONFIGURATION
========================================================
*/

const databaseConfig = DATABASE_URL
    ? {
          connectionString:
              DATABASE_URL,

          max:
              DB_POOL_MAX,

          min:
              DB_POOL_MIN,

          idleTimeoutMillis:
              DB_IDLE_TIMEOUT,

          connectionTimeoutMillis:
              DB_CONNECTION_TIMEOUT,

          statement_timeout:
              DB_STATEMENT_TIMEOUT,

          query_timeout:
              DB_QUERY_TIMEOUT,

          ssl:
              DB_SSL
                  ? {
                        rejectUnauthorized:
                            NODE_ENV ===
                            'production'
                                ? true
                                : false
                    }
                  : false
      }
    : {
          host:
              DB_HOST || undefined,

          port:
              DB_PORT,

          database:
              DB_NAME || undefined,

          user:
              DB_USER || undefined,

          password:
              DB_PASSWORD || undefined,

          max:
              DB_POOL_MAX,

          min:
              DB_POOL_MIN,

          idleTimeoutMillis:
              DB_IDLE_TIMEOUT,

          connectionTimeoutMillis:
              DB_CONNECTION_TIMEOUT,

          statement_timeout:
              DB_STATEMENT_TIMEOUT,

          query_timeout:
              DB_QUERY_TIMEOUT,

          ssl:
              DB_SSL
                  ? {
                        rejectUnauthorized:
                            NODE_ENV ===
                            'production'
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

const pool =
    new Pool(databaseConfig);

/*
========================================================
  INTERNAL STATE
========================================================
*/

let isShuttingDown =
    false;

let poolError =
    null;

/*
========================================================
  POOL ERROR
========================================================
*/

pool.on(
    'error',
    (error) => {
        poolError =
            error;

        console.error(
            '[DATABASE] PostgreSQL pool error:',
            error.message
        );
    }
);

/*
========================================================
  CLIENT ERROR
========================================================
*/

pool.on(
    'connect',
    (client) => {
        client.on(
            'error',
            (error) => {
                console.error(
                    '[DATABASE] PostgreSQL client error:',
                    error.message
                );
            }
        );
    }
);

/*
========================================================
  QUERY NORMALIZATION
========================================================
*/

function normalizeQueryConfig(
    text,
    values = [],
    options = {}
) {
    if (
        typeof text !== 'string' ||
        text.trim() === ''
    ) {
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
        name:
            options.name,
        rowMode:
            options.rowMode
    };
}

/*
========================================================
  QUERY
========================================================
*/

async function query(
    text,
    values = [],
    options = {}
) {
    if (isShuttingDown) {
        throw new Error(
            'قاعدة البيانات قيد الإغلاق.'
        );
    }

    const config =
        normalizeQueryConfig(
            text,
            values,
            options
        );

    const startedAt =
        Date.now();

    try {
        return await pool.query(
            config
        );
    } catch (error) {
        error.queryDurationMs =
            Date.now() -
            startedAt;

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
    const result =
        await query(
            text,
            values,
            options
        );

    return (
        result.rows[0] ||
        null
    );
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
    const result =
        await query(
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
    const result =
        await query(
            text,
            values,
            options
        );

    return {
        rowCount:
            result.rowCount,

        rows:
            result.rows
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

async function transaction(
    callback
) {
    if (
        typeof callback !==
        'function'
    ) {
        throw new TypeError(
            'transaction تحتاج إلى callback function.'
        );
    }

    if (isShuttingDown) {
        throw new Error(
            'قاعدة البيانات قيد الإغلاق.'
        );
    }

    const client =
        await getClient();

    try {
        await client.query(
            'BEGIN'
        );

        await client.query(
            `
            SET TRANSACTION
            ISOLATION LEVEL READ COMMITTED
            `
        );

        const tx =
            createTransactionApi(
                client
            );

        const result =
            await callback(tx);

        await client.query(
            'COMMIT'
        );

        return result;
    } catch (error) {
        try {
            await client.query(
                'ROLLBACK'
            );
        } catch (
            rollbackError
        ) {
            console.error(
                '[DATABASE] Rollback failed:',
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
  SERIALIZABLE TRANSACTION
========================================================
*/

async function serializableTransaction(
    callback
) {
    if (
        typeof callback !==
        'function'
    ) {
        throw new TypeError(
            'serializableTransaction تحتاج إلى callback function.'
        );
    }

    if (isShuttingDown) {
        throw new Error(
            'قاعدة البيانات قيد الإغلاق.'
        );
    }

    const client =
        await getClient();

    try {
        await client.query(
            'BEGIN'
        );

        await client.query(
            `
            SET TRANSACTION
            ISOLATION LEVEL SERIALIZABLE
            `
        );

        const tx =
            createTransactionApi(
                client
            );

        const result =
            await callback(tx);

        await client.query(
            'COMMIT'
        );

        return result;
    } catch (error) {
        try {
            await client.query(
                'ROLLBACK'
            );
        } catch (
            rollbackError
        ) {
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
  TRANSACTION API
========================================================
*/

function createTransactionApi(
    client
) {
    return {
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

            return client.query(
                config
            );
        },

        queryOne: async (
            text,
            values = [],
            options = {}
        ) => {
            const result =
                await client.query(
                    normalizeQueryConfig(
                        text,
                        values,
                        options
                    )
                );

            return (
                result.rows[0] ||
                null
            );
        },

        queryMany: async (
            text,
            values = [],
            options = {}
        ) => {
            const result =
                await client.query(
                    normalizeQueryConfig(
                        text,
                        values,
                        options
                    )
                );

            return result.rows;
        }
    };
}

/*
========================================================
  HEALTH CHECK
========================================================
*/

async function healthCheck() {
    const startedAt =
        Date.now();

    try {
        const result =
            await pool.query(
                `
                SELECT
                    NOW()
                        AS database_time,

                    current_database()
                        AS database_name,

                    current_user
                        AS database_user,

                    version()
                        AS version
                `
            );

        const row =
            result.rows[0];

        return {
            ok:
                true,

            latencyMs:
                Date.now() -
                startedAt,

            databaseTime:
                row.database_time,

            databaseName:
                row.database_name,

            databaseUser:
                row.database_user,

            version:
                row.version,

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
            ok:
                false,

            latencyMs:
                Date.now() -
                startedAt,

            error:
                error.message,

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
    const result =
        await healthCheck();

    if (!result.ok) {
        throw new Error(
            `تعذر الاتصال بقاعدة البيانات: ${result.error}`
        );
    }

    return result;
}

/*
========================================================
  REQUIRED TABLES
========================================================
*/

const REQUIRED_TABLES = [
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

/*
========================================================
  CHECK SCHEMA
========================================================
*/

async function checkSchema() {
    const result =
        await query(
            `
            SELECT
                table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name =
                  ANY($1::text[])
            ORDER BY table_name
            `,
            [
                REQUIRED_TABLES
            ]
        );

    const existing =
        new Set(
            result.rows.map(
                row =>
                    row.table_name
            )
        );

    const missing =
        REQUIRED_TABLES.filter(
            table =>
                !existing.has(
                    table
                )
        );

    return {
        ok:
            missing.length ===
            0,

        requiredCount:
            REQUIRED_TABLES.length,

        existingCount:
            existing.size,

        missing
    };
}

/*
========================================================
  POOL STATS
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
  INTEGER HELPERS
========================================================
*/

function toSafeInteger(
    value,
    fieldName = 'value'
) {
    const number =
        Number(value);

    if (
        !Number.isSafeInteger(
            number
        )
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
  WALLET
========================================================
*/

async function getWallet(
    userId
) {
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
        [
            userId
        ]
    );
}

/*
========================================================
  CREDIT COINS
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
    if (!userId) {
        throw new TypeError(
            'userId مطلوب.'
        );
    }

    const safeAmount =
        requirePositiveInteger(
            amount,
            'amount'
        );

    return serializableTransaction(
        async (tx) => {
            const wallet =
                await tx.queryOn
