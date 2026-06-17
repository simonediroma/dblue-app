import request from 'supertest';
import { createApp } from '../app';
import { connect, disconnect, clearDatabase } from './setup';

const app = createApp();

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('GET /health', () => {
  it('returns 200 with status ok and timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });
});
