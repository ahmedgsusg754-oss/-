'use strict';

/*
============================================================
 افـنـدツينا🥀🖤
 database.js
 PostgreSQL Database Layer
============================================================

 المسؤول عن:
 - إنشاء اتصال PostgreSQL
 - إدارة Connection Pool
 - التحقق من إعدادات قاعدة البيانات
 - الاتصالات الآمنة
 - تنفيذ الاستعلامات
 - تنفيذ المعاملات Transactions
 - إدارة الاتصالات
 - معالجة أخطاء قاعدة البيانات
 - دعم SSL
 - إيقاف الاتصال بشكل آمن

 ملاحظات:
 - لا توجد بيانات تجريبية.
 - لا توجد حسابات وهمية.
 - لا توجد أرصدة أو رسائل أو محتويات وهمية.
 - البيانات تأتي من PostgreSQL الفعلية.
============================================================
*/

const { Pool } = require('pg');

/*
============================================================
 1. قراءة إعدادات البيئة
============================================================
*/

const NODE_ENV = String(process.env.NODE_ENV || 'development').trim();

const DATABASE_URL = String(
  process.env.DATABASE_URL || ''
).trim();

/*
============================================================
 2. التحقق من إعدادات قاعدة البيانات
============================================================
*/

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required. Add a valid PostgreSQL connection string to the environment.'
  );
}

/*
============================================================
 3. إعداد SSL
============================================================

 في الإنتاج:
 - يفضل استخدام SSL مع مزود PostgreSQL الذي يتطلبه.

 يمكن تعطيله فقط إذا كانت قاعدة البيانات المحلية لا تستخدم SSL.
============================================================
*/

const DATABASE_SSL = String(
  process.env.DATABASE_SSL || ''
).trim().toLowerCase();

let ssl = undefined;

if (
  DATABASE_SSL === 'true' ||
  DATABASE_SSL === '1' ||
  DATABASE_SSL === 'require'
) {
  ssl = {
    rejectUnauthorized:
      String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || 'true')
        .trim()
        .toLowerCase() !== 'false'
  };
}

/*
============================================================
 4. إعدادات Pool
============================================================
*/

const poolConfig = {
  connectionString: DATABASE_URL,

  max: Number.parseInt(
    process.env.DATABASE_POOL_MAX || '20',
    10
  ),

  min: Number.parseInt(
    process.env.DATABASE_POOL_MIN || '0',
    10
  ),

  idleTimeoutMillis: Number.parseInt(
    process.env.DATABASE_IDLE_TIMEOUT_MS || '30000',
    10
  ),

  connectionTimeoutMillis: Number.parseInt(
    process.env.DATABASE_CONNECTION_TIMEOUT_MS || '10000',
    10
  ),

  statement_timeout: Number.parseInt(
    process.env.DATABASE_STATEMENT_TIMEOUT_MS || '30000',
    10
  ),

  query_timeout: Number.parseInt(
    process.env.DATABASE_QUERY_TIMEOUT_MS || '30000',
    10
  ),

  application_name:
    process.env.DATABASE_APPLICATION_NAME ||
    'afandina-platform'
};

if (ssl) {
  poolConfig.ssl = ssl;
}

/*
============================================================
 5. إنشاء PostgreSQL Pool
============================================================
*/

const pool = new Pool(poolConfig);

/*
============================================================
 6. مراقبة أخطاء Pool
============================================================
*/

pool.on('error', (error) => {
  console.error(
    '[DATABASE] Unexpected PostgreSQL pool error:',
    error
  );
});

/*
============================================================
 7. مراقبة اتصال Client
============================================================
*/

pool.on('connect', (client) => {
  if (NODE_ENV !== 'test') {
    console.log(
      '[DATABASE] PostgreSQL client connected.'
    );
  }

  client.on('error', (error) => {
    console.error(
      '[DATABASE] PostgreSQL client error:',
      error
    );
  });
});

/*
============================================================
 8. أدوات مساعدة
============================================================
*/

function normalizeQuery(query) {
  if (typeof query !== 'string') {
    throw new TypeError(
      'Database query must be a string.'
    );
  }

  const normalized = query.trim();

  if (!normalized) {
    throw new Error(
      'Database query cannot be empty.'
    );
  }

  return normalized;
}

function normalizeValues(values) {
  if (values === undefined || values === null) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw new TypeError(
      'Database query values must be an array.'
    );
  }

  return values;
}

/*
============================================================
 9. تنفيذ Query أساسي
============================================================
*/

async function query(text, values = []) {
  const sql = normalizeQuery(text);
  const params = normalizeValues(values);

  const startedAt = Date.now();

  try {
    const result = await pool.query(sql, params);

    if (NODE_ENV === 'development') {
      const duration = Date.now() - startedAt;

      console.debug(
        `[DATABASE] Query completed in ${duration}ms.`
      );
    }

    return result;
  } catch (error) {
    console.error(
      '[DATABASE] Query failed:',
      error
    );

    throw error;
  }
}

/*
============================================================
 10. تنفيذ Query وإرجاع الصفوف فقط
============================================================
*/

async function queryRows(text, values = []) {
  const result = await query(text, values);

  return result.rows;
}

