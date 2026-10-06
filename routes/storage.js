'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const STORAGE_ROOT =
  path.resolve(
    process.env.STORAGE_PATH ||
      path.join(process.cwd(), 'uploads')
  );

const TEMP_DIR =
  path.join(
    STORAGE_ROOT,
    'temp'
  );

const PUBLIC_DIR =
  path.join(
    STORAGE_ROOT,
    'public'
  );

const PRIVATE_DIR =
  path.join(
    STORAGE_ROOT,
    'private'
  );

const AVATARS_DIR =
  path.join(
    PUBLIC_DIR,
    'avatars'
  );

const COVERS_DIR =
  path.join(
    PUBLIC_DIR,
    'covers'
  );

const POSTS_DIR =
  path.join(
    PUBLIC_DIR,
    'posts'
  );

const ROOMS_DIR =
  path.join(
    PUBLIC_DIR,
    'rooms'
  );

const GIFTS_DIR =
  path.join(
    PUBLIC_DIR,
    'gifts'
  );

const CHAT_DIR =
  path.join(
    PRIVATE_DIR,
    'chat'
  );

const ALLOWED_STORAGE_ROOTS = [
  STORAGE_ROOT,
  TEMP_DIR,
  PUBLIC_DIR,
  PRIVATE_DIR,
  AVATARS_DIR,
  COVERS_DIR,
  POSTS_DIR,
  ROOMS_DIR,
  GIFTS_DIR,
  CHAT_DIR
];

function createStorageError(
  message,
  code = 'STORAGE_ERROR',
  statusCode = 500
) {
  const error =
    new Error(message);

  error.code = code;
  error.statusCode = statusCode;

  return error;
}

function normalizeRelativePath(
  value
) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw createStorageError(
      'مسار الملف غير صالح.',
      'INVALID_STORAGE_PATH',
      400
    );
  }

  const normalized =
    value
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

  if (
    normalized.includes('\0') ||
    normalized.includes('../') ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw createStorageError(
      'مسار الملف غير مسموح.',
      'PATH_TRAVERSAL',
      400
    );
  }

  return normalized;
}

function resolveSafePath(
  baseDirectory,
  relativePath
) {
  const base =
    path.resolve(
      baseDirectory
    );

  const relative =
    normalizeRelativePath(
      relativePath
    );

  const target =
    path.resolve(
      base,
      relative
    );

  const baseWithSeparator =
    base.endsWith(
      path.sep
    )
      ? base
      : `${base}${path.sep}`;

  if (
    target !== base &&
    !target.startsWith(
      baseWithSeparator
    )
  ) {
    throw createStorageError(
      'محاولة الوصول إلى مسار غير مسموح.',
      'PATH_TRAVERSAL',
      400
    );
  }

  return target;
}

function assertStoragePath(
  targetPath
) {
  const resolved =
    path.resolve(
      targetPath
    );

  const allowed =
    ALLOWED_STORAGE_ROOTS.some(
      (root) => {
        const normalizedRoot =
          path.resolve(root);

        const rootWithSeparator =
          normalizedRoot.endsWith(
            path.sep
          )
            ? normalizedRoot
            : `${normalizedRoot}${path.sep}`;

        return (
          resolved === normalizedRoot ||
          resolved.startsWith(
            rootWithSeparator
          )
        );
      }
    );

  if (!allowed) {
    throw createStorageError(
      'مسار التخزين غير مسموح.',
      'INVALID_STORAGE_PATH',
      400
    );
  }

  return true;
}

async function ensureDirectory(
  directory
) {
  if (
    typeof directory !== 'string' ||
    !directory.trim()
  ) {
    throw createStorageError(
      'مجلد التخزين غير صالح.'
    );
  }

  const resolved =
    path.resolve(
      directory
    );

  assertStoragePath(
    resolved
  );

  await fsp.mkdir(
    resolved,
    {
      recursive: true,
      mode: 0o750
    }
  );

  return resolved;
}

async function initializeStorage() {
  const directories = [
    STORAGE_ROOT,
    TEMP_DIR,
    PUBLIC_DIR,
    PRIVATE_DIR,
    AVATARS_DIR,
    COVERS_DIR,
    POSTS_DIR,
    ROOMS_DIR,
    GIFTS_DIR,
    CHAT_DIR
  ];

  for (
    const directory of directories
  ) {
    await ensureDirectory(
      directory
    );
  }

  return {
    root: STORAGE_ROOT,
    temp: TEMP_DIR,
    public: PUBLIC_DIR,
    private: PRIVATE_DIR,
    avatars: AVATARS_DIR,
    covers: COVERS_DIR,
    posts: POSTS_DIR,
    rooms: ROOMS_DIR,
    gifts: GIFTS_DIR,
    chat: CHAT_DIR
  };
}

