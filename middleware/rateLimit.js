'use strict';

const rateLimit = require('express-rate-limit');

const WINDOW_MS = Number(
  process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000
);

const MAX_REQUESTS = Number(
  process.env.RATE_LIMIT_MAX_REQUESTS || 300
);

const AUTH_MAX_REQUESTS = Number(
  process.env.AUTH_RATE_LIMIT_MAX || 10
);

const UPLOAD_MAX_REQUESTS = Number(
  process.env.UPLOAD_RATE_LIMIT_MAX || 30
);

function validPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

const windowMs = validPositiveInteger(
  WINDOW_MS,
  15 * 60 * 1000
);

const maxRequests = validPositiveInteger(
  MAX_REQUESTS,
  300
);

const authMaxRequests = validPositiveInteger(
  AUTH_MAX_REQUESTS,
  10
);

const uploadMaxRequests = validPositiveInteger(
  UPLOAD_MAX_REQUESTS,
  30
);

function createLimiter({
  windowMs: customWindowMs = windowMs,
  limit = maxRequests,
  message = 'تم تجاوز عدد الطلبات المسموح بها. حاول مرة أخرى لاحقاً.',
  code = 'RATE_LIMIT_EXCEEDED'
} = {}) {
  return rateLimit({
    windowMs: customWindowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    handler: (req, res) => {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          Number(res.getHeader('Retry-After') || 60)
        )
      );

      res.status(429).json({
        success: false,
        error: {
          code,
          message,
          retryAfterSeconds
        }
      });
    }
  });
}

const globalRateLimit = createLimiter();

const authRateLimit = createLimiter({
  limit: authMaxRequests,
  message:
    'تم تجاوز عدد محاولات المصادقة المسموح بها. حاول مرة أخرى لاحقاً.',
  code: 'AUTH_RATE_LIMIT_EXCEEDED'
});

const uploadRateLimit = createLimiter({
  limit: uploadMaxRequests,
  message:
    'تم تجاوز عدد عمليات رفع الملفات المسموح بها. حاول مرة أخرى لاحقاً.',
  code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
});

const strictRateLimit = createLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message:
    'تم تجاوز الحد المؤقت للطلبات. حاول مرة أخرى بعد قليل.',
  code: 'STRICT_RATE_LIMIT_EXCEEDED'
});

const sensitiveRateLimit = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message:
    'تم تجاوز عدد المحاولات المسموح بها لهذا الإجراء الحساس.',
  code: 'SENSITIVE_RATE_LIMIT_EXCEEDED'
});

function createCustomRateLimit(options = {}) {
  return createLimiter(options);
}

function applyRateLimitIfEnabled(limiter) {
  const enabled =
    String(
      process.env.ENABLE_RATE_LIMIT || 'true'
    ).toLowerCase() === 'true';

  if (!enabled) {
    return (req, res, next) => next();
  }

  return limiter;
}

module.exports = {
  createLimiter,
  createCustomRateLimit,
  applyRateLimitIfEnabled,
  globalRateLimit,
  authRateLimit,
  uploadRateLimit,
  strictRateLimit,
  sensitiveRateLimit,
  windowMs,
  maxRequests,
  authMaxRequests,
  uploadMaxRequests
};
