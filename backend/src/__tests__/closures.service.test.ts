jest.mock('../services/settings.service');
// Mock solo getBookingAppSession — parseDblueOfficeDate deve restare l'implementazione
// reale, altrimenti un automock pieno la sostituisce con un mock che ritorna sempre
// undefined, scartando silenziosamente ogni chiusura.
jest.mock('../services/dblueOfficeApi.service', () => ({
  ...jest.requireActual('../services/dblueOfficeApi.service'),
  getBookingAppSession: jest.fn(),
}));

import { getClosures } from '../services/closures.service';
import { isDblueOfficeIntegrationEnabled } from '../services/settings.service';
import { getBookingAppSession } from '../services/dblueOfficeApi.service';

const mockIsEnabled = isDblueOfficeIntegrationEnabled as jest.Mock;
const mockGetSession = getBookingAppSession as jest.Mock;

const STATIC_FALLBACK = [{ start: '2026-11-01', end: '2026-11-01', title: 'Office closed' }];

// closures.service.ts tiene una cache in-memory a livello di modulo: l'ordine dei
// test qui sotto è intenzionale (il caso "nessuna cache pregressa" deve girare
// PRIMA di qualunque fetch riuscito, altrimenti troverebbe una cache già popolata).
describe('closures.service', () => {
  it('returns the static fallback when the integration is disabled', async () => {
    mockIsEnabled.mockResolvedValue(false);

    const result = await getClosures('dev@dblue.it');

    expect(result).toEqual(STATIC_FALLBACK);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('falls back to the static list when dblue-office fails and there is no prior cache', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetSession.mockRejectedValue(new Error('network down'));

    const result = await getClosures('dev@dblue.it');

    expect(result).toEqual(STATIC_FALLBACK);
  });

  it('normalizes DD-MM-YYYY dates to YYYY-MM-DD when the integration is enabled', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetSession.mockResolvedValue({
      success: true,
      user: {},
      userSpaceAccess: [],
      userRoomList: [],
      allRooms: [],
      roomCategories: [],
      closures: [
        { _id: '1', title: 'Summer closure', start: '15-08-2026', end: '22-08-2026' },
      ],
    });

    const result = await getClosures('natalia.kravchenko@dblue.it');

    expect(result).toEqual([{ start: '2026-08-15', end: '2026-08-22', title: 'Summer closure' }]);
    expect(mockGetSession).toHaveBeenCalledWith('natalia.kravchenko@dblue.it');
  });

  it('returns the still-fresh cache without re-fetching', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetSession.mockRejectedValue(new Error('should not be called'));

    const result = await getClosures('dev@dblue.it');

    expect(result).toEqual([{ start: '2026-08-15', end: '2026-08-22', title: 'Summer closure' }]);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('falls back to the last known-good cache when dblue-office fails after the cache has expired', async () => {
    const realNow = Date.now.bind(Date);
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 10 * 60 * 1000); // +10min, oltre il TTL di 5min
    mockIsEnabled.mockResolvedValue(true);
    mockGetSession.mockRejectedValue(new Error('network down'));

    const result = await getClosures('dev@dblue.it');

    expect(result).toEqual([{ start: '2026-08-15', end: '2026-08-22', title: 'Summer closure' }]);
    expect(mockGetSession).toHaveBeenCalled();

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('drops closures with an invalid date format (e.g. ISO 8601, not the real DD-MM-YYYY) and keeps the valid ones', async () => {
    const realNow = Date.now.bind(Date);
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 20 * 60 * 1000); // oltre il TTL, forza un refetch
    mockIsEnabled.mockResolvedValue(true);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetSession.mockResolvedValue({
      success: true,
      user: {},
      userSpaceAccess: [],
      userRoomList: [],
      allRooms: [],
      roomCategories: [],
      closures: [
        { _id: '1', title: 'Valid closure', start: '15-08-2026', end: '22-08-2026' },
        { _id: '2', title: 'Bad closure', start: '2026-08-15T00:00:00.000Z', end: '2026-08-22T00:00:00.000Z' },
      ],
    });

    const result = await getClosures('dev@dblue.it');

    expect(result).toEqual([{ start: '2026-08-15', end: '2026-08-22', title: 'Valid closure' }]);
    expect(warnSpy).toHaveBeenCalled();

    jest.spyOn(Date, 'now').mockRestore();
    warnSpy.mockRestore();
  });
});
