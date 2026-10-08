// services/authService.js

'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../database');
const tokenService = require('./tokenService');

const BCRYPT_ROUNDS = 12;
const SESSION_DAYS = 30;
const REFRESH_TOKEN_BYTES = 48;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

class AuthServiceError extends Error {
    constructor(message, statusCode = 400, code = 'AUTH_ERROR') {
        super(message);
        this.name = 'AuthServiceError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeUsername(value) {
    return typeof value === 'string'
        ? value.trim().toLowerCase()
        : '';
}

function validateRegistration(data) {
    if (!data || typeof data !== 'object') {
        throw new AuthServiceError('بيانات التسجيل غير صالحة.');
    }

    const username = normalizeUsername(data.username);
    const email = normalizeEmail(data.email);
    const password = data.password;

    if (
        username.length < USERNAME_MIN_LENGTH ||
        username.length > USERNAME_MAX_LENGTH ||
        !/^[a-zA-Z0-9_.-]+$/.test(username)
    ) {
        throw new AuthServiceError(
            'اسم المستخدم يجب أن يكون بين 3 و30 حرفًا، ويحتوي على أحرف إنجليزية أو أرقام أو _ أو - أو .'
        );
    }

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
    ) {
        throw new AuthServiceError('البريد الإلكتروني غير صالح.');
    }

    if (
        typeof password !== 'string' ||
        password.length < PASSWORD_MIN_LENGTH ||
        password.length > PASSWORD_MAX_LENGTH
    ) {
        throw new AuthServiceError(
            'كلمة المرور يجب أن تكون بين 8 و128 حرفًا.'
        );
    }

    return { username, email, password };
}

function validateLogin(data) {
    if (!data || typeof data !== 'object') {
        throw new AuthServiceError('بيانات تسجيل الدخول غير صالحة.');
    }

    const identifier = typeof data.identifier === 'string'
        ? data.identifier.trim().toLowerCase()
        : typeof data.username === 'string'
            ? data.username.trim().toLowerCase()
            : typeof data.email === 'string'
                ? data.email.trim().toLowerCase()
                : '';

    if (!identifier || identifier.length > 254) {
        throw new AuthServiceError('أدخل اسم المستخدم أو البريد الإلكتروني.');
    }

    if (
        typeof data.password !== 'string' ||
        data.password.length === 0 ||
        data.password.length > PASSWORD_MAX_LENGTH
    ) {
        throw new AuthServiceError('كلمة المرور غير صالحة.');
    }

    return {
        identifier,
        password: data.password
    };
}

