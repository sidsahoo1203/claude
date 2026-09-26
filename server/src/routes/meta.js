const express = require('express');
const config = require('../config');
const time = require('../lib/time');

// The client's only clock: it never trusts the device time to decide "today".
const router = express.Router();

router.get('/now', (req, res) => {
  const now = time.now();
  res.json({
    now: now.toISO(),
    epochMs: now.toMillis(),
    today: now.toISODate(),
    hour: now.hour,
    tz: config.tz,
    logWindowHours: config.logWindowHours,
  });
});

module.exports = router;
