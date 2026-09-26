const express = require('express');
const mongoose = require('mongoose');
const { StopDoingItem, TimeBlock } = require('../models');
const { wrap, notFound, conflict } = require('../lib/errors');
const v = require('../lib/validate');
const time = require('../lib/time');

const router = express.Router();

// Relapse counts per item, from linked time blocks.
async function relapseCounts() {
  const rows = await TimeBlock.aggregate([
    { $match: { stopDoingItem: { $ne: null } } },
    { $group: { _id: '$stopDoingItem', count: { $sum: 1 }, last: { $max: '$startsAt' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

router.get(
  '/',
  wrap(async (req, res) => {
    const [items, counts] = await Promise.all([StopDoingItem.find().sort({ status: 1, createdAt: -1 }).lean(), relapseCounts()]);
    res.json(
      items.map((i) => {
        const c = counts.get(String(i._id));
        return { ...i, relapses: c ? c.count : 0, lastRelapse: c ? c.last : null };
      })
    );
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    v.objectId(req.params.id, 'id');
    const item = await StopDoingItem.findById(req.params.id).lean();
    if (!item) throw notFound('Item not found');
    const blocks = await TimeBlock.find({ stopDoingItem: new mongoose.Types.ObjectId(req.params.id) })
      .sort({ startsAt: -1 })
      .populate({ path: 'category', select: 'name color archived' })
      .lean();
    res.json({
      ...item,
      relapses: blocks.length,
      timeline: blocks.map((b) => ({ ...b, afterResolved: !!item.resolvedAt && b.startsAt > item.resolvedAt })),
    });
  })
);

// Append-only.
router.post(
  '/',
  wrap(async (req, res) => {
    const title = v.str(req.body.title, 'title', { max: 120 });
    const description = v.str(req.body.description, 'description', { max: 1000, optional: true });
    res.status(201).json(await StopDoingItem.create({ title, description }));
  })
);

// One-way state change.
router.post(
  '/:id/resolve',
  wrap(async (req, res) => {
    v.objectId(req.params.id, 'id');
    const item = await StopDoingItem.findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      { $set: { status: 'resolved', resolvedAt: time.now().toJSDate() } },
      { new: true }
    );
    if (item) return res.json(item);
    if (await StopDoingItem.exists({ _id: req.params.id })) throw conflict('Already resolved');
    throw notFound('Item not found');
  })
);

module.exports = router;
