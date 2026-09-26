const { Reflection } = require('../src/models');
const { startDb, stopDb, resetDb, setIST, loggedInAgent } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

const answers = { wentWell: 'Deep work block', didntGoWell: 'Reels after dinner', changeTomorrow: 'Phone in the other room' };

describe('end-of-day reflection', () => {
  test('one per day, locked once saved', async () => {
    setIST('2026-09-26T22:00');
    const agent = await loggedInAgent();
    const res = await agent.post('/api/reflections').send({ date: '2026-09-26', ...answers });
    expect(res.status).toBe(201);
    const again = await agent.post('/api/reflections').send({ date: '2026-09-26', ...answers, wentWell: 'Rewritten' });
    expect(again.status).toBe(409);
    expect((await agent.put('/api/reflections/2026-09-26').send(answers)).status).toBe(405);
    expect((await agent.delete('/api/reflections/2026-09-26')).status).toBe(405);
    await expect(Reflection.updateOne({ date: '2026-09-26' }, { wentWell: 'x' })).rejects.toThrow(/locked/);
    await expect(Reflection.deleteOne({ date: '2026-09-26' })).rejects.toThrow(/permanent/);
    expect((await agent.get('/api/reflections/2026-09-26')).body.wentWell).toBe('Deep work block');
  });

  test('all three questions are required', async () => {
    setIST('2026-09-26T22:00');
    const agent = await loggedInAgent();
    expect((await agent.post('/api/reflections').send({ date: '2026-09-26', ...answers, didntGoWell: ' ' })).status).toBe(400);
  });

  test('notes can be appended with a server timestamp', async () => {
    setIST('2026-09-26T22:00');
    const agent = await loggedInAgent();
    await agent.post('/api/reflections').send({ date: '2026-09-26', ...answers });
    setIST('2026-10-03T09:00');
    const res = await agent.post('/api/reflections/2026-09-26/notes').send({ text: 'A week later: the change worked.' });
    expect(res.status).toBe(201);
    expect(res.body.notes).toHaveLength(1);
    expect(new Date(res.body.notes[0].createdAt).toISOString()).toBe('2026-10-03T03:30:00.000Z');
    expect(res.body.wentWell).toBe('Deep work block');
  });

  test('only today, or yesterday within the window, can be reflected on', async () => {
    const agent = await loggedInAgent();
    setIST('2026-09-27T11:59');
    const open = (await agent.get('/api/reflections/open')).body;
    expect(open.map((d) => d.date)).toEqual(['2026-09-26', '2026-09-27']);
    expect((await agent.post('/api/reflections').send({ date: '2026-09-28', ...answers })).status).toBe(403);
    expect((await agent.post('/api/reflections').send({ date: '2026-09-25', ...answers })).status).toBe(403);
    expect((await agent.post('/api/reflections').send({ date: '2026-09-26', ...answers })).status).toBe(201);

    setIST('2026-09-28T12:00'); // yesterday's window closed at 12:00
    expect((await agent.post('/api/reflections').send({ date: '2026-09-27', ...answers })).status).toBe(403);
    expect((await agent.get('/api/reflections/open')).body).toEqual([{ date: '2026-09-28', written: false }]);
  });
});
