import type { User } from '../types/api';
import type { DayPresence, WorkStatus } from '../types';
import { getTodayStr, months } from '../utils/dateUtils';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Non autenticato');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function getMe(): Promise<User> {
  return request<User>('/auth/me');
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function getUsers(search?: string): Promise<User[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<User[]>(`/users${qs}`);
}

export function updateTeammates(ids: string[]): Promise<User> {
  return request<User>('/users/me/teammates', {
    method: 'PATCH',
    body: JSON.stringify({ teammates: ids }),
  });
}

export function updatePreferences(prefs: Partial<User['preferences']>): Promise<User> {
  return request<User>('/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
}

export function completeOnboarding(): Promise<void> {
  return request<void>('/users/me/onboarding', { method: 'PATCH' });
}

export { BASE_URL };

// ─── Presence API ────────────────────────────────────────────────────────────

interface RawPresenceDay {
  date: string;
  status: string;
  isUsingDesk?: boolean;
  room?: string;
  isConfirmed?: boolean;
  offTime?: { type: string; hours?: number };
  bookedCount?: number;
  totalCapacity?: number;
  colleagueAvatars?: unknown[];
}

function normalizeDayFromApi(raw: RawPresenceDay): DayPresence {
  const today = getTodayStr();
  const d = new Date(raw.date + 'T12:00:00');
  const dayName = months[d.getMonth()] !== undefined
    ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]
    : '';
  return {
    date: raw.date,
    dayName,
    status: raw.status.toUpperCase() as unknown as WorkStatus,
    isPast: raw.date < today,
    isCheckedIn: raw.isConfirmed ?? false,
    isUsingDesk: raw.isUsingDesk,
    room: raw.room,
    offTime: raw.offTime as DayPresence['offTime'],
    bookedCount: raw.bookedCount ?? 0,
    totalCapacity: raw.totalCapacity ?? 23,
    colleagueAvatars: [],
    projectTeammatesCount: 0,
  };
}

export function getPresence(month: string): Promise<DayPresence[]> {
  return request<RawPresenceDay[]>(`/presence?month=${month}`)
    .then(days => days.map(normalizeDayFromApi));
}

export function upsertStatus(
  date: string,
  payload: { status: string; isUsingDesk?: boolean; room?: string },
): Promise<DayPresence> {
  return request<RawPresenceDay>('/presence', {
    method: 'POST',
    body: JSON.stringify({ date, ...payload }),
  }).then(normalizeDayFromApi);
}

export function bulkUpsertStatus(
  updates: Array<{ date: string; status: string; isUsingDesk?: boolean; room?: string }>,
): Promise<DayPresence[]> {
  return request<{ succeeded: RawPresenceDay[] }>('/presence/bulk', {
    method: 'POST',
    body: JSON.stringify({ updates }),
  }).then(res => res.succeeded.map(normalizeDayFromApi));
}

export function updateOffTime(
  date: string,
  offTime: { type: string; hours?: number } | null,
): Promise<DayPresence> {
  return request<RawPresenceDay>(`/presence/${date}/offtime`, {
    method: 'PATCH',
    body: JSON.stringify({ offTime }),
  }).then(normalizeDayFromApi);
}
