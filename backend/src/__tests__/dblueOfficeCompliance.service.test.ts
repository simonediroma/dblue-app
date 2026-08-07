// Mock solo getBookingAppSession — le classi di errore devono restare quelle reali
// (extends Error), altrimenti un automock rompe l'instanceof check nel servizio.
jest.mock('../services/dblueOfficeApi.service', () => ({
  ...jest.requireActual('../services/dblueOfficeApi.service'),
  getBookingAppSession: jest.fn(),
}));

import { checkDevAccountsCompliance } from '../services/dblueOfficeCompliance.service';
import { getBookingAppSession, DblueOfficeForbiddenError } from '../services/dblueOfficeApi.service';
import { DEV_ACCOUNTS } from '../routes/auth.routes';

const mockGetSession = getBookingAppSession as jest.Mock;

function sessionFor(role: string) {
  return {
    success: true,
    user: { dblueOfficeId: '1', name: 'Test', email: 'test@dblue.it', mandatory_presence_days: 0, booking_app_role: role },
    userSpaceAccess: [],
    userRoomList: [],
    allRooms: [],
    roomCategories: [],
    closures: [],
  };
}

describe('dblueOfficeCompliance.service', () => {
  it('marks an account compliant when the returned role matches the expected one', async () => {
    mockGetSession.mockImplementation((email: string) => {
      const account = DEV_ACCOUNTS.find((a) => a.email === email)!;
      return Promise.resolve(sessionFor(account.role));
    });

    const results = await checkDevAccountsCompliance();

    expect(results).toHaveLength(DEV_ACCOUNTS.length);
    for (const result of results) {
      expect(result.compliant).toBe(true);
      expect(result.actualRole).toBe(result.expectedRole);
      expect(result.error).toBeUndefined();
    }
  });

  it('marks an account non-compliant when the returned role differs from the expected one', async () => {
    mockGetSession.mockResolvedValue(sessionFor('employee'));

    const results = await checkDevAccountsCompliance();

    const director = results.find((r) => r.email === 'giulia.bianchi@dblue.it')!;
    expect(director.expectedRole).toBe('director');
    expect(director.actualRole).toBe('employee');
    expect(director.compliant).toBe(false);
  });

  it('reports a 403 as a non-compliant result with an error message, not a thrown exception', async () => {
    mockGetSession.mockRejectedValue(new DblueOfficeForbiddenError('User not found'));

    const results = await checkDevAccountsCompliance();

    for (const result of results) {
      expect(result.compliant).toBe(false);
      expect(result.actualRole).toBeUndefined();
      expect(result.error).toContain('User not found');
    }
  });
});
