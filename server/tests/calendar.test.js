const { startDb, stopDb, resetDb, setIST, loggedInAgent, categoryId } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

async function logDay(agent, date, hours, category, alignment = 'toward') {
  for (const hour of hours) {
    const res = await agent.post('/api/blocks').send({ date, hour, activity: 'x', category, energy: 3, alignment });
    if (res.status !== 201) throw new Error(`${date} ${hour}: ${res.body.error}`);
  }
}

const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

describe('calendar & streaks', () => {
  test('calendar shows hours, dominant category, alignment and unaccounted per day', async () => {
    const agent = await loggedInAgent();
    const deep = await categoryId(agent, 'Deep work');
    const sleep = await categoryId(agent, 'Sleep');
    // Log all of the 24th in time, and part of the 25th.
    setIST('2026-09-25T00:30');
    await logDay(agent, '2026-09-24', range(12, 16), deep);
    await logDay(agent, '2026-09-24', range(16, 24), sleep, 'neutral');
    setIST('2026-09-24T12:05');
    // (earlier hours of the 24th were logged at 12:05 on the 24th)
    await logDay(agent, '2026-09-24', range(0, 12), sleep, 'neutral');
    setIST('2026-09-25T20:00');
    await logDay(agent, '2026-09-25', range(10, 14), deep);

    setIST('2026-09-26T10:30');
    const cal = (await agent.get('/api/calendar?month=2026-09')).body;
    const d = (date) => cal.days.find((x) => x.date === date);
    expect(cal.firstDate).toBe('2026-09-24');
    expect(d('2026-09-23').state).toBe('untracked');
    expect(d('2026-09-24')).toMatchObject({ logged: 24, unaccounted: 0, alignmentPct: 17 });
    expect(d('2026-09-24').dominant.name).toBe('Sleep');
    // 25th: 4 logged; 22:00 and 23:00 are still inside their 12h window at 10:30 on the 26th.
    expect(d('2026-09-25')).toMatchObject({ logged: 4, unaccounted: 18, alignmentPct: 100 });
    expect(d('2026-09-25').dominant.name).toBe('Deep work');
    // Today at 10:30: hours 0-9 are still open (window 12h), none unaccounted yet.
    expect(d('2026-09-26')).toMatchObject({ state: 'today', logged: 0, unaccounted: 0 });
    expect(d('2026-09-27').state).toBe('future');
  });

  test('streak counts consecutive days with no unaccounted hours', async () => {
    const agent = await loggedInAgent();
    const deep = await categoryId(agent, 'Deep work');
    for (const date of ['2026-09-22', '2026-09-23', '2026-09-24']) {
      setIST(`${date}T12:30`);
      await logDay(agent, date, range(0, 12), deep);
      setIST(`${date}T23:59`);
      await logDay(agent, date, range(12, 23), deep);
      setIST(`${date.slice(0, 8)}${String(Number(date.slice(8)) + 1).padStart(2, '0')}T00:10`);
      await logDay(agent, date, [23], deep);
    }
    // 25th: only one hour logged -> unaccounted hours break the streak.
    setIST('2026-09-25T12:00');
    await logDay(agent, '2026-09-25', [5], deep);
    setIST('2026-09-26T00:30');
    await logDay(agent, '2026-09-25', range(12, 24), deep);

    // 10:00 on the 26th: nothing unaccounted today yet, so today alone is a 1-day streak
    // (the 25th had unaccounted hours, so the run can't reach back further).
    setIST('2026-09-26T10:00');
    let dash = (await agent.get('/api/dashboard')).body;
    expect(dash.streak.longest).toBe(3);
    expect(dash.streak.current).toBe(1);

    // 13:30 without logging: 00:00-01:00 closed at 13:00 → today breaks, streak 0.
    setIST('2026-09-26T13:30');
    dash = (await agent.get('/api/dashboard')).body;
    expect(dash.streak.current).toBe(0);

    // Had today's hours been logged in time, the streak holds.
    setIST('2026-09-26T10:00');
    await logDay(agent, '2026-09-26', range(0, 10), deep);
    setIST('2026-09-26T13:30');
    dash = (await agent.get('/api/dashboard')).body;
    expect(dash.streak.current).toBe(1);
    expect(dash.streak.current).toBe(1);
    expect(dash.today).toMatchObject({ logged: 10, unaccounted: 0, alignmentPct: 100 });
  });
});