function cleanUser(user) {
    if (!user) return null;

    const {
        password_hash,
        password,
        refresh_token_hash,
        ...safeUser
    } = user;

    return safeUser;
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function getRequestInfo(req) {
    if (!req) {
        return {
            ipAddress: null,
            userAgent: null
        };
    }

    return {
        ipAddress: req.ip || null,
        userAgent: typeof req.get === 'function'
            ? req.get('user-agent') || null
            : null
    };
}

function createRefreshToken() {
    return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

function createSessionExpiry() {
    return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

function getDatabasePool() {
    if (!db || typeof db.query !== 'function') {
        throw new Error(
            'database.js يجب أن يصدّر كائنًا يحتوي على الدالة query.'
        );
    }

    return db;
}

async function createSession(client, userId, req) {
    const refreshToken = createRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const sessionId = crypto.randomUUID();
    const expiresAt = createSessionExpiry();
    const { ipAddress, userAgent } = getRequestInfo(req);

    await client.query(
        `INSERT INTO sessions (
            id,
            user_id,
            refresh_token_hash,
            ip_address,
            user_agent,
            expires_at,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
            sessionId,
            userId,
            refreshTokenHash,
            ipAddress,
            userAgent,
            expiresAt
        ]
    );

    return {
        sessionId,
        refreshToken,
        expiresAt
    };
}

function createAccessToken(user) {
    if (
        !tokenService ||
        typeof tokenService.generateAccessToken !== 'function'
    ) {
        throw new Error(
            'tokenService.js يجب أن يصدّر generateAccessToken.'
        );
    }

    return tokenService.generateAccessToken({
        id: user.id,
        role: user.role
    });
}

async function register(data, req) {
    const { username, email, password } = validateRegistration(data);
    const pool = getDatabasePool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // يمنع تسجيل حسابين أوليين في الوقت نفسه من الحصول على صلاحية المالك.
        await client.query(
            'SELECT pg_advisory_xact_lock($1)',
            [734829104]
        );

        const existingUser = await client.query(
            `SELECT id
             FROM users
             WHERE LOWER(username) = $1
                OR LOWER(email) = $2
             LIMIT 1`,
            [username, email]
        );

        if (existingUser.rowCount > 0) {
            throw new AuthServiceError(
                'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.',
                409,
                'ACCOUNT_EXISTS'
            );
        }

        const ownerResult = await client.query(
            `SELECT id
             FROM users
             WHERE role = 'OWNER'
             LIMIT 1`
        );

        const role = ownerResult.rowCount === 0 ? 'OWNER' : 'USER';
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const userResult = await client.query(
            `INSERT INTO users (
                username,
                email,
                password_hash,
                role,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, username, email, role, created_at`,
            [username, email, passwordHash, role]
        );

        const user = userResult.rows[0];
        const session = await createSession(client, user.id, req);
        const accessToken = createAccessToken(user);

        await client.query('COMMIT');

        return {
            user: cleanUser(user),
            accessToken,
            refreshToken: session.refreshToken,
            sessionId: session.sessionId,
            expiresAt: session.expiresAt
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});

        if (error.code === '23505') {
            throw new AuthServiceError(
                'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.',
                409,
                'ACCOUNT_EXISTS'
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

async function login(data, req) {
    const { identifier, password } = validateLogin(data);
    const pool = getDatabasePool();

    const result = await pool.query(
        `SELECT
            id,
            username,
            email,
            password_hash,
            role,
            status,
            is_banned,
            created_at
         FROM users
         WHERE LOWER(username) = $1
            OR LOWER(email) = $1
         LIMIT 1`,
        [identifier]
    );

    const user = result.rows[0];

    if (!user) {
        throw new AuthServiceError(
            'بيانات تسجيل الدخول غير صحيحة.',
            401,
            'INVALID_CREDENTIALS'
        );
    }

    const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatches) {
        throw new AuthServiceError(
            'بيانات تسجيل الدخول غير صحيحة.',
            401,
            'INVALID_CREDENTIALS'
        );
    }

    if (
        user.is_banned === true ||
        ['BANNED', 'DISABLED', 'SUSPENDED'].includes(
            String(user.status || '').toUpperCase()
        )
    ) {
        throw new AuthServiceError(
            'هذا الحساب موقوف ولا يمكن تسجيل الدخول.',
            403,
            'ACCOUNT_DISABLED'
        );
    }

    const poolClient = await pool.connect();

    try {
        await poolClient.query('BEGIN');

        const session = await createSession(poolClient, user.id, req);
        const accessToken = createAccessToken(user);

        await poolClient.query(
            `UPDATE users
             SET last_login_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [user.id]
        );

        await poolClient.query('COMMIT');

        return {
            user: cleanUser(user),
            accessToken,
            refreshToken: session.refreshToken,
            sessionId: session.sessionId,
            expiresAt: session.expiresAt
        };
    } catch (error) {
        await poolClient.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        poolClient.release();
    }
}

async function logout(options = {}) {
    const pool = getDatabasePool();
    const sessionId = options.sessionId;
    const userId = options.userId;

    if (sessionId) {
        const result = await pool.query(
            `DELETE FROM sessions
             WHERE id = $1
               AND ($2::text IS NULL OR user_id::text = $2)`,
            [sessionId, userId ? String(userId) : null]
        );

        return { loggedOut: result.rowCount > 0 };
    }

    if (options.refreshToken) {
        const refreshTokenHash = hashToken(options.refreshToken);

        const result = await pool.query(
            `DELETE FROM sessions
             WHERE refresh_token_hash = $1
               AND ($2::text IS NULL OR user_id::text = $2)`,
            [
                refreshTokenHash,
                userId ? String(userId) : null
            ]
        );

        return { loggedOut: result.rowCount > 0 };
    }

    throw new AuthServiceError(
        'يجب تحديد الجلسة أو رمز التحديث لتسجيل الخروج.',
        400,
        'SESSION_REQUIRED'
    );
}

async function refreshSession(refreshToken, req) {
    if (
        typeof refreshToken !== 'string' ||
        refreshToken.length < 32 ||
        refreshToken.length > 256
    ) {
        throw new AuthServiceError(
            'رمز التحديث غير صالح.',
            401,
            'INVALID_REFRESH_TOKEN'
        );
    }

    const pool = getDatabasePool();
    const oldHash = hashToken(refreshToken);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const sessionResult = await client.query(
            `SELECT
                s.id AS session_id,
                s.user_id,
                s.expires_at,
                u.username,
                u.email,
                u.role,
                u.status,
                u.is_banned
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.refresh_token_hash = $1
             FOR UPDATE OF s`,
            [oldHash]
        );

        const session = sessionResult.rows[0];

        if (!session || new Date(session.expires_at) <= new Date()) {
            if (session) {
                await client.query(
                    'DELETE FROM sessions WHERE id = $1',
                    [session.session_id]
                );
            }

            throw new AuthServiceError(
                'انتهت الجلسة، يرجى تسجيل الدخول مجددًا.',
                401,
                'SESSION_EXPIRED'
            );
        }

        if (
            session.is_banned === true ||
            ['BANNED', 'DISABLED', 'SUSPENDED'].includes(
                String(session.status || '').toUpperCase()
            )
        ) {
            await client.query(
                'DELETE FROM sessions WHERE id = $1',
                [session.session_id]
            );

            throw new AuthServiceError(
                'هذا الحساب موقوف.',
                403,
                'ACCOUNT_DISABLED'
            );
        }

        const nextRefreshToken = createRefreshToken();
        const nextHash = hashToken(nextRefreshToken);
        const expiresAt = createSessionExpiry();

        await client.query(
            `UPDATE sessions
             SET refresh_token_hash = $1,
                 expires_at = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [nextHash, expiresAt, session.session_id]
        );

        const user = {
            id: session.user_id,
            username: session.username,
            email: session.email,
            role: session.role
        };

        const accessToken = createAccessToken(user);

        await client.query('COMMIT');

        return {
            user: cleanUser(user),
            accessToken,
            refreshToken: nextRefreshToken,
            sessionId: session.session_id,
            expiresAt
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

async function getSession(sessionId, userId) {
    if (!sessionId || !userId) {
        throw new AuthServiceError(
            'معرّف الجلسة والمستخدم مطلوبان.',
            400,
            'SESSION_REQUIRED'
        );
    }

    const pool = getDatabasePool();

    const result = await pool.query(
        `SELECT
            s.id AS session_id,
            s.user_id,
            s.created_at,
            s.expires_at,
            s.ip_address,
            s.user_agent
         FROM sessions s
         WHERE s.id = $1
           AND s.user_id = $2
           AND s.expires_at > NOW()
         LIMIT 1`,
        [sessionId, userId]
    );

    return result.rows[0] || null;
}

async function logoutAll(userId) {
    if (!userId) {
        throw new AuthServiceError(
            'معرّف المستخدم مطلوب.',
            400,
            'USER_ID_REQUIRED'
        );
    }

    const pool = getDatabasePool();

    const result = await pool.query(
        'DELETE FROM sessions WHERE user_id = $1',
        [userId]
    );

    return {
        loggedOut: true,
        revokedSessions: result.rowCount
    };
}

module.exports = {
    register,
    login,
    logout,
    refreshSession,
    getSession,
    logoutAll,
    AuthServiceError
};
