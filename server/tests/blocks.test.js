const { TimeBlock } = require('../src/models');
const { startDb, stopDb, resetDb, setIST, loggedInAgent, categoryId } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

async function log(agent, date, hour, extra = {}) {
  const category = extra.category || (await categoryId(agent));
  return agent
    .post('/api/blocks')
    .send({ date, hour, activity: 'Writing', category, energy: 4, alignment: 'toward', ...extra });
}

describe('time logging: locking', () => {
  test('a saved block is locked: no re-log, no edit, no delete via API', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    const res = await log(agent, '2026-09-26', 9);
    expect(res.status).toBe(201);
    const id = res.body._id;

    const again = await log(agent, '2026-09-26', 9, { activity: 'Changed my mind' });
    expect(again.status).toBe(409);

    expect((await agent.put(`/api/blocks/${id}`).send({ activity: 'x' })).status).toBe(405);
    expect((await agent.patch(`/api/blocks/${id}`).send({ energy: 5 })).status).toBe(405);
    expect((await agent.delete(`/api/blocks/${id}`)).status).toBe(405);
    expect((await agent.delete(`/api/blocks/${id}/notes/0`)).status).toBe(405);

    const stored = (await agent.get(`/api/blocks/${id}`)).body;
    expect(stored.activity).toBe('Writing');
    expect(stored.energy).toBe(4);
  });

  test('blocks cannot be changed or deleted at the model layer', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    const { body } = await log(agent, '2026-09-26', 9);

    await expect(TimeBlock.updateOne({ _id: body._id }, { $set: { activity: 'x' } })).rejects.toThrow(/locked/);
    await expect(TimeBlock.findOneAndUpdate({ _id: body._id }, { energy: 1 })).rejects.toThrow(/locked/);
    await expect(TimeBlock.updateMany({}, { $pull: { notes: {} } })).rejects.toThrow(/not allowed/);
    await expect(TimeBlock.updateOne({ _id: body._id }, [{ $set: { energy: 1 } }])).rejects.toThrow(/pipeline/);
    await expect(TimeBlock.deleteOne({ _id: body._id })).rejects.toThrow(/permanent/);
    await expect(TimeBlock.deleteMany({})).rejects.toThrow(/permanent/);
    await expect(TimeBlock.findByIdAndDelete(body._id)).rejects.toThrow(/permanent/);
    await expect(TimeBlock.replaceOne({ _id: body._id }, { activity: 'x' })).rejects.toThrow(/permanent/);
    await expect(TimeBlock.bulkWrite([{ deleteOne: { filter: { _id: body._id } } }])).rejects.toThrow(/only insert/);

    const doc = await TimeBlock.findById(body._id);
    await expect(doc.deleteOne()).rejects.toThrow(/permanent/);
    doc.activity = 'Rewritten history';
    await doc.save().catch(() => {});
    expect((await TimeBlock.findById(body._id)).activity).toBe('Writing');
    expect(await TimeBlock.countDocuments()).toBe(1);
  });

  test('notes are the only allowed change: appended with a server timestamp', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    const { body } = await log(agent, '2026-09-26', 9);

    setIST('2026-10-15T08:00'); // notes can be added any time, forever
    const n1 = await agent
      .post(`/api/blocks/${body._id}/notes`)
      .send({ text: 'Actually I was distracted half the time', createdAt: '2020-01-01T00:00:00Z' });
    expect(n1.status).toBe(201);
    expect(n1.body.notes).toHaveLength(1);
    expect(new Date(n1.body.notes[0].createdAt).toISOString()).toBe('2026-10-15T02:30:00.000Z');

    const n2 = await agent.post(`/api/blocks/${body._id}/notes`).send({ text: 'Second thought' });
    expect(n2.body.notes.map((n) => n.text)).toEqual(['Actually I was distracted half the time', 'Second thought']);
    expect(n2.body.activity).toBe('Writing');

    expect((await agent.post(`/api/blocks/${body._id}/notes`).send({ text: '   ' })).status).toBe(400);
  });

  test('client cannot set server-controlled fields', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    const res = await log(agent, '2026-09-26', 7, { loggedAt: '2026-09-26T08:00:00Z', lateMinutes: 0 });
    expect(new Date(res.body.loggedAt).toISOString()).toBe('2026-09-26T05:00:00.000Z');
    expect(res.body.lateMinutes).toBe(150); // 07:00-08:00 ended 2.5h before 10:30
  });

  test('input is validated', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    expect((await log(agent, '2026-09-26', 9, { energy: 6 })).status).toBe(400);
    expect((await log(agent, '2026-09-26', 9, { alignment: 'maybe' })).status).toBe(400);
    expect((await log(agent, '2026-09-26', 24)).status).toBe(400);
    expect((await log(agent, '26-09-2026', 9)).status).toBe(400);
    expect((await log(agent, '2026-09-26', 9, { activity: '' })).status).toBe(400);
    expect((await log(agent, '2026-09-26', 9, { stopDoingItem: '64b7f0000000000000000000' })).status).toBe(400);
  });
});

