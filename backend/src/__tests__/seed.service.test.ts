// Automocking dblueOfficeApi.service.ts breaks `instanceof` on its error classes
// (DblueOfficeForbiddenError etc., used by userSync.service.ts internally) — same
// lesson already learned for dblueOfficeCompliance.service.test.ts. Partial mock via
// requireActual: only the two network calls are stubbed, everything else is real.
jest.mock('../services/dblueOfficeApi.service', () => ({
  ...jest.requireActual('../services/dblueOfficeApi.service'),
  getBookingAppSession: jest.fn(),
  getBookingAppUserList: jest.fn(),
}));

import { connect, disconnect, clearDatabase } from './setup';
import { runSeed, startSeedJob, getSeedJobState } from '../services/seed.service';
import { User } from '../models/user.model';
import { Room } from '../models/room.model';
import { WorkingStatus } from '../models/working-status.model';
import { getBookingAppSession, getBookingAppUserList } from '../services/dblueOfficeApi.service';

const mockGetSession = getBookingAppSession as jest.Mock;
const mockGetUserList = getBookingAppUserList as jest.Mock;

const DEV_EMAILS = [
  'dev@dblue.it', 'mario.rossi@dblue.it', 'sara.ferrari@dblue.it',
  'luca.esposito@dblue.it', 'giulia.bianchi@dblue.it', 'marco.conti@dblue.it',
];

const REAL_ROOMS = [
  { id: 'room-1', name: 'Sala Leonardo', category: 'open', color: '#111111', capacity: 3, reserved: 0, isActive: true },
  { id: 'room-2', name: 'Sala Galilei', category: 'open', color: '#222222', capacity: 2, reserved: 0, isActive: true },
  { id: 'room-3', name: 'Sala Disattivata', category: 'open', color: '#333333', capacity: 5, reserved: 0, isActive: false },
];

function sessionFor(email: string, role: 'employee' | 'director' = 'employee') {
  return {
    success: true as const,
    user: {
      dblueOfficeId: `dbl-${email}`,
      name: email,
      email,
      image_url: null,
      mandatory_presence_days: 8,
      booking_app_role: role,
    },
    userSpaceAccess: [],
    userRoomList: [],
    allRooms: REAL_ROOMS,
    roomCategories: [],
    closures: [],
  };
}

const DIRECTORY_USERS = [
  {
    _id: 'dir-1', name: 'Anna Verdi', email: 'anna.verdi@dblue.it', space_access: [],
    role: 'staff', status: true, contract_percentage: 100, mandatory_presence_days: 10,
    image_url: null, booking_app_role: 'employee' as const,
  },
  {
    _id: 'dir-2', name: 'Marco Neri', email: 'marco.neri@dblue.it', space_access: [],
    role: 'staff', status: true, contract_percentage: 100, mandatory_presence_days: null,
    image_url: null, booking_app_role: 'director' as const,
  },
];

describe('runSeed — sourced from dblue-office', () => {
  beforeAll(connect);
  afterAll(disconnect);
  afterEach(clearDatabase);

  beforeEach(() => {
    mockGetSession.mockImplementation((email: string) => Promise.resolve(sessionFor(email)));
    mockGetUserList.mockResolvedValue({ success: true, users: DIRECTORY_USERS });
  });

  it('seeds local rooms from the real, active dblue-office catalog only', async () => {
    await runSeed(true);
    const rooms = await Room.find().lean();
    expect(rooms.map((r) => r.name).sort()).toEqual(['Sala Galilei', 'Sala Leonardo']);
    const leonardo = rooms.find((r) => r.name === 'Sala Leonardo');
    expect(leonardo?.capacity).toBe(3);
    expect(leonardo?.type).toBe('open_space');
  });

  it('seeds colleagues from the real directory, excluding the 6 dev accounts', async () => {
    await runSeed(true);
    const colleagues = await User.find({ email: { $nin: DEV_EMAILS } }).lean();
    expect(colleagues).toHaveLength(2);
    expect(colleagues.map((u) => u.dblueOfficeId).sort()).toEqual(['dir-1', 'dir-2']);
  });

  it('only ever assigns real room names to in_office WorkingStatus records', async () => {
    await runSeed(true);
    const officeStatuses = await WorkingStatus.find({ status: { $in: ['in_office', 'office_no_desk'] } }).lean();
    expect(officeStatuses.length).toBeGreaterThan(0);
    const roomNames = new Set(officeStatuses.map((s) => s.room).filter(Boolean));
    for (const name of roomNames) {
      expect(['Sala Leonardo', 'Sala Galilei']).toContain(name);
    }
  });

  it('syncs the 6 dev accounts from dblue-office regardless of the integration flag (never enabled here)', async () => {
    mockGetSession.mockImplementation((email: string) => Promise.resolve(sessionFor(email, 'director')));
    await runSeed(true);
    const mario = await User.findOne({ email: 'mario.rossi@dblue.it' }).lean();
    expect(mario?.role).toBe('director');
    expect(mario?.dblueOfficeId).toBe('dbl-mario.rossi@dblue.it');
  });

  it('propagates a room-catalog fetch failure instead of falling back to synthetic data', async () => {
    mockGetSession.mockRejectedValue(new Error('dblue-office non raggiungibile'));
    await expect(runSeed(true)).rejects.toThrow();
    expect(await Room.countDocuments()).toBe(0);
  });
});

// POST /admin/seed used to await runSeed() directly and hold the HTTP request open
// until it finished — with a real dblue-office directory (potentially much larger
// than the old 85 synthetic colleagues), this could take long enough to exceed a
// proxy/browser timeout ("Failed to fetch" client-side even though the backend was
// still working). startSeedJob() runs it in the background instead.
describe('startSeedJob / getSeedJobState', () => {
  beforeAll(connect);
  afterAll(disconnect);
  afterEach(clearDatabase);

  beforeEach(() => {
    mockGetSession.mockImplementation((email: string) => Promise.resolve(sessionFor(email)));
    mockGetUserList.mockResolvedValue({ success: true, users: DIRECTORY_USERS });
  });

  async function waitUntilFinished() {
    for (let i = 0; i < 200; i++) {
      if (getSeedJobState().status !== 'running') return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('seed job did not finish in time');
  }

  it('runs the seed in the background and exposes the summary once done', async () => {
    const { started } = startSeedJob(true);
    expect(started).toBe(true);
    expect(getSeedJobState().status).toBe('running');

    await waitUntilFinished();

    const state = getSeedJobState();
    expect(state.status).toBe('done');
    if (state.status === 'done') {
      expect(state.summary.rooms).toBe(2);
    }
  });

  it('rejects a second start while one is already running', async () => {
    const first = startSeedJob(true);
    expect(first.started).toBe(true);

    const second = startSeedJob(true);
    expect(second.started).toBe(false);

    await waitUntilFinished();
  });

  it('exposes the error message instead of throwing when the catalog fetch fails', async () => {
    mockGetSession.mockRejectedValue(new Error('dblue-office non raggiungibile'));

    startSeedJob(true);
    await waitUntilFinished();

    const state = getSeedJobState();
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.message).toContain('dblue-office non raggiungibile');
    }
  });
});
