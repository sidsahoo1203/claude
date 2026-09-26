const mongoose = require('mongoose');
const { createdOnly } = require('../lib/time');
const { immutablePlugin } = require('../lib/immutable');

// One plan revision for an hour. Never changed; a new revision supersedes the previous one.
// The effective plan for an hour is its latest revision. No revisions after the hour starts.
const planEntrySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, immutable: true },
    hour: { type: Number, required: true, min: 0, max: 23, immutable: true },
    startsAt: { type: Date, required: true, immutable: true },
    activity: { type: String, trim: true, maxlength: 500, default: '', immutable: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, immutable: true },
    cleared: { type: Boolean, default: false, immutable: true },
  },
  { timestamps: createdOnly }
);

planEntrySchema.pre('validate', function (next) {
  if (!this.cleared && !this.category) this.invalidate('category', 'category is required unless clearing');
  next();
});

planEntrySchema.index({ date: 1, hour: 1, createdAt: 1 });
planEntrySchema.plugin(immutablePlugin);

module.exports = mongoose.model('PlanEntry', planEntrySchema);