describe('time logging: late window, future hours and timezone', () => {
  test('future hours and the hour in progress cannot be logged', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    expect((await log(agent, '2026-09-26', 10)).status).toBe(403); // in progress
    expect((await log(agent, '2026-09-26', 15)).status).toBe(403);
    expect((await log(agent, '2026-09-27', 1)).status).toBe(403);
  });

  test('an hour can be logged right after it ends', async () => {
    setIST('2026-09-26T11:00');
    const agent = await loggedInAgent();
    expect((await log(agent, '2026-09-26', 10)).status).toBe(201);
  });

  test('late-logging window closes exactly LOG_WINDOW_HOURS after the hour ends', async () => {
    const agent = await loggedInAgent();
    // Hour 08:00-09:00 on the 26th ends 09:00; window closes 21:00 IST.
    setIST('2026-09-26T20:59');
    let day = (await agent.get('/api/days/2026-09-26')).body;
    expect(day.hours[8].status).toBe('open');

    setIST('2026-09-26T21:00');
    day = (await agent.get('/api/days/2026-09-26')).body;
    expect(day.hours[8].status).toBe('unaccounted');
    const res = await log(agent, '2026-09-26', 8);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/window/);

    // Still unaccounted forever after.
    setIST('2026-12-01T09:00');
    day = (await agent.get('/api/days/2026-09-26')).body;
    expect(day.hours[8].status).toBe('unaccounted');
    expect((await log(agent, '2026-09-26', 8)).status).toBe(403);
  });

  test('day grid reports statuses and summary', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    await log(agent, '2026-09-26', 9);
    await log(agent, '2026-09-26', 8, { alignment: 'against', energy: 2 });
    const day = (await agent.get('/api/days/2026-09-26')).body;
    expect(day.hours).toHaveLength(24);
    expect(day.hours[9].status).toBe('logged');
    expect(day.hours[10].status).toBe('future');
    expect(day.hours[0].status).toBe('open'); // ended 01:00, window until 13:00
    expect(day.summary).toMatchObject({ logged: 2, unaccounted: 0, open: 8, future: 14, alignmentPct: 50, avgEnergy: 3 });
  });

  test('day boundaries use Asia/Kolkata, not UTC', async () => {
    // 19:00 UTC on the 26th is 00:30 IST on the 27th.
    setIST('2026-09-27T00:30');
    const agent = await loggedInAgent();
    const meta = (await agent.get('/api/meta/now')).body;
    expect(meta.today).toBe('2026-09-27');
    expect(meta.hour).toBe(0);
    expect(meta.tz).toBe('Asia/Kolkata');

    // 23:00-24:00 IST on the 26th has ended; it belongs to the 26th.
    const res = await log(agent, '2026-09-26', 23);
    expect(res.status).toBe(201);
    expect(res.body.startsAt).toBe('2026-09-26T17:30:00.000Z');
    // 00:00 on the 27th is still in progress.
    expect((await log(agent, '2026-09-27', 0)).status).toBe(403);
  });

  test('open hours include yesterday while its window is still open', async () => {
    setIST('2026-09-27T09:30');
    const agent = await loggedInAgent();
    const open = (await agent.get('/api/days/open')).body;
    const keys = open.map((h) => `${h.date}#${h.hour}`);
    // Yesterday 21:00-22:00 ended 22:00, closes 10:00 today → still open.
    expect(keys).toContain('2026-09-26#21');
    // Yesterday 20:00-21:00 closed at 09:00 today.
    expect(keys).not.toContain('2026-09-26#20');
    expect(keys).toContain('2026-09-27#8');
    expect(keys).not.toContain('2026-09-27#9');
  });
});
