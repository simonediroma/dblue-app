import { Types } from 'mongoose';
import { connect, disconnect, clearDatabase } from './setup';
import { createUser } from './helpers';
import { Room } from '../models/room.model';
import { WorkingStatus } from '../models/working-status.model';
import { reallocateSeededBookings } from '../services/reallocation.service';

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('reallocateSeededBookings', () => {
  it('rebalances seeded bookings across rooms without exceeding the new capacity', async () => {
    const owner = await createUser({ role: 'owner' });
    const date = tomorrowStr();

    await Room.create([
      { name: 'Blue', capacity: 2, type: 'open_space', createdBy: owner._id },
      { name: 'Red', capacity: 2, type: 'open_space', createdBy: owner._id },
    ]);

    // 5 seeded bookings all crammed into Blue, simulating a capacity that was just lowered.
    const userIds = Array.from({ length: 5 }, () => new Types.ObjectId());
    await WorkingStatus.create(
      userIds.map((userId) => ({
        userId,
        date,
        status: 'in_office',
        room: 'Blue',
        isUsingDesk: true,
        isSeeded: true,
      }))
    );

    const summary = await reallocateSeededBookings();
    expect(summary.datesProcessed).toBe(1);

    const records = await WorkingStatus.find({ date }).lean();
    const perRoom = new Map<string, number>();
    let waitingList = 0;
    for (const r of records) {
      if (r.status === 'waiting_list') waitingList++;
      else if (r.room) perRoom.set(r.room, (perRoom.get(r.room) ?? 0) + 1);
    }

    expect(perRoom.get('Blue')).toBe(2);
    expect(perRoom.get('Red')).toBe(2);
    expect(waitingList).toBe(1);
  });

  it('does not touch bookings that were not created by the seed script', async () => {
    const owner = await createUser({ role: 'owner' });
    const date = tomorrowStr();

    await Room.create({ name: 'Blue', capacity: 1, type: 'open_space', createdBy: owner._id });

    const realUser = new Types.ObjectId();
    await WorkingStatus.create({
      userId: realUser,
      date,
      status: 'in_office',
      room: 'Blue',
      isUsingDesk: true,
      isSeeded: false,
    });

    await reallocateSeededBookings();

    const record = await WorkingStatus.findOne({ userId: realUser }).lean();
    expect(record?.status).toBe('in_office');
    expect(record?.room).toBe('Blue');
  });
});
