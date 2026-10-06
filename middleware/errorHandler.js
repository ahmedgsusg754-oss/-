'use strict';

function isProduction() {
  return String(process.env.NODE_ENV || 'development')
    .trim()
    .toLowerCase() === 'production';
}

function getStatusCode(error) {
  if (
    Number.isInteger(error?.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
  ) {
    return error.statusCode;
  }

  if (
    Number.isInteger(error?.status) &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }

  switch (error?.code) {
    case 'AUTH_REQUIRED':
    case 'INVALID_TOKEN':
    case 'TOKEN_EXPIRED':
      return 401;

    case 'FORBIDDEN':
    case 'OWNER_ONLY':
    case 'PERMISSION_DENIED':
      return 403;

    case 'USER_NOT_FOUND':
    case 'RESOURCE_NOT_FOUND':
      return 404;

    case 'VALIDATION_ERROR':
      return 400;

    case 'RATE_LIMIT_EXCEEDED':
    case 'AUTH_RATE_LIMIT_EXCEEDED':
    case 'UPLOAD_RATE_LIMIT_EXCEEDED':
    case 'STRICT_RATE_LIMIT_EXCEEDED':
    case 'SENSITIVE_RATE_LIMIT_EXCEEDED':
      return 429;

    default:
      return 500;
  }
}

function getSafeMessage(error, statusCode) {
  if (statusCode >= 500 && isProduction()) {
    return 'حدث خطأ داخلي في الخادم. حاول مرة أخرى لاحقاً.';
  }

  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }

  return statusCode >= 500
    ? 'حدث خطأ داخلي في الخادم.'
    : 'تعذر تنفيذ الطلب.';
}

function getRequestId(req) {
  if (req?.requestId) {
    return String(req.requestId);
  }

  if (req?.id) {
    return String(req.id);
  }

  return null;
}

function buildErrorResponse(error, req, statusCode) {
  const response = {
    success: false,
    error: {
      code:
        typeof error?.code === 'string'
          ? error.code
          : statusCode >= 500
            ? 'INTERNAL_SERVER_ERROR'
            : 'REQUEST_ERROR',
      message: getSafeMessage(error, statusCode)
    }
  };

  const requestId = getRequestId(req);

  if (requestId) {
    response.error.requestId = requestId;
  }

  if (
    error?.details !== undefined &&
    statusCode < 500
  ) {
    response.error.details = error.details;
  }

  if (
    error?.fields !== undefined &&
    statusCode < 500
  ) {
    response.error.fields = error.fields;
  }

  if (
    error?.retryAfterSeconds !== undefined &&
    Number.isFinite(Number(error.retryAfterSeconds))
  ) {
    response.error.retryAfterSeconds = Number(
      error.retryAfterSeconds
    );
  }

  return response;
}

function logError(error, req, statusCode) {
  const enabled =
    String(
      process.env.ENABLE_SECURITY_LOGGING || 'true'
    ).toLowerCase() === 'true';

  if (!enabled) {
    return;
  }

  const logPayload = {
    method: req?.method,
    path: req?.originalUrl || req?.url,
    statusCode,
    code: error?.code || null,
    userId: req?.user?.id || null,
    ip: req?.ip || req?.socket?.remoteAddress || null
  };

  if (statusCode >= 500) {
    console.error(
      'Server error:',
      logPayload,
      error
    );
  } else if (statusCode >= 400) {
    console.warn(
      'Request error:',
      logPayload
    );
  }
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = getStatusCode(error);

  logError(error, req, statusCode);

  if (
    error?.type === 'entity.too.large' ||
    error?.code === 'LIMIT_FILE_SIZE'
  ) {
    const response = {
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message:
          'حجم البيانات أو الملف المرسل أكبر من الحد المسموح.'
      }
    };

    return res.status(413).json(response);
  }

  if (
    error?.type === 'entity.parse.failed'
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'صيغة البيانات المرسلة غير صالحة.'
      }
    });
  }

  if (
    error?.name === 'JsonWebTokenError' ||
    error?.name === 'TokenExpiredError'
  ) {
    return res.status(401).json({
      success: false,
      error: {
        code:
          error.name === 'TokenExpiredError'
            ? 'TOKEN_EXPIRED'
            : 'INVALID_TOKEN',
        message:
          error.name === 'TokenExpiredError'
            ? 'انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.'
            : 'رمز الدخول غير صالح.'
      }
    });
  }

  if (
    error?.name === 'ValidationError' &&
    Array.isArray(error.errors)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'البيانات المرسلة غير صالحة.',
        details: error.errors
      }
    });
  }

  if (
    error?.code === '23505'
  ) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: 'البيانات موجودة مسبقاً ولا يمكن تكرارها.'
      }
    });
  }

  if (
    error?.code === '23503'
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REFERENCE',
        message: 'يوجد ارتباط غير صالح مع بيانات أخرى.'
      }
    });
  }

  if (
    error?.code === '23502'
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'REQUIRED_FIELD_MISSING',
        message: 'يوجد حقل مطلوب لم يتم إرساله.'
      }
    });
  }

  if (
    error?.code === '22P02'
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_DATA_FORMAT',
        message: 'تنسيق إحدى البيانات المرسلة غير صالح.'
      }
    });
  }

  const response = buildErrorResponse(
    error,
    req,
    statusCode
  );

  return res.status(statusCode).json(response);
}

function notFoundHandler(req, res) {
  if (res.headersSent) {
    return;
  }

  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'المسار المطلوب غير موجود.'
    }
  });
}

function asyncHandler(handler) {
  if (typeof handler !== 'function') {
    throw new TypeError(
      'asyncHandler يتطلب دالة.'
    );
  }

  return function wrappedAsyncHandler(req, res, next) {
    Promise.resolve(
      handler(req, res, next)
    ).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  getStatusCode,
  getSafeMessage
};
