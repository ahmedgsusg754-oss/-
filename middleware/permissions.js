'use strict';

const { query } = require('../database');

const OWNER_ROLE = 'OWNER';
const FULL_ACCESS = '*';

function createPermissionError(
  message = 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'
) {
  const error = new Error(message);

  error.statusCode = 403;
  error.code = 'PERMISSION_DENIED';

  return error;
}

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toUpperCase();
}

function normalizePermission(permission) {
  return String(permission || '')
    .trim()
    .toLowerCase();
}

function getUserId(req) {
  return req?.user?.id || req?.auth?.userId || null;
}

function isOwnerRequest(req) {
  return normalizeRole(req?.user?.role) === OWNER_ROLE ||
    req?.isOwner === true;
}

function ownerHasFullAccess(req) {
  if (!isOwnerRequest(req)) {
    return false;
  }

  if (
    Array.isArray(req?.permissions) &&
    req.permissions.includes(FULL_ACCESS)
  ) {
    return true;
  }

  if (
    Array.isArray(req?.userPermissions) &&
    req.userPermissions.includes(FULL_ACCESS)
  ) {
    return true;
  }

  if (req?.access?.full === true) {
    return true;
  }

  if (req?.ownerPermissions?.fullAccess === true) {
    return true;
  }

  return true;
}

function allowOwner(req, res, next) {
  if (isOwnerRequest(req) && ownerHasFullAccess(req)) {
    return next();
  }

  return next(
    createPermissionError(
      'هذه الصلاحية متاحة لمالك المنصة فقط.'
    )
  );
}

async function getDatabasePermissions(userId) {
  if (!userId) {
    return [];
  }

  const result = await query(
    `
      SELECT DISTINCT p.permission_key
      FROM permissions p
      INNER JOIN role_permissions rp
        ON rp.permission_id = p.id
      INNER JOIN users u
        ON UPPER(u.role) = UPPER(rp.role)
      WHERE u.id = $1

      UNION

      SELECT DISTINCT p.permission_key
      FROM permissions p
      INNER JOIN user_permissions up
        ON up.permission_id = p.id
      WHERE up.user_id = $1
        AND (
          up.expires_at IS NULL
          OR up.expires_at > NOW()
        )

      ORDER BY permission_key
    `,
    [userId]
  );

  return result.rows
    .map((row) => normalizePermission(row.permission_key))
    .filter(Boolean);
}

async function loadPermissions(req) {
  if (!req.user) {
    return [];
  }

  if (isOwnerRequest(req)) {
    return [FULL_ACCESS];
  }

  const permissions = await getDatabasePermissions(
    getUserId(req)
  );

  req.permissions = permissions;
  req.userPermissions = permissions;

  req.access = {
    full: false,
    owner: false,
    permissions
  };

  return permissions;
}

function hasPermission(req, permission) {
  if (!req?.user) {
    return false;
  }

  if (isOwnerRequest(req) && ownerHasFullAccess(req)) {
    return true;
  }

  const requestedPermission = normalizePermission(permission);

  if (!requestedPermission) {
    return false;
  }

  const permissions = Array.isArray(req.permissions)
    ? req.permissions
    : Array.isArray(req.userPermissions)
      ? req.userPermissions
      : [];

  return permissions.some((item) => {
    const currentPermission = normalizePermission(item);

    return (
      currentPermission === FULL_ACCESS ||
      currentPermission === requestedPermission
    );
  });
}

function hasAnyPermission(req, permissions = []) {
  if (!req?.user) {
    return false;
  }

  if (isOwnerRequest(req) && ownerHasFullAccess(req)) {
    return true;
  }

  return permissions.some((permission) =>
    hasPermission(req, permission)
  );
}

function hasAllPermissions(req, permissions = []) {
  if (!req?.user) {
    return false;
  }

  if (isOwnerRequest(req) && ownerHasFullAccess(req)) {
    return true;
  }

  return permissions.every((permission) =>
    hasPermission(req, permission)
  );
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        const error = new Error('يجب تسجيل الدخول أولاً.');

        error.statusCode = 401;
        error.code = 'AUTH_REQUIRED';

        return next(error);
      }

      if (isOwnerRequest(req) && ownerHasFullAccess(req)) {
        return next();
      }

      if (
        !Array.isArray(req.permissions) ||
        req.permissions.length === 0
      ) {
        await loadPermissions(req);
      }

      if (hasPermission(req, permission)) {
        return next();
      }

      return next(createPermissionError());
    } catch (error) {
      return next(error);
    }
  };
}

function requireAnyPermission(...permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        const error = new Error('يجب تسجيل الدخول أولاً.');

        error.statusCode = 401;
        error.code = 'AUTH_REQUIRED';

        return next(error);
      }

      if (isOwnerRequest(req) && ownerHasFullAccess(req)) {
        return next();
      }

      if (
        !Array.isArray(req.permissions) ||
        req.permissions.length === 0
      ) {
        await loadPermissions(req);
      }

      if (hasAnyPermission(req, permissions.flat())) {
        return next();
      }

      return next(createPermissionError());
    } catch (error) {
      return next(error);
    }
  };
}

function requireAllPermissions(...permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        const error = new Error('يجب تسجيل الدخول أولاً.');

        error.statusCode = 401;
        error.code = 'AUTH_REQUIRED';

        return next(error);
      }

      if (isOwnerRequest(req) && ownerHasFullAccess(req)) {
        return next();
      }

      if (
        !Array.isArray(req.permissions) ||
        req.permissions.length === 0
      ) {
        await loadPermissions(req);
      }

      if (hasAllPermissions(req, permissions.flat())) {
        return next();
      }

      return next(createPermissionError());
    } catch (error) {
      return next(error);
    }
  };
}

async function permissionsMiddleware(req, res, next) {
  try {
    if (!req.user) {
      return next();
    }

    if (isOwnerRequest(req)) {
      req.permissions = [FULL_ACCESS];
      req.userPermissions = [FULL_ACCESS];

      req.access = {
        full: true,
        owner: true,
        permissions: [FULL_ACCESS]
      };

      return next();
    }

    await loadPermissions(req);

    return next();
  } catch (error) {
    return next(error);
  }
}

function getPermissions(req) {
  if (!req) {
    return [];
  }

  if (
    isOwnerRequest(req) &&
    ownerHasFullAccess(req)
  ) {
    return [FULL_ACCESS];
  }

  if (Array.isArray(req.permissions)) {
    return [...req.permissions];
  }

  if (Array.isArray(req.userPermissions)) {
    return [...req.userPermissions];
  }

  return [];
}

function attachOwnerFullAccess(req) {
  if (!req) {
    return req;
  }

  req.isOwner = true;
  req.permissions = [FULL_ACCESS];
  req.userPermissions = [FULL_ACCESS];

  req.access = {
    full: true,
    owner: true,
    permissions: [FULL_ACCESS]
  };

  if (!req.ownerPermissions) {
    req.ownerPermissions = {};
  }

  req.ownerPermissions.fullAccess = true;

  return req;
}

module.exports = {
  permissionsMiddleware,
  loadPermissions,
  getDatabasePermissions,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissions,
  allowOwner,
  attachOwnerFullAccess,
  normalizePermission,
  normalizeRole,
  OWNER_ROLE,
  FULL_ACCESS
};
