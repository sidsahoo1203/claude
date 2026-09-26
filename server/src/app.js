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
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Permanence: there are no edit or delete endpoints. Any PUT/PATCH/DELETE is refused.
  app.use('/api', (req, res, next) => {
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return res.status(405).json({ error: 'Logged data is permanent: it can never be edited or deleted, only added to.' });
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

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // In production the built client is served from the same origin.
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (config.env === 'production' && fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
