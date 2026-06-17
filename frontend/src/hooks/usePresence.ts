import { useState, useEffect } from 'react';
import type { DayPresence, WorkStatus, OffTimeType } from '../types';
import {
  getPresence,
  upsertStatus as apiUpsertStatus,
  bulkUpsertStatus as apiBulkUpsertStatus,
  updateOffTime as apiUpdateOffTime,
} from '../services/api';

export function usePresence(months: string[]) {
  const [days, setDays] = useState<DayPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(months.map(m => getPresence(m)))
      .then(results => {
        setDays(results.flat().sort((a, b) => a.date.localeCompare(b.date)));
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (
    date: string,
    status: WorkStatus,
    isUsingDesk?: boolean,
    room?: string,
  ) => {
    try {
      const updated = await apiUpsertStatus(date, { status, isUsingDesk, room });
      setDays(prev =>
        prev.map(d =>
          d.date === date
            ? { ...d, status: updated.status, isUsingDesk: updated.isUsingDesk, room: updated.room, isCheckedIn: updated.isCheckedIn, offTime: updated.offTime }
            : d,
        ),
      );
    } catch (err) {
      console.error('Failed to persist status:', err);
    }
  };

  const bulkUpdateStatus = async (
    updates: Array<{ date: string; status: WorkStatus; isUsingDesk: boolean; room: string }>,
  ) => {
    try {
      const results = await apiBulkUpsertStatus(updates);
      const serverMap = new Map(results.map(d => [d.date, d]));
      setDays(prev =>
        prev.map(d => {
          const srv = serverMap.get(d.date);
          return srv
            ? { ...d, status: srv.status, isUsingDesk: srv.isUsingDesk, room: srv.room, isCheckedIn: srv.isCheckedIn }
            : d;
        }),
      );
    } catch (err) {
      console.error('Failed to persist bulk status:', err);
    }
  };

  const updateOffTime = async (
    date: string,
    offTime: { type: OffTimeType; hours?: number } | undefined,
  ) => {
    try {
      const updated = await apiUpdateOffTime(date, offTime ?? null);
      setDays(prev =>
        prev.map(d => (d.date === date ? { ...d, offTime: updated.offTime } : d)),
      );
    } catch (err) {
      console.error('Failed to persist offTime:', err);
    }
  };

  return { days, setDays, loading, error, updateStatus, bulkUpdateStatus, updateOffTime };
}
