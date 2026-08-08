import { Types } from 'mongoose';
import { User } from '../models/user.model';
import { Room, seedDefaultRooms } from '../models/room.model';
import { WorkingStatus, WorkingStatusValue } from '../models/working-status.model';
import { DEV_ACCOUNTS } from '../routes/auth.routes';
import { getBookingAppSession } from './dblueOfficeApi.service';
import { syncUserFromDblueOfficeIfEnabled } from './userSync.service';
import { syncUserDirectoryIfEnabled } from './userDirectorySync.service';

// ─── Seeded pseudo-random (riproducibile) ────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

// ─── Date helpers ────────────────────────────────────────────────────────────

const IT_HOLIDAYS = new Set([
  '2025-01-01', '2025-01-06', '2025-04-18', '2025-04-21', '2025-04-25',
  '2025-05-01', '2025-06-02', '2025-08-15', '2025-11-01', '2025-12-08',
  '2025-12-25', '2025-12-26',
  '2026-01-01', '2026-01-06', '2026-04-03', '2026-04-06', '2026-04-25',
  '2026-05-01', '2026-06-02', '2026-08-17', '2026-11-02', '2026-12-08',
  '2026-12-25', '2026-12-28',
]);

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWorkingDay(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !IT_HOLIDAYS.has(dateStr);
}

