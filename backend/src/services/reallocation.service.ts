import { WorkingStatus, IWorkingStatus } from '../models/working-status.model';
import { Room } from '../models/room.model';
import { TOTAL_OFFICE_CAPACITY } from './capacity.service';

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ReallocationSummary {
  datesProcessed: number;
  assignedToRoom: number;
  movedToWaitingList: number;
}

// Rebalances room assignments for seeded (mock) bookings across open_space rooms so that
// no room exceeds its current capacity. Only touches future, unconfirmed dates and only
// records created by the seed script (isSeeded), never real user bookings.
export async function reallocateSeededBookings(): Promise<ReallocationSummary> {
  const todayStr = getTodayStr();
  const rooms = await Room.find({ type: 'open_space', isActive: true }).sort({ name: 1 }).lean();

  const candidates = await WorkingStatus.find({
    isSeeded: true,
    date: { $gt: todayStr },
    status: { $in: ['in_office', 'waiting_list'] },
  }).sort({ date: 1 });

  const byDate = new Map<string, IWorkingStatus[]>();
  for (const rec of candidates) {
    const arr = byDate.get(rec.date) ?? [];
    arr.push(rec);
    byDate.set(rec.date, arr);
  }

  const changed: IWorkingStatus[] = [];
  let assignedToRoom = 0;
  let movedToWaitingList = 0;

  for (const records of byDate.values()) {
    // Keep already-seated people first so a capacity change doesn't needlessly
    // reshuffle someone already in a room in favor of a previously waitlisted one.
    records.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'in_office' ? -1 : 1;
      return a.userId.toString().localeCompare(b.userId.toString());
    });

    let idx = 0;
    let totalSeated = 0;
    for (const room of rooms) {
      for (
        let seat = 0;
        seat < room.capacity && idx < records.length && totalSeated < TOTAL_OFFICE_CAPACITY;
        seat++, idx++, totalSeated++
      ) {
        const rec = records[idx];
        if (rec.status !== 'in_office' || rec.room !== room.name || !rec.isUsingDesk) {
          rec.status = 'in_office';
          rec.room = room.name;
          rec.isUsingDesk = true;
          changed.push(rec);
          assignedToRoom++;
        }
      }
    }
    for (; idx < records.length; idx++) {
      const rec = records[idx];
      if (rec.status !== 'waiting_list') {
        rec.status = 'waiting_list';
        rec.room = undefined;
        rec.isUsingDesk = false;
        rec.markModified('room');
        changed.push(rec);
        movedToWaitingList++;
      }
    }
  }

  await Promise.all(changed.map((rec) => rec.save()));

  return { datesProcessed: byDate.size, assignedToRoom, movedToWaitingList };
}
