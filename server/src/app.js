const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { errorHandler } = require('./lib/errors');
const { requireAuth } = require('./middleware/auth');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        // Only force HTTPS subresources when actually served over HTTPS (COOKIE_SECURE),
        // so plain-HTTP use on a home network still works.
        directives: { upgradeInsecureRequests: config.cookieSecure ? [] : null },
      },
    })
  );
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Permanence: there are no edit or delete endpoints. Any PUT/PATCH/DELETE is refused.
  app.use('/api', (req, res, next) => {
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return res.status(405).json({ error: 'Logged data is permanent: it can never be edited or deleted, only added to.' });
    }
    // CSRF: every write must carry a header an HTML form can't set. Cross-site, that forces a
    // CORS preflight, which only CLIENT_ORIGIN passes.
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && req.get('X-Requested-With') !== 'hourglass') {
      return res.status(403).json({ error: 'Missing X-Requested-With header' });
    }
    next();
  });

  app.use('/api/auth', require('./routes/auth')());
  app.use('/api', requireAuth);
  app.use('/api/meta', require('./routes/meta'));
  app.use('/api/categories', require('./routes/categories'));
  const { days, blocks } = require('./routes/blocks');
  app.use('/api/days', days);
  app.use('/api/blocks', blocks);
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/goals', require('./routes/goals'));
  app.use('/api/plans', require('./routes/plans'));
  app.use('/api/calendar', require('./routes/calendar'));
  app.use('/api/stop-doing', require('./routes/stopDoing'));
  app.use('/api/reflections', require('./routes/reflections'));
  app.use('/api/reviews', require('./routes/reviews'));
  app.use('/api/letters', require('./routes/letters'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/export', require('./routes/export'));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // In production the built client is served from the same origin.
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (config.env === 'production' && fs.existsSync(dist)) {
    app.use(
      express.static(dist, {
        setHeaders(res, file) {
          // Hashed build assets never change; the shell, manifest and service worker must revalidate.
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else res.setHeader('Cache-Control', 'no-cache');
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
