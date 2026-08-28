import { Types } from 'mongoose';
import { WorkingStatus } from '../models/working-status.model';
import { User, IUser } from '../models/user.model';
import { getClosures, OfficeClosure } from './closures.service';
import { getWorkingDaysOfMonth } from './working-status.service';

export interface MonthlyStats {
  month: string;
  presenceDaysConfirmed: number;
  // null = nessun target per questo utente (dblue-office mandatory_presence_days:null)
  presenceDaysTarget: number | null;
  distribution: {
    inOffice: number;
    remote: number;
    mission: number;
    leave: number;
    sick: number;
  };
  unbooking: {
    standard: number;
    lastMinute: number;
  };
}

export interface AnnualStats {
  year: number;
  monthlyBreakdown: Array<{ month: string; presenceDaysConfirmed: number; presenceDaysTarget: number | null }>;
  totalUnbooking: { standard: number; lastMinute: number };
  averageMonthlyPresenceDays: number;
}

export interface AreaStats {
  month: string;
  totalUsers: number;
  avgPresenceDaysConfirmed: number;
  usersAboveTarget: number;
  usersBelowTarget: number;
  totalUnbooking: { standard: number; lastMinute: number };
}

// Conta, tra le chiusure marcate isNonWorkingDay (festività, nessuna presenza attesa),
// quanti giorni lavorativi del mese cadono in un range di chiusura — da escludere dal
// denominatore del target proporzionale. Le chiusure isNonWorkingDay:false ("ufficio
// chiuso ma si lavora da remoto") non riducono il target: la presenza resta attesa.
function countClosureNonWorkingDaysInMonth(month: string, closures: OfficeClosure[]): number {
  const workingDays = new Set(getWorkingDaysOfMonth(month));
  let count = 0;
  for (const c of closures) {
    if (!c.isNonWorkingDay) continue;
    const cur = new Date(c.start);
    const end = new Date(c.end);
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10);
      if (workingDays.has(d)) count++;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return count;
}

export async function getMonthlyStats(userId: string, month: string, requesterEmail?: string): Promise<MonthlyStats> {
  const prefix = `${month}-`;

  const [statuses, user] = await Promise.all([
    WorkingStatus.find({ userId: new Types.ObjectId(userId), date: { $regex: `^${prefix}` } }).lean(),
    User.findById(userId).lean(),
  ]);

  const presenceDaysConfirmed = statuses.filter(
    (ws) => ws.status === 'in_office' && ws.isConfirmed
  ).length;

  const distribution = {
    inOffice: statuses.filter((ws) => ws.status === 'in_office' && ws.isConfirmed).length,
    remote: statuses.filter((ws) => ws.status === 'remote' && ws.isConfirmed).length,
    mission: statuses.filter((ws) => ws.status === 'mission' && ws.isConfirmed).length,
    leave: statuses.filter(
      (ws) => (ws.status === 'leave' || ws.status === 'parental_leave' || ws.status === 'long_term_leave') && ws.isConfirmed
    ).length,
    sick: statuses.filter((ws) => ws.status === 'sick' && ws.isConfirmed).length,
  };

  const unbooking = {
    // TODO: standard unbooking requires a "was_booked_and_cancelled" flag not yet tracked
    standard: 0,
    lastMinute: statuses.filter((ws) => ws.isLastMinuteUnbooking).length,
  };

  const rawTarget = user?.contract?.presenceDaysTarget ?? null;
  const closures = requesterEmail ? await getClosures(requesterEmail) : [];
  const allWorkingDays = getWorkingDaysOfMonth(month);
  const closureNonWorkingDays = countClosureNonWorkingDaysInMonth(month, closures);
  const workingDaysCount = allWorkingDays.length - closureNonWorkingDays;
  const absenceDays = distribution.leave + distribution.sick;
  const effectiveWorkingDays = Math.max(0, workingDaysCount - absenceDays);

  const presenceDaysTarget =
    rawTarget === null || workingDaysCount === 0
      ? rawTarget
      : Math.round((rawTarget * effectiveWorkingDays) / workingDaysCount);

  return { month, presenceDaysConfirmed, presenceDaysTarget, distribution, unbooking };
}

