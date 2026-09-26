const express = require('express');
const { Category } = require('../models');
const { wrap, notFound, conflict, badRequest } = require('../lib/errors');
const v = require('../lib/validate');
const time = require('../lib/time');

const router = express.Router();

router.get(
  '/',
  wrap(async (req, res) => {
    const filter = req.query.includeArchived === '1' ? {} : { archived: false };
    res.json(await Category.find(filter).sort({ archived: 1, createdAt: 1 }).lean());
  })
);

// Append-only: categories are created, never edited or deleted.
router.post(
  '/',
  wrap(async (req, res) => {
    const name = v.str(req.body.name, 'name', { max: 40 });
    const color = v.str(req.body.color, 'color', { max: 7 });
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw badRequest('color must be a hex colour like #7c5cff');
    const exists = await Category.findOne({ nameKey: name.toLowerCase() });
    if (exists) throw conflict(`A category named "${exists.name}" already exists`);
    const cat = await Category.create({ name, color: color.toLowerCase() });
    res.status(201).json(cat);
  })
);

async function setArchived(req, res, archived) {
  v.objectId(req.params.id, 'id');
  const cat = await Category.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { archived, archivedAt: archived ? time.now().toJSDate() : null } },
    { new: true }
  );
  if (!cat) throw notFound('Category not found');
  res.json(cat);
}

router.post('/:id/archive', wrap((req, res) => setArchived(req, res, true)));
router.post('/:id/unarchive', wrap((req, res) => setArchived(req, res, false)));

module.exports = router;
