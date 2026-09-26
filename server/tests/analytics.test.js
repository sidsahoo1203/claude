const { startDb, stopDb, resetDb, setIST, loggedInAgent, categoryId } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

async function log(agent, date, hour, category, extra = {}) {
  const res = await agent
    .post('/api/blocks')
    .send({ date, hour, activity: 'x', category, energy: 3, alignment: 'neutral', ...extra });
  if (res.status !== 201) throw new Error(`${date} ${hour}: ${res.body.error}`);
}

describe('analytics', () => {
  test('hours by category per day / week / month, with empty buckets filled', async () => {
    const agent = await loggedInAgent();
    const deep = await categoryId(agent, 'Deep work');
    const study = await categoryId(agent, 'Study');
    setIST('2026-09-22T12:00');
    await log(agent, '2026-09-22', 9, deep);
    await log(agent, '2026-09-22', 10, deep);
    await log(agent, '2026-09-22', 11, study);
    setIST('2026-09-29T12:00');
    await log(agent, '2026-09-29', 9, deep);

    const week = (await agent.get('/api/analytics/categories?period=week&from=2026-09-14&to=2026-10-04')).body;
    expect(week.buckets).toEqual(['2026-09-14', '2026-09-21', '2026-09-28']);
    const deepSeries = week.series.find((s) => s.category.name === 'Deep work');
    expect(deepSeries.values).toEqual([0, 2, 1]);
    expect(week.series.find((s) => s.category.name === 'Study').values).toEqual([0, 1, 0]);

    const month = (await agent.get('/api/analytics/categories?period=month&from=2026-08-01&to=2026-09-30')).body;
    expect(month.buckets).toEqual(['2026-08', '2026-09']);
    expect(month.series.find((s) => s.category.name === 'Deep work').values).toEqual([0, 3]);

    const day = (await agent.get('/api/analytics/categories?period=day&from=2026-09-21&to=2026-09-23')).body;
    expect(day.series.find((s) => s.category.name === 'Deep work').values).toEqual([0, 2, 0]);
    expect((await agent.get('/api/analytics/categories?period=year')).status).toBe(400);
  });

  test('best hours: average energy by hour of day', async () => {
    setIST('2026-09-23T11:00'); // 23:00 on the 22nd is still inside its 12h window
    const agent = await loggedInAgent();
    const deep = await categoryId(agent);
    await log(agent, '2026-09-22', 23, deep, { energy: 1 });
    await log(agent, '2026-09-23', 9, deep, { energy: 5 });
    await log(agent, '2026-09-23', 10, deep, { energy: 4 });
    setIST('2026-09-24T12:00');
    await log(agent, '2026-09-24', 9, deep, { energy: 4 });
    const e = (await agent.get('/api/analytics/energy-by-hour?from=2026-09-01&to=2026-09-30')).body;
    expect(e.hours).toHaveLength(24);
    expect(e.hours[9]).toEqual({ hour: 9, avgEnergy: 4.5, count: 2 });
    expect(e.hours[23]).toEqual({ hour: 23, avgEnergy: 1, count: 1 });
    expect(e.hours[0]).toEqual({ hour: 0, avgEnergy: null, count: 0 });
  });

  test('sleep pattern groups a night noon→noon across midnight', async () => {
    const agent = await loggedInAgent();
    const sleep = await categoryId(agent, 'Sleep');
    setIST('2026-09-23T00:30');
    await log(agent, '2026-09-22', 23, sleep);
    setIST('2026-09-23T07:30');
    for (const h of [0, 1, 2, 3, 4, 5, 6]) await log(agent, '2026-09-23', h, sleep);
    setIST('2026-09-23T15:00');
    await log(agent, '2026-09-23', 14, sleep); // afternoon nap belongs to the night of the 23rd
    const s = (await agent.get('/api/analytics/sleep?from=2026-09-22&to=2026-09-23')).body;
    expect(s.category.name).toBe('Sleep');
    expect(s.nights[0]).toEqual({ night: '2026-09-22', hours: 8, bedtime: 23, wake: 7, start: 23, end: 31 });
    expect(s.nights[1]).toMatchObject({ night: '2026-09-23', hours: 1, bedtime: 14 });
  });

  test('week vs week by category', async () => {
    const agent = await loggedInAgent();
    const deep = await categoryId(agent, 'Deep work');
    const study = await categoryId(agent, 'Study');
    setIST('2026-09-22T12:00');
    await log(agent, '2026-09-22', 9, deep);
    setIST('2026-09-29T12:00');
    await log(agent, '2026-09-29', 9, deep);
    await log(agent, '2026-09-29', 10, deep);
    await log(agent, '2026-09-29', 11, study);
    const w = (await agent.get('/api/analytics/week-compare')).body;
    expect(w.a).toMatchObject({ start: '2026-09-28', total: 3 });
    expect(w.b).toMatchObject({ start: '2026-09-21', total: 1 });
    expect(w.categories.find((c) => c.name === 'Deep work')).toMatchObject({ a: 2, b: 1, diff: 1 });
    expect(w.categories.find((c) => c.name === 'Study')).toMatchObject({ a: 1, b: 0 });
  });

  test('year heatmap reports hours, alignment and unaccounted per day', async () => {
    const agent = await loggedInAgent();
    const deep = await categoryId(agent);
    setIST('2026-09-22T12:00');
    await log(agent, '2026-09-22', 9, deep, { alignment: 'toward' });
    await log(agent, '2026-09-22', 10, deep);
    setIST('2026-09-24T12:00');
    const h = (await agent.get('/api/analytics/heatmap?year=2026')).body;
    expect(h.days).toHaveLength(365);
    const d = h.days.find((x) => x.date === '2026-09-22');
    expect(d).toMatchObject({ logged: 2, alignmentPct: 50, unaccounted: 22 });
    expect(h.days.find((x) => x.date === '2026-01-01').state).toBe('untracked');
    expect(h.days.find((x) => x.date === '2026-12-31').state).toBe('future');
    // 22nd and 23rd have unaccounted hours; today (24th, 12:00) has none yet, so it counts, as in streaks.
    expect(h.totals).toMatchObject({ logged: 2, trackedDays: 3, fullDays: 1 });
  });
});
