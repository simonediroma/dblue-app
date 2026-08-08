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
import { runSeed } from '../services/seed.service';
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
  { id: 'room-1', name: 'Sala Leonardo', category: 'open', color: '#111111', capacity: 3, reserved: false, isActive: true },
  { id: 'room-2', name: 'Sala Galilei', category: 'open', color: '#222222', capacity: 2, reserved: false, isActive: true },
  { id: 'room-3', name: 'Sala Disattivata', category: 'open', color: '#333333', capacity: 5, reserved: false, isActive: false },
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
