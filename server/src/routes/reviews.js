const express = require('express');
const { wrap } = require('../lib/errors');
const v = require('../lib/validate');
const time = require('../lib/time');
const { weeklyReview } = require('../services/weekly');

const router = express.Router();

// ?start= any date in the week (normalised to its Monday). Defaults to the current week.
router.get(
  '/week',
  wrap(async (req, res) => {
    const date = req.query.start ? v.date(req.query.start, 'start') : time.todayStr();
    res.json(await weeklyReview(date));
  })
);

module.exports = router;