/*
============================================================
 11. تنفيذ Query وإرجاع أول صف فقط
============================================================
*/

async function queryOne(text, values = []) {
  const rows = await queryRows(text, values);

  return rows.length > 0 ? rows[0] : null;
}

/*
============================================================
 12. فحص اتصال قاعدة البيانات
============================================================
*/

async function healthCheck() {
  const startedAt = Date.now();

  try {
    const result = await pool.query(
      'SELECT 1 AS database_ok'
    );

    return {
      ok:
        result.rows.length === 1 &&
        result.rows[0].database_ok === 1,

      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error:
        NODE_ENV === 'production'
          ? 'Database connection failed.'
          : error.message
    };
  }
}

/*
============================================================
 نهاية الجزء 1 من 6
============================================================
*//*
============================================================
 13. الحصول على Client من الـ Pool
============================================================
*/

async function getClient() {
  try {
    return await pool.connect();
  } catch (error) {
    console.error(
      '[DATABASE] Failed to acquire PostgreSQL client:',
      error
    );

    throw error;
  }
}

/*
============================================================
 14. تنفيذ Transaction
============================================================

 الاستخدام:

 await transaction(async (client) => {
   await client.query(...);
   await client.query(...);
 });

 إذا نجحت جميع العمليات:
 COMMIT

 إذا حدث خطأ:
 ROLLBACK
============================================================
*/

async function transaction(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError(
      'Transaction callback must be a function.'
    );
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        '[DATABASE] Transaction rollback failed:',
        rollbackError
      );
    }

    console.error(
      '[DATABASE] Transaction failed:',
      error
    );

    throw error;
  } finally {
    client.release();
  }
}

/*
============================================================
 15. تنفيذ Transaction مع إعدادات إضافية
============================================================
*/

