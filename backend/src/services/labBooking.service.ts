import { Types } from 'mongoose';
import { LabBooking } from '../models/lab-booking.model';
import { VisibleRoom, Role, getVisibleRoomsForUser } from './capacity.service';

// Quale stanza, tra quelle visibili all'utente, è "il Lab" — un solo campo,
// VisibleRoom.isLab, popolato a monte da getVisibleRoomsForUser() (locale: da
// room.type==='lab'; API: passato 1:1 dal campo dblue-office). Nessuna logica di
// riconoscimento qui: se nessuna stanza visibile ha isLab, degrado esplicito (409),
// non un crash — es. in modalità API finché dblue-office non implementa il campo.
export function findLabRoom(rooms: VisibleRoom[]): VisibleRoom | undefined {
  return rooms.find((r) => r.isLab);
}

export async function bookLab(
  date: string,
  actingUser: { _id: Types.ObjectId; role: Role; name: string; dblueOfficeRooms?: VisibleRoom[] }
): Promise<{ date: string; isLabBooked: true; labBookerName: string }> {
  const rooms = await getVisibleRoomsForUser({
    role: actingUser.role,
    dblueOfficeRooms: actingUser.dblueOfficeRooms,
  });
  const labRoom = findLabRoom(rooms);
  if (!labRoom) {
    const err = Object.assign(new Error('Nessuna stanza Lab configurata per il tuo account'), { statusCode: 409 });
    throw err;
  }

  await LabBooking.findOneAndUpdate(
    { date },
    { date, roomName: labRoom.name, bookedBy: actingUser._id, bookedByName: actingUser.name },
    { upsert: true }
  );

  return { date, isLabBooked: true, labBookerName: actingUser.name };
}

export async function unbookLab(date: string): Promise<{ date: string; isLabBooked: false }> {
  await LabBooking.findOneAndDelete({ date });
  return { date, isLabBooked: false };
}

// Batch lookup per un range di date — usato da getStatusForUser() per arricchire
// ogni giorno senza una query per data (stessa convenzione delle altre query batch
// in quella funzione).
export async function getLabBookingsByDate(
  startDate: string,
  endDate: string
): Promise<Map<string, { labBookerName: string }>> {
  const bookings = await LabBooking.find({ date: { $gte: startDate, $lte: endDate } }).lean();
  return new Map(bookings.map((b) => [b.date, { labBookerName: b.bookedByName }]));
}
