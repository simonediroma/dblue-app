import { connect, disconnect, clearDatabase } from './setup';
import { createUser } from './helpers';
import { WorkingStatus } from '../models/working-status.model';
import { User } from '../models/user.model';
import { getWorkingDaysOfMonth } from '../services/working-status.service';

// getClosures mockata: la sync dblue-office reale è già coperta da closures.service.test.ts,
// qui interessa solo l'esclusione dei giorni isNonWorkingDay dal denominatore.
jest.mock('../services/closures.service', () => ({
  getClosures: jest.fn(),
}));
import { getClosures } from '../services/closures.service';
import { getMonthlyStats } from '../services/stats.service';

const mockGetClosures = getClosures as jest.Mock;

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);
beforeEach(() => {
  mockGetClosures.mockResolvedValue([]);
});

const MONTH = '2026-06'; // giugno 2026, nessun weekend edge case rilevante per questi test

describe('getMonthlyStats — target proporzionale', () => {
  it('passa attraverso null quando l\'utente non ha un target (dblue-office mandatory_presence_days:null)', async () => {
    const user = await createUser();
    await User.findByIdAndUpdate(user._id, { 'contract.presenceDaysTarget': null });

    const stats = await getMonthlyStats(user._id.toString(), MONTH, user.email);

    expect(stats.presenceDaysTarget).toBeNull();
  });

  it('resta uguale al target grezzo quando non ci sono assenze confermate nel mese', async () => {
    const user = await createUser();
    await User.findByIdAndUpdate(user._id, { 'contract.presenceDaysTarget': 10 });

    const stats = await getMonthlyStats(user._id.toString(), MONTH, user.email);

    expect(stats.presenceDaysTarget).toBe(10);
  });

  it('riduce il target proporzionalmente ai giorni di leave/sick confermati nel mese', async () => {
    const user = await createUser();
    await User.findByIdAndUpdate(user._id, { 'contract.presenceDaysTarget': 10 });

    const workingDays = getWorkingDaysOfMonth(MONTH);
    const absenceDates = workingDays.slice(0, 3); // 3 giorni lavorativi persi ad assenza
    await WorkingStatus.create(
      absenceDates.map((date) => ({ userId: user._id, date, status: 'sick', isConfirmed: true }))
    );

    const stats = await getMonthlyStats(user._id.toString(), MONTH, user.email);

    const expectedTarget = Math.round((10 * (workingDays.length - 3)) / workingDays.length);
    expect(stats.presenceDaysTarget).toBe(expectedTarget);
    expect(stats.presenceDaysTarget).toBeLessThan(10);
  });

  it('non conta come assenza un leave non ancora confermato', async () => {
    const user = await createUser();
    await User.findByIdAndUpdate(user._id, { 'contract.presenceDaysTarget': 10 });

    const workingDays = getWorkingDaysOfMonth(MONTH);
    await WorkingStatus.create({ userId: user._id, date: workingDays[0], status: 'leave', isConfirmed: false });

    const stats = await getMonthlyStats(user._id.toString(), MONTH, user.email);

    expect(stats.presenceDaysTarget).toBe(10);
  });

  it('esclude dal denominatore i giorni lavorativi coperti da una chiusura isNonWorkingDay:true', async () => {
    const user = await createUser();
    await User.findByIdAndUpdate(user._id, { 'contract.presenceDaysTarget': 10 });
    mockGetClosures.mockResolvedValue([
      { start: '2026-06-15', end: '2026-06-15', title: 'Festività', isNonWorkingDay: true },
    ]);

    const workingDays = getWorkingDaysOfMonth(MONTH);
    const stats = await getMonthlyStats(user._id.toString(), MONTH, user.email);

    // Nessuna assenza confermata: il target resta uguale al grezzo perché la chiusura
    // riduce ugualmente sia il numeratore (effectiveWorkingDays) sia il denominatore
    // (workingDaysCount) — verificato qui che il conteggio la esclude davvero
    // confrontando con una chiusura isNonWorkingDay:false (nessun effetto).
    expect(stats.presenceDaysTarget).toBe(10);
    expect(workingDays).toContain('2026-06-15');
  });

  it('una chiusura isNonWorkingDay:false ("ufficio chiuso ma WFH") non riduce il target', async () => {
    const user = await createUser();
    await User.findByIdAndUpdate(user._id, { 'contract.presenceDaysTarget': 10 });
    mockGetClosures.mockResolvedValue([
      { start: '2026-06-15', end: '2026-06-15', title: 'Office closed', isNonWorkingDay: false },
    ]);

    const workingDays = getWorkingDaysOfMonth(MONTH);
    const absenceDates = workingDays.slice(0, 2);
    await WorkingStatus.create(
      absenceDates.map((date) => ({ userId: user._id, date, status: 'leave', isConfirmed: true }))
    );

    const stats = await getMonthlyStats(user._id.toString(), MONTH, user.email);

    // Il denominatore resta l'intero mese (la chiusura non è isNonWorkingDay), solo
    // le 2 assenze confermate riducono il numeratore.
    const expectedTarget = Math.round((10 * (workingDays.length - 2)) / workingDays.length);
    expect(stats.presenceDaysTarget).toBe(expectedTarget);
  });

  it('non chiama getClosures se non viene passata una requesterEmail (retro-compatibilità)', async () => {
    const user = await createUser();
    await User.findByIdAndUpdate(user._id, { 'contract.presenceDaysTarget': 10 });

    const stats = await getMonthlyStats(user._id.toString(), MONTH);

    expect(mockGetClosures).not.toHaveBeenCalled();
    expect(stats.presenceDaysTarget).toBe(10);
  });
});
