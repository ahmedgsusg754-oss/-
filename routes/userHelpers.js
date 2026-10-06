'use strict';

const crypto = require('crypto');

const OWNER_ROLE = 'OWNER';
const ADMIN_ROLE = 'ADMIN';
const MODERATOR_ROLE = 'MODERATOR';
const USER_ROLE = 'USER';

function normalizeId(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  return normalized || null;
}

function normalizeUsername(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const username =
    String(value).trim();

  return username || null;
}

function normalizeEmail(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const email =
    String(value)
      .trim()
      .toLowerCase();

  return email || null;
}

function normalizeDisplayName(
  value,
  fallback = null
) {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  const displayName =
    String(value).trim();

  return (
    displayName ||
    fallback ||
    null
  );
}

function getUserId(user) {
  if (
    !user ||
    typeof user !== 'object'
  ) {
    return null;
  }

  return normalizeId(
    user.id ??
    user.userId ??
    user.user_id
  );
}

function getUsername(user) {
  if (
    !user ||
    typeof user !== 'object'
  ) {
    return null;
  }

  return normalizeUsername(
    user.username
  );
}

function getEmail(user) {
  if (
    !user ||
    typeof user !== 'object'
  ) {
    return null;
  }

  return normalizeEmail(
    user.email
  );
}

function getRole(user) {
  if (
    !user ||
    typeof user !== 'object'
  ) {
    return null;
  }

  return String(
    user.role ||
    USER_ROLE
  )
    .trim()
    .toUpperCase();
}

function isOwner(user) {
  return getRole(user) === OWNER_ROLE;
}

function isAdmin(user) {
  const role =
    getRole(user);

  return (
    role === OWNER_ROLE ||
    role === ADMIN_ROLE
  );
}

function isModerator(user) {
  const role =
    getRole(user);

  return (
    role === OWNER_ROLE ||
    role === ADMIN_ROLE ||
    role === MODERATOR_ROLE
  );
}

function hasRole(
  user,
  role
) {
  if (!role) {
    return false;
  }

  return (
    getRole(user) ===
    String(role)
      .trim()
      .toUpperCase()
  );
}

function hasAnyRole(
  user,
  roles = []
) {
  if (!Array.isArray(roles)) {
    return false;
  }

  const userRole =
    getRole(user);

  return roles.some(
    (role) =>
      userRole ===
      String(role)
        .trim()
        .toUpperCase()
  );
}

function hasPermission(
  user,
  permission
) {
  if (!user || !permission) {
    return false;
  }

  if (isOwner(user)) {
    return true;
  }

  const required =
    String(permission)
      .trim();

  if (!required) {
    return false;
  }

  const permissions = Array.isArray(
    user.permissions
  )
    ? user.permissions
    : Array.isArray(
        user.userPermissions
      )
      ? user.userPermissions
      : [];

  return permissions.some(
    (item) => {
      const value =
        typeof item === 'string'
          ? item
          : item?.permission_key ??
            item?.permissionKey ??
            item?.key;

      return (
        value === '*' ||
        value === required
      );
    }
  );
}

function hasAnyPermission(
  user,
  permissions = []
) {
  if (
    !Array.isArray(permissions) ||
    permissions.length === 0
  ) {
    return false;
  }

  return permissions.some(
    (permission) =>
      hasPermission(
        user,
        permission
      )
  );
}

function hasAllPermissions(
  user,
  permissions = []
) {
  if (
    !Array.isArray(permissions)
  ) {
    return false;
  }

  if (permissions.length === 0) {
    return true;
  }

  return permissions.every(
    (permission) =>
      hasPermission(
        user,
        permission
      )
  );
}

function isActiveUser(user) {
  if (!user) {
    return false;
  }

  if (
    user.is_active === false ||
    user.isActive === false
  ) {
    return false;
  }

  const status = String(
    user.status || 'ACTIVE'
  )
    .trim()
    .toUpperCase();

  return ![
    'BANNED',
    'DISABLED',
    'SUSPENDED',
    'DELETED',
    'INACTIVE'
  ].includes(status);
}

function isBannedUser(user) {
  if (!user) {
    return false;
  }

  if (
    user.is_banned === true ||
    user.isBanned === true
  ) {
    return true;
  }

  return (
    String(user.status || '')
      .trim()
      .toUpperCase() === 'BANNED'
  );
}

