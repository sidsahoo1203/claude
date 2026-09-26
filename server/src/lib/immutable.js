// Mongoose plugin that enforces permanence at the model layer, so a buggy
// route can't edit or delete locked data even if it tries.
//
// Options:
//   mutable:     paths that may be changed with $set/$unset (e.g. ['archived'])
//   appendOnly:  array paths that may only grow via $push (e.g. ['notes'])
class PermanenceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PermanenceError';
  }
}

const TIMESTAMP_PATHS = ['createdAt', 'updatedAt'];

function immutablePlugin(schema, { mutable = [], appendOnly = [] } = {}) {
  const deny = (what) =>
    function denyHook(next) {
      const name = this.constructor.modelName || (this.model && this.model.modelName) || 'document';
      next(new PermanenceError(`${name} records are permanent: ${what} is not allowed`));
    };

  const deletes = ['deleteMany', 'findOneAndDelete', 'findOneAndReplace', 'replaceOne', 'deleteOne'];
  schema.pre(deletes, { query: true, document: false }, deny('delete/replace'));
  schema.pre('deleteOne', { document: true, query: false }, deny('delete'));

  schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], { query: true, document: false }, function (next) {
    const reason = checkUpdate(this.getUpdate(), this.getOptions(), mutable, appendOnly);
    if (reason) return next(new PermanenceError(`${this.model.modelName}: ${reason}`));
    next();
  });
  schema.pre('updateOne', { document: true, query: false }, deny('document update'));

  schema.pre('save', function (next) {
    if (this.isNew) return next();
    const bad = this.directModifiedPaths().filter((p) => !mutable.includes(p) && !TIMESTAMP_PATHS.includes(p));
    if (bad.length) {
      return next(new PermanenceError(`${this.constructor.modelName}: cannot modify ${bad.join(', ')}`));
    }
    next();
  });

  schema.pre('bulkWrite', function (next, ops) {
    const bad = (ops || []).some((op) => !op.insertOne);
    if (bad) return next(new PermanenceError(`${this.modelName}: bulk writes may only insert`));
    next();
  });
}

function checkUpdate(update, options, mutable, appendOnly) {
  if (!update || Array.isArray(update)) return 'pipeline updates are not allowed';
  if (options && options.upsert) return 'upserts are not allowed';
  for (const [key, value] of Object.entries(update)) {
    if (!key.startsWith('$')) {
      if (!mutable.includes(key)) return `field "${key}" is locked`;
      continue;
    }
    const paths = Object.keys(value || {});
    switch (key) {
      case '$set':
      case '$unset': {
        const locked = paths.find((p) => !mutable.includes(p));
        if (locked) return `field "${locked}" is locked`;
        break;
      }
      case '$push': {
        const locked = paths.find((p) => !appendOnly.includes(p));
        if (locked) return `"${locked}" is not append-only`;
        const reordering = paths.find((p) => {
          const v = value[p];
          return v && typeof v === 'object' && ('$position' in v || '$slice' in v || '$sort' in v);
        });
        if (reordering) return 'appends may not reorder or trim';
        break;
      }
      case '$setOnInsert': {
        // Added by Mongoose timestamps; harmless without upsert (rejected above).
        const other = paths.find((p) => !TIMESTAMP_PATHS.includes(p));
        if (other) return `field "${other}" is locked`;
        break;
      }
      default:
        return `operator ${key} is not allowed`;
    }
  }
  return null;
}

module.exports = { immutablePlugin, PermanenceError };
