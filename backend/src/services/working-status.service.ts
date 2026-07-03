import { Types } from 'mongoose';
import { WorkingStatus, IWorkingStatus, WorkingStatusValue } from '../models/working-status.model';
import { User } from '../models/user.model';
import { isCapacityAvailable, promoteFromWaitingList, getTotalCapacity } from './capacity.service';
import { sendSickLeaveConfirmation } from './email.service';

// Returns true if date is today or tomorrow
export function isLastMinute(date: string): boolean {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  return date === todayStr || date === tomorrowStr;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getWorkingDaysOfMonth(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  const days: string[] = [];
  const date = new Date(year, mon - 1, 1);
  while (date.getMonth() === mon - 1) {
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(date.toISOString().slice(0, 10));
    }
    date.setDate(date.getDate() + 1);
  }
  return days;
}

const OFFICE_STATUSES: WorkingStatusValue[] = ['in_office', 'office_no_desk'];

export async function getStatusForUser(
  userId: Types.ObjectId,
  month: string
): Promise<object[]> {
  const workingDays = getWorkingDaysOfMonth(month);
  const startDate = workingDays[0];
  const endDate = workingDays[workingDays.length - 1];

  const [userStatuses, allOfficeStatuses, totalCapacity, user] = await Promise.all([
    WorkingStatus.find({ userId, date: { $gte: startDate, $lte: endDate } }).lean(),
    WorkingStatus.find({
      date: { $gte: startDate, $lte: endDate },
      status: { $in: OFFICE_STATUSES },
    })
      .populate('userId', 'avatar _id teammates')
      .lean(),
    getTotalCapacity(month),
    User.findById(userId).lean(),
  ]);

  const teammateIds = new Set((user?.teammates ?? []).map((t: Types.ObjectId) => t.toString()));

  const userStatusByDate = new Map(userStatuses.map((ws) => [ws.date, ws]));

  // Group all office statuses by date
  const officeByDate = new Map<string, typeof allOfficeStatuses>();
  for (const ws of allOfficeStatuses) {
    const arr = officeByDate.get(ws.date) ?? [];
    arr.push(ws);
    officeByDate.set(ws.date, arr);
  }

  return workingDays.map((date) => {
    const existing = userStatusByDate.get(date);
    const officeEntries = officeByDate.get(date) ?? [];
    const bookedCount = officeEntries.length;

    // TODO (RBAC area filter): employee/lab_responsible/admin_member should only see colleagues
    // in their own area/floor. Director and owner see everyone. Add filter here once the
    // `area` field is added to the User model. For now all roles see all in-office colleagues.
    const colleagueAvatars = officeEntries
      .filter((ws) => ws.userId.toString() !== userId.toString())
      .slice(0, 10)
      .map((ws) => {
        const u = ws.userId as unknown as { _id: Types.ObjectId; avatar?: string };
        return u.avatar ?? null;
      })
      .filter(Boolean);

    const projectTeammatesCount = officeEntries.filter((ws) => {
      const uid = (ws.userId as unknown as { _id: Types.ObjectId })._id.toString();
      return teammateIds.has(uid);
    }).length;

    const base = existing ?? { date, status: 'pending', isConfirmed: false };

    return {
      ...base,
      bookedCount,
      totalCapacity,
      colleagueAvatars,
      projectTeammatesCount,
    };
  });
}

