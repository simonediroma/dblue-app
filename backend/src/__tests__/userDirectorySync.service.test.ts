jest.mock('../services/settings.service');
jest.mock('../services/dblueOfficeApi.service');
jest.mock('../models/user.model', () => ({ User: { findOneAndUpdate: jest.fn() } }));

import { syncUserDirectoryIfEnabled } from '../services/userDirectorySync.service';
import { isDblueOfficeIntegrationEnabled } from '../services/settings.service';
import { getBookingAppUserList } from '../services/dblueOfficeApi.service';
import { User } from '../models/user.model';

const mockIsEnabled = isDblueOfficeIntegrationEnabled as jest.Mock;
const mockGetUserList = getBookingAppUserList as jest.Mock;
const mockFindOneAndUpdate = User.findOneAndUpdate as unknown as jest.Mock;

const DIRECTORY_USER = {
  _id: 'dblue-1',
  name: 'Natalia Kravchenko',
  email: 'Natalia.Kravchenko@dblue.it',
  space_access: [],
  role: 'admin',
  status: true,
  contract_percentage: 100,
  mandatory_presence_days: null,
  image_url: 'https://example.com/avatar.jpg',
  booking_app_role: 'owner',
};

// Il servizio tiene un TTL in-memory a livello di modulo (lastSyncedAt): l'ordine dei
// test qui sotto è intenzionale, come per closures.service.test.ts.
describe('userDirectorySync.service', () => {
  it('is a no-op when the integration is disabled', async () => {
    mockIsEnabled.mockResolvedValue(false);

    await syncUserDirectoryIfEnabled('dev@dblue.it');

    expect(mockGetUserList).not.toHaveBeenCalled();
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not throw and leaves the cache cold if dblue-office fails', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetUserList.mockRejectedValue(new Error('network down'));

    await expect(syncUserDirectoryIfEnabled('dev@dblue.it')).resolves.toBeUndefined();
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('upserts a shadow user per directory entry, lowercasing the email', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetUserList.mockResolvedValue({ success: true, users: [DIRECTORY_USER] });
    mockFindOneAndUpdate.mockResolvedValue({});

    await syncUserDirectoryIfEnabled('dev@dblue.it');

    expect(mockGetUserList).toHaveBeenCalledWith('dev@dblue.it');
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { email: 'natalia.kravchenko@dblue.it' },
      {
        $setOnInsert: { googleId: 'dblue-office:dblue-1' },
        $set: {
          name: 'Natalia Kravchenko',
          role: 'owner',
          dblueOfficeId: 'dblue-1',
          avatar: 'https://example.com/avatar.jpg',
        },
      },
      { upsert: true }
    );
  });

  it('skips re-fetching within the TTL window', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGetUserList.mockClear();

    await syncUserDirectoryIfEnabled('dev@dblue.it');

    expect(mockGetUserList).not.toHaveBeenCalled();
  });
});
