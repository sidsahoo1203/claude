const { Category } = require('../src/models');
const { startDb, stopDb, resetDb, setIST, loggedInAgent, categoryId } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

describe('categories', () => {
  test('defaults are seeded on first run', async () => {
    const agent = await loggedInAgent();
    const names = (await agent.get('/api/categories')).body.map((c) => c.name);
    expect(names).toEqual(['Deep work', 'Study', 'Exercise', 'Sleep', 'Social', 'Entertainment', 'Chores']);
  });

  test('create validates colour and rejects duplicate names (case-insensitive)', async () => {
    const agent = await loggedInAgent();
    expect((await agent.post('/api/categories').send({ name: 'Reading', color: 'red' })).status).toBe(400);
    expect((await agent.post('/api/categories').send({ name: 'Reading', color: '#aa3300' })).status).toBe(201);
    expect((await agent.post('/api/categories').send({ name: 'reading', color: '#aa3300' })).status).toBe(409);
  });

  test('categories cannot be edited or deleted through the API', async () => {
    const agent = await loggedInAgent();
    const id = await categoryId(agent);
    expect((await agent.delete(`/api/categories/${id}`)).status).toBe(405);
    expect((await agent.put(`/api/categories/${id}`).send({ name: 'x' })).status).toBe(405);
    expect((await agent.patch(`/api/categories/${id}`).send({ color: '#000000' })).status).toBe(405);
  });

  test('categories cannot be deleted or renamed at the model layer', async () => {
    const cat = await Category.findOne({ name: 'Study' });
    await expect(Category.deleteOne({ _id: cat._id })).rejects.toThrow(/permanent/);
    await expect(Category.findByIdAndDelete(cat._id)).rejects.toThrow(/permanent/);
    await expect(cat.deleteOne()).rejects.toThrow(/permanent/);
    await expect(Category.updateOne({ _id: cat._id }, { $set: { color: '#000000' } })).rejects.toThrow(/locked/);
    await expect(Category.updateOne({ _id: cat._id }, { name: 'Other' })).rejects.toThrow(/locked/);
    expect(await Category.countDocuments()).toBe(7);
  });

  test('archived categories are hidden from new logs but old logs keep them', async () => {
    setIST('2026-09-26T10:30');
    const agent = await loggedInAgent();
    const id = await categoryId(agent, 'Entertainment');
    const logged = await agent
      .post('/api/blocks')
      .send({ date: '2026-09-26', hour: 8, activity: 'Series', category: id, energy: 2, alignment: 'against' });
    expect(logged.status).toBe(201);

    expect((await agent.post(`/api/categories/${id}/archive`)).status).toBe(200);
    const active = (await agent.get('/api/categories')).body.map((c) => c._id);
    expect(active).not.toContain(id);
    const all = (await agent.get('/api/categories?includeArchived=1')).body.map((c) => c._id);
    expect(all).toContain(id);

    const rejected = await agent
      .post('/api/blocks')
      .send({ date: '2026-09-26', hour: 9, activity: 'More', category: id, energy: 2, alignment: 'against' });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toMatch(/Archived/);

    const day = (await agent.get('/api/days/2026-09-26')).body;
    expect(day.hours[8].block.category.name).toBe('Entertainment');
    expect(day.hours[8].block.category.archived).toBe(true);

    expect((await agent.post(`/api/categories/${id}/unarchive`)).status).toBe(200);
    const again = await agent
      .post('/api/blocks')
      .send({ date: '2026-09-26', hour: 9, activity: 'More', category: id, energy: 2, alignment: 'against' });
    expect(again.status).toBe(201);
  });
});
