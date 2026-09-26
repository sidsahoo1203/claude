const mongoose = require('mongoose');
const { createdOnly } = require('../lib/time');
const { immutablePlugin } = require('../lib/immutable');

// Long-term goal and contribution statement. Append-only: the latest entry of each kind is current,
// earlier entries form the history.
const goalEntrySchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, enum: ['goal', 'contribution'], immutable: true },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000, immutable: true },
  },
  { timestamps: createdOnly }
);

goalEntrySchema.index({ kind: 1, createdAt: -1 });
goalEntrySchema.plugin(immutablePlugin);

module.exports = mongoose.model('GoalEntry', goalEntrySchema);
