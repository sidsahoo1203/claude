const express = require('express');
const { Letter } = require('../models');
const { wrap, notFound, badRequest } = require('../lib/errors');
const v = require('../lib/validate');
const time = require('../lib/time');

const router = express.Router();

// Public shape of a letter. The body is only included when explicitly loaded AND unlocked.
function present(letter, at) {
  const unlocked = at >= letter.unlocksAt;
  const out = {
    _id: letter._id,
    title: letter.title,
    unlockDate: letter.unlockDate,
    unlocksAt: letter.unlocksAt,
    createdAt: letter.createdAt,
    unlocked,
  };
  if (unlocked && letter.body !== undefined) out.body = letter.body;
  return out;
}

// Never selects the body (select: false on the schema).
router.get(
  '/',
  wrap(async (req, res) => {
    const at = time.now().toJSDate();
    const letters = await Letter.find().sort({ unlocksAt: 1, createdAt: 1 }).lean();
    res.json(letters.map((l) => present(l, at)));
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    v.objectId(req.params.id, 'id');
    const at = time.now().toJSDate();
    // Only ask the database for the body if the letter is already unlocked.
    let letter = await Letter.findOne({ _id: req.params.id, unlocksAt: { $lte: at } }).select('+body').lean();
    if (!letter) letter = await Letter.findById(req.params.id).lean();
    if (!letter) throw notFound('Letter not found');
    res.json(present(letter, at));
  })
);

// Append-only: letters can never be edited or deleted.
router.post(
  '/',
  wrap(async (req, res) => {
    const title = v.str(req.body.title, 'title', { max: 200 });
    const body = v.str(req.body.body, 'body', { max: 20000 });
    const unlockDate = v.date(req.body.unlockDate, 'unlockDate');
    const now = time.now();
    if (unlockDate <= now.toISODate()) throw badRequest('The unlock date must be after today.');
    const letter = await Letter.create({ title, body, unlockDate, unlocksAt: time.dayStart(unlockDate).toJSDate() });
    res.status(201).json(present(letter.toObject(), now.toJSDate()));
  })
);

module.exports = router;