async function transactionWithOptions(
  callback,
  options = {}
) {
  if (typeof callback !== 'function') {
    throw new TypeError(
      'Transaction callback must be a function.'
    );
  }

  const client = await getClient();

  const isolationLevel =
    typeof options.isolationLevel === 'string'
      ? options.isolationLevel.trim().toUpperCase()
      : null;

  const validIsolationLevels = new Set([
    'READ COMMITTED',
    'REPEATABLE READ',
    'SERIALIZABLE'
  ]);

  try {
    await client.query('BEGIN');

    if (
      isolationLevel &&
      validIsolationLevels.has(isolationLevel)
    ) {
      await client.query(
        `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
      );
    }

    if (options.readOnly === true) {
      await client.query(
        'SET TRANSACTION READ ONLY'
      );
    }

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        '[DATABASE] Transaction rollback failed:',
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

/*
============================================================
 16. تنفيذ Query باستخدام Client
============================================================
*/

async function clientQuery(
  client,
  text,
  values = []
) {
  if (
    !client ||
    typeof client.query !== 'function'
  ) {
    throw new TypeError(
      'A valid PostgreSQL client is required.'
    );
  }

  const sql = normalizeQuery(text);
  const params = normalizeValues(values);

  return client.query(sql, params);
}

/*
============================================================
 17. Query Rows باستخدام Client
============================================================
*/

async function clientQueryRows(
  client,
  text,
  values = []
) {
  const result = await clientQuery(
    client,
    text,
    values
  );

  return result.rows;
}

/*
============================================================
 18. Query One باستخدام Client
============================================================
*/

async function clientQueryOne(
  client,
  text,
  values = []
) {
  const rows = await clientQueryRows(
    client,
    text,
    values
  );

  return rows.length > 0
    ? rows[0]
    : null;
}

/*
============================================================
 19. التأكد من وجود جدول
============================================================
*/

async function tableExists(tableName) {
  if (
    typeof tableName !== 'string' ||
    !tableName.trim()
  ) {
    throw new TypeError(
      'Table name is required.'
    );
  }

  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName.trim()]
  );

  return result.rows[0].exists === true;
}

/*
============================================================
 20. التأكد من وجود Column
============================================================
*/

async function columnExists(
  tableName,
  columnName
) {
  if (
    typeof tableName !== 'string' ||
    !tableName.trim()
  ) {
    throw new TypeError(
      'Table name is required.'
    );
  }

  if (
    typeof columnName !== 'string' ||
    !columnName.trim()
  ) {
    throw new TypeError(
      'Column name is required.'
    );
  }

  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [
      tableName.trim(),
      columnName.trim()
    ]
  );

  return result.rows[0].exists === true;
}

/*
============================================================
 21. الحصول على إصدار PostgreSQL
============================================================
*/

async function getDatabaseVersion() {
  const result = await pool.query(
    'SELECT version() AS version'
  );

  return result.rows[0]?.version || null;
}

/*
============================================================
 22. الحصول على اسم قاعدة البيانات الحالية
============================================================
*/

async function getCurrentDatabase() {
  const result = await pool.query(
    'SELECT current_database() AS database'
  );

  return result.rows[0]?.database || null;
}

/*
============================================================
 23. الحصول على المستخدم الحالي في PostgreSQL
============================================================
*/

async function getCurrentDatabaseUser() {
  const result = await pool.query(
    'SELECT current_user AS username'
  );

  return result.rows[0]?.username || null;
}

/*
============================================================
 24. معلومات الاتصال الأساسية
============================================================
*/

async function getDatabaseInfo() {
  const [
    version,
    database,
    username
  ] = await Promise.all([
    getDatabaseVersion(),
    getCurrentDatabase(),
    getCurrentDatabaseUser()
  ]);

  return {
    database,
    username,
    version
  };
}

/*
============================================================
 25. إحصائيات Pool
============================================================
*/

function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

/*
============================================================
 26. إغلاق Pool
============================================================
*/

async function closeDatabase() {
  try {
    await pool.end();

    if (NODE_ENV !== 'test') {
      console.log(
        '[DATABASE] PostgreSQL pool closed.'
      );
    }
  } catch (error) {
    console.error(
      '[DATABASE] Failed to close PostgreSQL pool:',
      error
    );

    throw error;
  }
}

/*
============================================================
 27. معالجة إيقاف التطبيق
============================================================
*/

let shutdownStarted = false;

async function shutdownDatabase(
  signal = 'UNKNOWN'
) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;

  try {
    console.log(
      `[DATABASE] Shutdown signal received: ${signal}`
    );

    await closeDatabase();
  } catch (error) {
    console.error(
      '[DATABASE] Shutdown error:',
      error
    );
  }
}

/*
============================================================
 28. تصدير وظائف قاعدة البيانات
============================================================
*/

module.exports = {
  pool,

  query,
  queryRows,
  queryOne,

  getClient,

  clientQuery,
  clientQueryRows,
  clientQueryOne,

  transaction,
  transactionWithOptions,

  healthCheck,

  tableExists,
  columnExists,

  getDatabaseVersion,
  getCurrentDatabase,
  getCurrentDatabaseUser,
  getDatabaseInfo,

  getPoolStats,

  closeDatabase,
  shutdownDatabase
};

/*
============================================================
 نهاية الجزء 2 من 6
============================================================
*//*
============================================================
 29. التحقق من صحة أسماء الجداول والأعمدة
============================================================

 ملاحظة أمنية:
 أسماء الجداول والأعمدة لا يمكن تمريرها كـ $1 في PostgreSQL،
 لذلك نتحقق منها قبل استخدامها في أي استعلام ديناميكي.
============================================================
*/

function validateIdentifier(identifier, name = 'identifier') {
  if (
    typeof identifier !== 'string' ||
    !identifier.trim()
  ) {
    throw new TypeError(
      `${name} must be a non-empty string.`
    );
  }

  const value = identifier.trim();

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(
      `Invalid ${name}: ${value}`
    );
  }

  return value;
}

/*
============================================================
 30. تنفيذ INSERT آمن
============================================================
*/

async function insert(
  tableName,
  data,
  options = {}
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new TypeError(
      'Insert data must be a plain object.'
    );
  }

  const entries = Object.entries(data);

  if (entries.length === 0) {
    throw new Error(
      'Insert data cannot be empty.'
    );
  }

  const columns = entries.map(([column]) =>
    validateIdentifier(column, 'column name')
  );

  const values = entries.map(([, value]) => value);

  const placeholders = values.map(
    (_, index) => `$${index + 1}`
  );

  const returning =
    options.returning === false
      ? ''
      : options.returning
        ? ` RETURNING ${validateIdentifier(
            options.returning,
            'returning column'
          )}`
        : ' RETURNING *';

  const sql = `
    INSERT INTO ${table}
      (${columns.join(', ')})
    VALUES
      (${placeholders.join(', ')})
    ${returning}
  `;

  const result = await query(
    sql,
    values
  );

  if (options.returning === false) {
    return result;
  }

  return result.rows[0] || null;
}

/*
============================================================
 31. تنفيذ INSERT لعدة سجلات
============================================================
*/

async function insertMany(
  tableName,
  rows,
  options = {}
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  if (!Array.isArray(rows)) {
    throw new TypeError(
      'Rows must be an array.'
    );
  }

  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0];

  if (
    !firstRow ||
    typeof firstRow !== 'object' ||
    Array.isArray(firstRow)
  ) {
    throw new TypeError(
      'Each row must be a plain object.'
    );
  }

  const columns = Object.keys(firstRow).map(
    (column) =>
      validateIdentifier(
        column,
        'column name'
      )
  );

  if (columns.length === 0) {
    throw new Error(
      'Insert rows cannot have empty columns.'
    );
  }

  const values = [];
  const rowPlaceholders = [];

  rows.forEach((row, rowIndex) => {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row)
    ) {
      throw new TypeError(
        `Invalid row at index ${rowIndex}.`
      );
    }

    const placeholders = [];

    columns.forEach((column) => {
      values.push(row[column]);

      placeholders.push(
        `$${values.length}`
      );
    });

    rowPlaceholders.push(
      `(${placeholders.join(', ')})`
    );
  });

  const returning =
    options.returning === false
      ? ''
      : options.returning
        ? ` RETURNING ${validateIdentifier(
            options.returning,
            'returning column'
          )}`
        : ' RETURNING *';

  const sql = `
    INSERT INTO ${table}
      (${columns.join(', ')})
    VALUES
      ${rowPlaceholders.join(', ')}
    ${returning}
  `;

  const result = await query(
    sql,
    values
  );

  if (options.returning === false) {
    return result;
  }

  return result.rows;
}

/*
============================================================
 32. تنفيذ UPDATE آمن
============================================================
*/

async function update(
  tableName,
  data,
  where,
  whereValues = [],
  options = {}
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new TypeError(
      'Update data must be a plain object.'
    );
  }

  const entries = Object.entries(data);

  if (entries.length === 0) {
    throw new Error(
      'Update data cannot be empty.'
    );
  }

  if (
    typeof where !== 'string' ||
    !where.trim()
  ) {
    throw new Error(
      'Update operation requires a WHERE clause.'
    );
  }

  const normalizedWhere =
    where.trim();

  const values = [];

  const assignments = entries.map(
    ([column, value]) => {
      const safeColumn =
        validateIdentifier(
          column,
          'column name'
        );

      values.push(value);

      return `${safeColumn} = $${values.length}`;
    }
  );

  const offset = values.length;

  const adjustedWhere =
    normalizedWhere.replace(
      /\$(\d+)/g,
      (_, number) =>
        `$${Number(number) + offset}`
    );

  const finalValues = [
    ...values,
    ...whereValues
  ];

  const returning =
    options.returning === false
      ? ''
      : options.returning
        ? ` RETURNING ${validateIdentifier(
            options.returning,
            'returning column'
          )}`
        : ' RETURNING *';

  const sql = `
    UPDATE ${table}
    SET
      ${assignments.join(', ')}
    WHERE
      ${adjustedWhere}
    ${returning}
  `;

  const result = await query(
    sql,
    finalValues
  );

  if (options.returning === false) {
    return result;
  }

  return result.rows;
}

/*
============================================================
 33. تحديث سجل واحد
============================================================
*/

async function updateOne(
  tableName,
  data,
  where,
  whereValues = []
) {
  const rows = await update(
    tableName,
    data,
    where,
    whereValues
  );

  return rows[0] || null;
}

/*
============================================================
 34. تنفيذ DELETE آمن
============================================================
*/

async function remove(
  tableName,
  where,
  whereValues = [],
  options = {}
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  if (
    typeof where !== 'string' ||
    !where.trim()
  ) {
    throw new Error(
      'Delete operation requires a WHERE clause.'
    );
  }

  const returning =
    options.returning === false
      ? ''
      : options.returning
        ? ` RETURNING ${validateIdentifier(
            options.returning,
            'returning column'
          )}`
        : ' RETURNING *';

  const sql = `
    DELETE FROM ${table}
    WHERE ${where.trim()}
    ${returning}
  `;

  const result = await query(
    sql,
    whereValues
  );

  if (options.returning === false) {
    return result;
  }

  return result.rows;
}

/*
============================================================
 35. حذف سجل واحد
============================================================
*/

async function removeOne(
  tableName,
  where,
  whereValues = []
) {
  const rows = await remove(
    tableName,
    where,
    whereValues
  );

  return rows[0] || null;
}

/*
============================================================
 36. البحث عن سجلات
============================================================
*/

async function findMany(
  tableName,
  options = {}
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  const {
    columns = ['*'],
    where = null,
    values = [],
    orderBy = null,
    limit = null,
    offset = null
  } = options;

  const selectedColumns =
    Array.isArray(columns) &&
    columns.length > 0
      ? columns.map((column) => {
          if (column === '*') {
            return '*';
          }

          return validateIdentifier(
            column,
            'column name'
          );
        })
      : ['*'];

  let sql = `
    SELECT
      ${selectedColumns.join(', ')}
    FROM ${table}
  `;

  let queryValues = [
    ...normalizeValues(values)
  ];

  if (
    typeof where === 'string' &&
    where.trim()
  ) {
    sql += ` WHERE ${where.trim()}`;
  }

  if (
    typeof orderBy === 'string' &&
    orderBy.trim()
  ) {
    sql += ` ORDER BY ${orderBy.trim()}`;
  }

  if (
    Number.isInteger(limit) &&
    limit >= 0
  ) {
    queryValues.push(limit);
    sql += ` LIMIT $${queryValues.length}`;
  }

  if (
    Number.isInteger(offset) &&
    offset >= 0
  ) {
    queryValues.push(offset);
    sql += ` OFFSET $${queryValues.length}`;
  }

  const result = await query(
    sql,
    queryValues
  );

  return result.rows;
}

/*
============================================================
 37. البحث عن سجل واحد
============================================================
*/

async function findOne(
  tableName,
  options = {}
) {
  const rows = await findMany(
    tableName,
    {
      ...options,
      limit: 1
    }
  );

  return rows[0] || null;
}

/*
============================================================
 نهاية الجزء 3 من 6
============================================================
*//*
============================================================
 38. عدّ السجلات
============================================================
*/

async function count(
  tableName,
  options = {}
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  const {
    where = null,
    values = []
  } = options;

  let sql = `
    SELECT COUNT(*)::BIGINT AS count
    FROM ${table}
  `;

  if (
    typeof where === 'string' &&
    where.trim()
  ) {
    sql += ` WHERE ${where.trim()}`;
  }

  const result = await query(
    sql,
    normalizeValues(values)
  );

  return Number(result.rows[0]?.count || 0);
}

/*
============================================================
 39. التحقق من وجود سجل
============================================================
*/

async function exists(
  tableName,
  where,
  values = []
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  if (
    typeof where !== 'string' ||
    !where.trim()
  ) {
    throw new Error(
      'Exists operation requires a WHERE clause.'
    );
  }

  const result = await query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM ${table}
        WHERE ${where.trim()}
      ) AS exists
    `,
    normalizeValues(values)
  );

  return result.rows[0]?.exists === true;
}

/*
============================================================
 40. تنفيذ SELECT بقفل FOR UPDATE
============================================================
*/

async function findOneForUpdate(
  tableName,
  where,
  values = []
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  if (
    typeof where !== 'string' ||
    !where.trim()
  ) {
    throw new Error(
      'FOR UPDATE requires a WHERE clause.'
    );
  }

  const result = await query(
    `
      SELECT *
      FROM ${table}
      WHERE ${where.trim()}
      LIMIT 1
      FOR UPDATE
    `,
    normalizeValues(values)
  );

  return result.rows[0] || null;
}

/*
============================================================
 41. تنفيذ UPDATE مع إرجاع سجل واحد
============================================================
*/

async function updateReturningOne(
  tableName,
  data,
  where,
  whereValues = []
) {
  const row = await updateOne(
    tableName,
    data,
    where,
    whereValues
  );

  return row;
}

/*
============================================================
 42. تنفيذ INSERT أو UPDATE باستخدام ON CONFLICT
============================================================

 الاستخدام مخصص للعمليات التي تحتاج UPSERT.

 مثال:
 upsert(
   'site_settings',
   {
     setting_key: 'site_name',
     setting_value: 'افـنـدينا🥀🖤'
   },
   'setting_key'
 )
============================================================
*/

async function upsert(
  tableName,
  data,
  conflictColumn,
  options = {}
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  const conflict = validateIdentifier(
    conflictColumn,
    'conflict column'
  );

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new TypeError(
      'Upsert data must be a plain object.'
    );
  }

  const entries = Object.entries(data);

  if (entries.length === 0) {
    throw new Error(
      'Upsert data cannot be empty.'
    );
  }

  const columns = entries.map(
    ([column]) =>
      validateIdentifier(
        column,
        'column name'
      )
  );

  const values = entries.map(
    ([, value]) => value
  );

  const placeholders = values.map(
    (_, index) => `$${index + 1}`
  );

  const updateColumns = columns.filter(
    (column) => column !== conflict
  );

  if (updateColumns.length === 0) {
    throw new Error(
      'Upsert requires at least one column besides the conflict column.'
    );
  }

  const assignments =
    updateColumns.map(
      (column) =>
        `${column} = EXCLUDED.${column}`
    );

  const returning =
    options.returning === false
      ? ''
      : options.returning
        ? ` RETURNING ${validateIdentifier(
            options.returning,
            'returning column'
          )}`
        : ' RETURNING *';

  const sql = `
    INSERT INTO ${table}
      (${columns.join(', ')})
    VALUES
      (${placeholders.join(', ')})
    ON CONFLICT (${conflict})
    DO UPDATE SET
      ${assignments.join(', ')}
    ${returning}
  `;

  const result = await query(
    sql,
    values
  );

  if (options.returning === false) {
    return result;
  }

  return result.rows[0] || null;
}

/*
============================================================
 43. تنفيذ استعلام Pagination
============================================================
*/

async function paginate(
  tableName,
  options = {}
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  const page = Number.isInteger(options.page) &&
    options.page > 0
      ? options.page
      : 1;

  const pageSize =
    Number.isInteger(options.pageSize) &&
    options.pageSize > 0
      ? Math.min(options.pageSize, 100)
      : 20;

  const offset =
    (page - 1) * pageSize;

  const rows = await findMany(
    table,
    {
      columns: options.columns,
      where: options.where,
      values: options.values,
      orderBy: options.orderBy,
      limit: pageSize,
      offset
    }
  );

  const total = await count(
    table,
    {
      where: options.where,
      values: options.values
    }
  );

  const totalPages =
    Math.ceil(total / pageSize);

  return {
    rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage:
        page < totalPages,
      hasPreviousPage:
        page > 1
    }
  };
}

