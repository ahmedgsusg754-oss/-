'use strict';

const path = require('path');

const IMAGE_TYPES = (
  process.env.ALLOWED_IMAGE_TYPES ||
  'image/jpeg,image/png,image/webp,image/gif'
)
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const VIDEO_TYPES = (
  process.env.ALLOWED_VIDEO_TYPES ||
  'video/mp4,video/webm'
)
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const AUDIO_TYPES = (
  process.env.ALLOWED_AUDIO_TYPES ||
  'audio/mpeg,audio/mp4,audio/ogg,audio/wav'
)
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const MAX_FILE_SIZE_MB = Number.parseInt(
  process.env.MAX_FILE_SIZE_MB || '10',
  10
);

const MAX_IMAGE_SIZE_MB = Number.parseInt(
  process.env.MAX_IMAGE_SIZE_MB || '10',
  10
);

const MAX_VIDEO_SIZE_MB = Number.parseInt(
  process.env.MAX_VIDEO_SIZE_MB || '50',
  10
);

const MAX_AUDIO_SIZE_MB = Number.parseInt(
  process.env.MAX_AUDIO_SIZE_MB || '20',
  10
);

const MAX_AVATAR_SIZE_MB = Number.parseInt(
  process.env.MAX_AVATAR_SIZE_MB || '5',
  10
);

const MAX_COVER_SIZE_MB = Number.parseInt(
  process.env.MAX_COVER_SIZE_MB || '10',
  10
);

const EXTENSION_BY_MIME = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],

  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],

  'audio/mpeg': ['.mp3'],
  'audio/mp4': ['.m4a', '.mp4'],
  'audio/ogg': ['.ogg'],
  'audio/wav': ['.wav']
};

