import type { User } from '../types/api';
import type { DayPresence } from '../types';
import { WorkStatus } from '../types';

const STATUS_MAP: Record<string, WorkStatus> = {
  in_office: WorkStatus.IN_OFFICE,
  remote: WorkStatus.REMOTE,
  mission: WorkStatus.MISSION,
  leave: WorkStatus.LEAVE,
  sick: WorkStatus.SICK,
  parental_leave: WorkStatus.PARENTAL_LEAVE,
  pending: WorkStatus.PENDING,
  waiting_list: WorkStatus.WAITING_LIST,
  office_no_desk: WorkStatus.OFFICE_NO_DESK,
};

function normalizeDay(d: DayPresence): DayPresence {
  const mapped = STATUS_MAP[d.status?.toLowerCase?.()];
  return mapped ? { ...d, status: mapped } : d;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'open_space' | 'lab' | 'admin' | 'management';
}

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options?.headers },
    ...options,
  });
  if (res.status === 401) {
    clearStoredToken();
    window.location.href = '/login';
    throw new Error('Non autenticato');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getMe(): Promise<User | null> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function logout(): Promise<void> {
  clearStoredToken();
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

export function getPresence(month: string): Promise<DayPresence[]> {
  return request<DayPresence[]>(`/presence?month=${encodeURIComponent(month)}`).then(days => days.map(normalizeDay));
}

export function upsertStatus(date: string, payload: {
  status: string;
  isUsingDesk?: boolean;
  room?: string;
}): Promise<DayPresence> {
  return request<DayPresence>('/presence', {
    method: 'POST',
    body: JSON.stringify({ date, ...payload }),
  }).then(normalizeDay);
}

export function bulkUpsertStatus(updates: Array<{
  date: string;
  status: string;
  isUsingDesk?: boolean;
  room?: string;
}>): Promise<DayPresence[]> {
  return request<DayPresence[]>('/presence/bulk', {
    method: 'POST',
    body: JSON.stringify({ updates }),
  }).then(days => days.map(normalizeDay));
}

export function checkIn(date: string, room?: string, isUsingDesk?: boolean): Promise<DayPresence> {
  return request<DayPresence>(`/presence/${date}/checkin`, {
    method: 'POST',
    body: JSON.stringify({ room, isUsingDesk }),
  }).then(normalizeDay);
}

export function getRooms(): Promise<Room[]> {
  return request<Room[]>('/rooms');
}

export function updateOffTime(date: string, offTime: { type: string; hours?: number } | null): Promise<DayPresence> {
  return request<DayPresence>(`/presence/${date}/offtime`, {
    method: 'PATCH',
    body: JSON.stringify({ offTime }),
  });
}

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
  monthlyBreakdown: Array<{
    month: string;
    presenceDaysConfirmed: number;
    presenceDaysTarget: number;
  }>;
  totalUnbooking: {
    standard: number;
    lastMinute: number;
  };
  averageMonthlyPresenceDays: number;
}

export function getStatsMonthly(month: string): Promise<MonthlyStats> {
  return request<MonthlyStats>(`/stats/monthly?month=${encodeURIComponent(month)}`);
}

export function getStatsAnnual(year: number): Promise<AnnualStats> {
  return request<AnnualStats>(`/stats/annual?year=${year}`);
}

export interface SeedSummary {
  users: number;
  rooms: number;
  workingStatuses: number;
  rangeMe: string;
  rangeColleagues: string;
}

export function triggerSeed(fresh = false): Promise<{ ok: boolean; summary: SeedSummary }> {
  return request<{ ok: boolean; summary: SeedSummary }>('/admin/seed', {
    method: 'POST',
    body: JSON.stringify({ fresh }),
  });
}

export interface ColleaguePresenceItem {
  userId: string;
  name: string;
  status: string;
  room?: string;
  isConfirmed?: boolean;
}

export function getColleaguePresence(date: string): Promise<ColleaguePresenceItem[]> {
  return request<ColleaguePresenceItem[]>(`/presence/${date}/colleagues`);
}

export interface AreaStats {
  month: string;
  totalUsers: number;
  avgPresenceDaysConfirmed: number;
  usersAboveTarget: number;
  usersBelowTarget: number;
  totalUnbooking: { standard: number; lastMinute: number };
}

export function getStatsArea(month: string): Promise<AreaStats> {
  return request<AreaStats>(`/stats/area?month=${encodeURIComponent(month)}`);
}

export function getStatsByUser(userId: string, month: string): Promise<MonthlyStats> {
  return request<MonthlyStats>(`/admin/stats/${userId}/monthly?month=${encodeURIComponent(month)}`);
}

export { BASE_URL };
