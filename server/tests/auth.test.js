const request = require('supertest');
const { createApp } = require('../src/app');
const { startDb, stopDb, resetDb } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

describe('auth', () => {
  test('API requires a session', async () => {
    const res = await request(createApp()).get('/api/categories');
    expect(res.status).toBe(401);
  });

  test('wrong password is rejected, right password sets an httpOnly cookie', async () => {
    const app = createApp();
    expect((await request(app).post('/api/auth/login').set('X-Requested-With', 'hourglass').send({ password: 'nope' })).status).toBe(401);
    const ok = await request(app).post('/api/auth/login').set('X-Requested-With', 'hourglass').send({ password: process.env.TEST_PASSWORD });
    expect(ok.status).toBe(200);
    const cookie = ok.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Max-Age=604800/);
  });

  test('login is rate limited to 5 attempts per 15 minutes', async () => {
    const app = createApp();
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post('/api/auth/login').set('X-Requested-With', 'hourglass').send({ password: 'bad' })).status).toBe(401);
    }
    const blocked = await request(app).post('/api/auth/login').set('X-Requested-With', 'hourglass').send({ password: process.env.TEST_PASSWORD });
    expect(blocked.status).toBe(429);
  });

  test('logout ends the session', async () => {
    const agent = request.agent(createApp()).set('X-Requested-With', 'hourglass');
    await agent.post('/api/auth/login').send({ password: process.env.TEST_PASSWORD });
    expect((await agent.get('/api/categories')).status).toBe(200);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/categories')).status).toBe(401);
  });

  test('security headers are set (helmet)', async () => {
    const res = await request(createApp()).get('/api/auth/me');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('writes without the X-Requested-With header are refused (CSRF)', async () => {
    const app = createApp();
    const res = await request(app).post('/api/auth/login').send({ password: process.env.TEST_PASSWORD });
    expect(res.status).toBe(403);
    // A logged-in session doesn't help a forged request either.
    const agent = request.agent(app).set('X-Requested-With', 'hourglass');
    await agent.post('/api/auth/login').send({ password: process.env.TEST_PASSWORD });
    const forged = await agent.post('/api/goals').set('X-Requested-With', '').send({ kind: 'goal', text: 'forged' });
    expect(forged.status).toBe(403);
  });

  test('CORS only allows the configured client origins', async () => {
    const app = createApp();
    const good = await request(app).options('/api/auth/login').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST');
    expect(good.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(good.headers['access-control-allow-credentials']).toBe('true');
    const bad = await request(app).options('/api/auth/login').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
