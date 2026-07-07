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

  describe('with a fixed system date (2026-07-15)', () => {
    const MONTH = '2026-07';

    beforeEach(() => {
      jest.useFakeTimers({
        doNotFake: [
          'hrtime', 'nextTick', 'performance', 'queueMicrotask',
          'requestAnimationFrame', 'requestIdleCallback',
          'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
          'setTimeout', 'clearTimeout',
        ],
      });
      jest.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('only counts confirmed statuses in the distribution and presence days', async () => {
      const user = await createUser();

      await WorkingStatus.create([
        { userId: user._id, date: '2026-07-15', status: 'leave', isConfirmed: false },
        { userId: user._id, date: '2026-07-14', status: 'leave', isConfirmed: true },
        { userId: user._id, date: '2026-07-13', status: 'in_office', isConfirmed: false },
        { userId: user._id, date: '2026-07-12', status: 'in_office', isConfirmed: true },
      ]);

      const res = await request(app)
        .get(`/stats/monthly?month=${MONTH}`)
        .set('Cookie', authCookie(String(user._id)));

      expect(res.status).toBe(200);
      expect(res.body.presenceDaysConfirmed).toBe(1);
      expect(res.body.distribution.inOffice).toBe(1);
      expect(res.body.distribution.leave).toBe(1);
    });

    it('excludes future-dated statuses even if isConfirmed is (incorrectly) already true', async () => {
      const user = await createUser();

      await WorkingStatus.create([
        // simulates stale/bad data: a future sick day that somehow got isConfirmed:true,
        // even though sick is never manually confirmed and the date hasn't happened yet
        { userId: user._id, date: '2026-07-20', status: 'sick', isConfirmed: true },
        { userId: user._id, date: '2026-07-10', status: 'sick', isConfirmed: true },
      ]);

      const res = await request(app)
        .get(`/stats/monthly?month=${MONTH}`)
        .set('Cookie', authCookie(String(user._id)));

      expect(res.status).toBe(200);
      expect(res.body.distribution.sick).toBe(1);
    });
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
