'use strict';

const { query } = require('../database');

const OWNER_ROLE = 'OWNER';
const FULL_ACCESS = '*';

function createError(message, statusCode, code) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toUpperCase();
}

function isInactiveUser(user) {
  if (!user) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(user, 'is_active') &&
    user.is_active === false
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(user, 'is_banned') &&
    user.is_banned === true
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(user, 'status') &&
    ['banned', 'disabled', 'suspended', 'deleted'].includes(
      String(user.status).trim().toLowerCase()
    )
  ) {
    return true;
  }

  return false;
}

async function getOwnerAccount(userId) {
  if (!userId) {
    return null;
  }

  const result = await query(
    `
      SELECT
        id,
        username,
        email,
        role,
        is_active,
        is_banned,
        status
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

function attachFullOwnerAccess(req, user) {
  const ownerId = String(user.id);

  req.owner = {
    id: ownerId,
    username: user.username || null,
    email: user.email || null,
    role: OWNER_ROLE
  };

  req.isOwner = true;

  /*
   * OWNER يمتلك جميع الصلاحيات داخل المنصة.
   * الرمز * يعني وصولاً كاملاً، وسيتم التعامل معه
   * في middleware/permissions.js كصلاحية شاملة.
   */
  req.permissions = [FULL_ACCESS];

  req.userPermissions = [FULL_ACCESS];

  req.access = {
    full: true,
    owner: true,
    permissions: [FULL_ACCESS]
  };

  /*
   * صلاحيات المنصة الكاملة للـ OWNER.
   * لا يتم تقييدها بصلاحيات منفردة.
   */
  req.ownerPermissions = {
    users: true,
    usersView: true,
    usersCreate: true,
    usersUpdate: true,
    usersDelete: true,
    usersBan: true,
    usersUnban: true,
    usersSuspend: true,
    usersUnsuspend: true,
    usersPermissions: true,
    usersRoles: true,

    rooms: true,
    roomsView: true,
    roomsCreate: true,
    roomsUpdate: true,
    roomsDelete: true,
    roomsSettings: true,
    roomsMembers: true,
    roomsPermissions: true,
    roomsModeration: true,
    roomsMessages: true,

    messages: true,
    directMessages: true,
    roomMessages: true,
    deleteMessages: true,
    moderateMessages: true,

    posts: true,
    postsView: true,
    postsCreate: true,
    postsUpdate: true,
    postsDelete: true,
    postsModeration: true,

    comments: true,
    commentsCreate: true,
    commentsUpdate: true,
    commentsDelete: true,
    commentsModeration: true,

    reactions: true,

    profiles: true,
    profilesView: true,
    profilesUpdate: true,
    profilesModeration: true,

    settings: true,
    userSettings: true,
    roomSettings: true,
    systemSettings: true,

    uploads: true,
    uploadImages: true,
    uploadVideos: true,
    uploadAudio: true,
    uploadAvatars: true,
    uploadCovers: true,
    uploadGifs: true,

    wallet: true,
    walletsView: true,
    walletsManage: true,
    coins: true,
    coinsAdd: true,
    coinsRemove: true,
    coinsTransfer: true,
    transactions: true,
    transactionsView: true,
    transactionsManage: true,

    gifts: true,
    giftsView: true,
    giftsCreate: true,
    giftsUpdate: true,
    giftsDelete: true,
    giftsManage: true,

    store: true,
    storeView: true,
    storeCreate: true,
    storeUpdate: true,
    storeDelete: true,
    purchases: true,
    purchasesView: true,
    purchasesManage: true,

    levels: true,
    levelsView: true,
    levelsCreate: true,
    levelsUpdate: true,
    levelsDelete: true,
    rewards: true,
    dailyRewards: true,

    vip: true,
    vipManage: true,

    badges: true,
    badgesView: true,
    badgesCreate: true,
    badgesUpdate: true,
    badgesDelete: true,
    badgesAssign: true,
    badgesRemove: true,

    notifications: true,
    notificationsView: true,
    notificationsCreate: true,
    notificationsManage: true,

    reports: true,
    reportsView: true,
    reportsManage: true,
    reportsDelete: true,

    follows: true,
    blocks: true,

    sessions: true,
    sessionsView: true,
    sessionsRevoke: true,

    permissions: true,
    permissionsView: true,
    permissionsCreate: true,
    permissionsUpdate: true,
    permissionsDelete: true,
    permissionsAssign: true,
    permissionsRevoke: true,

    admins: true,
    moderators: true,
    roles: true,
    roleManagement: true,

    auditLogs: true,
    auditLogsView: true,
    securityLogs: true,

    databaseManagement: true,
    platformManagement: true,
    maintenance: true,

    ownerManagement: true,
    ownerSettings: true,

    system: true,
    fullAccess: true
  };

  return req;
}

async function ownerMiddleware(req, res, next) {
  try {
    if (!req.user) {
      return next(
        createError(
          'يجب تسجيل الدخول أولاً.',
          401,
          'AUTH_REQUIRED'
        )
      );
    }

    const userId = req.user.id;

    if (!userId) {
      return next(
        createError(
          'بيانات الحساب غير صالحة.',
          401,
          'INVALID_USER'
        )
      );
    }

    const user = await getOwnerAccount(userId);

    if (!user) {
      return next(
        createError(
          'الحساب غير موجود.',
          401,
          'USER_NOT_FOUND'
        )
      );
    }

    if (isInactiveUser(user)) {
      return next(
        createError(
          'هذا الحساب غير متاح حالياً.',
          403,
          'USER_INACTIVE'
        )
      );
    }

    const role = normalizeRole(user.role);

    if (role !== OWNER_ROLE) {
      return next(
        createError(
          'هذا الإجراء متاح لمالك المنصة فقط.',
          403,
          'OWNER_ONLY'
        )
      );
    }

    attachFullOwnerAccess(req, user);

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireOwner(req, res, next) {
  return ownerMiddleware(req, res, next);
}

function isOwner(req) {
  return Boolean(
    req &&
    req.user &&
    normalizeRole(req.user.role) === OWNER_ROLE
  );
}

function hasOwnerFullAccess(req) {
  return Boolean(
    req &&
    req.isOwner === true &&
    Array.isArray(req.permissions) &&
    req.permissions.includes(FULL_ACCESS)
  );
}

function ownerHasPermission(req, permission) {
  if (!isOwner(req)) {
    return false;
  }

  if (hasOwnerFullAccess(req)) {
    return true;
  }

  if (
    req.ownerPermissions &&
    typeof req.ownerPermissions === 'object'
  ) {
    if (req.ownerPermissions.fullAccess === true) {
      return true;
    }

    if (
      permission &&
      req.ownerPermissions[String(permission)] === true
    ) {
      return true;
    }
  }

  return false;
}

function requireOwnerPermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        createError(
          'يجب تسجيل الدخول أولاً.',
          401,
          'AUTH_REQUIRED'
        )
      );
    }

    if (!isOwner(req)) {
      return next(
        createError(
          'ليس لديك صلاحية تنفيذ هذا الإجراء.',
          403,
          'PERMISSION_DENIED'
        )
      );
    }

    /*
     * OWNER لديه جميع الصلاحيات.
     * لا يتم رفض الطلب بسبب اسم صلاحية محددة.
     */
    if (ownerHasPermission(req, permission)) {
      return next();
    }

    return next(
      createError(
        'تعذر التحقق من صلاحيات مالك المنصة.',
        403,
        'OWNER_PERMISSION_ERROR'
      )
    );
  };
}

function grantFullOwnerAccess(req) {
  if (!req) {
    return req;
  }

  req.isOwner = true;
  req.permissions = [FULL_ACCESS];
  req.userPermissions = [FULL_ACCESS];

  if (!req.access) {
    req.access = {};
  }

  req.access.full = true;
  req.access.owner = true;
  req.access.permissions = [FULL_ACCESS];

  return req;
}

module.exports = {
  ownerMiddleware,
  requireOwner,
  isOwner,
  hasOwnerFullAccess,
  ownerHasPermission,
  requireOwnerPermission,
  grantFullOwnerAccess,
  getOwnerAccount,
  OWNER_ROLE,
  FULL_ACCESS
};
