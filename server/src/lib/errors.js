class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const notFound = (msg = 'Not found') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);
const forbidden = (msg) => new HttpError(403, msg);

// Wraps async route handlers so rejections reach the error handler.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Already exists and cannot be replaced' });
  }
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'PermanenceError') {
    return res.status(405).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { HttpError, badRequest, notFound, conflict, forbidden, wrap, errorHandler };
