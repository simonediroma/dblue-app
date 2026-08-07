import {
  getBookingAppSession,
  getBookingAppUserList,
  DblueOfficeBadRequestError,
  DblueOfficeForbiddenError,
  DblueOfficeUnavailableError,
} from '../services/dblueOfficeApi.service';

const originalFetch = global.fetch;

function mockFetchOnce(status: number, body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('dblueOfficeApi.service', () => {
  beforeEach(() => {
    process.env.DBLUE_OFFICE_API_URL = 'https://staging-tools.dblue.it/api/v1/users';
    process.env.DBLUE_OFFICE_API_KEY = 'dbk_test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.DBLUE_OFFICE_API_URL;
    delete process.env.DBLUE_OFFICE_API_KEY;
  });

  it('returns session data on 200 and sends the API key header', async () => {
    const session = {
      success: true,
      user: {
        dblueOfficeId: '1',
        name: 'Natalia Kravchenko',
        email: 'natalia.kravchenko@dblue.it',
        mandatory_presence_days: 0,
        booking_app_role: 'owner',
      },
      userSpaceAccess: [],
      userRoomList: [],
      allRooms: [],
      roomCategories: [],
      closures: [],
    };
    mockFetchOnce(200, session);

    const result = await getBookingAppSession('natalia.kravchenko@dblue.it');

    expect(result).toEqual(session);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers).toEqual({ 'X-API-Key': 'dbk_test' });
  });

  it('fetches the user directory with the requester email', async () => {
    const list = { success: true, users: [] };
    mockFetchOnce(200, list);

    const result = await getBookingAppUserList('me@dblue.it');

    expect(result).toEqual(list);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/list/booking-app?email=me%40dblue.it');
  });

  it('throws DblueOfficeBadRequestError on 400', async () => {
    mockFetchOnce(400, { success: false, error: 'Bad Request', message: 'email richiesta' });
    await expect(getBookingAppSession('')).rejects.toBeInstanceOf(DblueOfficeBadRequestError);
  });

  it('throws DblueOfficeForbiddenError on 403', async () => {
    mockFetchOnce(403, { success: false, error: 'Forbidden', message: 'User not found' });
    await expect(getBookingAppSession('nobody@dblue.it')).rejects.toBeInstanceOf(DblueOfficeForbiddenError);
  });

  it('throws DblueOfficeUnavailableError on 5xx', async () => {
    mockFetchOnce(500, {});
    await expect(getBookingAppSession('a@dblue.it')).rejects.toBeInstanceOf(DblueOfficeUnavailableError);
  });

  it('throws DblueOfficeUnavailableError on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    await expect(getBookingAppSession('a@dblue.it')).rejects.toBeInstanceOf(DblueOfficeUnavailableError);
  });

  it('throws DblueOfficeUnavailableError when the API key is not configured', async () => {
    delete process.env.DBLUE_OFFICE_API_KEY;
    await expect(getBookingAppSession('a@dblue.it')).rejects.toBeInstanceOf(DblueOfficeUnavailableError);
  });
});
