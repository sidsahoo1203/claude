const mongoose = require('mongoose');
const { immutablePlugin } = require('../lib/immutable');

// Habits to eliminate. Never deleted; the only state change is active -> resolved.
const stopDoingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120, immutable: true },
    description: { type: String, trim: true, maxlength: 1000, default: '', immutable: true },
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stopDoingSchema.plugin(immutablePlugin, { mutable: ['status', 'resolvedAt'] });

module.exports = mongoose.model('StopDoingItem', stopDoingSchema);
