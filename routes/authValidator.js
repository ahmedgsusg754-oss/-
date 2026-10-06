'use strict';

const {
  createValidationError
} = require('../middleware/validate');

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const EMAIL_MAX = 254;
const DISPLAY_NAME_MAX = 60;

function fail(
  message,
  field,
  value = undefined
) {
  const error =
    createValidationError(
      message,
      field,
      value
    );

  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';

  return error;
}

function cleanString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value).trim();
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

function validateUsername(username) {
  const value =
    cleanString(username);

  if (!value) {
    throw fail(
      'اسم المستخدم مطلوب.',
      'username'
    );
  }

  if (
    value.length <
    USERNAME_MIN
  ) {
    throw fail(
      `اسم المستخدم يجب ألا يقل عن ${USERNAME_MIN} أحرف.`,
      'username',
      value
    );
  }

  if (
    value.length >
    USERNAME_MAX
  ) {
    throw fail(
      `اسم المستخدم يجب ألا يتجاوز ${USERNAME_MAX} حرفاً.`,
      'username',
      value
    );
  }

  /*
   * يسمح بالعربية والإنجليزية والأرقام
   * والشرطة السفلية، مع منع المسافات والرموز
   * غير المناسبة لأسماء المستخدمين.
   */
  const usernamePattern =
    /^[A-Za-z0-9_\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+$/u;

  if (
    !usernamePattern.test(value)
  ) {
    throw fail(
      'اسم المستخدم يحتوي على أحرف أو رموز غير مسموحة.',
      'username',
      value
    );
  }

  return value;
}

function validateEmail(email) {
  const value =
    normalizeEmail(email);

  if (!value) {
    throw fail(
      'البريد الإلكتروني مطلوب.',
      'email'
    );
  }

  if (
    value.length >
    EMAIL_MAX
  ) {
    throw fail(
      'البريد الإلكتروني طويل جداً.',
      'email',
      value
    );
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (
    !emailPattern.test(value)
  ) {
    throw fail(
      'البريد الإلكتروني غير صحيح.',
      'email',
      value
    );
  }

  return value;
}

function validatePassword(password) {
  const value =
    typeof password === 'string'
      ? password
      : '';

  if (!value) {
    throw fail(
      'كلمة المرور مطلوبة.',
      'password'
    );
  }

  if (
    value.length <
    PASSWORD_MIN
  ) {
    throw fail(
      `كلمة المرور يجب ألا تقل عن ${PASSWORD_MIN} أحرف.`,
      'password'
    );
  }

  if (
    value.length >
    PASSWORD_MAX
  ) {
    throw fail(
      `كلمة المرور يجب ألا تتجاوز ${PASSWORD_MAX} حرفاً.`,
      'password'
    );
  }

  if (
    /\s/.test(value)
  ) {
    throw fail(
      'كلمة المرور لا يمكن أن تحتوي على مسافات.',
      'password'
    );
  }

  const requireStrongPassword =
    process.env.REQUIRE_STRONG_PASSWORD !==
    'false';

  if (requireStrongPassword) {
    const hasLetter =
      /[A-Za-z\u0600-\u06FF]/u.test(
        value
      );

    const hasNumber =
      /\d/.test(value);

    if (
      !hasLetter ||
      !hasNumber
    ) {
      throw fail(
        'كلمة المرور يجب أن تحتوي على حروف وأرقام.',
        'password'
      );
    }
  }

  return value;
}

function validateDisplayName(
  displayName
) {
  if (
    displayName === undefined ||
    displayName === null ||
    displayName === ''
  ) {
    return undefined;
  }

  const value =
    cleanString(displayName);

  if (
    !value
  ) {
    return undefined;
  }

  if (
    value.length >
    DISPLAY_NAME_MAX
  ) {
    throw fail(
      `اسم العرض يجب ألا يتجاوز ${DISPLAY_NAME_MAX} حرفاً.`,
      'displayName',
      value
    );
  }

  return value;
}

function rejectUnknownFields(
  body,
  allowedFields
) {
  const source =
    body &&
    typeof body === 'object'
      ? body
      : {};

  const allowed =
    new Set(allowedFields);

  const unknown =
    Object.keys(source).filter(
      (key) => !allowed.has(key)
    );

  if (unknown.length) {
    throw fail(
      `حقول غير مسموحة: ${unknown.join(', ')}`,
      unknown[0]
    );
  }
}

function registerSchema(req, res, next) {
  try {
    const body =
      req.body &&
      typeof req.body === 'object'
        ? req.body
        : {};

    rejectUnknownFields(
      body,
      [
        'username',
        'email',
        'password',
        'displayName'
      ]
    );

    const username =
      validateUsername(
        body.username
      );

    const email =
      validateEmail(
        body.email
      );

    const password =
      validatePassword(
        body.password
      );

    const displayName =
      validateDisplayName(
        body.displayName
      );

    req.body = {
      username,
      email,
      password,
      ...(displayName !== undefined
        ? { displayName }
        : {})
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function loginSchema(req, res, next) {
  try {
    const body =
      req.body &&
      typeof req.body === 'object'
        ? req.body
        : {};

    rejectUnknownFields(
      body,
      [
        'identifier',
        'username',
        'email',
        'password'
      ]
    );

    const identifier =
      cleanString(
        body.identifier
      );

    const username =
      cleanString(
        body.username
      );

    const email =
      normalizeEmail(
        body.email
      );

    const password =
      typeof body.password === 'string'
        ? body.password
        : '';

    if (
      !identifier &&
      !username &&
      !email
    ) {
      throw fail(
        'اسم المستخدم أو البريد الإلكتروني مطلوب.',
        'identifier'
      );
    }

    if (!password) {
      throw fail(
        'كلمة المرور مطلوبة.',
        'password'
      );
    }

    if (
      password.length >
      PASSWORD_MAX
    ) {
      throw fail(
        'كلمة المرور طويلة جداً.',
        'password'
      );
    }

    req.body = {
      ...(identifier
        ? { identifier }
        : {}),
      ...(username
        ? {
            username:
              validateUsername(
                username
              )
          }
        : {}),
      ...(email
        ? {
            email:
              validateEmail(
                email
              )
          }
        : {}),
      password
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function changePasswordSchema(
  req,
  res,
  next
) {
  try {
    const body =
      req.body &&
      typeof req.body === 'object'
        ? req.body
        : {};

    rejectUnknownFields(
      body,
      [
        'currentPassword',
        'newPassword'
      ]
    );

    const currentPassword =
      typeof body.currentPassword ===
      'string'
        ? body.currentPassword
        : '';

    const newPassword =
      validatePassword(
        body.newPassword
      );

    if (!currentPassword) {
      throw fail(
        'كلمة المرور الحالية مطلوبة.',
        'currentPassword'
      );
    }

    if (
      currentPassword.length >
      PASSWORD_MAX
    ) {
      throw fail(
        'كلمة المرور الحالية طويلة جداً.',
        'currentPassword'
      );
    }

    if (
      currentPassword ===
      newPassword
    ) {
      throw fail(
        'كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية.',
        'newPassword'
      );
    }

    req.body = {
      currentPassword,
      newPassword
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function validateRegister(
  req,
  res,
  next
) {
  return registerSchema(
    req,
    res,
    next
  );
}

function validateLogin(
  req,
  res,
  next
) {
  return loginSchema(
    req,
    res,
    next
  );
}

function validateChangePassword(
  req,
  res,
  next
) {
  return changePasswordSchema(
    req,
    res,
    next
  );
}

function validateRefresh(
  req,
  res,
  next
) {
  try {
    const body =
      req.body &&
      typeof req.body === 'object'
        ? req.body
        : {};

    const refreshToken =
      cleanString(
        body.refreshToken
      );

    if (
      refreshToken &&
      refreshToken.length < 20
    ) {
      throw fail(
        'رمز التحديث غير صالح.',
        'refreshToken'
      );
    }

    req.body = {
      ...(refreshToken
        ? { refreshToken }
        : {})
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  USERNAME_MIN,
  USERNAME_MAX,
  PASSWORD_MIN,
  PASSWORD_MAX,
  EMAIL_MAX,
  DISPLAY_NAME_MAX,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateRefresh,
  validateUsername,
  validateEmail,
  validatePassword,
  validateDisplayName
};
