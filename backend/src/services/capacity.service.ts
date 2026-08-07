import { WorkingStatus, IWorkingStatus, WorkingStatusValue } from '../models/working-status.model';
import { Room } from '../models/room.model';
import { User, IUser } from '../models/user.model';
import { sendWaitingListPromotion } from './email.service';
import { isDblueOfficeIntegrationEnabled } from './settings.service';

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

// Forma unificata di "una stanza che questo utente può vedere/prenotare",
// indipendente dal fatto che provenga dal Room model locale (flag OFF) o dallo
// snapshot cachato al login da dblue-office (flag ON) — vedi getVisibleRoomsForUser.
export interface VisibleRoom {
  id?: string;
  name: string;
  capacity: number;
  color?: string;
  category?: string;
  // Popolato solo in modalità locale (OFF) — RoomManagement.tsx lo usa per il
  // picker di visibilità per ruolo. In modalità API la visibilità è già "baked in"
  // (la stanza è nella lista solo se l'utente può vederla), non serve esporlo.
  visibleRoles?: Role[];
}

const BOOKED_STATUSES: WorkingStatusValue[] = ['in_office', 'office_no_desk'];

// Rooms a given role can see and book: every open_space room (visible to
// everyone, open_space is the "for everyone" flag) plus any other room whose
// visibleRoles includes this role. Owner always sees every room regardless.
// Solo per la modalità locale (flag dblue-office OFF) — vedi getVisibleRoomsForUser,
// il punto d'ingresso corretto per il codice applicativo.
export async function getVisibleRooms(role: Role) {
  const rooms = await Room.find({ isActive: true }).lean();
  return rooms.filter(
    (r) => r.type === 'open_space' || role === 'owner' || (r.visibleRoles ?? []).includes(role)
  );
}

interface UserRoomContext {
  role: Role;
  dblueOfficeRooms?: VisibleRoom[];
}

/**
 * Stanze visibili/prenotabili da questo utente — punto d'ingresso unico per tutto
 * il codice applicativo (upsertStatus, GET /rooms, websocket, ecc.).
 *
 * OFF (default): comportamento invariato, deriva da getVisibleRooms(role) sul Room
 * model locale. ON: legge lo snapshot già cachato al login (user.dblueOfficeRooms,
 * popolato da userSync.service.ts) — nessuna chiamata esterna in questo path.
 */
export async function getVisibleRoomsForUser(user: UserRoomContext): Promise<VisibleRoom[]> {
  const enabled = await isDblueOfficeIntegrationEnabled();
  if (!enabled) {
    const rooms = await getVisibleRooms(user.role);
    return rooms.map((r) => ({
      id: String(r._id),
      name: r.name,
      capacity: r.capacity,
      color: r.color,
      category: r.type,
      visibleRoles: r.visibleRoles,
    }));
  }
  return user.dblueOfficeRooms ?? [];
}

export function getTotalCapacity(rooms: VisibleRoom[]): number {
  return rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
}

export async function getBookedCount(date: string, rooms: VisibleRoom[]): Promise<number> {
  const visibleRoomNames = rooms.map((r) => r.name);
  return WorkingStatus.countDocuments({
    date,
    status: { $in: BOOKED_STATUSES },
    $or: [{ room: { $in: visibleRoomNames } }, { room: null }, { room: '' }],
  });
}

export async function isCapacityAvailable(date: string, rooms: VisibleRoom[]): Promise<boolean> {
  const booked = await getBookedCount(date, rooms);
  return booked < getTotalCapacity(rooms);
}

export async function getWaitingList(date: string): Promise<IWorkingStatus[]> {
  return WorkingStatus.find({ date, status: 'waiting_list' }).sort({ createdAt: 1 });
}

export async function promoteFromWaitingList(date: string): Promise<void> {
  const waitingList = await getWaitingList(date);
  if (waitingList.length === 0) return;

  const first = waitingList[0];
  const waitingUser = await User.findById(first.userId).lean();
  const rooms = await getVisibleRoomsForUser({
    role: waitingUser?.role ?? 'employee',
    dblueOfficeRooms: waitingUser?.dblueOfficeRooms,
  });

  const available = await isCapacityAvailable(date, rooms);
  if (!available) return;

  await WorkingStatus.findByIdAndUpdate(first._id, { $set: { status: 'in_office' } });
  console.log(`WaitingList: utente ${first.userId} promosso per data ${date}`);

  if (waitingUser?.email) {
    sendWaitingListPromotion(waitingUser.email, date).catch((err) =>
      console.error('sendWaitingListPromotion error:', err)
    );
  }
}

// Broadcast target for the live WebSocket update — capacità è per-utente
// (getVisibleRoomsForUser), non più solo per-ruolo: il chiamante (websocket.service.ts)
// risolve l'elenco stanze visibili per ciascuna connessione e lo passa qui, questa
// funzione resta agnostica rispetto al flag/alla provenienza dell'elenco.
export async function getPresenceBreakdown(date: string, rooms: VisibleRoom[]): Promise<PresenceBreakdown> {
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
  const totalCapacity = getTotalCapacity(rooms);

  return { date, rooms: roomOccupancies, extras, totalBooked, totalCapacity };
}