/*
============================================================
 44. الحصول على أسماء الجداول
============================================================
*/

async function getTables() {
  const result = await query(`
    SELECT
      table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `);

  return result.rows.map(
    (row) => row.table_name
  );
}

/*
============================================================
 45. الحصول على أعمدة جدول
============================================================
*/

async function getTableColumns(
  tableName
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  const result = await query(
    `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position ASC
    `,
    [table]
  );

  return result.rows;
}

/*
============================================================
 46. الحصول على المفاتيح الأساسية
============================================================
*/

async function getPrimaryKeyColumns(
  tableName
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  const result = await query(
    `
      SELECT
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name =
           kcu.constraint_name
       AND tc.table_schema =
           kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position ASC
    `,
    [table]
  );

  return result.rows.map(
    (row) => row.column_name
  );
}

/*
============================================================
 47. الحصول على Foreign Keys
============================================================
*/

async function getForeignKeys(
  tableName
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  const result = await query(
    `
      SELECT
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name =
           kcu.constraint_name
       AND tc.table_schema =
           kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name =
           tc.constraint_name
       AND ccu.table_schema =
           tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
      ORDER BY kcu.column_name ASC
    `,
    [table]
  );

  return result.rows;
}

/*
============================================================
 48. اختبار سلامة قاعدة البيانات
============================================================
*/

