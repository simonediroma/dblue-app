import request from 'supertest';
import { createApp } from '../app';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser, authCookie } from './helpers';

const app = createApp();

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('GET /admin/settings', () => {
  it('returns 403 for director', async () => {
    const director = await createUser({ role: 'director' });
    const res = await request(app)
      .get('/admin/settings')
      .set('Cookie', authCookie(String(director._id)));
    expect(res.status).toBe(403);
  });

  it('defaults dblueOfficeIntegrationEnabled to false for owner', async () => {
    const owner = await createUser({ role: 'owner' });
    const res = await request(app)
      .get('/admin/settings')
      .set('Cookie', authCookie(String(owner._id)));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ dblueOfficeIntegrationEnabled: false });
  });
});

describe('PATCH /admin/settings', () => {
  it('returns 403 for director', async () => {
    const director = await createUser({ role: 'director' });
    const res = await request(app)
      .patch('/admin/settings')
      .set('Cookie', authCookie(String(director._id)))
      .send({ dblueOfficeIntegrationEnabled: true });
    expect(res.status).toBe(403);
  });

  it('returns 400 for a non-boolean value', async () => {
    const owner = await createUser({ role: 'owner' });
    const res = await request(app)
      .patch('/admin/settings')
      .set('Cookie', authCookie(String(owner._id)))
      .send({ dblueOfficeIntegrationEnabled: 'yes' });
    expect(res.status).toBe(400);
  });

  it('toggles the flag as owner and persists it', async () => {
    const owner = await createUser({ role: 'owner' });
    const cookie = authCookie(String(owner._id));

    const onRes = await request(app)
      .patch('/admin/settings')
      .set('Cookie', cookie)
      .send({ dblueOfficeIntegrationEnabled: true });
    expect(onRes.status).toBe(200);
    expect(onRes.body).toEqual({ dblueOfficeIntegrationEnabled: true });

    const getRes = await request(app).get('/admin/settings').set('Cookie', cookie);
    expect(getRes.body).toEqual({ dblueOfficeIntegrationEnabled: true });

    const offRes = await request(app)
      .patch('/admin/settings')
      .set('Cookie', cookie)
      .send({ dblueOfficeIntegrationEnabled: false });
    expect(offRes.body).toEqual({ dblueOfficeIntegrationEnabled: false });
  });
});
