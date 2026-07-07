import { Types } from 'mongoose';
import { WorkingStatus } from '../models/working-status.model';
import { User, IUser } from '../models/user.model';

export interface MonthlyStats {
  month: string;
  presenceDaysConfirmed: number;
  presenceDaysTarget: number;
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
  monthlyBreakdown: Array<{ month: string; presenceDaysConfirmed: number; presenceDaysTarget: number }>;
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

export async function getMonthlyStats(userId: string, month: string): Promise<MonthlyStats> {
  const prefix = `${month}-`;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [statuses, user] = await Promise.all([
    WorkingStatus.find({ userId: new Types.ObjectId(userId), date: { $regex: `^${prefix}` } }).lean(),
    User.findById(userId).lean(),
  ]);

  // A status can only be legitimately confirmed once its date has arrived
  // (via check-in or the same-day auto-confirm cron), so any future-dated
  // record is excluded regardless of its stored isConfirmed value.
  const isCounted = (ws: { isConfirmed: boolean; date: string }): boolean =>
    ws.isConfirmed && ws.date <= todayStr;

  const presenceDaysConfirmed = statuses.filter(
    (ws) => ws.status === 'in_office' && isCounted(ws)
  ).length;

  const presenceDaysTarget = user?.contract?.presenceDaysTarget ?? 10;

  const distribution = {
    inOffice: statuses.filter((ws) => ws.status === 'in_office' && isCounted(ws)).length,
    remote: statuses.filter((ws) => ws.status === 'remote' && isCounted(ws)).length,
    mission: statuses.filter((ws) => ws.status === 'mission' && isCounted(ws)).length,
    leave: statuses.filter(
      (ws) => (ws.status === 'leave' || ws.status === 'parental_leave') && isCounted(ws)
    ).length,
    sick: statuses.filter((ws) => ws.status === 'sick' && isCounted(ws)).length,
  };

  const unbooking = {
    // TODO: standard unbooking requires a "was_booked_and_cancelled" flag not yet tracked
    standard: 0,
    lastMinute: statuses.filter((ws) => ws.isLastMinuteUnbooking).length,
  };

  return { month, presenceDaysConfirmed, presenceDaysTarget, distribution, unbooking };
}

export async function getAnnualStats(userId: string, year: number): Promise<AnnualStats> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const completedMonths: string[] = [];
  const lastMonth = year < currentYear ? 12 : currentMonth - 1;
  for (let m = 1; m <= lastMonth; m++) {
    completedMonths.push(`${year}-${String(m).padStart(2, '0')}`);
  }

  const monthlyResults = await Promise.all(
    completedMonths.map((month) => getMonthlyStats(userId, month))
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
  const todayStr = new Date().toISOString().slice(0, 10);

  const [allUsers, allStatuses] = await Promise.all([
    User.find({}).lean(),
    WorkingStatus.find({ date: { $regex: `^${prefix}` } }).lean(),
  ]);

  const totalUsers = allUsers.length;

  const userTarget = new Map(
    allUsers.map((u) => [u._id.toString(), u.contract?.presenceDaysTarget ?? 10])
  );

  const confirmedByUser = new Map<string, number>();
  let totalLastMinute = 0;
  let totalStandard = 0;

  for (const ws of allStatuses) {
    const uid = ws.userId.toString();
    if (ws.status === 'in_office' && ws.isConfirmed && ws.date <= todayStr) {
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
