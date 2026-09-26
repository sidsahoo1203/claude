const { startDb, stopDb, resetDb, setIST, loggedInAgent, categoryId } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

describe('export', () => {
  test('JSON export contains everything, but never a sealed letter body', async () => {
    setIST('2026-09-26T21:00');
    const agent = await loggedInAgent();
    const deep = await categoryId(agent);
    await agent.post('/api/blocks').send({ date: '2026-09-26', hour: 9, activity: 'Write', category: deep, energy: 4, alignment: 'toward' });
    await agent.post('/api/goals').send({ kind: 'goal', text: 'Ship' });
    await agent.post('/api/letters').send({ title: 'Soon', body: 'OPENS-TOMORROW', unlockDate: '2026-09-27' });
    await agent.post('/api/letters').send({ title: 'Later', body: 'SEALED-SECRET', unlockDate: '2027-09-26' });

    let res = await agent.get('/api/export/json');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="hourglass-export-2026-09-26.json"/);
    expect(res.text).not.toContain('SEALED-SECRET');
    expect(res.text).not.toContain('OPENS-TOMORROW');
    const data = JSON.parse(res.text);
    expect(data.counts).toMatchObject({ categories: 7, timeBlocks: 1, goalEntries: 1, letters: 2 });
    expect(data.letters.every((l) => l.sealed)).toBe(true);

    setIST('2026-09-27T00:00');
    res = await agent.get('/api/export/json');
    expect(res.text).toContain('OPENS-TOMORROW');
    expect(res.text).not.toContain('SEALED-SECRET');
  });

  test('CSV export of time logs, safe against spreadsheet formulas', async () => {
    setIST('2026-09-26T21:00');
    const agent = await loggedInAgent();
    const deep = await categoryId(agent);
    const { body } = await agent
      .post('/api/blocks')
      .send({ date: '2026-09-26', hour: 9, activity: '=HYPERLINK("x")', category: deep, energy: 4, alignment: 'toward' });
    await agent.post(`/api/blocks/${body._id}/notes`).send({ text: 'said "hi", then left' });
    const res = await agent.get('/api/export/blocks.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('date,hour,start,end,activity,category,energy,alignment,stop_doing_relapse,logged_at,late_minutes,notes');
    expect(lines[1]).toContain('"2026-09-26","9","2026-09-26T09:00:00+05:30","2026-09-26T10:00:00+05:30"');
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[1]).toContain('"Deep work"');
    expect(lines[1]).toContain('said ""hi"", then left');
    expect(lines[1]).toContain('"660"'); // logged 11h after the hour ended
  });

  test('export requires login', async () => {
    const request = require('supertest');
    const res = await request(require('../src/app').createApp()).get('/api/export/json');
    expect(res.status).toBe(401);
  });
});