function getDirectory(
  type = 'public'
) {
  switch (
    String(type)
      .trim()
      .toLowerCase()
  ) {
    case 'temp':
      return TEMP_DIR;

    case 'public':
      return PUBLIC_DIR;

    case 'private':
      return PRIVATE_DIR;

    case 'avatars':
    case 'avatar':
      return AVATARS_DIR;

    case 'covers':
    case 'cover':
      return COVERS_DIR;

    case 'posts':
    case 'post':
      return POSTS_DIR;

    case 'rooms':
    case 'room':
      return ROOMS_DIR;

    case 'gifts':
    case 'gift':
      return GIFTS_DIR;

    case 'chat':
      return CHAT_DIR;

    default:
      throw createStorageError(
        'نوع مجلد التخزين غير معروف.',
        'INVALID_STORAGE_TYPE',
        400
      );
  }
}

function generateStorageFilename(
  extension = ''
) {
  let normalizedExtension =
    String(extension || '')
      .trim()
      .toLowerCase();

  if (
    normalizedExtension &&
    !normalizedExtension.startsWith('.')
  ) {
    normalizedExtension =
      `.${normalizedExtension}`;
  }

  normalizedExtension =
    normalizedExtension.replace(
      /[^a-z0-9.]/g,
      ''
    );

  const random =
    crypto.randomBytes(24)
      .toString('hex');

  return `${Date.now()}-${random}${normalizedExtension}`;
}

function generateObjectId() {
  return crypto
    .randomBytes(24)
    .toString('hex');
}

function sanitizeFilename(
  filename,
  fallback = 'file'
) {
  const value =
    path.basename(
      String(filename || '')
    );

  const extension =
    path.extname(value)
      .toLowerCase()
      .replace(
        /[^a-z0-9.]/g,
        ''
      );

  const base =
    path
      .basename(
        value,
        path.extname(value)
      )
      .normalize('NFKC')
      .replace(
        /[^\p{L}\p{N}_-]+/gu,
        '-'
      )
      .replace(
        /-+/g,
        '-'
      )
      .replace(
        /^[-_]+|[-_]+$/g,
        ''
      )
      .slice(0, 100);

  return (
    base || fallback
  ) + extension;
}

async function writeBuffer(
  buffer,
  options = {}
) {
  if (
    !Buffer.isBuffer(buffer)
  ) {
    throw createStorageError(
      'بيانات الملف غير صالحة.',
      'INVALID_FILE_BUFFER',
      400
    );
  }

  if (
    buffer.length === 0
  ) {
    throw createStorageError(
      'الملف فارغ.',
      'EMPTY_FILE',
      400
    );
  }

  const {
    directory = 'temp',
    filename = null,
    extension = ''
  } = options;

  const targetDirectory =
    getDirectory(
      directory
    );

  await ensureDirectory(
    targetDirectory
  );

  const safeFilename =
    filename
      ? sanitizeFilename(
          filename
        )
      : generateStorageFilename(
          extension
        );

  const targetPath =
    resolveSafePath(
      targetDirectory,
      safeFilename
    );

  await fsp.writeFile(
    targetPath,
    buffer,
    {
      flag: 'wx',
      mode: 0o640
    }
  );

  return {
    filename: safeFilename,
    path: targetPath,
    relativePath:
      path.relative(
        STORAGE_ROOT,
        targetPath
      ).replace(
        /\\/g,
        '/'
      ),
    size: buffer.length
  };
}

async function moveFile(
  sourcePath,
  options = {}
) {
  if (
    typeof sourcePath !== 'string' ||
    !sourcePath.trim()
  ) {
    throw createStorageError(
      'مسار الملف المصدر غير صالح.',
      'INVALID_SOURCE_PATH',
      400
    );
  }

  const source =
    path.resolve(
      sourcePath
    );

  assertStoragePath(
    source
  );

  const {
    directory = 'public',
    filename = null,
    extension = ''
  } = options;

  const targetDirectory =
    getDirectory(
      directory
    );

  await ensureDirectory(
    targetDirectory
  );

  const safeFilename =
    filename
      ? sanitizeFilename(
          filename
        )
      : generateStorageFilename(
          extension
        );

  const target =
    resolveSafePath(
      targetDirectory,
      safeFilename
    );

  if (
    source === target
  ) {
    return {
      filename: safeFilename,
      path: target,
      relativePath:
        path.relative(
          STORAGE_ROOT,
          target
        ).replace(
          /\\/g,
          '/'
        )
    };
  }

  try {
    await fsp.rename(
      source,
      target
    );
  } catch (error) {
    if (
      error.code ===
      'EXDEV'
    ) {
      await fsp.copyFile(
        source,
        target,
        fs.constants.COPYFILE_EXCL
      );

      await fsp.unlink(
        source
      );
    } else {
      throw error;
    }
  }

  return {
    filename: safeFilename,
    path: target,
    relativePath:
      path.relative(
        STORAGE_ROOT,
        target
      ).replace(
        /\\/g,
        '/'
      )
  };
}

