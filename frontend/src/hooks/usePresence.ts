import { useState, useEffect } from 'react';
import { DayPresence, WorkStatus, OffTimeType } from '../types';
import {
  getPresence,
  upsertStatus,
  bulkUpsertStatus,
  updateOffTime as apiUpdateOffTime,
} from '../services/api';
import { getFictionalDayName } from '../utils/dateUtils';

function isConsumingDesk(status: WorkStatus, isUsingDesk?: boolean): boolean {
  return status === WorkStatus.IN_OFFICE && isUsingDesk !== false;
}

function enrichDay(day: DayPresence): DayPresence {
  if (day.dayName) return day;
  return { ...day, dayName: getFictionalDayName(day.date, 'long') };
}

export function usePresence(months: string[]) {
  const [days, setDays] = useState<DayPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(months.map(m => getPresence(m)))
      .then(results => setDays(results.flat().map(enrichDay).sort((a, b) => a.date.localeCompare(b.date))))
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (
    date: string,
    status: WorkStatus,
    isUsingDesk?: boolean,
    room?: string,
  ) => {
    const prev = days.find(d => d.date === date);

    setDays(current => {
      const newDays = [...current];
      const index = newDays.findIndex(d => d.date === date);
      const wasConsuming = index !== -1 ? isConsumingDesk(newDays[index].status, newDays[index].isUsingDesk) : false;
      const willConsume = isConsumingDesk(status, isUsingDesk);

      if (index !== -1) {
        const oldDay = newDays[index];
        let newBookedCount = oldDay.bookedCount || 0;
        if (!wasConsuming && willConsume) newBookedCount++;
        if (wasConsuming && !willConsume) newBookedCount--;
        newDays[index] = { ...oldDay, status, isUsingDesk, room, bookedCount: Math.max(0, newBookedCount) };
      } else {
        newDays.push({
          date,
          dayName: getFictionalDayName(date, 'long'),
          status,
          isUsingDesk,
          room,
          bookedCount: isConsumingDesk(status, isUsingDesk) ? 1 : 0,
          totalCapacity: 23,
          projectTeammatesCount: 0,
          colleagueAvatars: [],
        });
      }
      return newDays.sort((a, b) => a.date.localeCompare(b.date));
    });

    try {
      const updated = await upsertStatus(date, { status, isUsingDesk, room });
      setDays(current => current.map(d => d.date === date ? enrichDay(updated) : d));
    } catch (err) {
      setDays(current => {
        if (prev) return current.map(d => d.date === date ? prev : d);
        return current.filter(d => d.date !== date);
      });
      throw err;
    }
  };

  const bulkUpdateStatus = async (updates: Array<{
    date: string;
    status: WorkStatus;
    isUsingDesk: boolean;
    room: string;
  }>) => {
    const prevDays = days.filter(d => updates.some(u => u.date === d.date));

    setDays(current => {
      const newDays = [...current];
      updates.forEach(update => {
        const index = newDays.findIndex(d => d.date === update.date);
        const wasConsuming = index !== -1 ? isConsumingDesk(newDays[index].status, newDays[index].isUsingDesk) : false;
        const willConsume = isConsumingDesk(update.status, update.isUsingDesk);

        if (index !== -1) {
          const oldDay = newDays[index];
          let newBookedCount = oldDay.bookedCount || 0;
          if (!wasConsuming && willConsume) newBookedCount++;
          if (wasConsuming && !willConsume) newBookedCount--;
          newDays[index] = { ...oldDay, status: update.status, isUsingDesk: update.isUsingDesk, room: update.room, bookedCount: Math.max(0, newBookedCount), isExtended: true };
        } else {
          newDays.push({
            date: update.date,
            dayName: getFictionalDayName(update.date, 'long'),
            status: update.status,
            isUsingDesk: update.isUsingDesk,
            room: update.room,
            bookedCount: willConsume ? 1 : 0,
            totalCapacity: 23,
            projectTeammatesCount: 0,
            colleagueAvatars: [],
            isExtended: true,
          });
        }
      });
      return newDays.sort((a, b) => a.date.localeCompare(b.date));
    });

    try {
      const updated = await bulkUpsertStatus(updates);
      setDays(current => {
        const newDays = [...current];
        updated.forEach(u => {
          const index = newDays.findIndex(d => d.date === u.date);
          if (index !== -1) newDays[index] = enrichDay(u);
        });
        return newDays;
      });
    } catch (err) {
      setDays(current => {
        const newDays = [...current];
        updates.forEach(update => {
          const prev = prevDays.find(d => d.date === update.date);
          const index = newDays.findIndex(d => d.date === update.date);
          if (index !== -1) {
            if (prev) newDays[index] = prev;
            else newDays.splice(index, 1);
          }
        });
        return newDays.sort((a, b) => a.date.localeCompare(b.date));
      });
      throw err;
    }
  };

  const updateOffTime = async (date: string, offTime: { type: string; hours?: number } | null) => {
    const prev = days.find(d => d.date === date);

    setDays(current => current.map(d => d.date === date ? {
      ...d,
      offTime: offTime ? { type: offTime.type as OffTimeType, hours: offTime.hours } : undefined,
    } : d));

    try {
      const updated = await apiUpdateOffTime(date, offTime);
      setDays(current => current.map(d => d.date === date ? enrichDay(updated) : d));
    } catch (err) {
      setDays(current => current.map(d => d.date === date ? (prev ?? d) : d));
      throw err;
    }
  };

  return { days, setDays, loading, error, updateStatus, bulkUpdateStatus, updateOffTime };
}
