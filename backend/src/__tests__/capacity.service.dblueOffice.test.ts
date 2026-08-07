jest.mock('../services/settings.service');

import { getVisibleRoomsForUser, getTotalCapacity } from '../services/capacity.service';
import { isDblueOfficeIntegrationEnabled } from '../services/settings.service';

const mockIsEnabled = isDblueOfficeIntegrationEnabled as jest.Mock;

// Percorso ON di getVisibleRoomsForUser: legge solo lo snapshot già cachato
// sull'utente, non tocca mai il DB locale — nessun mongodb-memory-server necessario.
describe('capacity.service — getVisibleRoomsForUser (modalità dblue-office)', () => {
  it('ritorna lo snapshot cachato sull\'utente quando il flag è ON', async () => {
    mockIsEnabled.mockResolvedValue(true);
    const dblueOfficeRooms = [
      { id: '1', name: 'Room A', capacity: 6, color: '#4A90D9', category: 'Open Space' },
    ];

    const result = await getVisibleRoomsForUser({ role: 'employee', dblueOfficeRooms });

    expect(result).toEqual(dblueOfficeRooms);
    expect(getTotalCapacity(result)).toBe(6);
  });

  it('ritorna un array vuoto se il flag è ON ma l\'utente non ha ancora uno snapshot (mai sincronizzato)', async () => {
    mockIsEnabled.mockResolvedValue(true);

    const result = await getVisibleRoomsForUser({ role: 'employee' });

    expect(result).toEqual([]);
  });
});
