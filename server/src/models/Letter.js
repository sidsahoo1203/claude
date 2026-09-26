const mongoose = require('mongoose');
const { createdOnly } = require('../lib/time');
const { immutablePlugin } = require('../lib/immutable');

// Letter to future self. Fully immutable. The body is excluded from every query by default
// (select: false) and is only read explicitly once unlocksAt has passed.
const letterSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200, immutable: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 20000, select: false, immutable: true },
    unlockDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, immutable: true },
    unlocksAt: { type: Date, required: true, immutable: true },
  },
  { timestamps: createdOnly }
);

letterSchema.index({ unlocksAt: 1 });
letterSchema.plugin(immutablePlugin);

module.exports = mongoose.model('Letter', letterSchema);