async function copyFile(
  sourcePath,
  options = {}
) {
  if (
    typeof sourcePath !== 'string' ||
    !sourcePath.trim()
  ) {
    throw createStorageError(
      'مسار الملف المصدر غير صالح.',
      'INVALID_SOURCE_PATH',
      400
    );
  }

  const source =
    path.resolve(
      sourcePath
    );

  assertStoragePath(
    source
  );

  const {
    directory = 'public',
    filename = null,
    extension = ''
  } = options;

  const targetDirectory =
    getDirectory(
      directory
    );

  await ensureDirectory(
    targetDirectory
  );

  const safeFilename =
    filename
      ? sanitizeFilename(
          filename
        )
      : generateStorageFilename(
          extension
        );

  const target =
    resolveSafePath(
      targetDirectory,
      safeFilename
    );

  await fsp.copyFile(
    source,
    target,
    fs.constants.COPYFILE_EXCL
  );

  const stats =
    await fsp.stat(
      target
    );

  return {
    filename: safeFilename,
    path: target,
    relativePath:
      path.relative(
        STORAGE_ROOT,
        target
      ).replace(
        /\\/g,
        '/'
      ),
    size: stats.size
  };
}

async function readFile(
  filePath
) {
  if (
    typeof filePath !== 'string' ||
    !filePath.trim()
  ) {
    throw createStorageError(
      'مسار الملف غير صالح.',
      'INVALID_FILE_PATH',
      400
    );
  }

  const resolved =
    path.resolve(
      filePath
    );

  assertStoragePath(
    resolved
  );

  return fsp.readFile(
    resolved
  );
}

async function getFileInfo(
  filePath
) {
  if (
    typeof filePath !== 'string' ||
    !filePath.trim()
  ) {
    throw createStorageError(
      'مسار الملف غير صالح.',
      'INVALID_FILE_PATH',
      400
    );
  }

  const resolved =
    path.resolve(
      filePath
    );

  assertStoragePath(
    resolved
  );

  const stats =
    await fsp.stat(
      resolved
    );

  return {
    path: resolved,
    size: stats.size,
    isFile: stats.isFile(),
    isDirectory:
      stats.isDirectory(),
    createdAt:
      stats.birthtime,
    modifiedAt:
      stats.mtime
  };
}

async function fileExists(
  filePath
) {
  if (
    typeof filePath !== 'string' ||
    !filePath.trim()
  ) {
    return false;
  }

  try {
    const resolved =
      path.resolve(
        filePath
      );

    assertStoragePath(
      resolved
    );

    const stats =
      await fsp.stat(
        resolved
      );

    return stats.isFile();
  } catch {
    return false;
  }
}

async function deleteFile(
  filePath
) {
  if (
    typeof filePath !== 'string' ||
    !filePath.trim()
  ) {
    throw createStorageError(
      'مسار الملف غير صالح.',
      'INVALID_FILE_PATH',
      400
    );
  }

  const resolved =
    path.resolve(
      filePath
    );

  assertStoragePath(
    resolved
  );

  try {
    await fsp.unlink(
      resolved
    );

    return true;
  } catch (error) {
    if (
      error.code ===
      'ENOENT'
    ) {
      return false;
    }

    throw error;
  }
}

async function deleteDirectory(
  directoryPath
) {
  if (
    typeof directoryPath !== 'string' ||
    !directoryPath.trim()
  ) {
    throw createStorageError(
      'مسار المجلد غير صالح.',
      'INVALID_DIRECTORY_PATH',
      400
    );
  }

  const resolved =
    path.resolve(
      directoryPath
    );

  assertStoragePath(
    resolved
  );

  if (
    resolved ===
    STORAGE_ROOT
  ) {
    throw createStorageError(
      'لا يمكن حذف مجلد التخزين الرئيسي.',
      'PROTECTED_STORAGE_PATH',
      403
    );
  }

  await fsp.rm(
    resolved,
    {
      recursive: true,
      force: false
    }
  );

  return true;
}

