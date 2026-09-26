const { StopDoingItem } = require('../src/models');
const { startDb, stopDb, resetDb, setIST, loggedInAgent, categoryId } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

describe('stop doing list', () => {
  test('items can be added and resolved but never deleted or edited', async () => {
    const agent = await loggedInAgent();
    const { body } = await agent.post('/api/stop-doing').send({ title: 'Doomscrolling' });
    expect((await agent.delete(`/api/stop-doing/${body._id}`)).status).toBe(405);
    expect((await agent.patch(`/api/stop-doing/${body._id}`).send({ title: 'x' })).status).toBe(405);
    await expect(StopDoingItem.deleteOne({ _id: body._id })).rejects.toThrow(/permanent/);
    await expect(StopDoingItem.updateOne({ _id: body._id, status: 'active' }, { title: 'x' })).rejects.toThrow(/locked/);

    expect((await agent.post(`/api/stop-doing/${body._id}/resolve`)).status).toBe(200);
    expect((await agent.post(`/api/stop-doing/${body._id}/resolve`)).status).toBe(409);
  });

  test('resolving is one-way at the model layer', async () => {
    const agent = await loggedInAgent();
    const { body } = await agent.post('/api/stop-doing').send({ title: 'Snoozing' });
    await agent.post(`/api/stop-doing/${body._id}/resolve`);
    await expect(StopDoingItem.updateOne({ _id: body._id }, { $set: { status: 'active' } })).rejects.toThrow(/permanent/);
    await expect(StopDoingItem.updateOne({ _id: body._id }, { $set: { resolvedAt: new Date() } })).rejects.toThrow(/active items/);
    const doc = await StopDoingItem.findById(body._id);
    doc.status = 'active';
    await expect(doc.save()).rejects.toThrow(/permanent/);
    doc.status = 'resolved';
    doc.resolvedAt = new Date(0);
    await expect(doc.save()).rejects.toThrow(/permanent/);
  });

  test('linked blocks count as relapses, with a timeline', async () => {
    setIST('2026-09-26T09:30');
    const agent = await loggedInAgent();
    const item = (await agent.post('/api/stop-doing').send({ title: 'Doomscrolling' })).body;
    const ent = await categoryId(agent, 'Entertainment');
    const blk = (hour) =>
      agent.post('/api/blocks').send({
        date: '2026-09-26', hour, activity: 'Reels', category: ent, energy: 1, alignment: 'against', stopDoingItem: item._id,
      });
    await blk(7);
    await blk(8);
    await agent.post(`/api/stop-doing/${item._id}/resolve`); // resolved at 09:30
    // Relapse after resolving is still allowed and flagged. 10:00-11:00 started after 09:30.
    setIST('2026-09-26T11:05');
    expect((await blk(10)).status).toBe(201);

    const list = (await agent.get('/api/stop-doing')).body;
    expect(list[0].relapses).toBe(3);
    const detail = (await agent.get(`/api/stop-doing/${item._id}`)).body;
    expect(detail.timeline.map((b) => b.hour)).toEqual([10, 8, 7]);
    expect(detail.timeline.map((b) => b.afterResolved)).toEqual([true, false, false]);
  });
});
