'use strict';

require('dotenv').config();

const database = require('./database');

const systemPermissions = [
  ['users.view', 'عرض المستخدمين'],
  ['users.manage', 'إدارة المستخدمين'],
  ['users.suspend', 'إيقاف المستخدمين'],
  ['users.ban', 'حظر المستخدمين'],
  ['users.delete', 'حذف المستخدمين'],
  ['users.permissions', 'إدارة صلاحيات المستخدمين'],
  ['rooms.view', 'عرض الغرف'],
  ['rooms.create', 'إنشاء الغرف'],
  ['rooms.manage', 'إدارة الغرف'],
  ['rooms.delete', 'حذف الغرف'],
  ['rooms.members', 'إدارة أعضاء الغرف'],
  ['rooms.settings', 'إدارة إعدادات الغرف'],
  ['rooms.moderate', 'إدارة محتوى الغرف'],
  ['posts.moderate', 'إدارة المنشورات'],
  ['comments.moderate', 'إدارة التعليقات'],
  ['reports.view', 'عرض البلاغات'],
  ['reports.manage', 'إدارة البلاغات'],
  ['wallet.view', 'عرض المحفظة'],
  ['wallet.manage', 'إدارة أرصدة المحافظ'],
  ['transactions.view', 'عرض المعاملات'],
  ['gifts.view', 'عرض الهدايا'],
  ['gifts.manage', 'إدارة الهدايا'],
  ['store.view', 'عرض المتجر'],
  ['store.manage', 'إدارة المتجر'],
  ['levels.view', 'عرض المستويات'],
  ['levels.manage', 'إدارة المستويات'],
  ['notifications.manage', 'إدارة الإشعارات'],
  ['settings.view', 'عرض الإعدادات'],
  ['settings.manage', 'إدارة إعدادات النظام'],
  ['audit.view', 'عرض سجل العمليات'],
  ['admin.access', 'الدخول إلى لوحة الإدارة'],
  ['owner.full_access', 'صلاحيات المالك الكاملة']
];

const levels = [
  [1, 0, 0, 'مبتدئ'],
  [2, 100, 0, 'عضو'],
  [3, 250, 0, 'نشط'],
  [4, 500, 0, 'متفاعل'],
  [5, 1000, 100, 'متقدم'],
  [6, 1800, 120, 'مميز'],
  [7, 3000, 150, 'محترف'],
  [8, 5000, 180, 'خبير'],
  [9, 8000, 220, 'نجم'],
  [10, 12000, 250, 'نجم متقدم'],
  [11, 18000, 300, 'نخبة'],
  [12, 26000, 350, 'نخبة متقدمة'],
  [13, 38000, 400, 'أسطوري'],
  [14, 55000, 450, 'أسطوري متقدم'],
  [15, 80000, 500, 'ملك'],
  [16, 115000, 600, 'ملك متقدم'],
  [17, 165000, 700, 'قمة'],
  [18, 235000, 800, 'قمة متقدمة'],
  [19, 330000, 900, 'أسطورة'],
  [20, 450000, 1000, 'أسطورة عليا']
];

const systemSettings = [
  ['site_name', 'افـنـدツ⁠يـنـا🥀🖤'],
  ['registration_enabled', true],
  ['rooms_enabled', true],
  ['posts_enabled', true],
  ['gifts_enabled', true],
  ['store_enabled', true],
  ['transfers_enabled', true],
  ['max_gift_price', 200000],
  ['room_purchase_price', 50000],
  ['daily_rewards_start_level', 5],
  ['auto_first_owner', true],
  ['owner_transfer_enabled', false],
  ['owner_demotion_enabled', false]
];

async function seedPermissions(client) {
  for (const [permissionKey, description] of systemPermissions) {
    await client.query(
      `
        INSERT INTO permissions (
          permission_key,
          description
        )
        VALUES ($1, $2)
        ON CONFLICT (permission_key)
        DO UPDATE SET
          description = EXCLUDED.description
      `,
      [permissionKey, description]
    );
  }
}

async function seedRolePermissions(client) {
  const moderatorPermissions = [
    'users.view',
    'rooms.view',
    'rooms.members',
    'rooms.moderate',
    'posts.moderate',
    'comments.moderate',
    'reports.view',
    'reports.manage',
    'gifts.view',
    'store.view',
    'levels.view'
  ];

  const adminPermissions = [
    'users.view',
    'users.manage',
    'users.suspend',
    'users.ban',
    'users.permissions',
    'rooms.view',
    'rooms.create',
    'rooms.manage',
    'rooms.delete',
    'rooms.members',
    'rooms.settings',
    'rooms.moderate',
    'posts.moderate',
    'comments.moderate',
    'reports.view',
    'reports.manage',
    'wallet.view',
    'wallet.manage',
    'transactions.view',
    'gifts.view',
    'gifts.manage',
    'store.view',
    'store.manage',
    'levels.view',
    'levels.manage',
    'notifications.manage',
    'settings.view',
    'settings.manage',
    'audit.view',
    'admin.access'
  ];

  const roles = {
    MODERATOR: moderatorPermissions,
    ADMIN: adminPermissions
  };

  for (const [role, permissionKeys] of Object.entries(roles)) {
    for (const permissionKey of permissionKeys) {
      await client.query(
        `
          INSERT INTO role_permissions (
            role,
            permission_id
          )
          SELECT $1, id
          FROM permissions
          WHERE permission_key = $2
          ON CONFLICT DO NOTHING
        `,
        [role, permissionKey]
      );
    }
  }

  await client.query(
    `
      INSERT INTO role_permissions (
        role,
        permission_id
      )
      SELECT 'OWNER', id
      FROM permissions
      ON CONFLICT DO NOTHING
    `
  );
}

async function seedLevels(client) {
  for (const [level, requiredExperience, dailyReward, title] of levels) {
    await client.query(
      `
        INSERT INTO levels (
          level,
          required_experience,
          daily_reward,
          title
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (level)
        DO UPDATE SET
          required_experience = EXCLUDED.required_experience,
          daily_reward = EXCLUDED.daily_reward,
          title = EXCLUDED.title
      `,
      [level, requiredExperience, dailyReward, title]
    );
  }
}

async function seedSettings(client) {
  for (const [settingKey, value] of systemSettings) {
    await client.query(
      `
        INSERT INTO system_settings (
          setting_key,
          setting_value
        )
        VALUES ($1, $2::jsonb)
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = NOW()
      `,
      [settingKey, JSON.stringify(value)]
    );
  }
}

async function seed() {
  const client = await database.getClient();

  try {
    await client.query('BEGIN');

    await seedPermissions(client);
    await seedRolePermissions(client);
    await seedLevels(client);
    await seedSettings(client);

    await client.query('COMMIT');

    console.log('تم تجهيز بيانات النظام الأساسية بنجاح.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('فشل التراجع عن عملية التهيئة:', rollbackError);
    }

    console.error('فشل تجهيز بيانات النظام:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await database.end();
  }
}

if (require.main === module) {
  seed();
}

module.exports = {
  seed,
  systemPermissions,
  levels,
  systemSettings
};
