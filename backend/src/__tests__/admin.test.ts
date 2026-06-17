import request from 'supertest';
import { createApp } from '../app';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser, authCookie } from './helpers';

const app = createApp();

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('GET /admin/users', () => {
  it('returns 403 for employee', async () => {
    const user = await createUser({ role: 'employee' });
    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(403);
  });

  it('returns 200 array for director', async () => {
    const director = await createUser({ role: 'director' });
    await createUser({ role: 'employee' });
    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', authCookie(String(director._id)));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('PATCH /admin/users/:userId/role', () => {
  it('returns 403 for director', async () => {
    const director = await createUser({ role: 'director' });
    const employee = await createUser({ role: 'employee' });
    const res = await request(app)
      .patch(`/admin/users/${employee._id}/role`)
      .set('Cookie', authCookie(String(director._id)))
      .send({ role: 'director' });
    expect(res.status).toBe(403);
  });

  it('changes role as owner', async () => {
    const owner = await createUser({ role: 'owner' });
    const employee = await createUser({ role: 'employee' });
    const res = await request(app)
      .patch(`/admin/users/${employee._id}/role`)
      .set('Cookie', authCookie(String(owner._id)))
      .send({ role: 'director' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('director');
  });
});