function createFileValidationError(
  message,
  code = 'INVALID_FILE',
  statusCode = 400
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function normalizeMimeType(mimeType) {
  return String(mimeType || '')
    .trim()
    .toLowerCase()
    .split(';')[0];
}

function normalizeExtension(extension) {
  const value = String(extension || '')
    .trim()
    .toLowerCase();

  if (!value) {
    return '';
  }

  return value.startsWith('.')
    ? value
    : `.${value}`;
}

function getExtension(filename) {
  if (!filename) {
    return '';
  }

  return normalizeExtension(
    path.extname(
      String(filename)
    )
  );
}

function getFileCategory(
  mimeType
) {
  const mime =
    normalizeMimeType(mimeType);

  if (IMAGE_TYPES.includes(mime)) {
    return 'image';
  }

  if (VIDEO_TYPES.includes(mime)) {
    return 'video';
  }

  if (AUDIO_TYPES.includes(mime)) {
    return 'audio';
  }

  return null;
}

function isImageMime(mimeType) {
  return IMAGE_TYPES.includes(
    normalizeMimeType(mimeType)
  );
}

function isVideoMime(mimeType) {
  return VIDEO_TYPES.includes(
    normalizeMimeType(mimeType)
  );
}

function isAudioMime(mimeType) {
  return AUDIO_TYPES.includes(
    normalizeMimeType(mimeType)
  );
}

function isAllowedMimeType(
  mimeType,
  allowedTypes = []
) {
  const mime =
    normalizeMimeType(mimeType);

  if (!mime) {
    return false;
  }

  if (
    !Array.isArray(allowedTypes)
  ) {
    return false;
  }

  return allowedTypes
    .map(normalizeMimeType)
    .includes(mime);
}

function isAllowedExtensionForMime(
  filename,
  mimeType
) {
  const extension =
    getExtension(filename);

  const mime =
    normalizeMimeType(mimeType);

  if (!extension || !mime) {
    return false;
  }

  const allowedExtensions =
    EXTENSION_BY_MIME[mime];

  if (!allowedExtensions) {
    return false;
  }

  return allowedExtensions.includes(
    extension
  );
}

function getMaxSizeBytes(
  category,
  purpose = null
) {
  const baseMax =
    Math.max(
      1,
      MAX_FILE_SIZE_MB
    ) *
    1024 *
    1024;

  if (purpose === 'avatar') {
    return Math.min(
      baseMax,
      Math.max(
        1,
        MAX_AVATAR_SIZE_MB
      ) *
        1024 *
        1024
    );
  }

  if (purpose === 'cover') {
    return Math.min(
      baseMax,
      Math.max(
        1,
        MAX_COVER_SIZE_MB
      ) *
        1024 *
        1024
    );
  }

  switch (category) {
    case 'image':
      return Math.min(
        baseMax,
        Math.max(
          1,
          MAX_IMAGE_SIZE_MB
        ) *
          1024 *
          1024
      );

    case 'video':
      return Math.min(
        baseMax,
        Math.max(
          1,
          MAX_VIDEO_SIZE_MB
        ) *
          1024 *
          1024
      );

    case 'audio':
      return Math.min(
        baseMax,
        Math.max(
          1,
          MAX_AUDIO_SIZE_MB
        ) *
          1024 *
          1024
      );

    default:
      return baseMax;
  }
}

function validateFileSize(
  size,
  category,
  purpose = null
) {
  const fileSize =
    Number(size);

  if (
    !Number.isFinite(fileSize) ||
    fileSize <= 0
  ) {
    throw createFileValidationError(
      'حجم الملف غير صالح.',
      'INVALID_FILE_SIZE'
    );
  }

  const maxSize =
    getMaxSizeBytes(
      category,
      purpose
    );

  if (fileSize > maxSize) {
    const maxMB =
      Math.floor(
        maxSize /
          1024 /
          1024
      );

    throw createFileValidationError(
      `حجم الملف يتجاوز الحد المسموح وهو ${maxMB}MB.`,
      'FILE_TOO_LARGE',
      413
    );
  }

  return true;
}

function validateFilename(
  filename
) {
  if (
    typeof filename !== 'string' ||
    !filename.trim()
  ) {
    throw createFileValidationError(
      'اسم الملف غير صالح.',
      'INVALID_FILENAME'
    );
  }

  const value =
    filename.trim();

  if (value.length > 255) {
    throw createFileValidationError(
      'اسم الملف طويل جداً.',
      'FILENAME_TOO_LONG'
    );
  }

  /*
   * منع المسارات الخفية وأسماء الملفات
   * التي يمكن استخدامها لمحاولات Path Traversal.
   */
  if (
    value.includes('\0') ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('..')
  ) {
    throw createFileValidationError(
      'اسم الملف يحتوي على مسار غير مسموح.',
      'INVALID_FILENAME'
    );
  }

  return true;
}

function validateFileObject(
  file,
  options = {}
) {
  if (
    !file ||
    typeof file !== 'object'
  ) {
    throw createFileValidationError(
      'الملف غير موجود.',
      'FILE_REQUIRED'
    );
  }

  const {
    allowedMimeTypes = null,
    allowedCategories = null,
    purpose = null
  } = options;

  const filename =
    file.originalname ||
    file.filename ||
    file.name ||
    '';

  validateFilename(filename);

  const mimeType =
    normalizeMimeType(
      file.mimetype ||
      file.mimeType
    );

  if (!mimeType) {
    throw createFileValidationError(
      'نوع الملف غير معروف.',
      'MIME_TYPE_REQUIRED'
    );
  }

  const category =
    getFileCategory(
      mimeType
    );

  if (!category) {
    throw createFileValidationError(
      'نوع الملف غير مسموح.',
      'FILE_TYPE_NOT_ALLOWED'
    );
  }

  if (
    Array.isArray(
      allowedMimeTypes
    ) &&
    allowedMimeTypes.length > 0 &&
    !isAllowedMimeType(
      mimeType,
      allowedMimeTypes
    )
  ) {
    throw createFileValidationError(
      'نوع الملف غير مسموح لهذه العملية.',
      'FILE_TYPE_NOT_ALLOWED'
    );
  }

  if (
    Array.isArray(
      allowedCategories
    ) &&
    allowedCategories.length > 0 &&
    !allowedCategories.includes(
      category
    )
  ) {
    throw createFileValidationError(
      'تصنيف الملف غير مسموح لهذه العملية.',
      'FILE_CATEGORY_NOT_ALLOWED'
    );
  }

  if (
    !isAllowedExtensionForMime(
      filename,
      mimeType
    )
  ) {
    throw createFileValidationError(
      'امتداد الملف لا يتطابق مع نوعه الحقيقي المعلن.',
      'FILE_EXTENSION_MISMATCH'
    );
  }

  validateFileSize(
    file.size,
    category,
    purpose
  );

  return {
    valid: true,
    category,
    mimeType,
    extension:
      getExtension(filename),
    size:
      Number(file.size),
    originalName:
      filename
  };
}

function validateImageFile(
  file,
  options = {}
) {
  return validateFileObject(
    file,
    {
      ...options,
      allowedCategories: ['image'],
      allowedMimeTypes:
        options.allowedMimeTypes ||
        IMAGE_TYPES
    }
  );
}

function validateVideoFile(
  file,
  options = {}
) {
  return validateFileObject(
    file,
    {
      ...options,
      allowedCategories: ['video'],
      allowedMimeTypes:
        options.allowedMimeTypes ||
        VIDEO_TYPES
    }
  );
}

function validateAudioFile(
  file,
  options = {}
) {
  return validateFileObject(
    file,
    {
      ...options,
      allowedCategories: ['audio'],
      allowedMimeTypes:
        options.allowedMimeTypes ||
        AUDIO_TYPES
    }
  );
}

function validateAvatarFile(
  file
) {
  return validateImageFile(
    file,
    {
      purpose: 'avatar'
    }
  );
}

function validateCoverFile(
  file
) {
  return validateImageFile(
    file,
    {
      purpose: 'cover'
    }
  );
}

function validateFiles(
  files,
  options = {}
) {
  if (!Array.isArray(files)) {
    throw createFileValidationError(
      'قائمة الملفات غير صالحة.',
      'INVALID_FILES'
    );
  }

  return files.map(
    (file) =>
      validateFileObject(
        file,
        options
      )
  );
}

function validateSingleFile(
  file,
  options = {}
) {
  return validateFileObject(
    file,
    options
  );
}

function sanitizeOriginalFilename(
  filename
) {
  if (
    typeof filename !== 'string'
  ) {
    return 'file';
  }

  const extension =
    getExtension(filename);

  const base =
    path
      .basename(
        filename,
        path.extname(filename)
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
    base ||
    'file'
  ) + extension;
}

function createSafeFilename(
  filename,
  randomBytes = 16
) {
  const extension =
    getExtension(filename);

  const randomPart =
    crypto.randomBytes(
      randomBytes
    ).toString('hex');

  return `${Date.now()}-${randomPart}${extension}`;
}

function getAllowedMimeTypes(
  category = null
) {
  switch (category) {
    case 'image':
      return [...IMAGE_TYPES];

    case 'video':
      return [...VIDEO_TYPES];

    case 'audio':
      return [...AUDIO_TYPES];

    default:
      return [
        ...new Set([
          ...IMAGE_TYPES,
          ...VIDEO_TYPES,
          ...AUDIO_TYPES
        ])
      ];
  }
}

module.exports = {
  IMAGE_TYPES,
  VIDEO_TYPES,
  AUDIO_TYPES,

  MAX_FILE_SIZE_MB,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB,
  MAX_AUDIO_SIZE_MB,
  MAX_AVATAR_SIZE_MB,
  MAX_COVER_SIZE_MB,

  createFileValidationError,
  normalizeMimeType,
  normalizeExtension,
  getExtension,
  getFileCategory,

  isImageMime,
  isVideoMime,
  isAudioMime,
  isAllowedMimeType,
  isAllowedExtensionForMime,

  getMaxSizeBytes,
  validateFileSize,
  validateFilename,
  validateFileObject,

  validateImageFile,
  validateVideoFile,
  validateAudioFile,
  validateAvatarFile,
  validateCoverFile,

  validateFiles,
  validateSingleFile,

  sanitizeOriginalFilename,
  createSafeFilename,
  getAllowedMimeTypes
};
