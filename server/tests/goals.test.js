const { GoalEntry } = require('../src/models');
const { startDb, stopDb, resetDb, setIST, loggedInAgent } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

describe('goal & contribution statement', () => {
  test('append-only: latest is current, earlier versions stay in history', async () => {
    const agent = await loggedInAgent();
    setIST('2026-09-01T09:00');
    await agent.post('/api/goals').send({ kind: 'goal', text: 'Ship v1' });
    setIST('2026-09-10T09:00');
    await agent.post('/api/goals').send({ kind: 'goal', text: 'Ship v1 and get 10 users' });
    await agent.post('/api/goals').send({ kind: 'contribution', text: 'Because it helps people stay honest' });

    const res = (await agent.get('/api/goals')).body;
    expect(res.goal.text).toBe('Ship v1 and get 10 users');
    expect(res.contribution.text).toBe('Because it helps people stay honest');
    expect(res.history.goal.map((g) => g.text)).toEqual(['Ship v1 and get 10 users', 'Ship v1']);
    expect(new Date(res.history.goal[1].createdAt).toISOString()).toBe('2026-09-01T03:30:00.000Z');

    const dash = (await agent.get('/api/dashboard')).body;
    expect(dash.goal.text).toBe('Ship v1 and get 10 users');
  });

  test('goals cannot be edited or deleted', async () => {
    const agent = await loggedInAgent();
    const { body } = await agent.post('/api/goals').send({ kind: 'goal', text: 'Original' });
    expect((await agent.put(`/api/goals/${body._id}`).send({ text: 'x' })).status).toBe(405);
    expect((await agent.delete(`/api/goals/${body._id}`)).status).toBe(405);
    await expect(GoalEntry.updateOne({ _id: body._id }, { text: 'x' })).rejects.toThrow(/locked/);
    await expect(GoalEntry.deleteOne({ _id: body._id })).rejects.toThrow(/permanent/);
    expect((await agent.post('/api/goals').send({ kind: 'mission', text: 'x' })).status).toBe(400);
  });
});