async function databaseDiagnostics() {
  const startedAt = Date.now();

  try {
    const health = await healthCheck();
    const info = await getDatabaseInfo();
    const tables = await getTables();
    const poolStats = getPoolStats();

    return {
      ok: health.ok,
      latencyMs:
        Date.now() - startedAt,

      database: {
        name: info.database,
        user: info.username,
        version: info.version
      },

      pool: poolStats,

      tablesCount:
        tables.length,

      tables
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs:
        Date.now() - startedAt,

      error:
        NODE_ENV === 'production'
          ? 'Database diagnostics failed.'
          : error.message
    };
  }
}

/*
============================================================
 نهاية الجزء 4 من 6
============================================================
*//*
============================================================
 49. تنفيذ عدة استعلامات بشكل متسلسل داخل Transaction
============================================================
*/

async function transactionQueries(queries = []) {
  if (!Array.isArray(queries)) {
    throw new TypeError(
      'Transaction queries must be an array.'
    );
  }

  return transaction(async (client) => {
    const results = [];

    for (const item of queries) {
      if (
        !item ||
        typeof item !== 'object'
      ) {
        throw new TypeError(
          'Each transaction query must be an object.'
        );
      }

      const sql = normalizeQuery(
        item.text
      );

      const values =
        normalizeValues(item.values);

      const result = await client.query(
        sql,
        values
      );

      results.push(result);
    }

    return results;
  });
}

