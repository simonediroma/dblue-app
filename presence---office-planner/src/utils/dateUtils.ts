/**
 * Utility for handling dates in the fictional calendar where 2026-10-09 is a Monday.
 * The shift from real calendar is +3 days.
 */

export const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseAppDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getFictionalDayIndex(dateStr: string | Date): number {
  let date: Date;
  if (typeof dateStr === 'string') {
    date = parseAppDate(dateStr);
  } else {
    date = dateStr;
  }
  
  const realDayIndex = date.getDay();
  // Fictional offset: 2026-10-09 (Real: Fri, 5) is Monday (1) in app.
  // Shift = (Real + 3) % 7
  return (realDayIndex + 3) % 7;
}

export function getFictionalDayName(dateStr: string | Date, format: 'short' | 'long' = 'short'): string {
  const index = getFictionalDayIndex(dateStr);
  return format === 'short' ? shortDays[index] : days[index];
}

export function getFictionalIsWeekend(dateStr: string | Date): boolean {
  const index = getFictionalDayIndex(dateStr);
  return index === 0 || index === 6;
}

export function formatAppDate(dateStr: string | Date, format: 'short' | 'long' = 'short'): string {
  let date: Date;
  if (typeof dateStr === 'string') {
    date = parseAppDate(dateStr);
  } else {
    date = dateStr;
  }
  
  const dayName = getFictionalDayName(date, format);
  const day = date.getDate();
  const month = format === 'short' ? shortMonths[date.getMonth()] : months[date.getMonth()];
  const year = date.getFullYear();
  
  if (format === 'short') {
    return `${month} ${day}`;
  }
  return `${dayName}, ${month} ${day}, ${year}`;
}

export function toAppDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