function isSuspendedUser(user) {
  if (!user) {
    return false;
  }

  return (
    String(user.status || '')
      .trim()
      .toUpperCase() === 'SUSPENDED'
  );
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const id =
    getUserId(user);

  const username =
    getUsername(user);

  const email =
    getEmail(user);

  const role =
    getRole(user);

  const displayName =
    normalizeDisplayName(
      user.display_name ??
      user.displayName,
      username
    );

  return {
    id,
    username,
    email,
    displayName,
    avatarUrl:
      user.avatar_url ??
      user.avatarUrl ??
      null,
    coverUrl:
      user.cover_url ??
      user.coverUrl ??
      null,
    bio:
      user.bio ??
      '',
    role,
    status:
      user.status ??
      'ACTIVE',
    level:
      Number.isFinite(
        Number(user.level)
      )
        ? Number(user.level)
        : 1,
    experience:
      Number.isFinite(
        Number(
          user.experience ??
          user.xp
        )
      )
        ? Number(
            user.experience ??
            user.xp
          )
        : 0,
    coins:
      Number.isFinite(
        Number(user.coins)
      )
        ? Number(user.coins)
        : 0,
    isOwner:
      role === OWNER_ROLE,
    isAdmin:
      isAdmin(user),
    isModerator:
      isModerator(user),
    createdAt:
      user.created_at ??
      user.createdAt ??
      null,
    updatedAt:
      user.updated_at ??
      user.updatedAt ??
      null
  };
}

function sanitizePublicUser(user) {
  if (!user) {
    return null;
  }

  const sanitized =
    sanitizeUser(user);

  if (!sanitized) {
    return null;
  }

  delete sanitized.email;

  return sanitized;
}

function sanitizePrivateUser(user) {
  if (!user) {
    return null;
  }

  return sanitizeUser(user);
}

function getAvatarUrl(user) {
  if (!user) {
    return null;
  }

  return (
    user.avatar_url ??
    user.avatarUrl ??
    null
  );
}

function getCoverUrl(user) {
  if (!user) {
    return null;
  }

  return (
    user.cover_url ??
    user.coverUrl ??
    null
  );
}

function getLevel(user) {
  if (!user) {
    return 1;
  }

  const level =
    Number(user.level);

  return Number.isInteger(level) &&
    level > 0
    ? level
    : 1;
}

function getExperience(user) {
  if (!user) {
    return 0;
  }

  const experience =
    Number(
      user.experience ??
      user.xp ??
      0
    );

  return Number.isFinite(
    experience
  ) && experience >= 0
    ? experience
    : 0;
}

function getCoins(user) {
  if (!user) {
    return 0;
  }

  const coins =
    Number(user.coins ?? 0);

  return Number.isFinite(coins) &&
    coins >= 0
    ? coins
    : 0;
}

function getUserInitials(
  user,
  fallback = '؟'
) {
  const name =
    normalizeDisplayName(
      user?.display_name ??
      user?.displayName ??
      user?.username,
      ''
    );

  if (!name) {
    return fallback;
  }

  const parts =
    name
      .split(/\s+/)
      .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2);
  }

  return (
    parts[0][0] +
    parts[1][0]
  );
}

function createPublicProfile(
  user
) {
  if (!user) {
    return null;
  }

  return {
    id:
      getUserId(user),
    username:
      getUsername(user),
    displayName:
      normalizeDisplayName(
        user.display_name ??
        user.displayName,
        getUsername(user)
      ),
    avatarUrl:
      getAvatarUrl(user),
    coverUrl:
      getCoverUrl(user),
    bio:
      user.bio ?? '',
    role:
      getRole(user),
    level:
      getLevel(user),
    experience:
      getExperience(user),
    isOwner:
      isOwner(user),
    createdAt:
      user.created_at ??
      user.createdAt ??
      null
  };
}

function canViewProfile(
  viewer,
  target
) {
  if (!target) {
    return false;
  }

  const viewerId =
    getUserId(viewer);

  const targetId =
    getUserId(target);

  if (
    viewerId &&
    targetId &&
    viewerId === targetId
  ) {
    return true;
  }

  if (isOwner(viewer)) {
    return true;
  }

  return isActiveUser(target);
}

