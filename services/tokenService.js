'use strict';

const crypto = require('crypto');

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const ISSUER = process.env.JWT_ISSUER || 'afn-platform';
const AUDIENCE = process.env.JWT_AUDIENCE || 'afn-platform-users';

const ALGORITHM = 'HS256';
const MAX_TOKEN_LENGTH = 8192;

class TokenServiceError extends Error {
    constructor(message, code = 'TOKEN_ERROR') {
        super(message);
        this.name = 'TokenServiceError';
        this.code = code;
    }
}

function getSecret() {
    if (
        typeof ACCESS_TOKEN_SECRET !== 'string' ||
        ACCESS_TOKEN_SECRET.length < 32
    ) {
        throw new TokenServiceError(
            'يجب ضبط JWT_ACCESS_SECRET في متغيرات البيئة بمفتاح عشوائي قوي لا يقل عن 32 حرفًا.',
            'JWT_SECRET_NOT_CONFIGURED'
        );
    }

    return ACCESS_TOKEN_SECRET;
}

function base64UrlEncode(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecode(value) {
    if (
        typeof value !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(value)
    ) {
        throw new TokenServiceError(
            'صيغة الرمز غير صالحة.',
            'INVALID_TOKEN'
        );
    }

    return Buffer.from(
        value.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
    );
}

function parseDuration(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }

    if (typeof value !== 'string') {
        throw new TokenServiceError(
            'مدة صلاحية الرمز غير صالحة.',
            'INVALID_TOKEN_DURATION'
        );
    }

    const match = value.trim().match(/^(\d+)\s*(s|m|h|d)$/i);

    if (!match) {
        throw new TokenServiceError(
            'صيغة مدة صلاحية الرمز غير صالحة.',
            'INVALID_TOKEN_DURATION'
        );
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
        s: 1,
        m: 60,
        h: 3600,
        d: 86400
    };

    const seconds = amount * multipliers[unit];

    if (
        !Number.isSafeInteger(seconds) ||
        seconds <= 0 ||
        seconds > 365 * 24 * 60 * 60
    ) {
        throw new TokenServiceError(
            'مدة صلاحية الرمز خارج النطاق المسموح.',
            'INVALID_TOKEN_DURATION'
        );
    }

    return seconds;
}

function sign(payload, expiresIn = ACCESS_TOKEN_EXPIRES_IN) {
    const secret = getSecret();
    const now = Math.floor(Date.now() / 1000);
    const duration = parseDuration(expiresIn);

    const header = {
        alg: ALGORITHM,
        typ: 'JWT'
    };

    const claims = {
        ...payload,
        iss: ISSUER,
        aud: AUDIENCE,
        iat: now,
        exp: now + duration,
        jti: crypto.randomUUID()
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(claims));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
        .createHmac('sha256', secret)
        .update(unsignedToken)
        .digest('base64url');

    return `${unsignedToken}.${signature}`;
}

function verify(token) {
    const secret = getSecret();

    if (
        typeof token !== 'string' ||
        token.length === 0 ||
        token.length > MAX_TOKEN_LENGTH
    ) {
        throw new TokenServiceError(
            'رمز الدخول غير صالح.',
            'INVALID_TOKEN'
        );
    }

    const parts = token.split('.');

    if (parts.length !== 3) {
        throw new TokenServiceError(
            'صيغة رمز الدخول غير صالحة.',
            'INVALID_TOKEN'
        );
    }

    const [encodedHeader, encodedPayload, suppliedSignature] = parts;

    let header;
    let payload;

    try {
        header = JSON.parse(
            base64UrlDecode(encodedHeader).toString('utf8')
        );

        payload = JSON.parse(
            base64UrlDecode(encodedPayload).toString('utf8')
        );
    } catch {
        throw new TokenServiceError(
            'تعذر قراءة رمز الدخول.',
            'INVALID_TOKEN'
        );
    }

    if (
        !header ||
        header.alg !== ALGORITHM ||
        header.typ !== 'JWT' ||
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload)
    ) {
        throw new TokenServiceError(
            'معلومات رمز الدخول غير صالحة.',
            'INVALID_TOKEN'
        );
    }

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(unsignedToken)
        .digest();

    let suppliedSignatureBuffer;

    try {
        suppliedSignatureBuffer = base64UrlDecode(suppliedSignature);
    } catch {
        throw new TokenServiceError(
            'توقيع رمز الدخول غير صالح.',
            'INVALID_TOKEN'
        );
    }

    if (
        suppliedSignatureBuffer.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(
            expectedSignature,
            suppliedSignatureBuffer
        )
    ) {
        throw new TokenServiceError(
            'توقيع رمز الدخول غير صحيح.',
            'INVALID_TOKEN'
        );
    }

    const now = Math.floor(Date.now() / 1000);

    if (
        !Number.isSafeInteger(payload.exp) ||
        payload.exp <= now
    ) {
        throw new TokenServiceError(
            'انتهت صلاحية رمز الدخول.',
            'TOKEN_EXPIRED'
        );
    }

    if (
        payload.iss !== ISSUER ||
        payload.aud !== AUDIENCE ||
        !Number.isSafeInteger(payload.iat) ||
        payload.iat > now + 60 ||
        typeof payload.jti !== 'string' ||
        payload.jti.length === 0
    ) {
        throw new TokenServiceError(
            'بيانات رمز الدخول غير مقبولة.',
            'INVALID_TOKEN'
        );
    }

    return payload;
}

function generateAccessToken(user) {
    if (!user || user.id === undefined || user.id === null) {
        throw new TokenServiceError(
            'بيانات المستخدم غير مكتملة لإنشاء الرمز.',
            'INVALID_USER'
        );
    }

    const userId = String(user.id);

    if (!userId || userId.length > 128) {
        throw new TokenServiceError(
            'معرّف المستخدم غير صالح.',
            'INVALID_USER'
        );
    }

    const role = typeof user.role === 'string'
        ? user.role.toUpperCase()
        : 'USER';

    return sign({
        sub: userId,
        role
    });
}

function verifyAccessToken(token) {
    const payload = verify(token);

    if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new TokenServiceError(
            'رمز الدخول لا يحتوي على معرّف مستخدم صالح.',
            'INVALID_TOKEN'
        );
    }

    return {
        userId: payload.sub,
        role: payload.role,
        issuedAt: payload.iat,
        expiresAt: payload.exp,
        tokenId: payload.jti
    };
}

function getTokenExpiration(expiresIn = ACCESS_TOKEN_EXPIRES_IN) {
    return new Date(
        Date.now() + parseDuration(expiresIn) * 1000
    );
}

module.exports = {
    generateAccessToken,
    verifyAccessToken,
    getTokenExpiration,
    TokenServiceError
};
