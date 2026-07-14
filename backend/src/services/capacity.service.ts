import { WorkingStatus, IWorkingStatus, WorkingStatusValue } from '../models/working-status.model';
import { Room } from '../models/room.model';
import { User, IUser } from '../models/user.model';
import { sendWaitingListPromotion } from './email.service';

export type Role = IUser['role'];

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

// Rooms a given role can see and book: every open_space room (visible to
// everyone, open_space is the "for everyone" flag) plus any other room whose
// visibleRoles includes this role. Owner always sees every room regardless.
export async function getVisibleRooms(role: Role) {
  const rooms = await Room.find({ isActive: true }).lean();
  return rooms.filter(
    (r) => r.type === 'open_space' || role === 'owner' || (r.visibleRoles ?? []).includes(role)
  );
}

export async function getTotalCapacity(role: Role): Promise<number> {
  const rooms = await getVisibleRooms(role);
  return rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
}

export async function getBookedCount(date: string, role: Role): Promise<number> {
  const visibleRoomNames = (await getVisibleRooms(role)).map((r) => r.name);
  return WorkingStatus.countDocuments({
    date,
    status: { $in: BOOKED_STATUSES },
    $or: [{ room: { $in: visibleRoomNames } }, { room: null }, { room: '' }],
  });
}

export async function isCapacityAvailable(date: string, role: Role): Promise<boolean> {
  const [booked, total] = await Promise.all([getBookedCount(date, role), getTotalCapacity(role)]);
  return booked < total;
}

export async function getWaitingList(date: string): Promise<IWorkingStatus[]> {
  return WorkingStatus.find({ date, status: 'waiting_list' }).sort({ createdAt: 1 });
}

export async function promoteFromWaitingList(date: string): Promise<void> {
  const waitingList = await getWaitingList(date);
  if (waitingList.length === 0) return;

  const first = waitingList[0];
  const waitingUser = await User.findById(first.userId).lean();
  const role: Role = waitingUser?.role ?? 'employee';

  const available = await isCapacityAvailable(date, role);
  if (!available) return;

  await WorkingStatus.findByIdAndUpdate(first._id, { $set: { status: 'in_office' } });
  console.log(`WaitingList: utente ${first.userId} promosso per data ${date}`);

  if (waitingUser?.email) {
    sendWaitingListPromotion(waitingUser.email, date).catch((err) =>
      console.error('sendWaitingListPromotion error:', err)
    );
  }
}

// Broadcast target for the live WebSocket update. Sockets aren't tied to an
// authenticated user/role, so this reflects the same whole-office total every
// authenticated GET /presence already shows an owner (all active rooms) — the
// frontend (App.tsx's useWebSocket handler) unconditionally overwrites a day's
// bookedCount/totalCapacity with whatever this returns, so scoping it to just
// open_space rooms (as before) made the count visibly flip between the correct
// per-role total and this narrower one the moment any booking triggered a
// broadcast for that date.
export async function getPresenceBreakdown(date: string): Promise<PresenceBreakdown> {
  const rooms = await Room.find({ isActive: true }).lean();

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