function canEditProfile(
  viewer,
  target
) {
  if (!viewer || !target) {
    return false;
  }

  const viewerId =
    getUserId(viewer);

  const targetId =
    getUserId(target);

  if (
    viewerId &&
    targetId &&
    viewerId === targetId
  ) {
    return true;
  }

  return isOwner(viewer);
}

function canManageUser(
  actor,
  target
) {
  if (!actor || !target) {
    return false;
  }

  if (isOwner(actor)) {
    return true;
  }

  if (
    getUserId(actor) ===
    getUserId(target)
  ) {
    return false;
  }

  return isAdmin(actor);
}

function canDeleteUser(
  actor,
  target
) {
  if (!actor || !target) {
    return false;
  }

  if (
    getUserId(actor) ===
    getUserId(target)
  ) {
    return false;
  }

  if (isOwner(actor)) {
    return true;
  }

  if (
    getRole(target) ===
    OWNER_ROLE
  ) {
    return false;
  }

  return isAdmin(actor);
}

function canBanUser(
  actor,
  target
) {
  if (!actor || !target) {
    return false;
  }

  if (
    getUserId(actor) ===
    getUserId(target)
  ) {
    return false;
  }

  if (isOwner(actor)) {
    return true;
  }

  if (
    getRole(target) ===
    OWNER_ROLE
  ) {
    return false;
  }

  return isAdmin(actor);
}

function canChangeRole(
  actor,
  target,
  newRole
) {
  if (!actor || !target) {
    return false;
  }

  if (!isOwner(actor)) {
    return false;
  }

  const role =
    String(newRole || '')
      .trim()
      .toUpperCase();

  if (!role) {
    return false;
  }

  /*
   * OWNER هو صاحب الصلاحية الكاملة.
   * لا يسمح لأي حساب آخر بتعديل OWNER.
   */
  if (
    getRole(target) ===
    OWNER_ROLE
  ) {
    return false;
  }

  return [
    USER_ROLE,
    MODERATOR_ROLE,
    ADMIN_ROLE
  ].includes(role);
}

function isSameUser(
  first,
  second
) {
  const firstId =
    getUserId(first);

  const secondId =
    getUserId(second);

  if (!firstId || !secondId) {
    return false;
  }

  return firstId === secondId;
}

function createUserReference(
  user
) {
  if (!user) {
    return null;
  }

  return {
    id:
      getUserId(user),
    username:
      getUsername(user),
    displayName:
      normalizeDisplayName(
        user.display_name ??
        user.displayName,
        getUsername(user)
      ),
    avatarUrl:
      getAvatarUrl(user)
  };
}

function parseBoolean(
  value,
  defaultValue = false
) {
  if (
    value === undefined ||
    value === null
  ) {
    return defaultValue;
  }

  if (
    typeof value === 'boolean'
  ) {
    return value;
  }

  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  if (
    ['true', '1', 'yes', 'on']
      .includes(normalized)
  ) {
    return true;
  }

  if (
    ['false', '0', 'no', 'off']
      .includes(normalized)
  ) {
    return false;
  }

  return defaultValue;
}

function parsePositiveInteger(
  value,
  defaultValue = 0
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return defaultValue;
  }

  return number;
}

function generateReferenceId(
  prefix = 'usr'
) {
  const safePrefix =
    String(prefix)
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 20) ||
    'usr';

  return `${safePrefix}_${crypto
    .randomBytes(12)
    .toString('hex')}`;
}

module.exports = {
  OWNER_ROLE,
  ADMIN_ROLE,
  MODERATOR_ROLE,
  USER_ROLE,

  normalizeId,
  normalizeUsername,
  normalizeEmail,
  normalizeDisplayName,

  getUserId,
  getUsername,
  getEmail,
  getRole,

  isOwner,
  isAdmin,
  isModerator,
  hasRole,
  hasAnyRole,

  hasPermission,
  hasAnyPermission,
  hasAllPermissions,

  isActiveUser,
  isBannedUser,
  isSuspendedUser,

  sanitizeUser,
  sanitizePublicUser,
  sanitizePrivateUser,

  getAvatarUrl,
  getCoverUrl,
  getLevel,
  getExperience,
  getCoins,
  getUserInitials,

  createPublicProfile,

  canViewProfile,
  canEditProfile,
  canManageUser,
  canDeleteUser,
  canBanUser,
  canChangeRole,

  isSameUser,
  createUserReference,

  parseBoolean,
  parsePositiveInteger,
  generateReferenceId
};
