const { startDb, stopDb, resetDb, setIST, loggedInAgent, categoryId } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

describe('weekly review', () => {
  test('aggregates hours, alignment, adherence, energy, relapses and reflections for Mon–Sun', async () => {
    const agent = await loggedInAgent();
    const deep = await categoryId(agent, 'Deep work');
    const ent = await categoryId(agent, 'Entertainment');
    const item = (await agent.post('/api/stop-doing').send({ title: 'Reels' })).body;

    // Week of Mon 21 – Sun 27 Sep 2026.
    setIST('2026-09-22T08:00');
    await agent.post('/api/plans/bulk').send({ date: '2026-09-22', hours: [9, 10], activity: 'Write', category: deep });
    setIST('2026-09-22T12:00');
    const blk = (date, hour, category, alignment, energy, extra = {}) =>
      agent.post('/api/blocks').send({ date, hour, activity: 'x', category, energy, alignment, ...extra });
    await blk('2026-09-22', 9, deep, 'toward', 5); // plan hit
    await blk('2026-09-22', 10, ent, 'against', 1, { stopDoingItem: item._id }); // plan miss + relapse
    await blk('2026-09-22', 11, deep, 'toward', 3);
    await agent.post('/api/reflections').send({ date: '2026-09-22', wentWell: 'a', didntGoWell: 'b', changeTomorrow: 'c' });
    // Outside the week: Sunday 20th must not count.
    setIST('2026-09-21T01:00');
    await blk('2026-09-20', 23, ent, 'against', 1, { stopDoingItem: item._id });

    setIST('2026-09-23T10:00');
    const res = await agent.get('/api/reviews/week?start=2026-09-24'); // any day → normalised to Monday
    expect(res.status).toBe(200);
    const w = res.body;
    expect(w.start).toBe('2026-09-21');
    expect(w.end).toBe('2026-09-27');
    expect(w.totals).toMatchObject({
      logged: 3,
      alignmentPct: 67,
      adherencePct: 50,
      planHits: 1,
      planDecided: 2,
      avgEnergy: 3,
      relapses: 1,
      reflections: 1,
    });
    expect(w.categories.map((c) => [c.name, c.hours])).toEqual([['Deep work', 2], ['Entertainment', 1]]);
    expect(w.relapses[0]).toMatchObject({ count: 1, item: { title: 'Reels' } });
    expect(w.reflections.map((r) => r.date)).toEqual(['2026-09-22']);
    expect(w.days).toHaveLength(7);
    expect(w.days.find((d) => d.date === '2026-09-24').state).toBe('future');
    // Tracking started on the 20th, so Monday the 21st (nothing logged, window closed) is 24 unaccounted.
    expect(w.days[0]).toMatchObject({ date: '2026-09-21', unaccounted: 24 });
  });
});
