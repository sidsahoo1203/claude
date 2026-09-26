// Test configuration, set before any app module loads.
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.APP_TZ = 'Asia/Kolkata';
process.env.LOG_WINDOW_HOURS = '12';
process.env.TEST_PASSWORD = 'correct horse battery';
process.env.PASSWORD_HASH = bcrypt.hashSync(process.env.TEST_PASSWORD, 4);
process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
