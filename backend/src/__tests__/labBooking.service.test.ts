import { connect, disconnect, clearDatabase } from './setup';
import { createUser, createRoom } from './helpers';
import { LabBooking } from '../models/lab-booking.model';
import { bookLab, unbookLab, getLabBookingsByDate } from '../services/labBooking.service';

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('labBooking.service', () => {
  it('books the lab room visible to the acting user and records their real name', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'DBLue Innovation Lab', type: 'lab', capacity: 4, visibleRoles: ['lab_responsible'] });
    const labResponsible = await createUser({ role: 'lab_responsible', name: 'Sara Ferrari' });
    const date = tomorrowStr();

    const result = await bookLab(date, {
      _id: labResponsible._id,
      role: labResponsible.role,
      name: labResponsible.name,
    });

    expect(result).toEqual({ date, isLabBooked: true, labBookerName: 'Sara Ferrari' });
    const stored = await LabBooking.findOne({ date }).lean();
    expect(stored?.roomName).toBe('DBLue Innovation Lab');
    expect(stored?.bookedByName).toBe('Sara Ferrari');
  });

  it('rejects booking when the acting user has no lab room visible', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'Blue', type: 'open_space', capacity: 4 });
    const employee = await createUser({ role: 'employee', name: 'Mario Rossi' });
    const date = tomorrowStr();

    await expect(
      bookLab(date, { _id: employee._id, role: employee.role, name: employee.name })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await LabBooking.findOne({ date })).toBeNull();
  });

  it('re-booking the same date overwrites the previous booker (collective privilege, not per-booker exclusivity)', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'DBLue Innovation Lab', type: 'lab', capacity: 4, visibleRoles: ['lab_responsible'] });
    const sara = await createUser({ role: 'lab_responsible', name: 'Sara Ferrari' });
    const otherLabResponsible = await createUser({ role: 'lab_responsible', name: 'Bhavesh Sharma' });
    const date = tomorrowStr();

    await bookLab(date, { _id: sara._id, role: sara.role, name: sara.name });
    const result = await bookLab(date, {
      _id: otherLabResponsible._id,
      role: otherLabResponsible.role,
      name: otherLabResponsible.name,
    });

    expect(result.labBookerName).toBe('Bhavesh Sharma');
    expect(await LabBooking.countDocuments({ date })).toBe(1);
  });

  it('unbooks by deleting the record for that date', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'DBLue Innovation Lab', type: 'lab', capacity: 4, visibleRoles: ['lab_responsible'] });
    const labResponsible = await createUser({ role: 'lab_responsible', name: 'Sara Ferrari' });
    const date = tomorrowStr();
    await bookLab(date, { _id: labResponsible._id, role: labResponsible.role, name: labResponsible.name });

    const result = await unbookLab(date);

    expect(result).toEqual({ date, isLabBooked: false });
    expect(await LabBooking.findOne({ date })).toBeNull();
  });

  it('getLabBookingsByDate returns only bookings in range, keyed by date', async () => {
    const owner = await createUser({ role: 'owner' });
    await createRoom(owner._id, { name: 'DBLue Innovation Lab', type: 'lab', capacity: 4, visibleRoles: ['lab_responsible'] });
    const labResponsible = await createUser({ role: 'lab_responsible', name: 'Sara Ferrari' });
    const inRange = tomorrowStr();
    await bookLab(inRange, { _id: labResponsible._id, role: labResponsible.role, name: labResponsible.name });
    await LabBooking.create({ date: '2099-01-01', roomName: 'DBLue Innovation Lab', bookedBy: labResponsible._id, bookedByName: 'Sara Ferrari' });

    const map = await getLabBookingsByDate(inRange, inRange);

    expect(map.size).toBe(1);
    expect(map.get(inRange)).toEqual({ labBookerName: 'Sara Ferrari' });
  });
});
