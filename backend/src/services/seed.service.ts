import { Types } from 'mongoose';
import { User } from '../models/user.model';
import { Room, seedDefaultRooms } from '../models/room.model';
import { WorkingStatus, WorkingStatusValue } from '../models/working-status.model';

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

// ─── Dati colleghi ───────────────────────────────────────────────────────────

const COLLEAGUES = [
  'Alberto Pasquini', 'Alessandra Tedeschi', 'Alessandro Tedeschi Gallo',
  'Alessia Golfetti', 'Alexandra Ghita', 'Alice Salvatori', 'Ana Ferreira',
  'Anna Vicario', 'Andrea Capaccioli', 'Aurora De Bortoli', 'Andrea Carrieri',
  'Marianna Groia', 'Carla Fresia', 'Carlo Abate', 'Damiano Taurino',
  'Daria Verna', 'Elisa Spiller', 'Elizabeth Humm', 'Erica Vannucci',
  'Francesca Piazza', 'Francesca Margiotta', 'Francois Brambati',
  'Emanuela Laguardia', 'Angela Donati', 'Giorgio Sestili', 'Giuseppe Frau',
  'Linda Portoghese', 'Viviana S. Couto', 'Linda Napoletano', 'Luca Save',
  'Marta Cecconi', 'Mara Marzella', 'Marilea Laviola', 'Susanna Cohen',
  'Michela Cohen', 'Michela Terenzi', 'Micol Biscotto', 'Morena Ugulini',
  'Nicola Cavagnetto', 'Nikolas Giampaolo', 'Paola Lanzi', 'Paola Tomasello',
  'Patrizia Di Leonardo', 'Rebecca Hueting', 'Fabio Lovati',
  'Katarzyna Cichomska', 'Annalisa De Angelis', 'Simona Turco',
  'Simone Pozzi', 'Stefano Bonelli', 'Hossein Mapar', 'Tommaso Vendruscolo',
  'Vanessa Arrigoni', 'Vera Ferraiuolo', 'Debora Zanatto', 'Bhavesh Sharma',
  'Vladimira Canadyova', 'Serena Fabbrini', 'Serena Scuccimarra',
  'Teodora Mosor', 'Sonia Matera', 'Natalia Kravchenko', 'Marta Renzini',
  'Alfonso Levantesi', 'Emma Volpato', 'Veronika Takacs', 'Giusy Portolan',
  'Lorenzo Mancini', 'Daniele Ruscio', 'Matteo Cirillo', 'Leonie Stieren',
  'Virginia Procopio', 'Elisa Prati', 'Paris Vaiopoulos',
  'Domenico De Pasquali', 'Claudia Iasillo', 'Izabela Ihnatiuc',
  'Jean Baptiste Shamuana', 'Michele Di Virgilio', 'Ginevra Fedrizzi',
  'Olivia Cox', 'Silvia Torsi', 'Edoardo Pedicini', 'Lorenzo Cane',
  'Luca Cappello',
];

const ROLES_ASSIGNED: Record<string, 'director' | 'admin_member' | 'lab_responsible'> = {
  'Giorgio Sestili': 'director',
  'Patrizia Di Leonardo': 'director',
  'Marilea Laviola': 'admin_member',
  'Debora Zanatto': 'admin_member',
  'Carlo Abate': 'admin_member',
  'Hossein Mapar': 'lab_responsible',
  'Bhavesh Sharma': 'lab_responsible',
};

function nameToEmail(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s.]/g, '')
    .trim()
    .replace(/\s+/g, '.');
  return `${normalized}@dbluecorp.com`;
}

// ─── Generazione status ──────────────────────────────────────────────────────

const OPEN_SPACE_ROOMS = ['Blue', 'Red', 'Green'];

type ColleagueProfile = {
  officeProb: number;
  remoteProb: number;
  sickProb: number;
};

function generateColleagueProfile(seed: number): ColleagueProfile {
  const rng = seededRandom(seed);
  const r = rng();
  if (r < 0.2) return { officeProb: 0.7, remoteProb: 0.2, sickProb: 0.03 };
  if (r < 0.5) return { officeProb: 0.55, remoteProb: 0.35, sickProb: 0.03 };
  return { officeProb: 0.35, remoteProb: 0.55, sickProb: 0.03 };
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
}

function buildStatusForUser(
  userId: Types.ObjectId,
  days: string[],
  profile: ColleagueProfile,
  lastMinutePerMonth: number,
  baseSeed: number,
  todayStr: string,
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
      room = OPEN_SPACE_ROOMS[Math.floor(rng() * OPEN_SPACE_ROOMS.length)];
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

  const colleagueUsers = [];
  for (let i = 0; i < COLLEAGUES.length; i++) {
    const name = COLLEAGUES[i];
    const email = nameToEmail(name);
    const role = ROLES_ASSIGNED[name] ?? 'employee';
    const target = [8, 10, 10, 12][i % 4];
    const u = await User.findOneAndUpdate(
      { email },
      { googleId: `seed-${i}`, email, name, role, contract: { presenceDaysTarget: target }, onboardingCompleted: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    colleagueUsers.push(u);
  }

  await seedDefaultRooms(meUser._id as Types.ObjectId);

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

  const meRecords = buildStatusForUser(
    meUser._id as Types.ObjectId,
    meDays,
    { officeProb: 0.58, remoteProb: 0.30, sickProb: 0.04 },
    3,
    42,
    todayStr,
  );
  await WorkingStatus.deleteMany({ userId: meUser._id });
  await WorkingStatus.insertMany(meRecords);

  let totalColleagueRecords = 0;
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
    );
    await WorkingStatus.deleteMany({ userId: u._id });
    await WorkingStatus.insertMany(records);
    totalColleagueRecords += records.length;
  }

  const defaultTeammates = colleagueUsers.slice(0, 5).map((u) => u._id);
  await User.updateOne({ _id: meUser._id }, { teammates: defaultTeammates });

  return {
    users: 1 + colleagueUsers.length,
    rooms: 6,
    workingStatuses: meRecords.length + totalColleagueRecords,
    rangeMe: `${meStartDate} → ${meEndDate}`,
    rangeColleagues: `${colleaguesStartDate} → ${meEndDate}`,
  };
}
