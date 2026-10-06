'use strict';

const express = require('express');
const {
  validateBody
} = require('../middleware/validate');
const {
  authRateLimit
} = require('../middleware/rateLimit');
const {
  authenticate
} = require('../middleware/auth');
const {
  register,
  login,
  logout,
  getCurrentUser,
  refreshSession,
  changePassword
} = require('../services/authService');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema
} = require('../validators/authValidator');

const router = express.Router();

router.use(authRateLimit);

function sendSuccess(res, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data
  });
}

router.post(
  '/register',
  validateBody(registerSchema),
  async (req, res, next) => {
    try {
      const result = await register({
        ...req.body,
        ipAddress:
          req.ip ||
          req.socket?.remoteAddress ||
          null,
        userAgent:
          req.get('user-agent') || null
      });

      return sendSuccess(
        res,
        result,
        201
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/login',
  validateBody(loginSchema),
  async (req, res, next) => {
    try {
      const result = await login({
        ...req.body,
        ipAddress:
          req.ip ||
          req.socket?.remoteAddress ||
          null,
        userAgent:
          req.get('user-agent') || null
      });

      return sendSuccess(
        res,
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/logout',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await logout({
        userId: req.user.id,
        token: req.auth?.token || null,
        sessionId:
          req.auth?.payload?.sessionId ||
          req.auth?.payload?.session_id ||
          null
      });

      return sendSuccess(
        res,
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/refresh',
  async (req, res, next) => {
    try {
      const result = await refreshSession({
        token:
          req.auth?.token ||
          req.body?.refreshToken ||
          null,
        ipAddress:
          req.ip ||
          req.socket?.remoteAddress ||
          null,
        userAgent:
          req.get('user-agent') || null
      });

      return sendSuccess(
        res,
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  '/me',
  authenticate,
  async (req, res, next) => {
    try {
      const user = await getCurrentUser(
        req.user.id
      );

      return sendSuccess(
        res,
        user,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  async (req, res, next) => {
    try {
      const result = await changePassword({
        userId: req.user.id,
        currentPassword:
          req.body.currentPassword,
        newPassword:
          req.body.newPassword,
        ipAddress:
          req.ip ||
          req.socket?.remoteAddress ||
          null,
        userAgent:
          req.get('user-agent') || null
      });

      return sendSuccess(
        res,
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