/*
============================================================
 50. تنفيذ Query واحد وإرجاع rowCount
============================================================
*/

async function execute(
  text,
  values = []
) {
  const result = await query(
    text,
    values
  );

  return {
    rowCount: result.rowCount,
    command: result.command
  };
}

/*
============================================================
 51. تحديث قيمة واحدة بشكل آمن
============================================================
*/

async function updateValue(
  tableName,
  columnName,
  value,
  where,
  whereValues = []
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  const column = validateIdentifier(
    columnName,
    'column name'
  );

  if (
    typeof where !== 'string' ||
    !where.trim()
  ) {
    throw new Error(
      'Update value requires a WHERE clause.'
    );
  }

  const values = [
    value,
    ...normalizeValues(whereValues)
  ];

  const adjustedWhere =
    where.trim().replace(
      /\$(\d+)/g,
      (_, number) =>
        `$${Number(number) + 1}`
    );

  const result = await query(
    `
      UPDATE ${table}
      SET ${column} = $1
      WHERE ${adjustedWhere}
      RETURNING *
    `,
    values
  );

  return result.rows;
}

/*
============================================================
 52. زيادة قيمة رقمية بشكل ذري Atomic Increment
============================================================
*/

async function increment(
  tableName,
  columnName,
  amount,
  where,
  whereValues = []
) {
  const table = validateIdentifier(
    tableName,
    'table name'
  );

  const column = validateIdentifier(
    columnName,
    'column name'
  );

  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount)
  ) {
    throw new TypeError(
      'Increment amount must be a finite number.'
    );
  }

  if (
    typeof where !== 'string' ||
    !where.trim()
  ) {
    throw new Error(
      'Increment requires a WHERE clause.'
    );
  }

  const values = [
    amount,
    ...normalizeValues(whereValues)
  ];

  const adjustedWhere =
    where.trim().replace(
      /\$(\d+)/g,
      (_, number) =>
        `$${Number(number) + 1}`
    );

  const result = await query(
    `
      UPDATE ${table}
      SET ${column} = COALESCE(${column}, 0) + $1
      WHERE ${adjustedWhere}
      RETURNING *
    `,
    values
  );

  return result.rows;
}

/*
============================================================
 53. إنقاص قيمة رقمية بشكل ذري Atomic Decrement
============================================================
*/

async function decrement(
  tableName,
  columnName,
  amount,
  where,
  whereValues = []
) {
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new TypeError(
      'Decrement amount must be a non-negative finite number.'
    );
  }

  return increment(
    tableName,
    columnName,
    -amount,
    where,
    whereValues
  );
}

/*
============================================================
 54. تنفيذ Batch Queries
============================================================
*/

async function batch(
  queries = [],
  options = {}
) {
  if (!Array.isArray(queries)) {
    throw new TypeError(
      'Batch queries must be an array.'
    );
  }

  if (queries.length === 0) {
    return [];
  }

  const useTransaction =
    options.transaction !== false;

  if (!useTransaction) {
    const results = [];

    for (const item of queries) {
      if (
        !item ||
        typeof item !== 'object'
      ) {
        throw new TypeError(
          'Invalid batch query.'
        );
      }

      results.push(
        await query(
          item.text,
          item.values || []
        )
      );
    }

    return results;
  }

  return transactionQueries(
    queries
  );
}

/*
============================================================
 55. التحقق من اتصال PostgreSQL قبل تشغيل النظام
============================================================
*/

