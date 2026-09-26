const mongoose = require('mongoose');
const { immutablePlugin } = require('../lib/immutable');
const noteSchema = require('./note');

// One logged hour. Locked forever once saved; only notes can be appended.
const timeBlockSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, immutable: true },
    hour: { type: Number, required: true, min: 0, max: 23, immutable: true },
    startsAt: { type: Date, required: true, immutable: true },
    endsAt: { type: Date, required: true, immutable: true },
    activity: { type: String, required: true, trim: true, minlength: 1, maxlength: 500, immutable: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, immutable: true },
    energy: { type: Number, required: true, min: 1, max: 5, immutable: true },
    alignment: { type: String, required: true, enum: ['toward', 'neutral', 'against'], immutable: true },
    stopDoingItem: { type: mongoose.Schema.Types.ObjectId, ref: 'StopDoingItem', default: null, immutable: true },
    loggedAt: { type: Date, required: true, immutable: true },
    lateMinutes: { type: Number, required: true, min: 0, immutable: true },
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

timeBlockSchema.index({ date: 1, hour: 1 }, { unique: true });
timeBlockSchema.index({ stopDoingItem: 1, startsAt: 1 });
timeBlockSchema.index({ category: 1, date: 1 });

timeBlockSchema.plugin(immutablePlugin, { appendOnly: ['notes'] });

module.exports = mongoose.model('TimeBlock', timeBlockSchema);
