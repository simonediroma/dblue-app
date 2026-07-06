import request from 'supertest';
import { createApp } from '../app';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser, authCookie, createRoom } from './helpers';

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
      .send({ name: 'New Room', capacity: 10, type: 'open_space', color: '#3b82f6' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Room');
    expect(res.body.color).toBe('#3b82f6');
  });
});

describe('PATCH /rooms/:id', () => {
  it('returns 403 for employee', async () => {
    const owner = await createUser({ role: 'owner' });
    const employee = await createUser({ role: 'employee' });
    const room = await createRoom(owner._id);
    const res = await request(app)
      .patch(`/rooms/${room._id}`)
      .set('Cookie', authCookie(String(employee._id)))
      .send({ capacity: 4 });
    expect(res.status).toBe(403);
  });

  it('updates capacity and color as owner', async () => {
    const owner = await createUser({ role: 'owner' });
    const room = await createRoom(owner._id, { capacity: 20 });
    const res = await request(app)
      .patch(`/rooms/${room._id}`)
      .set('Cookie', authCookie(String(owner._id)))
      .send({ capacity: 4, color: '#ef4444' });
    expect(res.status).toBe(200);
    expect(res.body.capacity).toBe(4);
    expect(res.body.color).toBe('#ef4444');
  });
});
