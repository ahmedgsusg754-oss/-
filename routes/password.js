'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const DEFAULT_ROUNDS = 12;

function getRounds() {
  const rounds = Number.parseInt(
    process.env.BCRYPT_ROUNDS || String(DEFAULT_ROUNDS),
    10
  );

  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15) {
    return DEFAULT_ROUNDS;
  }

  return rounds;
}

function normalizePassword(password) {
  if (typeof password !== 'string') {
    throw new TypeError('كلمة المرور يجب أن تكون نصاً.');
  }

  return password;
}

function validatePassword(password) {
  const value = normalizePassword(password);

  const minLength = 8;
  const maxLength = 128;

  if (!value.length) {
    throw new Error('كلمة المرور مطلوبة.');
  }

  if (value.length < minLength) {
    throw new Error(
      `كلمة المرور يجب ألا تقل عن ${minLength} أحرف.`
    );
  }

  if (value.length > maxLength) {
    throw new Error(
      `كلمة المرور يجب ألا تتجاوز ${maxLength} حرفاً.`
    );
  }

  if (/\s/.test(value)) {
    throw new Error(
      'كلمة المرور لا يمكن أن تحتوي على مسافات.'
    );
  }

  if (process.env.REQUIRE_STRONG_PASSWORD !== 'false') {
    const hasLetter =
      /[A-Za-z\u0600-\u06FF]/u.test(value);

    const hasNumber = /\d/.test(value);

    if (!hasLetter || !hasNumber) {
      throw new Error(
        'كلمة المرور يجب أن تحتوي على حروف وأرقام.'
      );
    }
  }

  return true;
}

async function hashPassword(password) {
  const value = normalizePassword(password);

  validatePassword(value);

  return bcrypt.hash(
    value,
    getRounds()
  );
}

async function comparePassword(
  password,
  passwordHash
) {
  if (
    typeof password !== 'string' ||
    typeof passwordHash !== 'string' ||
    !password ||
    !passwordHash
  ) {
    return false;
  }

  return bcrypt.compare(
    password,
    passwordHash
  );
}

async function verifyPassword(
  password,
  passwordHash
) {
  return comparePassword(
    password,
    passwordHash
  );
}

function isBcryptHash(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(
    value
  );
}

function getHashRounds(passwordHash) {
  if (!isBcryptHash(passwordHash)) {
    return null;
  }

  const rounds =
    Number.parseInt(
      passwordHash.slice(4, 6),
      10
    );

  return Number.isInteger(rounds)
    ? rounds
    : null;
}

function needsRehash(passwordHash) {
  const currentRounds =
    getHashRounds(passwordHash);

  if (!currentRounds) {
    return true;
  }

  return currentRounds < getRounds();
}

async function hashIfNeeded(
  password,
  passwordHash
) {
  if (
    typeof passwordHash === 'string' &&
    !needsRehash(passwordHash)
  ) {
    return passwordHash;
  }

  return hashPassword(password);
}

function generateTemporaryPassword(length = 24) {
  const size =
    Number.isInteger(length) &&
    length >= 16 &&
    length <= 128
      ? length
      : 24;

  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZ' +
    'abcdefghijkmnopqrstuvwxyz' +
    '23456789';

  const bytes =
    crypto.randomBytes(size);

  let result = '';

  for (let i = 0; i < size; i += 1) {
    result +=
      alphabet[
        bytes[i] % alphabet.length
      ];
  }

  return result;
}

function generateSecureRandomString(
  length = 32
) {
  const size =
    Number.isInteger(length) &&
    length > 0 &&
    length <= 256
      ? length
      : 32;

  return crypto
    .randomBytes(size)
    .toString('hex');
}

function createPasswordResetToken() {
  return crypto
    .randomBytes(48)
    .toString('hex');
}

function hashPasswordResetToken(token) {
  if (
    typeof token !== 'string' ||
    !token
  ) {
    throw new Error(
      'رمز استعادة كلمة المرور غير صالح.'
    );
  }

  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

function safeEqualStrings(
  first,
  second
) {
  if (
    typeof first !== 'string' ||
    typeof second !== 'string'
  ) {
    return false;
  }

  const firstBuffer =
    Buffer.from(first);

  const secondBuffer =
    Buffer.from(second);

  if (
    firstBuffer.length !==
    secondBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    firstBuffer,
    secondBuffer
  );
}

module.exports = {
  getRounds,
  normalizePassword,
  validatePassword,
  hashPassword,
  comparePassword,
  verifyPassword,
  isBcryptHash,
  getHashRounds,
  needsRehash,
  hashIfNeeded,
  generateTemporaryPassword,
  generateSecureRandomString,
  createPasswordResetToken,
  hashPasswordResetToken,
  safeEqualStrings
};
