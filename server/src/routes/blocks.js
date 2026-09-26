const express = require('express');
const { TimeBlock, Category, StopDoingItem } = require('../models');
const { wrap, badRequest, notFound, conflict, forbidden } = require('../lib/errors');
const v = require('../lib/validate');
const config = require('../config');
const time = require('../lib/time');
const { getDay, getOpenHours, BLOCK_POPULATE } = require('../services/day');

const days = express.Router();
const blocks = express.Router();

days.get(
  '/open',
  wrap(async (req, res) => {
    res.json(await getOpenHours());
  })
);

days.get(
  '/:date',
  wrap(async (req, res) => {
    res.json(await getDay(v.date(req.params.date)));
  })
);

// Append-only: creates a locked block. Only allowed while the hour is "open":
// finished, not yet logged, and within LOG_WINDOW_HOURS of its end.
blocks.post(
  '/',
  wrap(async (req, res) => {
    const body = req.body || {};
    const date = v.date(body.date);
    const hour = v.intIn(body.hour, 'hour', 0, 23);
    const activity = v.str(body.activity, 'activity', { max: 500 });
    const categoryId = v.objectId(body.category, 'category');
    const energy = v.intIn(body.energy, 'energy', 1, 5);
    const alignment = v.oneOf(body.alignment, 'alignment', ['toward', 'neutral', 'against']);
    const stopDoingId = v.objectId(body.stopDoingItem, 'stopDoingItem', { optional: true });

    const now = time.now();
    const existing = await TimeBlock.exists({ date, hour });
    const status = time.hourStatus(date, hour, !!existing, now);
    if (status === 'logged') throw conflict('This hour is already logged and locked. You can only add notes.');
    if (status === 'future') throw forbidden('This hour has not finished yet. You can log it once it ends.');
    if (status === 'unaccounted') {
      throw forbidden(`The ${config.logWindowHours}-hour logging window for this hour has closed. It stays unaccounted.`);
    }

    const category = await Category.findById(categoryId);
    if (!category) throw badRequest('Category not found');
    if (category.archived) throw badRequest('Archived categories cannot be used for new logs');
    if (stopDoingId && !(await StopDoingItem.exists({ _id: stopDoingId }))) {
      throw badRequest('Stop Doing item not found');
    }

    const endsAt = time.hourEnd(date, hour);
    const block = await TimeBlock.create({
      date,
      hour,
      startsAt: time.hourStart(date, hour).toJSDate(),
      endsAt: endsAt.toJSDate(),
      activity,
      category: category._id,
      energy,
      alignment,
      stopDoingItem: stopDoingId,
      loggedAt: now.toJSDate(),
      lateMinutes: Math.max(0, Math.floor(now.diff(endsAt, 'minutes').minutes)),
    });
    res.status(201).json(await TimeBlock.findById(block._id).populate(BLOCK_POPULATE).lean());
  })
);

blocks.get(
  '/:id',
  wrap(async (req, res) => {
    v.objectId(req.params.id, 'id');
    const block = await TimeBlock.findById(req.params.id).populate(BLOCK_POPULATE).lean();
    if (!block) throw notFound('Block not found');
    res.json(block);
  })
);

// Append-only: the only change ever allowed on a block.
blocks.post(
  '/:id/notes',
  wrap(async (req, res) => {
    v.objectId(req.params.id, 'id');
    const text = v.str(req.body && req.body.text, 'text', { max: 2000 });
    const block = await TimeBlock.findOneAndUpdate(
      { _id: req.params.id },
      { $push: { notes: { text, createdAt: time.now().toJSDate() } } },
      { new: true }
    ).populate(BLOCK_POPULATE);
    if (!block) throw notFound('Block not found');
    res.status(201).json(block);
  })
);

module.exports = { days, blocks };
