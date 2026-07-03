import { WorkingStatus, IWorkingStatus, WorkingStatusValue } from '../models/working-status.model';
import { Room } from '../models/room.model';
import { User } from '../models/user.model';
import { sendWaitingListPromotion } from './email.service';

export interface RoomOccupancy {
  name: string;
  booked: number;
  capacity: number;
}

export interface PresenceBreakdown {
  date: string;
  rooms: RoomOccupancy[];
  extras: number;
  totalBooked: number;
  totalCapacity: number;
}

const BOOKED_STATUSES: WorkingStatusValue[] = ['in_office', 'office_no_desk'];

// Simple in-memory cache for total capacity (changes rarely)
let capacityCache: { value: number; expiresAt: number } | null = null;

export async function getTotalCapacity(_date: string): Promise<number> {
  const now = Date.now();
  if (capacityCache && now < capacityCache.expiresAt) {
    return capacityCache.value;
  }
  const rooms = await Room.find({ type: 'open_space', isActive: true }).lean();
  const total = rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
  capacityCache = { value: total, expiresAt: now + 60_000 };
  return total;
}

export async function getBookedCount(date: string): Promise<number> {
  return WorkingStatus.countDocuments({ date, status: { $in: BOOKED_STATUSES } });
}

export async function isCapacityAvailable(date: string): Promise<boolean> {
  const [booked, total] = await Promise.all([getBookedCount(date), getTotalCapacity(date)]);
  return booked < total;
}

export async function getWaitingList(date: string): Promise<IWorkingStatus[]> {
  return WorkingStatus.find({ date, status: 'waiting_list' }).sort({ createdAt: 1 });
}

export async function promoteFromWaitingList(date: string): Promise<void> {
  const available = await isCapacityAvailable(date);
  if (!available) return;

  const waitingList = await getWaitingList(date);
  if (waitingList.length === 0) return;

  const first = waitingList[0];
  await WorkingStatus.findByIdAndUpdate(first._id, { $set: { status: 'in_office' } });
  console.log(`WaitingList: utente ${first.userId} promosso per data ${date}`);

  const user = await User.findById(first.userId).lean();
  if (user?.email) {
    sendWaitingListPromotion(user.email, date).catch((err) =>
      console.error('sendWaitingListPromotion error:', err)
    );
  }
}

export async function getPresenceBreakdown(date: string): Promise<PresenceBreakdown> {
  const rooms = await Room.find({ type: 'open_space', isActive: true }).lean();

  const roomOccupancies: RoomOccupancy[] = await Promise.all(
    rooms.map(async (room) => {
      const booked = await WorkingStatus.countDocuments({
        date,
        status: { $in: BOOKED_STATUSES },
        room: room.name,
      });
      return { name: room.name, booked, capacity: room.capacity ?? 0 };
    })
  );

  const extras = await WorkingStatus.countDocuments({
    date,
    status: { $in: BOOKED_STATUSES },
    $or: [{ room: null }, { room: '' }],
  });

  const totalBooked = roomOccupancies.reduce((sum, r) => sum + r.booked, 0) + extras;
  const totalCapacity = rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);

  return { date, rooms: roomOccupancies, extras, totalBooked, totalCapacity };
}
