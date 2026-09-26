const request = require('supertest');
const { Letter } = require('../src/models');
const { startDb, stopDb, resetDb, setIST, loggedInAgent } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

const SECRET = 'Dear future me, the secret is patience.';

describe('letters to future self', () => {
  test('sealed letters never expose their body; unlocked ones do', async () => {
    setIST('2026-09-26T21:00');
    const agent = await loggedInAgent();
    const created = await agent.post('/api/letters').send({ title: 'One month on', body: SECRET, unlockDate: '2026-10-26' });
    expect(created.status).toBe(201);
    expect(created.body.body).toBeUndefined();
    expect(created.body.unlocked).toBe(false);
    expect(JSON.stringify(created.body)).not.toContain('patience');

    const list = await agent.get('/api/letters');
    expect(list.body).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain('patience');
    const detail = await agent.get(`/api/letters/${created.body._id}`);
    expect(detail.body.title).toBe('One month on');
    expect(detail.body.body).toBeUndefined();
    expect(JSON.stringify(detail.body)).not.toContain('patience');

    // One minute before midnight IST on the unlock date: still sealed.
    setIST('2026-10-25T23:59');
    expect((await agent.get(`/api/letters/${created.body._id}`)).body.body).toBeUndefined();

    setIST('2026-10-26T00:00');
    const opened = await agent.get(`/api/letters/${created.body._id}`);
    expect(opened.body.unlocked).toBe(true);
    expect(opened.body.body).toBe(SECRET);
    // The list never includes bodies, even when unlocked.
    expect(JSON.stringify((await agent.get('/api/letters')).body)).not.toContain('patience');
  });

  test('the body is excluded at the model layer by default', async () => {
    setIST('2026-09-26T21:00');
    const agent = await loggedInAgent();
    await agent.post('/api/letters').send({ title: 'T', body: SECRET, unlockDate: '2027-01-01' });
    const l = await Letter.findOne().lean();
    expect(l.body).toBeUndefined();
  });

  test('unlock date must be after today', async () => {
    setIST('2026-09-26T21:00');
    const agent = await loggedInAgent();
    expect((await agent.post('/api/letters').send({ title: 'T', body: 'B', unlockDate: '2026-09-26' })).status).toBe(400);
    expect((await agent.post('/api/letters').send({ title: 'T', body: 'B', unlockDate: '2026-09-01' })).status).toBe(400);
    expect((await agent.post('/api/letters').send({ title: 'T', body: 'B', unlockDate: '2026-09-27' })).status).toBe(201);
  });

  test('letters can never be edited or deleted', async () => {
    setIST('2026-09-26T21:00');
    const agent = await loggedInAgent();
    const { body } = await agent.post('/api/letters').send({ title: 'T', body: SECRET, unlockDate: '2027-01-01' });
    expect((await agent.put(`/api/letters/${body._id}`).send({ unlockDate: '2026-09-27' })).status).toBe(405);
    expect((await agent.patch(`/api/letters/${body._id}`).send({ unlockDate: '2026-09-27' })).status).toBe(405);
    expect((await agent.delete(`/api/letters/${body._id}`)).status).toBe(405);
    await expect(Letter.updateOne({ _id: body._id }, { $set: { unlocksAt: new Date(0) } })).rejects.toThrow(/locked/);
    await expect(Letter.findByIdAndDelete(body._id)).rejects.toThrow(/permanent/);
  });

  test('letters require login', async () => {
    const res = await request(require('../src/app').createApp()).get('/api/letters');
    expect(res.status).toBe(401);
  });
});
