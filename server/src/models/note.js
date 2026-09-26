const mongoose = require('mongoose');

// Timestamped note appended to a locked record. createdAt is always set by the server.
const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000, immutable: true },
    createdAt: { type: Date, required: true, immutable: true },
  },
  { _id: true }
);

module.exports = noteSchema;
