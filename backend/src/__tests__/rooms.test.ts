import request from 'supertest';
import { createApp } from '../app';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser, authCookie } from './helpers';

const app = createApp();

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('GET /rooms', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/rooms');
    expect(res.status).toBe(401);
  });

  it('returns array for employee', async () => {
    const user = await createUser({ role: 'employee' });
    const res = await request(app)
      .get('/rooms')
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /rooms', () => {
  it('returns 403 for employee', async () => {
    const user = await createUser({ role: 'employee' });
    const res = await request(app)
      .post('/rooms')
      .set('Cookie', authCookie(String(user._id)))
      .send({ name: 'New Room', capacity: 10, type: 'open_space' });
    expect(res.status).toBe(403);
  });

  it('creates room as owner', async () => {
    const owner = await createUser({ role: 'owner' });
    const res = await request(app)
      .post('/rooms')
      .set('Cookie', authCookie(String(owner._id)))
      .send({ name: 'New Room', capacity: 10, type: 'open_space' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Room');
  });
});