async function assertDatabaseConnection() {
  const result = await healthCheck();

  if (!result.ok) {
    throw new Error(
      'Unable to establish a healthy PostgreSQL database connection.'
    );
  }

  return true;
}

/*
============================================================
 56. تشغيل فحص قاعدة البيانات عند الحاجة
============================================================
*/

async function initializeDatabase() {
  await assertDatabaseConnection();

  if (NODE_ENV !== 'test') {
    console.log(
      '[DATABASE] PostgreSQL database initialized successfully.'
    );
  }

  return {
    ok: true,
    pool: getPoolStats()
  };
}

/*
============================================================
 57. منع استخدام Transaction Client بعد إغلاقه
============================================================
*/

function isValidClient(client) {
  return Boolean(
    client &&
    typeof client.query === 'function' &&
    typeof client.release === 'function'
  );
}

/*
============================================================
 58. تنفيذ Callback مع Client وإرجاعه تلقائيًا
============================================================
*/

async function withClient(
  callback
) {
  if (typeof callback !== 'function') {
    throw new TypeError(
      'withClient callback must be a function.'
    );
  }

  const client = await getClient();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

/*
============================================================
 59. الحصول على عدد الاتصالات النشطة
============================================================
*/

function getActiveConnectionCount() {
  return pool.totalCount -
    pool.idleCount;
}

/*
============================================================
 60. حالة Pool كاملة
============================================================
*/

function getDetailedPoolStats() {
  return {
    total:
      pool.totalCount,

    idle:
      pool.idleCount,

    active:
      getActiveConnectionCount(),

    waiting:
      pool.waitingCount
  };
}

/*
============================================================
 61. التحقق من إعدادات Pool
============================================================
*/

function validatePoolConfiguration() {
  const max =
    Number.parseInt(
      process.env.DATABASE_POOL_MAX || '20',
      10
    );

  const min =
    Number.parseInt(
      process.env.DATABASE_POOL_MIN || '0',
      10
    );

  const idleTimeout =
    Number.parseInt(
      process.env.DATABASE_IDLE_TIMEOUT_MS || '30000',
      10
    );

  const connectionTimeout =
    Number.parseInt(
      process.env.DATABASE_CONNECTION_TIMEOUT_MS || '10000',
      10
    );

  const statementTimeout =
    Number.parseInt(
      process.env.DATABASE_STATEMENT_TIMEOUT_MS || '30000',
      10
    );

  const errors = [];

  if (
    !Number.isInteger(max) ||
    max < 1
  ) {
    errors.push(
      'DATABASE_POOL_MAX must be >= 1.'
    );
  }

  if (
    !Number.isInteger(min) ||
    min < 0 ||
    min > max
  ) {
    errors.push(
      'DATABASE_POOL_MIN must be >= 0 and <= DATABASE_POOL_MAX.'
    );
  }

  if (
    !Number.isInteger(idleTimeout) ||
    idleTimeout < 0
  ) {
    errors.push(
      'DATABASE_IDLE_TIMEOUT_MS must be >= 0.'
    );
  }

  if (
    !Number.isInteger(connectionTimeout) ||
    connectionTimeout < 0
  ) {
    errors.push(
      'DATABASE_CONNECTION_TIMEOUT_MS must be >= 0.'
    );
  }

  if (
    !Number.isInteger(statementTimeout) ||
    statementTimeout < 0
  ) {
    errors.push(
      'DATABASE_STATEMENT_TIMEOUT_MS must be >= 0.'
    );
  }

  if (errors.length > 0) {
    throw new Error(
      errors.join(' ')
    );
  }

  return {
    valid: true,
    max,
    min,
    idleTimeout,
    connectionTimeout,
    statementTimeout
  };
}

/*
============================================================
 62. تصدير الأدوات الإضافية
============================================================
*/

module.exports.validateIdentifier =
  validateIdentifier;

module.exports.insert =
  insert;

module.exports.insertMany =
  insertMany;

module.exports.update =
  update;

module.exports.updateOne =
  updateOne;

module.exports.updateReturningOne =
  updateReturningOne;

module.exports.remove =
  remove;

module.exports.removeOne =
  removeOne;

module.exports.findMany =
  findMany;

module.exports.findOne =
  findOne;

module.exports.findOneForUpdate =
  findOneForUpdate;

module.exports.count =
  count;

module.exports.exists =
  exists;

module.exports.upsert =
  upsert;

module.exports.paginate =
  paginate;

module.exports.getTables =
  getTables;

module.exports.getTableColumns =
  getTableColumns;

module.exports.getPrimaryKeyColumns =
  getPrimaryKeyColumns;

module.exports.getForeignKeys =
  getForeignKeys;

module.exports.databaseDiagnostics =
  databaseDiagnostics;

module.exports.transactionQueries =
  transactionQueries;

module.exports.execute =
  execute;

module.exports.updateValue =
  updateValue;

module.exports.increment =
  increment;

module.exports.decrement =
  decrement;

module.exports.batch =
  batch;

module.exports.assertDatabaseConnection =
  assertDatabaseConnection;

module.exports.initializeDatabase =
  initializeDatabase;

module.exports.isValidClient =
  isValidClient;

module.exports.withClient =
  withClient;

module.exports.getActiveConnectionCount =
  getActiveConnectionCount;

module.exports.getDetailedPoolStats =
  getDetailedPoolStats;

module.exports.validatePoolConfiguration =
  validatePoolConfiguration;

/*
============================================================
 نهاية الجزء 5 من 6
============================================================
*//*
============================================================
 63. فحص نهائي لإعدادات قاعدة البيانات
============================================================
*/

function getDatabaseConfiguration() {
  const poolConfiguration =
    validatePoolConfiguration();

  return {
    environment: NODE_ENV,

    databaseConfigured:
      Boolean(DATABASE_URL),

    sslEnabled:
      Boolean(ssl),

    pool: {
      max:
        poolConfiguration.max,

      min:
        poolConfiguration.min,

      idleTimeoutMillis:
        poolConfiguration.idleTimeout,

      connectionTimeoutMillis:
        poolConfiguration.connectionTimeout,

      statementTimeout:
        poolConfiguration.statementTimeout
    }
  };
}

/*
============================================================
 64. اختبار الاتصال الفعلي
============================================================
*/

async function testConnection() {
  const startedAt = Date.now();

  try {
    const result = await pool.query(
      `
        SELECT
          NOW() AS server_time,
          current_database() AS database_name,
          current_user AS database_user
      `
    );

    return {
      connected: true,

      latencyMs:
        Date.now() - startedAt,

      serverTime:
        result.rows[0]?.server_time || null,

      database:
        result.rows[0]?.database_name || null,

      user:
        result.rows[0]?.database_user || null
    };
  } catch (error) {
    return {
      connected: false,

      latencyMs:
        Date.now() - startedAt,

      error:
        NODE_ENV === 'production'
          ? 'Database connection test failed.'
          : error.message
    };
  }
}

/*
============================================================
 65. فحص جاهزية النظام
============================================================
*/

async function readinessCheck() {
  const configuration =
    getDatabaseConfiguration();

  const connection =
    await testConnection();

  return {
    ready:
      configuration.databaseConfigured &&
      connection.connected,

    configuration,
    connection
  };
}

/*
============================================================
 66. تنظيف القيم قبل إرسالها لقاعدة البيانات
============================================================

 لا نقوم بتحويل البيانات إلى نصوص بشكل إجباري.
 PostgreSQL driver مسؤول عن التعامل مع أنواع القيم.
============================================================
*/

function prepareValues(values) {
  return normalizeValues(values).map(
    (value) => value
  );
}

/*
============================================================
 67. Query آمن مع القيم المحضرة
============================================================
*/

async function safeQuery(
  text,
  values = []
) {
  return query(
    text,
    prepareValues(values)
  );
}

/*
============================================================
 68. Query Rows آمن
============================================================
*/

async function safeQueryRows(
  text,
  values = []
) {
  return queryRows(
    text,
    prepareValues(values)
  );
}

/*
============================================================
 69. Query One آمن
============================================================
*/

async function safeQueryOne(
  text,
  values = []
) {
  return queryOne(
    text,
    prepareValues(values)
  );
}

/*
============================================================
 70. إيقاف قاعدة البيانات عند إغلاق التطبيق
============================================================
*/

const shutdownSignals = [
  'SIGINT',
  'SIGTERM'
];

for (const signal of shutdownSignals) {
  process.once(
    signal,
    async () => {
      await shutdownDatabase(
        signal
      );
    }
  );
}

/*
============================================================
 71. منع Promise rejection غير المتعامل معها داخل
     عمليات قاعدة البيانات
============================================================
*/

process.on(
  'unhandledRejection',
  (reason) => {
    if (NODE_ENV !== 'test') {
      console.error(
        '[DATABASE] Unhandled Promise Rejection:',
        reason
      );
    }
  }
);

/*
============================================================
 72. التصدير النهائي
============================================================
*/

module.exports.prepareValues =
  prepareValues;

module.exports.safeQuery =
  safeQuery;

module.exports.safeQueryRows =
  safeQueryRows;

module.exports.safeQueryOne =
  safeQueryOne;

module.exports.getDatabaseConfiguration =
  getDatabaseConfiguration;

module.exports.testConnection =
  testConnection;

module.exports.readinessCheck =
  readinessCheck;

/*
============================================================
 73. التحقق من صحة الإعدادات عند تحميل الملف
============================================================
*/

try {
  validatePoolConfiguration();
} catch (error) {
  console.error(
    '[DATABASE] Invalid database configuration:',
    error.message
  );

  throw error;
}

/*
============================================================
 74. النهاية الرسمية للملف
============================================================

 database.js لا يحتوي على:
 - مستخدمين تجريبيين
 - حسابات وهمية
 - أرصدة وهمية
 - رسائل وهمية
 - منشورات وهمية
 - هدايا وهمية
 - كلمات مرور
 - بيانات تسجيل دخول ثابتة

 جميع البيانات يجب أن تأتي من PostgreSQL الفعلية.

 ملاحظة:
 تعيين أول حساب كـ Owner سيتم تنفيذه في طبقة
 المصادقة/الخادم مع Transaction آمنة، وليس بإضافة
 حساب وهمي داخل database.js.
============================================================
*/
