import request from 'supertest';
import { createApp } from '../app';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser, authCookie } from './helpers';

const app = createApp();

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('GET /auth/me', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user when authenticated', async () => {
    const user = await createUser();
    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });
});

describe('POST /auth/logout', () => {
  it('returns 200', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
  });
});
