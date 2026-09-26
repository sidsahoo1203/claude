const mongoose = require('mongoose');
const { createdOnly } = require('../lib/time');
const { immutablePlugin, PermanenceError } = require('../lib/immutable');

// Habits to eliminate. Never deleted; the only state change is active -> resolved.
const stopDoingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120, immutable: true },
    description: { type: String, trim: true, maxlength: 1000, default: '', immutable: true },
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: createdOnly }
);

stopDoingSchema.plugin(immutablePlugin, { mutable: ['status', 'resolvedAt'] });

// Status each document had when loaded from the DB.
const loadedStatus = new WeakMap();

// Resolving is one-way: an update may only ever set status to "resolved".
stopDoingSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function (next) {
  const u = this.getUpdate() || {};
  const status = (u.$set && u.$set.status) ?? u.status;
  const unsetting = u.$unset && ('status' in u.$unset || 'resolvedAt' in u.$unset);
  if ((status !== undefined && status !== 'resolved') || unsetting) {
    return next(new PermanenceError('StopDoingItem: resolving is permanent'));
  }
  // Only still-active items may be touched, so resolvedAt can't be rewritten later.
  if (Object.keys(u).length && this.getFilter().status !== 'active') {
    return next(new PermanenceError('StopDoingItem: updates must target active items only'));
  }
  next();
});
stopDoingSchema.pre('save', function (next) {
  if (!this.isNew && (this.isModified('resolvedAt') || this.isModified('status')) && loadedStatus.get(this) !== 'active') {
    return next(new PermanenceError('StopDoingItem: resolving is permanent'));
  }
  if (!this.isNew && this.isModified('status') && this.status !== 'resolved') {
    return next(new PermanenceError('StopDoingItem: resolving is permanent'));
  }
  next();
});

stopDoingSchema.post('init', function () {
  loadedStatus.set(this, this.status);
});

module.exports = mongoose.model('StopDoingItem', stopDoingSchema);
