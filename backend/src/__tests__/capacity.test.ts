import { Types } from 'mongoose';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser, createRoom } from './helpers';
import { WorkingStatus } from '../models/working-status.model';
import { getTotalCapacity, getBookedCount, isCapacityAvailable } from '../services/capacity.service';

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('role-based room visibility & capacity', () => {
  it('total capacity is open_space only for a role with no extra visible rooms', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'Blue', type: 'open_space', capacity: 20 });
    await createRoom(owner._id, { name: 'Admin Room', type: 'admin', capacity: 8, visibleRoles: ['director'] });

    expect(await getTotalCapacity('employee')).toBe(20);
  });

  it('adds a restricted room capacity for the role it is visible to', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'Blue', type: 'open_space', capacity: 20 });
    await createRoom(owner._id, { name: 'Admin Room', type: 'admin', capacity: 8, visibleRoles: ['director'] });

    expect(await getTotalCapacity('director')).toBe(28);
  });

  it('owner always sees every room regardless of visibleRoles', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'Blue', type: 'open_space', capacity: 20 });
    await createRoom(owner._id, { name: 'Admin Room', type: 'admin', capacity: 8, visibleRoles: ['director'] });
    await createRoom(owner._id, { name: 'Lab', type: 'lab', capacity: 15, visibleRoles: ['lab_responsible'] });

    expect(await getTotalCapacity('owner')).toBe(43);
  });

  it('booked count only counts bookings in rooms visible to the given role, plus unassigned ones', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'Blue', type: 'open_space', capacity: 20 });
    await createRoom(owner._id, { name: 'Admin Room', type: 'admin', capacity: 8, visibleRoles: ['director'] });
    const date = tomorrowStr();

    await WorkingStatus.create([
      { userId: new Types.ObjectId(), date, status: 'in_office', room: 'Blue', isUsingDesk: true },
      { userId: new Types.ObjectId(), date, status: 'in_office', room: 'Admin Room', isUsingDesk: true },
      { userId: new Types.ObjectId(), date, status: 'in_office', isUsingDesk: false },
    ]);

    // Employee can't see Admin Room: only Blue + the unassigned entry count.
    expect(await getBookedCount(date, 'employee')).toBe(2);
    // Director can see Admin Room too: all three count.
    expect(await getBookedCount(date, 'director')).toBe(3);
  });

  it('capacity gate is evaluated against the acting role, not a global constant', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'Blue', type: 'open_space', capacity: 1 });
    await createRoom(owner._id, { name: 'Admin Room', type: 'admin', capacity: 1, visibleRoles: ['director'] });
    const date = tomorrowStr();

    await WorkingStatus.create({
      userId: new Types.ObjectId(),
      date,
      status: 'in_office',
      room: 'Blue',
      isUsingDesk: true,
    });

    // The single open_space seat is taken: an employee has no room left.
    expect(await isCapacityAvailable(date, 'employee')).toBe(false);
    // A director still has the (still-empty) Admin Room seat available.
    expect(await isCapacityAvailable(date, 'director')).toBe(true);
  });
});
