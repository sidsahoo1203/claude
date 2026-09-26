const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { wrap } = require('../lib/errors');
const { issueSession, clearSession, isAuthenticated } = require('../middleware/auth');

module.exports = function authRouter() {
  const router = express.Router();

  // 5 login attempts per 15 minutes per IP (successful or not).
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  });

  router.post(
    '/login',
    loginLimiter,
    wrap(async (req, res) => {
      const password = req.body && req.body.password;
      if (typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Password is required' });
      }
      if (!config.passwordHash || !config.jwtSecret) {
        return res.status(500).json({ error: 'Server has no password set. Run npm run set-password.' });
      }
      const ok = await bcrypt.compare(password, config.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Wrong password' });
      issueSession(res);
      res.json({ ok: true });
    })
  );

  router.post('/logout', (req, res) => {
    clearSession(res);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    res.json({ authenticated: isAuthenticated(req) });
  });

  return router;
};
