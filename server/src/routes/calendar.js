const express = require('express');
const { wrap, badRequest } = require('../lib/errors');
const time = require('../lib/time');
const { dailyStats, firstTrackedDate } = require('../services/history');

const router = express.Router();

router.get(
  '/',
  wrap(async (req, res) => {
    const at = time.now();
    const month = req.query.month || at.toFormat('yyyy-MM');
    if (!/^\d{4}-\d{2}$/.test(month) || !time.isValidDate(`${month}-01`)) throw badRequest('month must look like YYYY-MM');
    const from = `${month}-01`;
    const to = time.dayStart(from).endOf('month').toISODate();
    const days = await dailyStats(from, to, at);
    res.json({ month, today: at.toISODate(), firstDate: await firstTrackedDate(), days });
  })
);

module.exports = router;
