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

beforeEach(() => {
  // getBookingAppSessionUrl (usata per la diagnostica) NON è mockata — usa la vera
  // getBaseUrl(), che legge questa env var. getBookingAppSession invece è mockata
  // sopra, quindi non fa mai una vera richiesta HTTP in questi test.
  process.env.DBLUE_OFFICE_API_URL = 'https://staging-tools.dblue.it/api/v1/users';
});

afterEach(() => {
  delete process.env.DBLUE_OFFICE_API_URL;
});

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
      // Diagnostica: URL reale (con l'email nella query), solo il NOME dell'header
      // (mai il valore della API key), e la risposta grezza esplorabile per intero.
      expect(result.url).toBe(
        `https://staging-tools.dblue.it/api/v1/users/booking-app/session?email=${encodeURIComponent(result.email)}`
      );
      expect(result.requestHeaders).toEqual(['X-API-Key']);
      expect(result.rawResponse).toEqual(sessionFor(result.expectedRole));
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
      expect(result.rawResponse).toBeUndefined();
      // La diagnostica (URL, nomi header) resta disponibile anche quando la
      // chiamata fallisce — è calcolata a parte dalla risposta vera e propria.
      expect(result.url).toContain('/booking-app/session?email=');
      expect(result.requestHeaders).toEqual(['X-API-Key']);
    }
  });
});
