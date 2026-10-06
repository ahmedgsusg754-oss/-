'use strict';

function createValidationError(message, details = null) {
  const error = new Error(
    message || 'البيانات المرسلة غير صالحة.'
  );

  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';

  if (details !== null) {
    error.details = details;
  }

  return error;
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function isEmptyValue(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function string(value, options = {}) {
  const {
    required = false,
    min = 0,
    max = Infinity,
    trim = true,
    name = 'الحقل'
  } = options;

  if (isEmptyValue(value)) {
    if (required) {
      throw createValidationError(
        `${name} مطلوب.`
      );
    }

    return null;
  }

  if (typeof value !== 'string') {
    throw createValidationError(
      `${name} يجب أن يكون نصاً.`
    );
  }

  const result = trim ? value.trim() : value;

  if (result.length < min) {
    throw createValidationError(
      `${name} يجب ألا يقل عن ${min} أحرف.`
    );
  }

  if (result.length > max) {
    throw createValidationError(
      `${name} يجب ألا يتجاوز ${max} حرفاً.`
    );
  }

  return result;
}

function email(value, options = {}) {
  const {
    required = false,
    name = 'البريد الإلكتروني'
  } = options;

  const result = string(value, {
    required,
    min: 3,
    max: 254,
    name
  });

  if (result === null) {
    return null;
  }

  const normalized = result.toLowerCase();

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!emailPattern.test(normalized)) {
    throw createValidationError(
      `${name} غير صالح.`
    );
  }

  return normalized;
}

function username(value, options = {}) {
  const {
    required = false,
    name = 'اسم المستخدم'
  } = options;

  const result = string(value, {
    required,
    min: 3,
    max: 30,
    name
  });

  if (result === null) {
    return null;
  }

  if (
    !/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(result)
  ) {
    throw createValidationError(
      `${name} يحتوي على أحرف أو رموز غير مسموحة.`
    );
  }

  return result;
}

function integer(value, options = {}) {
  const {
    required = false,
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    name = 'القيمة'
  } = options;

  if (isEmptyValue(value)) {
    if (required) {
      throw createValidationError(
        `${name} مطلوب.`
      );
    }

    return null;
  }

  const numberValue =
    typeof value === 'number'
      ? value
      : Number(value);

  if (
    !Number.isSafeInteger(numberValue)
  ) {
    throw createValidationError(
      `${name} يجب أن يكون رقماً صحيحاً.`
    );
  }

  if (numberValue < min) {
    throw createValidationError(
      `${name} أقل من الحد المسموح.`
    );
  }

  if (numberValue > max) {
    throw createValidationError(
      `${name} أكبر من الحد المسموح.`
    );
  }

  return numberValue;
}

function number(value, options = {}) {
  const {
    required = false,
    min = -Infinity,
    max = Infinity,
    name = 'القيمة'
  } = options;

  if (isEmptyValue(value)) {
    if (required) {
      throw createValidationError(
        `${name} مطلوب.`
      );
    }

    return null;
  }

  const numberValue =
    typeof value === 'number'
      ? value
      : Number(value);

  if (
    !Number.isFinite(numberValue)
  ) {
    throw createValidationError(
      `${name} يجب أن يكون رقماً صالحاً.`
    );
  }

  if (numberValue < min) {
    throw createValidationError(
      `${name} أقل من الحد المسموح.`
    );
  }

  if (numberValue > max) {
    throw createValidationError(
      `${name} أكبر من الحد المسموح.`
    );
  }

  return numberValue;
}

function boolean(value, options = {}) {
  const {
    required = false,
    name = 'القيمة'
  } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw createValidationError(
        `${name} مطلوب.`
      );
    }

    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  throw createValidationError(
    `${name} يجب أن يكون صحيحاً أو خاطئاً.`
  );
}

function enumValue(value, allowedValues, options = {}) {
  const {
    required = false,
    caseInsensitive = false,
    name = 'القيمة'
  } = options;

  if (isEmptyValue(value)) {
    if (required) {
      throw createValidationError(
        `${name} مطلوب.`
      );
    }

    return null;
  }

  if (!Array.isArray(allowedValues)) {
    throw new TypeError(
      'allowedValues يجب أن تكون مصفوفة.'
    );
  }

  const candidate =
    caseInsensitive &&
    typeof value === 'string'
      ? value.toLowerCase()
      : value;

  const found = allowedValues.find(
    (allowed) => {
      const normalizedAllowed =
        caseInsensitive &&
        typeof allowed === 'string'
          ? allowed.toLowerCase()
          : allowed;

      return normalizedAllowed === candidate;
    }
  );

  if (found === undefined) {
    throw createValidationError(
      `${name} يحتوي على قيمة غير مسموحة.`
    );
  }

  return found;
}

function uuid(value, options = {}) {
  const {
    required = false,
    name = 'المعرف'
  } = options;

  const result = string(value, {
    required,
    min: 1,
    max: 100,
    name
  });

  if (result === null) {
    return null;
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(result)) {
    throw createValidationError(
      `${name} غير صالح.`
    );
  }

  return result;
}