function workingDaysInRange(startStr: string, endStr: string): string[] {
  const days: string[] = [];
  const cur = new Date(startStr + 'T12:00:00Z');
  const end = new Date(endStr + 'T12:00:00Z');
  while (cur <= end) {
    const s = toDateStr(cur);
    if (isWorkingDay(s)) days.push(s);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function monthEnd(year: number, month: number): string {
  return toDateStr(new Date(Date.UTC(year, month, 0)));
}

// ─── Generazione status ──────────────────────────────────────────────────────

const OFFICE_STATUSES: WorkingStatusValue[] = ['in_office', 'office_no_desk'];

interface RoomPoolEntry {
  name: string;
  capacity: number;
  color?: string;
}

type ColleagueProfile = {
  officeProb: number;
  remoteProb: number;
  sickProb: number;
};

// officeProb tuned so the pool's average (~0.16) keeps a typical day's organic
// attendance comfortably under a modest office capacity — the real room pool now
// comes from dblue-office at seed time (unknown when this comment was written),
// so the *guaranteed* full day is what actually demonstrates "full" (see
// fullCapacityTestDate below); these probabilities just keep every OTHER day from
// also organically reading as full.
function generateColleagueProfile(seed: number): ColleagueProfile {
  const rng = seededRandom(seed);
  const r = rng();
  if (r < 0.2) return { officeProb: 0.25, remoteProb: 0.65, sickProb: 0.03 };
  if (r < 0.5) return { officeProb: 0.18, remoteProb: 0.72, sickProb: 0.03 };
  return { officeProb: 0.12, remoteProb: 0.78, sickProb: 0.03 };
}

interface StatusRecord {
  userId: Types.ObjectId;
  date: string;
  status: WorkingStatusValue;
  isConfirmed: boolean;
  confirmedAt?: Date;
  room?: string;
  isUsingDesk?: boolean;
  isRetrofit: boolean;
  isLastMinuteUnbooking: boolean;
  isSeeded: boolean;
}

function buildStatusForUser(
  userId: Types.ObjectId,
  days: string[],
  profile: ColleagueProfile,
  lastMinutePerMonth: number,
  baseSeed: number,
  todayStr: string,
  roomPool: RoomPoolEntry[],
): StatusRecord[] {
  const rng = seededRandom(baseSeed);
  const records: StatusRecord[] = [];

  const lastMinuteDays = new Set<string>();
  const byMonth: Record<string, string[]> = {};
  for (const d of days) {
    const m = d.slice(0, 7);
    (byMonth[m] = byMonth[m] ?? []).push(d);
  }
  for (const monthDays of Object.values(byMonth)) {
    const officeDays = monthDays.filter(() => rng() < profile.officeProb);
    for (let i = 0; i < lastMinutePerMonth && i < officeDays.length; i++) {
      lastMinuteDays.add(officeDays[Math.floor(rng() * officeDays.length)]);
    }
  }

  for (const date of days) {
    const r = rng();
    let status: WorkingStatusValue;
    let room: string | undefined;
    let isUsingDesk = false;

    if (r < profile.officeProb) {
      status = 'in_office';
      room = roomPool[Math.floor(rng() * roomPool.length)].name;
      isUsingDesk = true;
    } else if (r < profile.officeProb + profile.remoteProb) {
      status = 'remote';
    } else if (r < profile.officeProb + profile.remoteProb + profile.sickProb) {
      status = 'sick';
    } else if (r < profile.officeProb + profile.remoteProb + profile.sickProb + 0.01) {
      status = 'mission';
    } else {
      status = 'leave';
    }

    const isPast = date <= todayStr;
    const rec: StatusRecord = {
      userId,
      date,
      status,
      isConfirmed: isPast,
      confirmedAt: isPast ? new Date(date + 'T18:00:00Z') : undefined,
      isRetrofit: false,
      isLastMinuteUnbooking: lastMinuteDays.has(date),
      isSeeded: true,
    };
    if (room) rec.room = room;
    if (isUsingDesk) rec.isUsingDesk = true;
    records.push(rec);
  }

  return records;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export interface SeedSummary {
  users: number;
  rooms: number;
  workingStatuses: number;
  rangeMe: string;
  rangeColleagues: string;
  fullCapacityTestDate: string | null;
}

export async function runSeed(fresh = false): Promise<SeedSummary> {
  if (fresh) {
    await WorkingStatus.deleteMany({});
    await Room.deleteMany({});
    await User.deleteMany({});
  }

  const meData = {
    googleId: 'dev-login',
    email: 'dev@dblue.it',
    name: 'Simone Razzano',
    role: 'owner' as const,
    contract: { presenceDaysTarget: 10 },
    onboardingCompleted: true,
  };
  const meUser = await User.findOneAndUpdate(
    { email: meData.email },
    meData,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // The other 5 fixed dev-login accounts (mario.rossi, sara.ferrari, etc.) are
  // normally upserted lazily on first /auth/dev-login, not by this function — after
  // a fresh:true reseed (which wipes every User), that leaves them nonexistent until
  // something logs in as them. Create them here too, same upsert shape dev-login
  // itself uses, so they're immediately usable right after a reseed instead of only
  // after their first login. onboardingCompleted:true is forced ONLY at creation time
  // ($setOnInsert, not $set) so these accounts never hit the onboarding overlay on a
  // fresh reseed — nothing exercises it for director/admin_member/lab_responsible, so
  // without this they'd stay stuck at the schema default (false) forever. Using $set
  // instead would stomp on a deliberate mid-suite reset (resetOnboarding(), used by
  // H-01/H-02 to exercise the onboarding flow itself) on every subsequent call.
  const devUsers = [meUser];
  for (const account of DEV_ACCOUNTS) {
    if (account.email === meData.email) continue;
    const u = await User.findOneAndUpdate(
      { email: account.email },
      { $setOnInsert: { googleId: `dev-login:${account.email}`, email: account.email, name: account.name, onboardingCompleted: true }, $set: { role: account.role } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    devUsers.push(u);
  }

  // Real role/rooms/presence-target for the 6 dev accounts, straight from
  // dblue-office — always (force:true), independent of the live integration flag:
  // seed is a distinct, deliberate admin action, not the request-time behavior the
  // flag governs. Best-effort per account: one not yet provisioned in dblue-office
  // shouldn't block the whole reseed, it just keeps its local fallback role above.
  for (const u of devUsers) {
    try {
      await syncUserFromDblueOfficeIfEnabled(u, { force: true });
    } catch (err) {
      console.warn(`[seed] dblue-office sync fallita per ${u.email}, mantengo il ruolo locale: ${(err as Error).message}`);
    }
  }

  // Real room catalog — foundational input, no fallback: without it there is no
  // authoritative name/capacity data to generate coherent presence records against.
  // Let a failure here abort runSeed() entirely (surfaced as an error on
  // POST /admin/seed) rather than silently falling back to something synthetic.
  const session = await getBookingAppSession(meData.email);
  const roomPool: RoomPoolEntry[] = session.allRooms
    .filter((r) => r.isActive)
    .map((r) => ({ name: r.name, capacity: r.capacity, color: r.color }));
  if (roomPool.length === 0) {
    throw new Error('dblue-office non ha restituito nessuna stanza attiva: impossibile generare i dati seed.');
  }

  await seedDefaultRooms(
    meUser._id as Types.ObjectId,
    roomPool.map((r) => ({ name: r.name, type: 'open_space' as const, capacity: r.capacity, color: r.color ?? '#94a3b8' }))
  );

  // Full real directory → shadow local Users (same upsert the app already does when
  // it syncs the directory live) — force:true bypasses both the flag check and the
  // 30-minute TTL, so a reseed always takes a fresh snapshot.
  await syncUserDirectoryIfEnabled(meData.email, { force: true });
  const devEmails = DEV_ACCOUNTS.map((a) => a.email);
  const colleagueUsers = await User.find({ email: { $nin: devEmails } });

  const now = new Date();
  const todayStr = toDateStr(now);

  const meStartDate = (() => {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - 13);
    d.setUTCDate(1);
    return toDateStr(d);
  })();
  const meEndDate = monthEnd(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const meDays = workingDaysInRange(meStartDate, meEndDate);

  const colleaguesStartDate = (() => {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - 3);
    d.setUTCDate(1);
    return toDateStr(d);
  })();
  const colleaguesDays = workingDaysInRange(colleaguesStartDate, meEndDate);

  // Guarantee ONE fully-booked future day so the waiting-list flow can always be
  // tested, without every other day also reading as full: officeProb above is tuned
  // so organic attendance normally stays comfortably under capacity. Seeding only
  // ever assigns rooms from roomPool (the real dblue-office catalog fetched above),
  // so "full" here is measured against that pool's real total capacity.
  const fullCapacityTestDate = colleaguesDays.find((d) => d > todayStr) ?? null;
  const openSpaceCapacityByRoom = new Map(roomPool.map((r) => [r.name, r.capacity]));
  const fullCapacityTestSeats = roomPool.reduce((sum, r) => sum + r.capacity, 0);

  const meRecords = buildStatusForUser(
    meUser._id as Types.ObjectId,
    meDays,
    { officeProb: 0.30, remoteProb: 0.58, sickProb: 0.04 },
    3,
    42,
    todayStr,
    roomPool,
  );
  if (fullCapacityTestDate) {
    const meTestRecord = meRecords.find((r) => r.date === fullCapacityTestDate);
    if (meTestRecord) {
      meTestRecord.status = 'pending';
      meTestRecord.isConfirmed = false;
      meTestRecord.confirmedAt = undefined;
      delete meTestRecord.room;
      delete meTestRecord.isUsingDesk;
    }
  }

  const colleagueRecordsByUser: Array<{ user: (typeof colleagueUsers)[number]; records: StatusRecord[] }> = [];
  for (let i = 0; i < colleagueUsers.length; i++) {
    const u = colleagueUsers[i];
    const profile = generateColleagueProfile(i * 100 + 7);
    const records = buildStatusForUser(
      u._id as Types.ObjectId,
      colleaguesDays,
      profile,
      i % 5 === 0 ? 2 : 0,
      i * 999 + 13,
      todayStr,
      roomPool,
    );
    if (fullCapacityTestDate) {
      const testRecord = records.find((r) => r.date === fullCapacityTestDate);
      if (testRecord) {
        if (i < fullCapacityTestSeats) {
          testRecord.status = 'in_office';
          testRecord.room = roomPool[i % roomPool.length].name;
          testRecord.isUsingDesk = true;
          testRecord.isConfirmed = false;
          testRecord.confirmedAt = undefined;
        } else if (i < fullCapacityTestSeats + 2) {
          testRecord.status = 'waiting_list';
          testRecord.isConfirmed = false;
          testRecord.confirmedAt = undefined;
          delete testRecord.room;
          delete testRecord.isUsingDesk;
        }
      }
    }
    colleagueRecordsByUser.push({ user: u, records });
  }

  // Cap organic daily office attendance to each room's real capacity, not just the
  // office-wide total. Each user's day (and room preference) is generated independently
  // with no cross-user awareness — capping only the aggregate total isn't enough to
  // prevent a single room from being "overbooked" (e.g. 9 people randomly landing in
  // the same room on the same date) while the office-wide total still reads as under
  // capacity. Demote per-room overflow to waiting_list, same as upsertStatus() would
  // for a real booking once that room is full.
  const byDateRoom = new Map<string, Map<string, StatusRecord[]>>();
  for (const r of [...meRecords, ...colleagueRecordsByUser.flatMap((c) => c.records)]) {
    if (!OFFICE_STATUSES.includes(r.status) || !r.room) continue;
    const roomMap = byDateRoom.get(r.date) ?? new Map<string, StatusRecord[]>();
    const list = roomMap.get(r.room) ?? [];
    list.push(r);
    roomMap.set(r.room, list);
    byDateRoom.set(r.date, roomMap);
  }
  for (const roomMap of byDateRoom.values()) {
    for (const [roomName, records] of roomMap) {
      const capacity = openSpaceCapacityByRoom.get(roomName) ?? 0;
      for (const r of records.slice(capacity)) {
        r.status = 'waiting_list';
        delete r.room;
        delete r.isUsingDesk;
      }
    }
  }

  await WorkingStatus.deleteMany({ userId: meUser._id });
  await WorkingStatus.insertMany(meRecords);

  let totalColleagueRecords = 0;
  for (const { user: u, records } of colleagueRecordsByUser) {
    await WorkingStatus.deleteMany({ userId: u._id });
    await WorkingStatus.insertMany(records);
    totalColleagueRecords += records.length;
  }

  const defaultTeammates = colleagueUsers.slice(0, 5).map((u) => u._id);
  await User.updateOne({ _id: meUser._id }, { teammates: defaultTeammates });

  return {
    users: 1 + colleagueUsers.length,
    rooms: roomPool.length,
    workingStatuses: meRecords.length + totalColleagueRecords,
    rangeMe: `${meStartDate} → ${meEndDate}`,
    rangeColleagues: `${colleaguesStartDate} → ${meEndDate}`,
    fullCapacityTestDate,
  };
}
