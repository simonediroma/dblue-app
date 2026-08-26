jest.mock('../services/settings.service');
jest.mock('../services/dblueOfficeApi.service', () => ({
  ...jest.requireActual('../services/dblueOfficeApi.service'),
  getBookingAppSession: jest.fn(),
}));

import { syncUserFromDblueOfficeIfEnabled } from '../services/userSync.service';
import { isDblueOfficeIntegrationEnabled } from '../services/settings.service';
import { getBookingAppSession } from '../services/dblueOfficeApi.service';
import { IUser } from '../models/user.model';

const mockIsEnabled = isDblueOfficeIntegrationEnabled as jest.Mock;
const mockGetSession = getBookingAppSession as jest.Mock;

function fakeUser(overrides: Partial<IUser> = {}): IUser {
  return {
    email: 'mario.rossi@dblue.it',
    name: 'Mario Rossi',
    role: 'employee',
    contract: { presenceDaysTarget: 10 },
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as IUser;
}

describe('userSync.service — force option', () => {
  it('is a no-op when the integration is disabled and force is not passed', async () => {
    mockIsEnabled.mockResolvedValue(false);
    const user = fakeUser();

    await syncUserFromDblueOfficeIfEnabled(user);

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  it('force:true syncs from dblue-office even when the integration flag is disabled', async () => {
    mockIsEnabled.mockResolvedValue(false);
    mockGetSession.mockResolvedValue({
      success: true,
      user: {
        dblueOfficeId: 'dbl-1',
        name: 'Mario Rossi',
        email: 'mario.rossi@dblue.it',
        image_url: null,
        mandatory_presence_days: 8,
        booking_app_role: 'director',
      },
      userSpaceAccess: [],
      userRoomList: [],
      allRooms: [],
      roomCategories: [],
      closures: [],
    });
    const user = fakeUser();

    await syncUserFromDblueOfficeIfEnabled(user, { force: true });

    expect(mockIsEnabled).not.toHaveBeenCalled();
    expect(user.role).toBe('director');
    expect(user.dblueOfficeId).toBe('dbl-1');
    expect(user.save).toHaveBeenCalled();
  });

  it('mandatory_presence_days:null clears presenceDaysTarget instead of leaving the previous value', async () => {
    mockIsEnabled.mockResolvedValue(false);
    mockGetSession.mockResolvedValue({
      success: true,
      user: {
        dblueOfficeId: 'dbl-1',
        name: 'Mario Rossi',
        email: 'mario.rossi@dblue.it',
        image_url: null,
        mandatory_presence_days: null,
        booking_app_role: 'director',
      },
      userSpaceAccess: [],
      userRoomList: [],
      allRooms: [],
      roomCategories: [],
      closures: [],
    });
    const user = fakeUser({ contract: { presenceDaysTarget: 10 } });

    await syncUserFromDblueOfficeIfEnabled(user, { force: true });

    expect(user.contract.presenceDaysTarget).toBeNull();
  });

  it('nets reserved seats out of capacity, except when includeReserved says they are this user\'s', async () => {
    mockIsEnabled.mockResolvedValue(false);
    mockGetSession.mockResolvedValue({
      success: true,
      user: {
        dblueOfficeId: 'dbl-1',
        name: 'Mario Rossi',
        email: 'mario.rossi@dblue.it',
        image_url: null,
        mandatory_presence_days: null,
        booking_app_role: 'lab_responsible',
      },
      userSpaceAccess: [],
      userRoomList: [
        // Lab: 2 dei 6 posti sono riservati, ma per questo utente (lab_responsible)
        // includeReserved:true dice che sono suoi — vede la capacity intera.
        { id: 'lab', name: 'Innovation Lab', space: 'lab', color: '#fff', capacity: 6, reserved: 2, isActive: true, includeReserved: true, isLab: true },
        // Stanza open space: nessun includeReserved, i riservati vanno sottratti.
        { id: 'open', name: 'Open Space', space: 'open', color: '#eee', capacity: 10, reserved: 3, isActive: true, includeReserved: false },
        // Dato inconsistente da dblue-office (reserved > capacity) — non deve mai
        // risultare in una capacity negativa.
        { id: 'bad', name: 'Bad Room', space: 'open', color: '#ddd', capacity: 2, reserved: 5, isActive: true, includeReserved: false },
      ],
      allRooms: [],
      roomCategories: [],
      closures: [],
    });
    const user = fakeUser();

    await syncUserFromDblueOfficeIfEnabled(user, { force: true });

    expect(user.dblueOfficeRooms).toEqual([
      expect.objectContaining({ id: 'lab', capacity: 6 }),
      expect.objectContaining({ id: 'open', capacity: 7 }),
      expect.objectContaining({ id: 'bad', capacity: 0 }),
    ]);
  });
});
