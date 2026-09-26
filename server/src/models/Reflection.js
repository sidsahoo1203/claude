const mongoose = require('mongoose');
const { createdOnly } = require('../lib/time');
const { immutablePlugin } = require('../lib/immutable');
const noteSchema = require('./note');

const answer = { type: String, required: true, trim: true, minlength: 1, maxlength: 2000, immutable: true };

// End-of-day reflection: one per date, locked once saved; only notes can be appended.
const reflectionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/, immutable: true },
    wentWell: answer,
    didntGoWell: answer,
    changeTomorrow: answer,
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: createdOnly }
);

reflectionSchema.plugin(immutablePlugin, { appendOnly: ['notes'] });

module.exports = mongoose.model('Reflection', reflectionSchema);
