'use strict';

require('dotenv').config();

const database = require('./database');

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
  },
  {
    version: 2,
    name: 'ensure_core_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS users_status_idx
        ON users(status);

      CREATE INDEX IF NOT EXISTS users_role_idx
        ON users(role);

      CREATE INDEX IF NOT EXISTS users_level_idx
        ON users(level);

      CREATE INDEX IF NOT EXISTS users_last_seen_idx
        ON users(last_seen_at DESC);

      CREATE INDEX IF NOT EXISTS rooms_created_idx
        ON rooms(created_at DESC);

      CREATE INDEX IF NOT EXISTS room_members_status_idx
        ON room_members(status);

      CREATE INDEX IF NOT EXISTS posts_created_idx
        ON posts(created_at DESC);

      CREATE INDEX IF NOT EXISTS transactions_type_idx
        ON transactions(type);

      CREATE INDEX IF NOT EXISTS notifications_type_idx
        ON notifications(type);
    `
  },
  {
    version: 3,
    name: 'ensure_owner_configuration',
    sql: `
      INSERT INTO system_settings (setting_key, setting_value)
      VALUES
        ('auto_first_owner', 'true'::jsonb),
        ('owner_transfer_enabled', 'false'::jsonb),
        ('owner_demotion_enabled', 'false'::jsonb)
      ON CONFLICT (setting_key) DO UPDATE
      SET
        setting_value = EXCLUDED.setting_value,
        updated_at = NOW();
    `
  }
];

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedVersions(client) {
  const result = await client.query(`
    SELECT version
    FROM schema_migrations
    ORDER BY version ASC
  `);

  return new Set(result.rows.map((row) => Number(row.version)));
}

async function runMigrations() {
  const client = await database.getClient();

  try {
    await client.query('BEGIN');

    await ensureMigrationsTable(client);

    const appliedVersions = await getAppliedVersions(client);

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      await client.query(migration.sql);

      await client.query(
        `
          INSERT INTO schema_migrations (version, name)
          VALUES ($1, $2)
        `,
        [migration.version, migration.name]
      );
    }

    await client.query('COMMIT');

    return true;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('فشل التراجع عن عملية الترحيل:', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

async function getMigrationStatus() {
  const client = await database.getClient();

  try {
    await ensureMigrationsTable(client);

    const result = await client.query(`
      SELECT
        version,
        name,
        applied_at
      FROM schema_migrations
      ORDER BY version ASC
    `);

    return result.rows;
  } finally {
    client.release();
  }
}

async function resetMigrationHistory() {
  if (String(process.env.NODE_ENV).toLowerCase() === 'production') {
    throw new Error(
      'لا يمكن حذف سجل الترحيلات في بيئة الإنتاج.'
    );
  }

  await database.query(`
    DROP TABLE IF EXISTS schema_migrations;
  `);

  return true;
}

async function main() {
  try {
    await database.checkConnection();
    await runMigrations();

    const status = await getMigrationStatus();

    console.log(
      `تم تنفيذ الترحيلات بنجاح. عدد الترحيلات المسجلة: ${status.length}`
    );
  } catch (error) {
    console.error('فشل تنفيذ الترحيلات:', error);
    process.exitCode = 1;
  } finally {
    await database.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  migrations,
  runMigrations,
  getMigrationStatus,
  resetMigrationHistory
};