async function createUserDirectory(
  userId
) {
  const safeUserId =
    String(userId || '')
      .trim();

  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(
      safeUserId
    )
  ) {
    throw createStorageError(
      'معرف المستخدم غير صالح.',
      'INVALID_USER_ID',
      400
    );
  }

  const userDirectory =
    resolveSafePath(
      PRIVATE_DIR,
      safeUserId
    );

  await ensureDirectory(
    userDirectory
  );

  return userDirectory;
}

async function createRoomDirectory(
  roomId
) {
  const safeRoomId =
    String(roomId || '')
      .trim();

  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(
      safeRoomId
    )
  ) {
    throw createStorageError(
      'معرف الغرفة غير صالح.',
      'INVALID_ROOM_ID',
      400
    );
  }

  const roomDirectory =
    resolveSafePath(
      ROOMS_DIR,
      safeRoomId
    );

  await ensureDirectory(
    roomDirectory
  );

  return roomDirectory;
}

function getPublicRelativePath(
  filePath
) {
  const resolved =
    path.resolve(
      filePath
    );

  const publicRoot =
    path.resolve(
      PUBLIC_DIR
    );

  const publicPrefix =
    `${publicRoot}${path.sep}`;

  if (
    !resolved.startsWith(
      publicPrefix
    )
  ) {
    throw createStorageError(
      'الملف ليس داخل التخزين العام.',
      'NOT_PUBLIC_FILE',
      400
    );
  }

  return path
    .relative(
      publicRoot,
      resolved
    )
    .replace(
      /\\/g,
      '/'
    );
}

function getStorageRelativePath(
  filePath
) {
  const resolved =
    path.resolve(
      filePath
    );

  const storageRoot =
    path.resolve(
      STORAGE_ROOT
    );

  const storagePrefix =
    `${storageRoot}${path.sep}`;

  if (
    !resolved.startsWith(
      storagePrefix
    )
  ) {
    throw createStorageError(
      'الملف خارج التخزين.',
      'NOT_STORAGE_FILE',
      400
    );
  }

  return path
    .relative(
      storageRoot,
      resolved
    )
    .replace(
      /\\/g,
      '/'
    );
}

function resolveStorageRelativePath(
  relativePath
) {
  return resolveSafePath(
    STORAGE_ROOT,
    relativePath
  );
}

function resolvePublicPath(
  relativePath
) {
  return resolveSafePath(
    PUBLIC_DIR,
    relativePath
  );
}

function resolvePrivatePath(
  relativePath
) {
  return resolveSafePath(
    PRIVATE_DIR,
    relativePath
  );
}

function resolveTempPath(
  relativePath
) {
  return resolveSafePath(
    TEMP_DIR,
    relativePath
  );
}

async function cleanupTemp(
  maxAgeMs = 24 * 60 * 60 * 1000
) {
  if (
    !Number.isFinite(
      maxAgeMs
    ) ||
    maxAgeMs <= 0
  ) {
    throw createStorageError(
      'مدة تنظيف الملفات المؤقتة غير صالحة.',
      'INVALID_CLEANUP_AGE',
      400
    );
  }

  await ensureDirectory(
    TEMP_DIR
  );

  const entries =
    await fsp.readdir(
      TEMP_DIR,
      {
        withFileTypes: true
      }
    );

  const now =
    Date.now();

  let removed = 0;

  for (
    const entry of entries
  ) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath =
      path.join(
        TEMP_DIR,
        entry.name
      );

    try {
      const stats =
        await fsp.stat(
          filePath
        );

      if (
        now -
          stats.mtimeMs >
        maxAgeMs
      ) {
        await fsp.unlink(
          filePath
        );

        removed += 1;
      }
    } catch {
      // تجاهل الملف إذا تم حذفه
      // بواسطة عملية أخرى أثناء التنظيف.
    }
  }

  return {
    removed
  };
}

module.exports = {
  STORAGE_ROOT,
  TEMP_DIR,
  PUBLIC_DIR,
  PRIVATE_DIR,
  AVATARS_DIR,
  COVERS_DIR,
  POSTS_DIR,
  ROOMS_DIR,
  GIFTS_DIR,
  CHAT_DIR,

  createStorageError,

  normalizeRelativePath,
  resolveSafePath,
  assertStoragePath,

  ensureDirectory,
  initializeStorage,

  getDirectory,

  generateStorageFilename,
  generateObjectId,
  sanitizeFilename,

  writeBuffer,
  moveFile,
  copyFile,
  readFile,
  getFileInfo,
  fileExists,

  deleteFile,
  deleteDirectory,

  createUserDirectory,
  createRoomDirectory,

  getPublicRelativePath,
  getStorageRelativePath,

  resolveStorageRelativePath,
  resolvePublicPath,
  resolvePrivatePath,
  resolveTempPath,

  cleanupTemp
};