function id(value, options = {}) {
  const {
    required = false,
    name = 'المعرف'
  } = options;

  const result = string(value, {
    required,
    min: 1,
    max: 100,
    name
  });

  if (result === null) {
    return null;
  }

  if (!/^[A-Za-z0-9_-]+$/.test(result)) {
    throw createValidationError(
      `${name} غير صالح.`
    );
  }

  return result;
}

function array(value, options = {}) {
  const {
    required = false,
    min = 0,
    max = Infinity,
    name = 'القائمة'
  } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw createValidationError(
        `${name} مطلوبة.`
      );
    }

    return null;
  }

  if (!Array.isArray(value)) {
    throw createValidationError(
      `${name} يجب أن تكون قائمة.`
    );
  }

  if (value.length < min) {
    throw createValidationError(
      `${name} تحتوي على عناصر أقل من الحد المسموح.`
    );
  }

  if (value.length > max) {
    throw createValidationError(
      `${name} تحتوي على عناصر أكثر من الحد المسموح.`
    );
  }

  return value;
}

function object(value, options = {}) {
  const {
    required = false,
    name = 'البيانات'
  } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw createValidationError(
        `${name} مطلوبة.`
      );
    }

    return null;
  }

  if (!isPlainObject(value)) {
    throw createValidationError(
      `${name} يجب أن تكون كائناً صالحاً.`
    );
  }

  return value;
}

function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replace(/\u0000/g, '')
    .trim();
}

function sanitizeObject(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeObject);
  }

  if (isPlainObject(value)) {
    const result = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = sanitizeObject(item);
    }

    return result;
  }

  return sanitizeString(value);
}

function sanitizeRequest(req) {
  if (req.body && isPlainObject(req.body)) {
    req.body = sanitizeObject(req.body);
  }

  if (req.params && isPlainObject(req.params)) {
    req.params = sanitizeObject(req.params);
  }

  if (req.query && isPlainObject(req.query)) {
    req.query = sanitizeObject(req.query);
  }

  return req;
}

function validateBody(schema) {
  return createValidator('body', schema);
}

function validateParams(schema) {
  return createValidator('params', schema);
}

function validateQuery(schema) {
  return createValidator('query', schema);
}

function createValidator(source, schema) {
  if (!isPlainObject(schema)) {
    throw new TypeError(
      'مخطط التحقق يجب أن يكون كائناً.'
    );
  }

  return (req, res, next) => {
    try {
      sanitizeRequest(req);

      const data = req[source] || {};
      const validated = {};
      const unknownKeys = [];

      for (const [field, validator] of Object.entries(
        schema
      )) {
        if (typeof validator !== 'function') {
          throw new TypeError(
            `Validator للحقل "${field}" يجب أن يكون دالة.`
          );
        }

        validated[field] = validator(
          data[field]
        );
      }

      for (const key of Object.keys(data)) {
        if (
          !Object.prototype.hasOwnProperty.call(
            schema,
            key
          )
        ) {
          unknownKeys.push(key);
        }
      }

      if (unknownKeys.length > 0) {
        throw createValidationError(
          'تم إرسال حقول غير مسموحة.',
          {
            fields: unknownKeys
          }
        );
      }

      req[source] = validated;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function validate(schema, options = {}) {
  const {
    source = 'body',
    stripUnknown = false
  } = options;

  if (!isPlainObject(schema)) {
    throw new TypeError(
      'مخطط التحقق يجب أن يكون كائناً.'
    );
  }

  return (req, res, next) => {
    try {
      sanitizeRequest(req);

      const data = req[source] || {};
      const validated = {};

      for (const [field, validator] of Object.entries(
        schema
      )) {
        if (typeof validator !== 'function') {
          throw new TypeError(
            `Validator للحقل "${field}" يجب أن يكون دالة.`
          );
        }

        validated[field] = validator(
          data[field]
        );
      }

      if (!stripUnknown) {
        for (const key of Object.keys(data)) {
          if (
            !Object.prototype.hasOwnProperty.call(
              schema,
              key
            )
          ) {
            throw createValidationError(
              'تم إرسال حقول غير مسموحة.',
              {
                fields: [key]
              }
            );
          }
        }
      }

      req[source] = validated;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function validateRequest({
  body,
  params,
  query
} = {}) {
  const validators = [];

  if (body) {
    validators.push(
      validateBody(body)
    );
  }

  if (params) {
    validators.push(
      validateParams(params)
    );
  }

  if (query) {
    validators.push(
      validateQuery(query)
    );
  }

  return (req, res, next) => {
    let index = 0;

    const runNext = (error) => {
      if (error) {
        return next(error);
      }

      if (index >= validators.length) {
        return next();
      }

      const validator = validators[index++];

      return validator(
        req,
        res,
        runNext
      );
    };

    return runNext();
  };
}

module.exports = {
  createValidationError,
  isPlainObject,
  isEmptyValue,
  string,
  email,
  username,
  integer,
  number,
  boolean,
  enumValue,
  uuid,
  id,
  array,
  object,
  sanitizeString,
  sanitizeObject,
  sanitizeRequest,
  validate,
  validateBody,
  validateParams,
  validateQuery,
  validateRequest,
  createValidator
};
