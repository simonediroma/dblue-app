import request from 'supertest';
import { createApp } from '../app';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser, authCookie } from './helpers';

const app = createApp();

const TODAY = new Date().toISOString().slice(0, 10);
const THIS_MONTH = TODAY.slice(0, 7);
const PAST_DATE = '2020-01-15';

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('GET /presence', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/presence');
    expect(res.status).toBe(401);
  });

  it('returns 400 without ?month', async () => {
    const user = await createUser();
    const res = await request(app)
      .get('/presence')
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(400);
  });

  it('returns 200 array for valid ?month', async () => {
    const user = await createUser();
    const res = await request(app)
      .get(`/presence?month=${THIS_MONTH}`)
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /presence', () => {
  it('returns 200 with status remote', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/presence')
      .set('Cookie', authCookie(String(user._id)))
      .send({ date: TODAY, status: 'remote' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('remote');
  });
});

describe('POST /presence/bulk', () => {
  it('returns 200 array with length 2', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/presence/bulk')
      .set('Cookie', authCookie(String(user._id)))
      .send({
        updates: [
          { date: TODAY, status: 'remote' },
          { date: PAST_DATE, status: 'leave' },
        ],
      });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });
});

describe('POST /presence/:date/checkin', () => {
  it('returns 200 with isConfirmed true for today after setting status', async () => {
    const user = await createUser();
    const cookie = authCookie(String(user._id));
    await request(app)
      .post('/presence')
      .set('Cookie', cookie)
      .send({ date: TODAY, status: 'remote' });
    const res = await request(app)
      .post(`/presence/${TODAY}/checkin`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.isConfirmed).toBe(true);
  });

  it('returns 400 for past date', async () => {
    const user = await createUser();
    const res = await request(app)
      .post(`/presence/${PAST_DATE}/checkin`)
      .set('Cookie', authCookie(String(user._id)));
    expect(res.status).toBe(400);
  });
});