export async function upsertStatus(
  userId: Types.ObjectId,
  date: string,
  payload: { status: string; isUsingDesk?: boolean; room?: string }
): Promise<IWorkingStatus> {
  payload = { ...payload, status: payload.status.toLowerCase() };

  const existing = await WorkingStatus.findOne({ userId, date });

  if (existing?.isConfirmed && date !== getTodayStr()) {
    const err = Object.assign(new Error('Status già confermato, non modificabile'), { statusCode: 409 });
    throw err;
  }

  if (payload.status === 'sick' && date !== getTodayStr()) {
    const err = Object.assign(new Error('Malattia dichiarabile solo per il giorno corrente'), { statusCode: 400 });
    throw err;
  }

  const unbookingStatuses: WorkingStatusValue[] = ['remote', 'pending', 'leave', 'sick', 'mission'];
  const wasOfficeBooked =
    existing && (['in_office', 'office_no_desk'] as WorkingStatusValue[]).includes(existing.status);
  const wasBooked = existing && (['in_office', 'waiting_list'] as WorkingStatusValue[]).includes(existing.status);
  const isUnbooking = unbookingStatuses.includes(payload.status as WorkingStatusValue);
  const isLastMinuteUnbooking = !!(wasBooked && isUnbooking && isLastMinute(date));

  // Capacity gate: if requesting in_office but office is full, downgrade to waiting_list
  let finalStatus = payload.status;
  if (payload.status === 'in_office') {
    const available = await isCapacityAvailable(date);
    if (!available) {
      finalStatus = 'waiting_list';
    }
  }

  const result = await WorkingStatus.findOneAndUpdate(
    { userId, date },
    {
      $set: {
        status: finalStatus,
        ...(payload.isUsingDesk !== undefined && { isUsingDesk: payload.isUsingDesk }),
        ...(payload.room !== undefined && { room: payload.room }),
        isLastMinuteUnbooking,
        isConfirmed: false,
      },
      $unset: { confirmedAt: '' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Fire-and-forget promotion when a desk is freed
  if (wasOfficeBooked && isUnbooking) {
    promoteFromWaitingList(date).catch((err) =>
      console.error('promoteFromWaitingList error:', err)
    );
  }

  // Fire-and-forget sick leave confirmation email (only for today)
  if (payload.status === 'sick' && date === getTodayStr()) {
    User.findById(userId)
      .lean()
      .then((user) => {
        if (user?.email) {
          sendSickLeaveConfirmation(user.email, date).catch((err) =>
            console.error('sendSickLeaveConfirmation error:', err)
          );
        }
      })
      .catch((err) => console.error('sick email lookup error:', err));
  }

  return result!;
}

export async function bulkUpsertStatus(
  userId: Types.ObjectId,
  updates: Array<{ date: string; status: string; isUsingDesk?: boolean; room?: string }>
): Promise<{ succeeded: IWorkingStatus[]; failed: Array<{ date: string; error: string }> }> {
  const succeeded: IWorkingStatus[] = [];
  const failed: Array<{ date: string; error: string }> = [];

  for (const update of updates) {
    try {
      const result = await upsertStatus(userId, update.date, update);
      succeeded.push(result);
    } catch (err) {
      failed.push({ date: update.date, error: (err as Error).message });
    }
  }

  return { succeeded, failed };
}

export async function updateOffTime(
  userId: Types.ObjectId,
  date: string,
  offTime: { type: 'morning' | 'afternoon' | 'custom'; hours?: number } | null
): Promise<IWorkingStatus> {
  const result = await WorkingStatus.findOneAndUpdate(
    { userId, date },
    { $set: { offTime: offTime ?? undefined } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return result!;
}

export async function retrofitStatus(
  userId: Types.ObjectId,
  date: string,
  payload: { status: string; offTime?: { type: 'morning' | 'afternoon' | 'custom'; hours?: number } }
): Promise<IWorkingStatus> {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = (() => {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const dateMonth = date.slice(0, 7);
  if (dateMonth !== prevMonth) {
    const err = Object.assign(
      new Error(`Retrofit consentito solo per il mese precedente (${prevMonth})`),
      { statusCode: 400 }
    );
    throw err;
  }

  const existing = await WorkingStatus.findOne({ userId, date });
  if (existing?.isConfirmed) {
    const err = Object.assign(new Error('Status già confermato, non modificabile'), { statusCode: 409 });
    throw err;
  }

  const result = await WorkingStatus.findOneAndUpdate(
    { userId, date },
    {
      $set: {
        status: payload.status.toLowerCase(),
        isRetrofit: true,
        ...(payload.offTime !== undefined && { offTime: payload.offTime }),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Suppress unused variable warning
  void currentMonth;

  return result!;
}

export interface ColleaguePresenceItem {
  userId: string;
  name: string;
  status: string;
  room?: string;
  isConfirmed?: boolean;
}

export async function getColleaguePresences(
  date: string,
  requestingUserId: string
): Promise<ColleaguePresenceItem[]> {
  const [allUsers, dayStatuses] = await Promise.all([
    User.find({}).select('name').lean(),
    WorkingStatus.find({ date }).lean(),
  ]);

  const statusByUser = new Map(
    dayStatuses.map((ws) => [ws.userId.toString(), ws])
  );

  return allUsers
    .filter((u) => u._id.toString() !== requestingUserId)
    .map((u) => {
      const ws = statusByUser.get(u._id.toString());
      return {
        userId: u._id.toString(),
        name: u.name,
        status: ws?.status ?? 'pending',
        room: ws?.room,
        isConfirmed: ws?.isConfirmed,
      };
    });
}
