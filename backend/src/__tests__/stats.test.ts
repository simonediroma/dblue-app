import request from 'supertest';
import { createApp } from '../app';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser, authCookie } from './helpers';
import { WorkingStatus } from '../models/working-status.model';

const app = createApp();

const THIS_MONTH = new Date().toISOString().slice(0, 7);
const THIS_YEAR = new Date().getFullYear().toString();

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('GET /stats/monthly', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/stats/monthly?month=${THIS_MONTH}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 without ?month', async () => {
    const user = await createUser();
    const res = await request(app)
      .get('/stats/monthly')
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(400);
  });

  it('returns 200 for valid month', async () => {
    const user = await createUser();
    const res = await request(app)
      .get(`/stats/monthly?month=${THIS_MONTH}`)
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(200);
  });

  it('only counts confirmed statuses in the distribution and presence days', async () => {
    const user = await createUser();
    const today = new Date().toISOString().slice(0, 10);

    await WorkingStatus.create([
      { userId: user._id, date: today, status: 'leave', isConfirmed: false },
      { userId: user._id, date: `${THIS_MONTH}-02`, status: 'leave', isConfirmed: true },
      { userId: user._id, date: `${THIS_MONTH}-03`, status: 'in_office', isConfirmed: false },
      { userId: user._id, date: `${THIS_MONTH}-04`, status: 'in_office', isConfirmed: true },
    ]);

    const res = await request(app)
      .get(`/stats/monthly?month=${THIS_MONTH}`)
      .set('Cookie', authCookie(String(user._id)));

    expect(res.status).toBe(200);
    expect(res.body.presenceDaysConfirmed).toBe(1);
    expect(res.body.distribution.inOffice).toBe(1);
    expect(res.body.distribution.leave).toBe(1);
  });
});

describe('GET /stats/annual', () => {
  it('returns 400 without ?year', async () => {
    const user = await createUser();
    const res = await request(app)
      .get('/stats/annual')
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(400);
  });

  it('returns 200 for any authenticated user', async () => {
    const user = await createUser({ role: 'employee' });
    const res = await request(app)
      .get(`/stats/annual?year=${THIS_YEAR}`)
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(200);
  });
});

describe('GET /stats/area', () => {
  it('returns 403 for employee', async () => {
    const user = await createUser({ role: 'employee' });
    const res = await request(app)
      .get(`/stats/area?month=${THIS_MONTH}`)
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(403);
  });

  it('returns 200 for director', async () => {
    const director = await createUser({ role: 'director' });
    const res = await request(app)
      .get(`/stats/area?month=${THIS_MONTH}`)
      .set('Cookie', authCookie(String(director._id)));
    expect(res.status).toBe(200);
  });
});
