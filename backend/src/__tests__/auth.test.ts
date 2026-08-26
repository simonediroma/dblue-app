import request from 'supertest';
import { createApp } from '../app';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser, authCookie } from './helpers';
import { User } from '../models/user.model';

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

// Flag dblue-office non mockato in questo file (nessun documento Setting seedato =
// disattivato di default, come a runtime) — l'idoneità al sign-up ricade quindi sulla
// whitelist locale @dblue.it, stesso gate già usato da Google OAuth in questa modalità.
describe('POST /auth/signup-check', () => {
  it('returns ok for an eligible, not-yet-registered @dblue.it email', async () => {
    const res = await request(app).post('/auth/signup-check').send({ email: 'new.person@dblue.it' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 403 for an email outside the @dblue.it whitelist', async () => {
    const res = await request(app).post('/auth/signup-check').send({ email: 'someone@gmail.com' });
    expect(res.status).toBe(403);
  });

  it('returns 409 when an account with a password already exists for that email', async () => {
    await createUser({ email: 'already.registered@dblue.it' }).then((u) =>
      User.findByIdAndUpdate(u._id, { passwordHash: 'irrelevant-hash' })
    );

    const res = await request(app).post('/auth/signup-check').send({ email: 'already.registered@dblue.it' });
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/signup', () => {
  it('creates an account, sets the auth cookie, and the new session can call /auth/me', async () => {
    const agent = request.agent(app);
    const signupRes = await agent
      .post('/auth/signup')
      .send({ email: 'fresh.signup@dblue.it', password: 'a-strong-password' });
    expect(signupRes.status).toBe(200);

    const meRes = await agent.get('/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('fresh.signup@dblue.it');
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app).post('/auth/signup').send({ email: 'short.pass@dblue.it', password: '1234567' });
    expect(res.status).toBe(400);
  });

  it('rejects an email outside the @dblue.it whitelist', async () => {
    const res = await request(app).post('/auth/signup').send({ email: 'outsider@gmail.com', password: 'a-strong-password' });
    expect(res.status).toBe(403);
  });

  it('rejects signing up twice for the same email', async () => {
    await request(app).post('/auth/signup').send({ email: 'double.signup@dblue.it', password: 'a-strong-password' });

    const res = await request(app).post('/auth/signup').send({ email: 'double.signup@dblue.it', password: 'another-password' });
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('logs in with the right credentials and the session can call /auth/me', async () => {
    await request(app).post('/auth/signup').send({ email: 'login.me@dblue.it', password: 'a-strong-password' });

    const agent = request.agent(app);
    const loginRes = await agent.post('/auth/login').send({ email: 'login.me@dblue.it', password: 'a-strong-password' });
    expect(loginRes.status).toBe(200);

    const meRes = await agent.get('/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('login.me@dblue.it');
  });

  it('rejects the wrong password', async () => {
    await request(app).post('/auth/signup').send({ email: 'wrong.pass@dblue.it', password: 'a-strong-password' });

    const res = await request(app).post('/auth/login').send({ email: 'wrong.pass@dblue.it', password: 'not-the-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an email with no password account', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'never.signed.up@dblue.it', password: 'whatever' });
    expect(res.status).toBe(401);
  });
});