export async function getAnnualStats(userId: string, year: number, requesterEmail?: string): Promise<AnnualStats> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const completedMonths: string[] = [];
  const lastMonth = year < currentYear ? 12 : currentMonth - 1;
  for (let m = 1; m <= lastMonth; m++) {
    completedMonths.push(`${year}-${String(m).padStart(2, '0')}`);
  }

  const monthlyResults = await Promise.all(
    completedMonths.map((month) => getMonthlyStats(userId, month, requesterEmail))
  );

  const monthlyBreakdown = monthlyResults.map(({ month, presenceDaysConfirmed, presenceDaysTarget }) => ({
    month,
    presenceDaysConfirmed,
    presenceDaysTarget,
  }));

  const totalUnbooking = monthlyResults.reduce(
    (acc, m) => ({
      standard: acc.standard + m.unbooking.standard,
      lastMinute: acc.lastMinute + m.unbooking.lastMinute,
    }),
    { standard: 0, lastMinute: 0 }
  );

  const averageMonthlyPresenceDays =
    monthlyResults.length > 0
      ? monthlyResults.reduce((sum, m) => sum + m.presenceDaysConfirmed, 0) / monthlyResults.length
      : 0;

  return { year, monthlyBreakdown, totalUnbooking, averageMonthlyPresenceDays };
}

export async function getAreaStats(month: string, requestingUser: IUser): Promise<AreaStats> {
  if (requestingUser.role !== 'director' && requestingUser.role !== 'owner') {
    const err = Object.assign(new Error('Permesso negato'), { statusCode: 403 });
    throw err;
  }

  const prefix = `${month}-`;

  const [allUsers, allStatuses] = await Promise.all([
    User.find({}).lean(),
    WorkingStatus.find({ date: { $regex: `^${prefix}` } }).lean(),
  ]);

  const totalUsers = allUsers.length;

  // Fuori scope qui: la KPI di adherence dell'area (director/owner) resta con un
  // default di 10 per chi non ha un target — cambiare questo cambierebbe anche il
  // significato di totalUsers nel denominatore, non richiesto in questo giro.
  const userTarget = new Map(
    allUsers.map((u) => [u._id.toString(), u.contract?.presenceDaysTarget ?? 10])
  );

  const confirmedByUser = new Map<string, number>();
  let totalLastMinute = 0;
  let totalStandard = 0;

  for (const ws of allStatuses) {
    const uid = ws.userId.toString();
    if (ws.status === 'in_office' && ws.isConfirmed) {
      confirmedByUser.set(uid, (confirmedByUser.get(uid) ?? 0) + 1);
    }
    if (ws.isLastMinuteUnbooking) totalLastMinute++;
    // TODO: standard unbooking requires a "was_booked_and_cancelled" flag not yet tracked
  }

  const avgPresenceDaysConfirmed =
    totalUsers > 0
      ? Array.from(confirmedByUser.values()).reduce((sum, v) => sum + v, 0) / totalUsers
      : 0;

  let usersAboveTarget = 0;
  let usersBelowTarget = 0;

  for (const u of allUsers) {
    const uid = u._id.toString();
    const confirmed = confirmedByUser.get(uid) ?? 0;
    const target = userTarget.get(uid) ?? 10;
    if (confirmed >= target) usersAboveTarget++;
    else usersBelowTarget++;
  }

  return {
    month,
    totalUsers,
    avgPresenceDaysConfirmed,
    usersAboveTarget,
    usersBelowTarget,
    totalUnbooking: { standard: totalStandard, lastMinute: totalLastMinute },
  };
}
