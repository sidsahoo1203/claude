const express = require('express');
const { GoalEntry } = require('../models');
const { wrap } = require('../lib/errors');
const v = require('../lib/validate');
const { latestGoals } = require('../services/dashboard');

const router = express.Router();

router.get(
  '/',
  wrap(async (req, res) => {
    const [current, history] = await Promise.all([
      latestGoals(),
      GoalEntry.find().sort({ createdAt: -1, _id: -1 }).lean(),
    ]);
    res.json({
      ...current,
      history: {
        goal: history.filter((g) => g.kind === 'goal'),
        contribution: history.filter((g) => g.kind === 'contribution'),
      },
    });
  })
);

// Append-only: a new version becomes current; earlier ones stay in the history.
router.post(
  '/',
  wrap(async (req, res) => {
    const kind = v.oneOf(req.body.kind, 'kind', ['goal', 'contribution']);
    const text = v.str(req.body.text, 'text', { max: 2000 });
    res.status(201).json(await GoalEntry.create({ kind, text }));
  })
);

module.exports = router;
