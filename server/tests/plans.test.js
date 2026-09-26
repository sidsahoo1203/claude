const { PlanEntry } = require('../src/models');
const { startDb, stopDb, resetDb, setIST, loggedInAgent, categoryId } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

const plan = (agent, body) => agent.post('/api/plans').send(body);

describe('plan vs actual', () => {
  test('only today and tomorrow can be planned', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    const category = await categoryId(agent);
    expect((await plan(agent, { date: '2026-09-26', hour: 14, activity: 'Write', category })).status).toBe(201);
    expect((await plan(agent, { date: '2026-09-27', hour: 9, activity: 'Write', category })).status).toBe(201);
    expect((await plan(agent, { date: '2026-09-28', hour: 9, activity: 'Write', category })).status).toBe(403);
    expect((await plan(agent, { date: '2026-09-25', hour: 22, activity: 'Write', category })).status).toBe(403);
  });

  test('a planned hour locks once that hour starts', async () => {
    const agent = await loggedInAgent();
    const category = await categoryId(agent);
    setIST('2026-09-26T13:59');
    expect((await plan(agent, { date: '2026-09-26', hour: 14, activity: 'Write', category })).status).toBe(201);
    setIST('2026-09-26T14:00');
    const res = await plan(agent, { date: '2026-09-26', hour: 14, activity: 'Something else', category });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/locked/);
    expect((await plan(agent, { date: '2026-09-26', hour: 14, cleared: true })).status).toBe(403);
    const view = (await agent.get('/api/plans/2026-09-26')).body;
    expect(view.hours[14].locked).toBe(true);
    expect(view.hours[14].plan.activity).toBe('Write');
  });

  test('re-planning appends revisions; the latest wins and history is kept', async () => {
    setIST('2026-09-26T08:00');
    const agent = await loggedInAgent();
    const deep = await categoryId(agent, 'Deep work');
    const study = await categoryId(agent, 'Study');
    await plan(agent, { date: '2026-09-26', hour: 10, activity: 'Write', category: deep });
    await plan(agent, { date: '2026-09-26', hour: 10, activity: 'Read', category: study });
    await plan(agent, { date: '2026-09-26', hour: 11, activity: 'Gym', category: deep });
    await plan(agent, { date: '2026-09-26', hour: 11, cleared: true });

    const view = (await agent.get('/api/plans/2026-09-26')).body;
    expect(view.hours[10].plan.activity).toBe('Read');
    expect(view.hours[10].revisions.map((r) => r.activity)).toEqual(['Write', 'Read']);
    expect(view.hours[11].plan).toBeNull();
    expect(view.hours[11].revisions).toHaveLength(2);
    expect(await PlanEntry.countDocuments()).toBe(4);
  });

  test('plans cannot be edited or deleted', async () => {
    setIST('2026-09-26T08:00');
    const agent = await loggedInAgent();
    const { body } = await plan(agent, { date: '2026-09-26', hour: 10, activity: 'Write', category: await categoryId(agent) });
    expect((await agent.put(`/api/plans/${body._id}`).send({})).status).toBe(405);
    expect((await agent.delete(`/api/plans/${body._id}`)).status).toBe(405);
    await expect(PlanEntry.updateOne({ _id: body._id }, { activity: 'x' })).rejects.toThrow(/locked/);
    await expect(PlanEntry.deleteMany({})).rejects.toThrow(/permanent/);
  });

  test('bulk planning validates every hour before inserting any', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    const category = await categoryId(agent);
    const bad = await agent.post('/api/plans/bulk').send({ date: '2026-09-26', hours: [12, 13, 10], activity: 'Write', category });
    expect(bad.status).toBe(403);
    expect(await PlanEntry.countDocuments()).toBe(0);
    const ok = await agent.post('/api/plans/bulk').send({ date: '2026-09-26', hours: [12, 13, 14], activity: 'Write', category });
    expect(ok.body.created).toBe(3);
  });

  test('archived categories cannot be planned', async () => {
    setIST('2026-09-26T08:00');
    const agent = await loggedInAgent();
    const id = await categoryId(agent, 'Social');
    await agent.post(`/api/categories/${id}/archive`);
    expect((await plan(agent, { date: '2026-09-26', hour: 12, category: id })).status).toBe(400);
  });

  test('adherence compares actual category with the plan, counting unaccounted as a miss', async () => {
    const agent = await loggedInAgent();
    const deep = await categoryId(agent, 'Deep work');
    const ent = await categoryId(agent, 'Entertainment');
    setIST('2026-09-26T05:30');
    await agent.post('/api/plans/bulk').send({ date: '2026-09-26', hours: [6, 7, 8, 9, 20], activity: 'Write', category: deep });

    setIST('2026-09-26T10:05');
    const blk = (hour, category) =>
      agent.post('/api/blocks').send({ date: '2026-09-26', hour, activity: 'x', category, energy: 3, alignment: 'neutral' });
    await blk(7, deep); // hit
    await blk(8, ent); // miss
    // 6 is open (not decided), 9 is open, 20 is future
    let day = (await agent.get('/api/days/2026-09-26')).body;
    expect(day.hours[7].adherence).toBe('hit');
    expect(day.hours[8].adherence).toBe('miss');
    expect(day.hours[6].adherence).toBeNull();
    expect(day.summary).toMatchObject({ planned: 5, planDecided: 2, planHits: 1, adherencePct: 50 });

    setIST('2026-09-26T19:30'); // hour 6 window closed at 19:00 -> unaccounted -> miss
    day = (await agent.get('/api/days/2026-09-26')).body;
    expect(day.hours[6].status).toBe('unaccounted');
    expect(day.hours[6].adherence).toBe('miss');
    expect(day.summary.adherencePct).toBe(33);
  });
});
