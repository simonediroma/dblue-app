import type { User } from '../types/api';
import type { DayPresence } from '../types';

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

export function getPresence(month: string): Promise<DayPresence[]> {
  return request<DayPresence[]>(`/presence?month=${encodeURIComponent(month)}`);
}

export function upsertStatus(date: string, payload: {
  status: string;
  isUsingDesk?: boolean;
  room?: string;
}): Promise<DayPresence> {
  return request<DayPresence>('/presence', {
    method: 'POST',
    body: JSON.stringify({ date, ...payload }),
  });
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
  });
}

export function updateOffTime(date: string, offTime: { type: string; hours?: number } | null): Promise<DayPresence> {
  return request<DayPresence>(`/presence/${date}/offtime`, {
    method: 'PATCH',
    body: JSON.stringify({ offTime }),
  });
}

export { BASE_URL };
