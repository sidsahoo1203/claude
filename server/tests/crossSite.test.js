// Cross-site mode (client on GitHub Pages, API elsewhere): cookie must be SameSite=None; Secure.
const request = require('supertest');

describe('cross-site cookie mode', () => {
  let createApp;
  beforeAll(() => {
    jest.resetModules();
    process.env.COOKIE_SAMESITE = 'none';
    process.env.COOKIE_SECURE = 'false'; // 'none' must force Secure anyway
    process.env.CLIENT_ORIGIN = 'http://localhost:5173, https://sidsahoo1203.github.io/';
    ({ createApp } = require('../src/app'));
  });
  afterAll(() => {
    delete process.env.COOKIE_SAMESITE;
    delete process.env.COOKIE_SECURE;
    process.env.CLIENT_ORIGIN = 'http://localhost:5173';
    jest.resetModules();
  });

  test('session cookie is SameSite=None and Secure', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .set('X-Requested-With', 'hourglass')
      .send({ password: process.env.TEST_PASSWORD });
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/SameSite=None/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/HttpOnly/);
  });

  test('every listed origin is allowed (trailing slash ignored)', async () => {
    const res = await request(createApp())
      .options('/api/auth/login')
      .set('Origin', 'https://sidsahoo1203.github.io')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-requested-with');
    expect(res.headers['access-control-allow-origin']).toBe('https://sidsahoo1203.github.io');
    expect(res.headers['access-control-allow-headers']).toMatch(/x-requested-with/i);
  });
});
