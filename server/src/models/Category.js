const mongoose = require('mongoose');
const { createdOnly } = require('../lib/time');
const { immutablePlugin } = require('../lib/immutable');

// Categories are never deleted so old logs keep their category; they can only be archived.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 40, immutable: true },
    nameKey: { type: String, required: true, unique: true, immutable: true },
    color: { type: String, required: true, match: /^#[0-9a-f]{6}$/i, immutable: true },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: createdOnly }
);

categorySchema.pre('validate', function (next) {
  if (this.isNew && this.name) this.nameKey = this.name.trim().toLowerCase();
  next();
});

categorySchema.plugin(immutablePlugin, { mutable: ['archived', 'archivedAt'] });

module.exports = mongoose.model('Category', categorySchema);
