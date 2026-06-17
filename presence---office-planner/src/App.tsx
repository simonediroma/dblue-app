/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import Layout from './components/Layout';
import DayCard from './components/DayCard';
import DailyDetail from './components/DailyDetail';
import Stats from './components/Stats';
import Profile from './components/Profile';
import RoomSelection from './components/RoomSelection';
import SplashScreen from './components/SplashScreen';
import Organisation from './components/Organisation';
import Onboarding from './components/Onboarding';
import { WorkStatus, DayPresence, OffTimeType, UserRole, ColleagueAvatarInfo } from './types';
import { COLLEAGUES, Colleague } from './constants/colleagues';
import { getFictionalDayName, getFictionalIsWeekend, parseAppDate } from './utils/dateUtils';
import { ChevronLeft, ChevronRight, ChevronDown, Check, X, AlertTriangle, Building2, Home, Plane, Palmtree, Thermometer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const statusLabels: Record<string, string=""> = {
  [WorkStatus.IN_OFFICE]: 'In Office',
  [WorkStatus.REMOTE]: 'Remote',
  [WorkStatus.MISSION]: 'On a mission',
  [WorkStatus.LEAVE]: 'On Leave (Vacation)',
  [WorkStatus.SICK]: 'On a sick leave',
  [WorkStatus.PARENTAL_LEAVE]: 'Parental Leave',
  [WorkStatus.WAITING_LIST]: 'Waiting List',
  [WorkStatus.OFFICE_NO_DESK]: 'Office (No Desk)',
};

const LAST_MINUTE_THRESHOLD_DAYS = 1;

function isLastMinute(dateStr: string): boolean {
  const today = parseAppDate('2026-10-09'); // Reference date
  const target = parseAppDate(dateStr);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 && diffDays <= LAST_MINUTE_THRESHOLD_DAYS;
}

const INITIAL_DAYS: DayPresence[] = [
  // Past Days
  { date: '2026-10-02', dayName: 'Monday', status: WorkStatus.IN_OFFICE, isPast: true, isCheckedIn: true, isUsingDesk: true, room: 'Blue Room', bookedCount: 20, totalCapacity: 23, projectTeammatesCount: 4, colleagueAvatars: [{ initials: 'AP', color: 'bg-blue-500' }, { initials: 'AT', color: 'bg-red-500' }, { initials: 'AG', color: 'bg-green-500' }, { initials: 'AS', color: 'bg-yellow-500' }] },
  { date: '2026-10-03', dayName: 'Tuesday', status: WorkStatus.PENDING, isPast: true, isCheckedIn: false, bookedCount: 15, totalCapacity: 23, projectTeammatesCount: 2, colleagueAvatars: [{ initials: 'AF', color: 'bg-purple-500' }, { initials: 'AV', color: 'bg-pink-500' }] },
  { date: '2026-10-04', dayName: 'Wednesday', status: WorkStatus.REMOTE, isPast: true, isCheckedIn: true, bookedCount: 10, totalCapacity: 23, projectTeammatesCount: 1, colleagueAvatars: [{ initials: 'AC', color: 'bg-indigo-500' }] },
  { date: '2026-10-05', dayName: 'Thursday', status: WorkStatus.LEAVE, isPast: true, isCheckedIn: false, bookedCount: 22, totalCapacity: 23, projectTeammatesCount: 5, colleagueAvatars: [{ initials: 'AD', color: 'bg-teal-500' }, { initials: 'AC', color: 'bg-orange-500' }, { initials: 'MG', color: 'bg-cyan-500' }, { initials: 'CF', color: 'bg-emerald-500' }, { initials: 'CA', color: 'bg-violet-500' }] },
  { date: '2026-10-06', dayName: 'Friday', status: WorkStatus.REMOTE, isPast: true, isCheckedIn: true, isLabBooked: true, labBookerName: 'Team Activity', bookedCount: 12, totalCapacity: 23, projectTeammatesCount: 2, colleagueAvatars: [{ initials: 'DT', color: 'bg-blue-600' }, { initials: 'DV', color: 'bg-red-600' }] },
  
  // Current Week (9 is Today)
  {
    date: '2026-10-09',
    dayName: 'Monday',
    status: WorkStatus.IN_OFFICE,
    isHighlighted: true,
    isCheckedIn: false,
    isUsingDesk: true,
    room: 'Blue Room',
    bookedCount: 18,
    totalCapacity: 23,
    projectTeammatesCount: 5,
    colleagueAvatars: [
      { initials: 'ES', color: 'bg-blue-500' },
      { initials: 'EH', color: 'bg-red-500' },
      { initials: 'EV', color: 'bg-green-500' },
      { initials: 'FP', color: 'bg-yellow-500' },
      { initials: 'FM', color: 'bg-purple-500' },
      { initials: 'GS', color: 'bg-orange-500' },
      { initials: 'LN', color: 'bg-teal-500' },
      { initials: 'MC', color: 'bg-indigo-500' },
      { initials: 'PT', color: 'bg-pink-500' },
      { initials: 'RV', color: 'bg-cyan-500' },
    ]
  },
  { date: '2026-10-10', dayName: 'Tuesday', status: WorkStatus.REMOTE, bookedCount: 15, totalCapacity: 23, projectTeammatesCount: 3, colleagueAvatars: [{ initials: 'FB', color: 'bg-blue-500' }, { initials: 'EL', color: 'bg-red-500' }, { initials: 'AD', color: 'bg-green-500' }] },
  { date: '2026-10-11', dayName: 'Wednesday', status: WorkStatus.MISSION, bookedCount: 9, totalCapacity: 23, projectTeammatesCount: 2, colleagueAvatars: [{ initials: 'GS', color: 'bg-yellow-500' }, { initials: 'GF', color: 'bg-purple-500' }] },
  { date: '2026-10-12', dayName: 'Thursday', status: WorkStatus.IN_OFFICE, isUsingDesk: true, room: 'Red Room', bookedCount: 20, totalCapacity: 23, projectTeammatesCount: 5, colleagueAvatars: [{ initials: 'LP', color: 'bg-blue-500' }, { initials: 'VC', color: 'bg-red-500' }, { initials: 'LN', color: 'bg-green-500' }, { initials: 'LS', color: 'bg-yellow-500' }, { initials: 'MC', color: 'bg-purple-500' }] },
  { date: '2026-10-13', dayName: 'Friday', status: WorkStatus.LEAVE, bookedCount: 4, totalCapacity: 23, projectTeammatesCount: 0, colleagueAvatars: [{ initials: 'MM', color: 'bg-pink-500' }, { initials: 'ML', color: 'bg-indigo-500' }] },

  // Rest of October
  { date: '2026-10-16', dayName: 'Monday', status: WorkStatus.IN_OFFICE, isUsingDesk: true, room: 'Lab', bookedCount: 12, totalCapacity: 23, projectTeammatesCount: 3, colleagueAvatars: [{ initials: 'SC', color: 'bg-teal-500' }, { initials: 'MC', color: 'bg-orange-500' }, { initials: 'MT', color: 'bg-cyan-500' }] },
  { date: '2026-10-17', dayName: 'Tuesday', status: WorkStatus.IN_OFFICE, isUsingDesk: true, room: 'Lab', bookedCount: 19, totalCapacity: 23, projectTeammatesCount: 6, colleagueAvatars: [{ initials: 'MB', color: 'bg-emerald-500' }, { initials: 'MU', color: 'bg-violet-500' }, { initials: 'NC', color: 'bg-blue-500' }] },
  { date: '2026-10-18', dayName: 'Wednesday', status: WorkStatus.REMOTE, bookedCount: 22, totalCapacity: 23, projectTeammatesCount: 8, colleagueAvatars: [{ initials: 'NG', color: 'bg-red-500' }, { initials: 'PL', color: 'bg-green-500' }, { initials: 'PT', color: 'bg-yellow-500' }] },
  { date: '2026-10-19', dayName: 'Thursday', status: WorkStatus.PENDING, bookedCount: 12, totalCapacity: 23, projectTeammatesCount: 3, colleagueAvatars: [{ initials: 'PD', color: 'bg-purple-500' }, { initials: 'RH', color: 'bg-pink-500' }, { initials: 'RV', color: 'bg-indigo-500' }] },
  { date: '2026-10-20', dayName: 'Friday', status: WorkStatus.MISSION, bookedCount: 10, totalCapacity: 23, projectTeammatesCount: 2, colleagueAvatars: [{ initials: 'FL', color: 'bg-teal-500' }, { initials: 'KC', color: 'bg-orange-500' }] },

  { date: '2026-10-23', dayName: 'Monday', status: WorkStatus.PENDING, bookedCount: 23, totalCapacity: 23, projectTeammatesCount: 4, colleagueAvatars: [{ initials: 'AA', color: 'bg-cyan-500' }, { initials: 'ST', color: 'bg-emerald-500' }] },
  { date: '2026-10-24', dayName: 'Tuesday', status: WorkStatus.IN_OFFICE, isUsingDesk: true, room: 'Green Room', bookedCount: 18, totalCapacity: 23, projectTeammatesCount: 3, colleagueAvatars: [{ initials: 'SP', color: 'bg-violet-500' }, { initials: 'SB', color: 'bg-blue-500' }] },
  { date: '2026-10-25', dayName: 'Wednesday', status: WorkStatus.REMOTE, bookedCount: 11, totalCapacity: 23, projectTeammatesCount: 1, colleagueAvatars: [{ initials: 'HM', color: 'bg-red-500' }] },
  { date: '2026-10-26', dayName: 'Thursday', status: WorkStatus.IN_OFFICE, isUsingDesk: true, room: 'Blue Room', bookedCount: 20, totalCapacity: 23, projectTeammatesCount: 5, colleagueAvatars: [{ initials: 'TV', color: 'bg-green-500' }, { initials: 'VA', color: 'bg-yellow-500' }] },
  { date: '2026-10-27', dayName: 'Friday', status: WorkStatus.PENDING, bookedCount: 6, totalCapacity: 23, projectTeammatesCount: 0, colleagueAvatars: [{ initials: 'VF', color: 'bg-purple-500' }] },

  { date: '2026-10-30', dayName: 'Monday', status: WorkStatus.PENDING, bookedCount: 0, totalCapacity: 23, projectTeammatesCount: 2, colleagueAvatars: [{ initials: 'DZ', color: 'bg-pink-500' }, { initials: 'BS', color: 'bg-indigo-500' }], isOfficeClosed: true },
  { date: '2026-10-31', dayName: 'Tuesday', status: WorkStatus.MISSION, bookedCount: 8, totalCapacity: 23, projectTeammatesCount: 1, colleagueAvatars: [{ initials: 'VC', color: 'bg-teal-500' }] },

  // November
  { date: '2026-11-01', dayName: 'Wednesday', status: WorkStatus.PENDING, bookedCount: 0, totalCapacity: 23, projectTeammatesCount: 0, colleagueAvatars: [], isClosed: true },
  { date: '2026-11-02', dayName: 'Thursday', status: WorkStatus.IN_OFFICE, isUsingDesk: true, room: 'Red Room', bookedCount: 12, totalCapacity: 23, projectTeammatesCount: 3, colleagueAvatars: [{ initials: 'SF', color: 'bg-orange-500' }] },
  { date: '2026-11-03', dayName: 'Friday', status: WorkStatus.REMOTE, bookedCount: 15, totalCapacity: 23, projectTeammatesCount: 2, colleagueAvatars: [{ initials: 'SS', color: 'bg-cyan-500' }] },
  
  { date: '2026-11-06', dayName: 'Monday', status: WorkStatus.IN_OFFICE, isUsingDesk: true, room: 'Blue Room', bookedCount: 18, totalCapacity: 23, projectTeammatesCount: 4, colleagueAvatars: [{ initials: 'TM', color: 'bg-emerald-500' }] },
  { date: '2026-11-07', dayName: 'Tuesday', status: WorkStatus.IN_OFFICE, isUsingDesk: true, room: 'Green Room', bookedCount: 21, totalCapacity: 23, projectTeammatesCount: 7, colleagueAvatars: [{ initials: 'SM', color: 'bg-violet-500' }] },
  { date: '2026-11-08', dayName: 'Wednesday', status: WorkStatus.REMOTE, bookedCount: 10, totalCapacity: 23, projectTeammatesCount: 1, colleagueAvatars: [{ initials: 'NK', color: 'bg-blue-500' }] },
  { date: '2026-11-09', dayName: 'Thursday', status: WorkStatus.PENDING, bookedCount: 14, totalCapacity: 23, projectTeammatesCount: 3, colleagueAvatars: [{ initials: 'MR', color: 'bg-red-500' }] },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [projectTeammates, setProjectTeammates] = useState<colleague[]>([]);
  const [userName] = useState('Roberto');
  const [userRole] = useState<userrole>(UserRole.DIRECTOR);
  const [days, setDays] = useState<daypresence[]>(INITIAL_DAYS);
  const [selectedDay, setSelectedDay] = useState<daypresence |="" null="">(null);
  const [activeTab, setActiveTab] = useState<'plan' | 'stats' | 'profile' | 'organisation'>('plan');
  const [roomSelectionDate, setRoomSelectionDate] = useState<string |="" null="">(null);
  const [isCurrentInView, setIsCurrentInView] = useState(true);
  const currentDayRef = useRef<htmldivelement>(null);
  const monthDividerRef = useRef<htmldivelement>(null);
  const [activeMonth, setActiveMonth] = useState('October 2026');
  const [showMonthBanner, setShowMonthBanner] = useState(false);
  const [fabCheckStatus, setFabCheckStatus] = useState<'idle' | 'checking' | 'done'>('idle');
  const [notification, setNotification] = useState<{message: string, date: string, isRetrofit?: boolean, showWorkspaceAction?: boolean, undoAction?: () => void, isCheckInNotification?: boolean} | null>(null);
  const [notificationCountdown, setNotificationCountdown] = useState<number |="" null="">(null);
  const [selectedDayInitialStep, setSelectedDayInitialStep] = useState<'VIEW' | 'WORKSPACE'>('VIEW');
  const [isMandatoryWorkspace, setIsMandatoryWorkspace] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light');
  const [isSimplifiedView, setIsSimplifiedView] = useState(false);
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [originalDaysSnapshot, setOriginalDaysSnapshot] = useState<daypresence[] |="" null="">(null);
  const [lastMinuteWarning, setLastMinuteWarning] = useState<{ date: string, action: () => void } | null>(null);

  // Generate September 2026 data (Historical)
  const septemberDays: DayPresence[] = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const date = `2026-09-${day.toString().padStart(2, '0')}`;
    const statuses = [WorkStatus.IN_OFFICE, WorkStatus.REMOTE, WorkStatus.MISSION, WorkStatus.LEAVE];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      date,
      dayName: getFictionalDayName(date, 'long'),
      status,
      isPast: true,
      isCheckedIn: status === WorkStatus.IN_OFFICE,
      bookedCount: Math.floor(Math.random() * 23),
      totalCapacity: 23,
      projectTeammatesCount: Math.floor(Math.random() * 10),
      colleagueAvatars: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, idx) => ({
        initials: COLLEAGUES[(i + idx) % COLLEAGUES.length].initials,
        color: COLLEAGUES[(i + idx) % COLLEAGUES.length].color
      })),
      isClosed: getFictionalIsWeekend(date)
    };
  }), []);

  const monthCounts = useMemo(() => {
    const monthPrefix = activeMonth === 'October 2026' ? '2026-10' : 
                        activeMonth === 'November 2026' ? '2026-11' :
                        activeMonth === 'September 2026' ? '2026-09' : '';
    
    if (!monthPrefix) return { office: 0, remote: 0, leave: 0, mission: 0, sick: 0 };

    const relevantDays = isHistoricalView ? septemberDays : days.filter(d => d.date.startsWith(monthPrefix));

    return {
      office: relevantDays.filter(d => d.status === WorkStatus.IN_OFFICE || d.status === WorkStatus.OFFICE_NO_DESK).length,
      remote: relevantDays.filter(d => d.status === WorkStatus.REMOTE).length,
      leave: relevantDays.filter(d => d.status === WorkStatus.LEAVE || d.status === WorkStatus.PARENTAL_LEAVE || d.status === WorkStatus.PARTIAL_LEAVE).length,
      mission: relevantDays.filter(d => d.status === WorkStatus.MISSION).length,
      sick: relevantDays.filter(d => d.status === WorkStatus.SICK).length,
    };
  }, [activeMonth, days, isHistoricalView, septemberDays]);

  const handleOpenDay = (day: DayPresence, step: 'VIEW' | 'WORKSPACE' = 'VIEW', isMandatory = false) => {
    if (!originalDaysSnapshot) {
      setOriginalDaysSnapshot([...days]);
    }
    setSelectedDay(day);
    setSelectedDayInitialStep(step);
    setIsMandatoryWorkspace(isMandatory);
  };

  const handleCancelDetail = () => {
    if (selectedDay && originalDaysSnapshot) {
      const originalDay = originalDaysSnapshot.find(d => d.date === selectedDay.date);
      const isNewBooking = !originalDay || originalDay.status === WorkStatus.PENDING;
      
      const dateParts = selectedDay.date.split('-');
      const dayNum = dateParts[2];
      
      if (isNewBooking) {
        setNotification({
          message: `Booking cancelled for Day ${dayNum}`,
          date: selectedDay.date
        });
      } else {
        setNotification({
          message: `No changes saved. Your Day ${dayNum} booking stays the same.`,
          date: selectedDay.date
        });
      }
    }
    if (originalDaysSnapshot) {
      setDays(originalDaysSnapshot);
      setOriginalDaysSnapshot(null);
    }
    setSelectedDay(null);
  };

  const handleCloseDetail = () => {
    setOriginalDaysSnapshot(null);
    setSelectedDay(null);
  };

  const handleUpdateLabBooking = (date: string, isBooked: boolean) => {
    setDays(prev => prev.map(d => d.date === date ? { ...d, isLabBooked: isBooked, labBookerName: isBooked ? 'Roberto' : undefined } : d));
    
    setNotification({
      message: isBooked ? `Lab booked for Oct ${date.split('-')[2]}` : `Lab booking cancelled`,
      date: date
    });
  };

  const handleMonthSelect = (month: string) => {
    setIsMonthDropdownOpen(false);
    if (month === 'September 2026') {
      setIsHistoricalView(true);
      setActiveMonth('September 2026');
      setIsCurrentInView(true); // Hide FAB in historical view
    } else if (month === 'November 2026') {
      setIsHistoricalView(false);
      setActiveMonth('November 2026');
      setTimeout(() => {
        if (monthDividerRef.current) {
          const layoutHeaderHeight = window.innerWidth < 640 ? 52 : 56;
          const stickyHeaderHeight = stickyHeaderRef.current?.offsetHeight || (window.innerWidth < 640 ? 80 : 120);
          const totalOffset = layoutHeaderHeight + stickyHeaderHeight;
          const top = monthDividerRef.current.getBoundingClientRect().top + window.pageYOffset - totalOffset + 10;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }, 100);
    } else {
      setIsHistoricalView(false);
      setActiveMonth('October 2026');
      // Scroll to today is handled by the useEffect or caller if needed
      setTimeout(() => {
        scrollToToday('smooth');
      }, 100);
    }
  };

  useEffect(() => {
    if (isHistoricalView || activeTab !== 'plan') {
      setIsCurrentInView(true);
      return;
    }

    const currentObserver = new IntersectionObserver(
      ([entry]) => {
        setIsCurrentInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    const monthObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.target === monthDividerRef.current) {
            const isBelowSticky = entry.boundingClientRect.top > 250;
            if (isBelowSticky) {
              setActiveMonth(prev => prev !== 'October 2026' ? 'October 2026' : prev);
              setShowMonthBanner(false);
            } else {
              setActiveMonth(prev => prev !== 'November 2026' ? 'November 2026' : prev);
              setShowMonthBanner(true);
            }
          }
        });
      },
      { 
        threshold: [0, 1],
        rootMargin: '-52px 0px 0px 0px'
      }
    );

    if (currentDayRef.current) {
      currentObserver.observe(currentDayRef.current);
    }
    if (monthDividerRef.current) {
      monthObserver.observe(monthDividerRef.current);
    }

    return () => {
      currentObserver.disconnect();
      monthObserver.disconnect();
    };
  }, [isHistoricalView, activeTab]);

  const handleFabCheckIn = () => {
    const currentDay = days.find(d => d.date === '2026-10-09');
    if (!currentDay) return;

    if (currentDay.status === WorkStatus.REMOTE) {
      setFabCheckStatus('checking');
      handleCheckIn(currentDay.date, false);
      setTimeout(() => {
        setFabCheckStatus('done');
      }, 600);
      setTimeout(() => {
        setFabCheckStatus('idle');
      }, 3600);
    } else {
      handleCheckIn(currentDay.date, false);
    }
  };

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      let isDark = false;
      
      if (themeMode === 'dark') {
        isDark = true;
      } else if (themeMode === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  const handleTabChange = (newTab: 'plan' | 'stats' | 'profile' | 'organisation') => {
    if (newTab === activeTab) return;
    
    setActiveTab(newTab);
    
    // Reset scroll instantly
    if (newTab !== 'plan') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const handleCheckIn = (date: string, autoOpen = false) => {
    const day = days.find(d => d.date === date);
    const isToday = date === '2026-10-09';
    
    if (isToday && day?.status === WorkStatus.IN_OFFICE) {
      setRoomSelectionDate(date);
      setSelectedDay(null); // Ensure the detailed view is closed when moving to room selection
    } else {
      const oldDay = { ...day! };
      setDays(prev => prev.map(d => d.date === date ? { ...d, isCheckedIn: true } : d));
      
      setNotification({
        message: "Successfully checked in",
        date: date,
        isCheckInNotification: true,
        undoAction: () => {
          setDays(prev => prev.map(d => d.date === date ? { ...d, isCheckedIn: false } : d));
          setNotification(null);
          setNotificationCountdown(null);
        }
      });

      if (autoOpen) {
        if (day) handleOpenDay(day);
      }
    }
  };

  const handleRoomSelect = (roomName: string) => {
    if (!roomSelectionDate) return;
    
    const isUsingDesk = roomName !== 'No Desk';
    const oldDaySnapshot = days.find(d => d.date === roomSelectionDate);
    if (!oldDaySnapshot) return;

    setDays(prev => {
      const index = prev.findIndex(d => d.date === roomSelectionDate);
      if (index === -1) return prev;
      
      const newDays = [...prev];
      const oldDay = newDays[index];
      const wasConsuming = isConsumingDesk(oldDay.status, oldDay.isUsingDesk);
      const willConsume = isConsumingDesk(oldDay.status, isUsingDesk);
      
      let newBookedCount = oldDay.bookedCount || 0;
      if (!wasConsuming && willConsume) newBookedCount++;
      if (wasConsuming && !willConsume) newBookedCount--;
      
      newDays[index] = { ...oldDay, isCheckedIn: true, room: roomName, isUsingDesk, bookedCount: Math.max(0, newBookedCount) };
      return newDays;
    });
    
    setNotification({
      message: isUsingDesk ? `Successfully checked in in the ${roomName}` : `Successfully checked in`,
      date: roomSelectionDate,
      isCheckInNotification: true,
      undoAction: () => {
        setDays(prev => prev.map(d => d.date === roomSelectionDate ? { 
          ...d, 
          isCheckedIn: false, 
          room: oldDaySnapshot.room, 
          isUsingDesk: oldDaySnapshot.isUsingDesk,
          bookedCount: oldDaySnapshot.bookedCount 
        } : d));
        setNotification(null);
        setNotificationCountdown(null);
      }
    });
    
    setRoomSelectionDate(null);
  };

  const isConsumingDesk = (status: WorkStatus, isUsingDesk?: boolean) => {
    return status === WorkStatus.IN_OFFICE && isUsingDesk !== false;
  };

  const handleUpdateStatus = (dateOrDates: string | string[], status: WorkStatus, isUsingDesk?: boolean, isRetrofit = false, room?: string, showWorkspaceAction = false, bypassWarning = false, shouldClose = true) => {
    const targetDates = Array.isArray(dateOrDates) ? dateOrDates : [dateOrDates];
    
    // Check for last-minute booking warning
    if (targetDates.length === 1 && !isRetrofit && !bypassWarning) {
      const date = targetDates[0];
      const existingDay = days.find(d => d.date === date);
      const isCurrentlyInOffice = existingDay && [WorkStatus.IN_OFFICE, WorkStatus.WAITING_LIST, WorkStatus.OFFICE_NO_DESK].includes(existingDay.status);
      
      const isPotentiallyLastMinute = (status === WorkStatus.PENDING || status === WorkStatus.REMOTE) && isCurrentlyInOffice;
      
      if (isPotentiallyLastMinute && isLastMinute(date) && !lastMinuteWarning) {
        setLastMinuteWarning({
          date,
          action: () => {
            setLastMinuteWarning(null);
            handleUpdateStatus(dateOrDates, status, isUsingDesk, isRetrofit, room, showWorkspaceAction, true);
          }
        });
        return;
      }
    }

    setLastMinuteWarning(null);

    // Check if we are changing an existing status or defining a new one
    const isChange = !Array.isArray(dateOrDates) && days.find(d => d.date === dateOrDates)?.status !== WorkStatus.PENDING;

    setDays(prev => {
      const newDays = [...prev];
      targetDates.forEach(date => {
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
          // If date doesn't exist, create it (important for long-term sick leave)
          newDays.push({
            date,
            dayName: getFictionalDayName(date, 'long'),
            status,
            isUsingDesk,
            room,
            bookedCount: willConsume ? 1 : 0,
            totalCapacity: 23,
            projectTeammatesCount: 0,
            colleagueAvatars: []
          });
        }
      });
      // Keep them sorted by date
      return newDays.sort((a, b) => a.date.localeCompare(b.date));
    });
    
    // Set notification
    const primaryDate = targetDates[0];
    const dateParts = primaryDate.split('-');
    const dayNum = dateParts[2];
    const statusLabel = statusLabels[status] || status;
    
    if (isRetrofit) {
      setNotification({
        message: `Retrofitting for Day ${dayNum} completed`,
        date: primaryDate,
        isRetrofit: true
      });
    } else {
      setNotification({
        message: isChange 
          ? `Working status for Day ${dayNum} changed to ${statusLabel}`
          : `Working status ${statusLabel} defined for Day ${dayNum}`,
        date: primaryDate,
        showWorkspaceAction
      });
    }
    
    if (shouldClose) {
      setOriginalDaysSnapshot(null);
      setSelectedDay(null); // Direct navigation back to homepage
      setSelectedDayInitialStep('VIEW'); // Reset initial step
    }
  };

  const handleUpdateBulkStatus = (updates: Array<{date: string, status: WorkStatus, isUsingDesk: boolean, room: string}>) => {
    setDays(prev => {
      const newDays = [...prev];
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
            isExtended: true
          });
        }
      });
      return newDays.sort((a, b) => a.date.localeCompare(b.date));
    });

    setNotification({
      message: `Working Status "${statusLabels[updates[0].status]}" correctly extended for selected days`,
      date: updates[0].date,
      undoAction: () => {
        setDays(prev => {
          const newDays = [...prev];
          updates.forEach(update => {
            const index = newDays.findIndex(d => d.date === update.date);
            if (index !== -1) {
              const originalDay = originalDaysSnapshot?.find(d => d.date === update.date);
              if (originalDay) {
                newDays[index] = { ...originalDay };
              } else {
                newDays[index] = { ...newDays[index], status: WorkStatus.PENDING };
              }
            }
          });
          return newDays.sort((a, b) => a.date.localeCompare(b.date));
        });
        setNotification({
          message: "Extension reversed",
          date: updates[0].date
        });
        setOriginalDaysSnapshot(null);
      }
    });
    
    // Do not clear snapshot yet so Undo can use it
    setSelectedDay(null);
  };

  const handleUpdateOffTime = (date: string, offTime: { type: OffTimeType, hours?: number } | undefined) => {
    setDays(prev => prev.map(d => d.date === date ? { ...d, offTime } : d));
    
    const day = days.find(d => d.date === date);
    const isPast = day?.isPast || false;
    const dayNum = date.split('-')[2];
    
    if (isPast) {
      setNotification({
        message: `Retrofitting for Day ${dayNum} completed`,
        date: date,
        isRetrofit: true
      });
    } else {
      setNotification({
        message: offTime 
          ? `Hours off for Day ${dayNum} updated`
          : `Hours off for Day ${dayNum} removed`,
        date: date
      });
    }
    
    setOriginalDaysSnapshot(null);
    setSelectedDay(null);
  };

  const stickyHeaderRef = useRef<htmldivelement>(null);

  const scrollToToday = (behavior: ScrollBehavior = 'smooth') => {
    if (currentDayRef.current) {
      const layoutHeaderHeight = window.innerWidth < 640 ? 52 : 56;
      // If stickyHeaderRef isn't ready, use a reasonable default
      const stickyHeaderHeight = stickyHeaderRef.current?.offsetHeight || (window.innerWidth < 640 ? 80 : 120);
      const totalOffset = layoutHeaderHeight + stickyHeaderHeight;
      
      const rect = currentDayRef.current.getBoundingClientRect();
      const top = rect.top + window.pageYOffset - totalOffset;
      window.scrollTo({ top, behavior });
    }
  };

  useEffect(() => {
    // Scroll to today on mount
    const timer = setTimeout(() => scrollToToday('smooth'), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'plan') {
      const timer = setTimeout(() => {
        scrollToToday('auto');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  useEffect(() => {
    if (notification) {
      if (notification.isCheckInNotification) {
        setNotificationCountdown(7);
      } else {
        setNotificationCountdown(null);
      }
      const timer = setTimeout(() => {
        setNotification(null);
        setNotificationCountdown(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (notificationCountdown !== null && notificationCountdown > 0) {
      timer = setTimeout(() => {
        setNotificationCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [notificationCountdown]);

  const currentDay = days.find(d => d.date === '2026-10-09');
  const pastDays = days.filter(d => d.isPast);
  const futureDaysOctober = days.filter(d => !d.isPast && d.date !== '2026-10-09' && d.date.startsWith('2026-10-'));
  const futureDaysNovember = days.filter(d => d.date.startsWith('2026-11-') && d.date <= '2026-11-09');

  useEffect(() => {
    if (!showOnboarding && activeTab === 'plan') {
      // Increase timeout and try multiple times to ensure scroll settles after animations
      const timer1 = setTimeout(() => scrollToToday('auto'), 50);
      const timer2 = setTimeout(() => scrollToToday('auto'), 300);
      const timer3 = setTimeout(() => scrollToToday('auto'), 600);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [showOnboarding, activeTab]);

  useEffect(() => {
    const handleScroll = () => {
      if (activeTab !== 'plan' || isHistoricalView) return;

      // Track current day visibility for FAB
      if (currentDayRef.current) {
        const rect = currentDayRef.current.getBoundingClientRect();
        const layoutHeaderHeight = window.innerWidth < 640 ? 52 : 56;
        const stickyHeaderHeight = stickyHeaderRef.current?.offsetHeight || (window.innerWidth < 640 ? 80 : 120);
        const threshold = layoutHeaderHeight + stickyHeaderHeight + 20;
        
        // If the top of the current day card is above the sticky header, or the bottom is below the viewport
        setIsCurrentInView(rect.top >= threshold - 100 && rect.bottom <= window.innerHeight);
      }

      // Track month for stats and header
      if (monthDividerRef.current) {
        const rect = monthDividerRef.current.getBoundingClientRect();
        const layoutHeaderHeight = window.innerWidth < 640 ? 52 : 56;
        const stickyHeaderHeight = stickyHeaderRef.current?.offsetHeight || (window.innerWidth < 640 ? 80 : 120);
        
        if (rect.top < layoutHeaderHeight + stickyHeaderHeight) {
          setActiveMonth('November 2026');
        } else {
          setActiveMonth('October 2026');
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab, isHistoricalView]);

  const clickTimeoutRef = useRef<nodejs.timeout |="" null="">(null);

  useEffect(() => {
    // Hide splash screen after 2 seconds, then show onboarding
    const timer = setTimeout(() => {
      setShowSplash(false);
      setShowOnboarding(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleOnboardingComplete = (selected: Colleague[]) => {
    setProjectTeammates(selected);
    setShowOnboarding(false);
    setTimeout(() => scrollToToday('auto'), 100);
    setTimeout(() => scrollToToday('auto'), 400);
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    setTimeout(() => scrollToToday('auto'), 100);
    setTimeout(() => scrollToToday('auto'), 400);
  };

  // Re-inject project teammates into days avatars if they are in office
  const processedDays = useMemo(() => {
    return days.map(day => {
      const isFutureDay = day.date > '2026-10-09' && !day.isPast;
      
      // Mock: determine if teammates are in office based on day hash
      const hash = day.date.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      // Determine project teammates who are in office
      const officeProjectTeammates = projectTeammates.length > 0 
        ? projectTeammates.filter((_, i) => (hash + i) % 2 === 0)
        : [];
      
      const projectAvatars: ColleagueAvatarInfo[] = officeProjectTeammates.map(c => ({
        initials: c.initials,
        color: c.color
      }));

      // Find other people in office for that day (consistent with DailyDetail)
      const otherOfficeAvatars: ColleagueAvatarInfo[] = [];
      const projectInitials = new Set(officeProjectTeammates.map(c => c.initials));
      
      COLLEAGUES.forEach((colleague, i) => {
        if (colleague.name === 'Roberto') return;
        if (projectInitials.has(colleague.initials)) return;
        
        const seed = hash + i;
        const rand = (n: number) => (Math.abs(seed * n) % 100);
        
        if (rand(101) < 20) {
          otherOfficeAvatars.push({
            initials: colleague.initials,
            color: colleague.color
          });
        }
      });

      // Final determination of avatars for the card
      let finalAvatars = [...projectAvatars, ...otherOfficeAvatars];
      
      // If future day, ensure at least 5 avatars pick people marked as "in office"
      if (isFutureDay && !day.isClosed && !day.isOfficeClosed) {
        if (finalAvatars.length < 5) {
          const usedInitials = new Set(finalAvatars.map(a => a.initials));
          // Get all available colleagues except Roberto
          const availableCollagues = COLLEAGUES.filter(c => c.name !== 'Roberto' && !usedInitials.has(c.initials));
          
          // Deterministically pick fillers to reach 5
          const fillersNeeded = 5 - finalAvatars.length;
          const fillers = availableCollagues.slice(0, fillersNeeded).map(c => ({
            initials: c.initials,
            color: c.color
          }));
          
          finalAvatars = [...finalAvatars, ...fillers];
        }
      }

      const finalBookedCount = Math.max(day.bookedCount || 0, finalAvatars.length);

      return {
        ...day,
        colleagueAvatars: finalAvatars.slice(0, 10),
        bookedCount: finalBookedCount,
        totalCapacity: day.totalCapacity || 23,
        projectTeammatesCount: officeProjectTeammates.length
      };
    });
  }, [days, projectTeammates]);

  const handleDayClick = (day: DayPresence) => {
    if (day.isClosed) return; // Ignore clicks on closed days
    
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      return; // Handled by double click
    }

    clickTimeoutRef.current = setTimeout(() => {
      handleOpenDay(day);
      clickTimeoutRef.current = null;
    }, 250);
  };

  const handleDayDoubleClick = (day: DayPresence) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    if (day.isPast || day.isClosed || day.isOfficeClosed) return;
    
    const isCurrentDay = day.date === '2026-10-09';
    
    // If it's the current day and user already checked in, do nothing
    if (isCurrentDay && day.isCheckedIn) return;

    const isCurrentlyInOffice = [WorkStatus.IN_OFFICE, WorkStatus.WAITING_LIST, WorkStatus.OFFICE_NO_DESK].includes(day.status);
    
    if (isCurrentlyInOffice) {
      // Unbook presence
      handleUpdateStatus(day.date, WorkStatus.PENDING);
      
      if (isCurrentDay) {
        setNotification({
          message: "You just unbooked from the current day.",
          date: day.date
        });
      }
      return;
    }

    // Book presence
    const booked = Number(day.bookedCount || 0);
    const capacity = Number(day.totalCapacity || 23);
    const isFull = booked >= capacity;
    const targetStatus = isFull ? WorkStatus.WAITING_LIST : WorkStatus.IN_OFFICE;
    
    if (isFull) {
      // Directly update and show special toast, don't open modal
      handleUpdateStatus(day.date, targetStatus, undefined, false, undefined, false, true, false);
      
      const dayNum = day.date.split('-')[2];
      setNotification({
        message: `You are in the waiting list for Day ${dayNum}`,
        date: day.date
      });
    } else {
      // First take snapshot and open
      handleOpenDay({ ...day, status: targetStatus }, 'WORKSPACE', true);
      
      // Set isUsingDesk to undefined to indicate it hasn't been decided
      handleUpdateStatus(day.date, targetStatus, undefined, false, undefined, false, false, false); // No toast, no close in this context
    }
  };

  const handleNavigate = (direction: 'next' | 'prev') => {
    if (!selectedDay) return;
    const currentIndex = days.findIndex(d => d.date === selectedDay.date);
    let nextIndex = currentIndex;
    
    // Attempt to find the next/prev day that isn't closed
    while (true) {
      nextIndex = direction === 'next' ? nextIndex + 1 : nextIndex - 1;
      
      // Stop if we hit bounds
      if (nextIndex < 0 || nextIndex >= days.length) break;
      
      // If the day is not closed, we found our next day
      if (!days[nextIndex].isClosed) {
        setSelectedDay(days[nextIndex]);
        break;
      }
    }
  };

  return (
    <>
      <animatepresence mode="wait">
        {showSplash && <splashscreen key="splash"/>}
        {showOnboarding && !showSplash && (
          <onboarding oncomplete="{handleOnboardingComplete}" onskip="{handleOnboardingSkip}"/>
        )}
      </AnimatePresence>
      <layout activetab="{activeTab}" ontabchange="{handleTabChange}" issimplifiedview="{isSimplifiedView}" userrole="{userRole}">
      <animatepresence mode="wait">
        {activeTab === 'organisation' ? (
          <motion.div key="organisation" initial="{{" opacity:="" 0,="" x:="" 20="" }}="" animate="{{" opacity:="" 1,="" x:="" 0="" }}="" exit="{{" opacity:="" 0,="" x:="" -20="" }}="" transition="{{" duration:="" 0.3="" }}="">
            <organisation days="{processedDays}" activemonth="{isHistoricalView" ?="" 'september="" 2026'="" :="" activemonth}=""/>
          </motion.div>
        ) : activeTab === 'plan' && !showOnboarding ? (
          <motion.div key="plan" initial="{{" opacity:="" 0="" }}="" animate="{{" opacity:="" 1="" }}="" exit="{{" opacity:="" 0="" }}="" classname="flex flex-col">
            <div ref="{stickyHeaderRef}" classname="sticky top-[52px] sm:top-[56px] z-40 bg-surface -mx-4 px-4 sm:-mx-6 sm:px-6 pt-6 sm:pt-12 pb-2 border-b border-outline-variant/10 transition-all flex flex-col">
              <section classname="mb-2 sm:mb-4 text-center">
                <h2 classname="font-headline text-2xl sm:text-4xl tracking-tight leading-tight">
                  {!isSimplifiedView ? <>Good Morning, <span classname="text-primary">{userName}</span></> : <span classname="text-primary">Office Planner</span>}
                </h2>
              </section>

              <div classname="relative">
                <section classname="mb-1 flex justify-between items-center text-on-surface">
                  <div classname="relative">
                    <button onclick="{()" ==""> setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                      className={`flex items-center gap-2 group transition-all px-2 py-1 -ml-2 rounded-lg ${isMonthDropdownOpen ? 'bg-primary/5 shadow-inner' : 'hover:bg-surface-container'}`}
                    >
                      <h1 classname="font-headline text-lg sm:text-2xl font-extrabold tracking-tight">
                        {isHistoricalView ? 'September 2026' : activeMonth}
                      </h1>
                      <chevrondown classname="{`w-4" h-4="" sm:w-5="" sm:h-5="" transition-transform="" duration-300="" ${ismonthdropdownopen="" ?="" 'rotate-180'="" :="" ''}`}=""/>
                    </button>

                    <animatepresence>
                      {isMonthDropdownOpen && (
                        <motion.div initial="{{" opacity:="" 0,="" y:="" 10,="" scale:="" 0.95="" }}="" animate="{{" opacity:="" 1,="" y:="" 0,="" scale:="" 1="" }}="" exit="{{" opacity:="" 0,="" y:="" 10,="" scale:="" 0.95="" }}="" classname="absolute top-full left-0 mt-2 w-48 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 z-50 overflow-hidden py-2">
                          <div classname="px-3 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-50">Select Month</div>
                          {['November 2026', 'October 2026', 'September 2026', 'August 2026', 'July 2026', 'June 2026'].map((month) => (
                            <button key="{month}" onclick="{()" ==""> handleMonthSelect(month)}
                              disabled={month !== 'September 2026' && month !== 'October 2026' && month !== 'November 2026'}
                              className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors flex justify-between items-center ${
                                (isHistoricalView ? 'September 2026' : activeMonth) === month 
                                  ? 'bg-primary text-white' 
                                  : (month === 'October 2026' || month === 'September 2026' || month === 'November 2026')
                                    ? 'text-on-surface hover:bg-surface-container-high bg-surface-container-lowest' 
                                    : 'text-on-surface/20 cursor-not-allowed'
                              }`}
                            >
                              {month}
                              {(isHistoricalView ? 'September 2026' : activeMonth) === month && <check classname="w-4 h-4"/>}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {!isSimplifiedView && (
                    <div classname="ml-auto">
                      {/* Mobile Layout (Unified right-aligned block) */}
                      <div classname="flex sm:hidden flex-col items-end gap-1">
                        <div classname="flex items-baseline gap-1.5">
                          <span classname="font-headline text-[13px] font-bold text-primary leading-none">
                            {isHistoricalView 
                              ? '10/10' 
                              : `${days.filter(d => d.date.startsWith(activeMonth.startsWith('October') ? '2026-10' : '2026-11') && d.isCheckedIn && (d.status === WorkStatus.IN_OFFICE || d.status === WorkStatus.OFFICE_NO_DESK)).length}/10`}
                          </span>
                          <span classname="font-sans text-[9px] text-on-surface-variant whitespace-nowrap">Presence days</span>
                        </div>
                      </div>

                      {/* Desktop Layout (Current structure with divider) */}
                      <div classname="hidden sm:flex items-center gap-4">
                        {/* Presence Days Block */}
                        <div classname="flex flex-col items-end">
                          <span classname="font-headline text-sm font-bold text-primary block leading-none">
                            {isHistoricalView 
                              ? '10/10' 
                              : `${days.filter(d => d.date.startsWith(activeMonth.startsWith('October') ? '2026-10' : '2026-11') && d.isCheckedIn && (d.status === WorkStatus.IN_OFFICE || d.status === WorkStatus.OFFICE_NO_DESK)).length}/10`}
                          </span>
                          <p classname="font-sans text-[10px] leading-tight text-on-surface-variant mt-0.5 whitespace-nowrap">
                            Presence days
                          </p>
                        </div>

                        <div classname="w-[1px] h-7 bg-outline-variant/20 self-center"/>

                        {/* Planned Days Block */}
                        <div classname="flex flex-col items-start">
                          <div classname="flex items-center gap-2.5 h-[16px]">
                            <div classname="flex items-center gap-1">
                              <building2 classname="w-3 h-3 text-on-surface-variant/30"/>
                              <span classname="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.office}</span>
                            </div>
                            <div classname="flex items-center gap-1">
                              <home classname="w-3 h-3 text-on-surface-variant/30"/>
                              <span classname="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.remote}</span>
                            </div>
                            <div classname="flex items-center gap-1">
                              <plane classname="w-3 h-3 text-on-surface-variant/30"/>
                              <span classname="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.mission}</span>
                            </div>
                            <div classname="flex items-center gap-1">
                              <palmtree classname="w-3 h-3 text-on-surface-variant/30"/>
                              <span classname="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.leave}</span>
                            </div>
                            <div classname="flex items-center gap-1">
                              <thermometer classname="w-3 h-3 text-on-surface-variant/30"/>
                              <span classname="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.sick}</span>
                            </div>
                          </div>
                          <p classname="font-sans text-[10px] leading-tight text-on-surface-variant mt-0.5 whitespace-nowrap">
                            Planned days
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

              </div>

              {/* Mobile-only Planned Days Strip */}
              {!isSimplifiedView && (
                <div classname="flex sm:hidden items-center justify-between pt-3 mt-1 border-t border-outline-variant/10">
                  <div classname="flex items-center gap-3">
                    <div classname="flex items-center gap-1.5">
                      <building2 classname="w-3.5 h-3.5 text-on-surface-variant/30"/>
                      <span classname="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.office}</span>
                    </div>
                    <div classname="flex items-center gap-1.5">
                      <home classname="w-3.5 h-3.5 text-on-surface-variant/30"/>
                      <span classname="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.remote}</span>
                    </div>
                    <div classname="flex items-center gap-1.5">
                      <plane classname="w-3.5 h-3.5 text-on-surface-variant/30"/>
                      <span classname="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.mission}</span>
                    </div>
                    <div classname="flex items-center gap-1.5">
                      <palmtree classname="w-3.5 h-3.5 text-on-surface-variant/30"/>
                      <span classname="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.leave}</span>
                    </div>
                    <div classname="flex items-center gap-1.5">
                      <thermometer classname="w-3.5 h-3.5 text-on-surface-variant/30"/>
                      <span classname="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.sick}</span>
                    </div>
                  </div>
                  <span classname="font-sans text-[9px] text-on-surface-variant whitespace-nowrap">Planned days</span>
                </div>
              )}
            </div>

            <div classname="pt-4 sm:pt-6 flex flex-col gap-3 sm:gap-4">
              {isHistoricalView ? (
                <div classname="grid grid-cols-2 gap-4 pb-32">
                  {septemberDays.map((day, i) => {
                    const isMonday = day.dayName === 'Monday';
                    const hasMondayInRow = isMonday || (i % 2 === 0 ? septemberDays[i+1]?.dayName === 'Monday' : septemberDays[i-1]?.dayName === 'Monday');
                    return (
                      <daycard key="{day.date}" day="{day}" issimplified="{isSimplifiedView}" index="{i}" projectteammates="{projectTeammates}" showweekseparator="{isMonday}" hasmondayinrow="{hasMondayInRow}"/>
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* Render Past Days in a grid */}
                  <div classname="grid grid-cols-2 gap-4">
                    {pastDays.map((day, i) => {
                      const isMonday = day.dayName === 'Monday';
                      const hasMondayInRow = isMonday || (i % 2 === 0 ? pastDays[i+1]?.dayName === 'Monday' : pastDays[i-1]?.dayName === 'Monday');
                      return (
                        <daycard key="{day.date}" day="{day}" onclick="{()" ==""> handleDayClick(day)}
                          onDoubleClick={() => handleDayDoubleClick(day)}
                          isSimplified={isSimplifiedView}
                          index={i}
                          projectTeammates={projectTeammates}
                          showWeekSeparator={isMonday}
                          hasMondayInRow={hasMondayInRow}
                        />
                      );
                    })}
                  </div>

                  {/* Render Current Day next */}
                  {currentDay && (
                    <div ref="{currentDayRef}" classname="{`snap-start" scroll-mt-[176px]="" sm:scroll-mt-[236px]`}="">
                      <daycard key="{currentDay.date}" day="{currentDay}" onclick="{()" ==""> handleDayClick(currentDay)}
                        onDoubleClick={!currentDay.isCheckedIn ? () => handleDayDoubleClick(currentDay) : undefined}
                        onCheckIn={() => handleCheckIn(currentDay.date, false)}
                        isSimplified={isSimplifiedView}
                        index={pastDays.length}
                        projectTeammates={projectTeammates}
                        showWeekSeparator={currentDay.dayName === 'Monday'}
                        hasMondayInRow={currentDay.dayName === 'Monday'}
                      />
                    </div>
                  )}

                  {/* Render remaining October days in a grid */}
                  <div classname="grid grid-cols-2 gap-4">
                    {futureDaysOctober.map((day, i) => {
                      const isMonday = day.dayName === 'Monday';
                      const hasMondayInRow = isMonday || (i % 2 === 0 ? futureDaysOctober[i+1]?.dayName === 'Monday' : futureDaysOctober[i-1]?.dayName === 'Monday');
                      return (
                        <daycard key="{day.date}" day="{{...day," ishighlighted:="" false}}="" onclick="{()" ==""> handleDayClick(day)}
                          onDoubleClick={() => handleDayDoubleClick(day)}
                          onCheckIn={() => handleCheckIn(day.date, false)}
                          isSimplified={isSimplifiedView}
                          index={pastDays.length + (currentDay ? 1 : 0) + i}
                          projectTeammates={projectTeammates}
                          showWeekSeparator={isMonday}
                          hasMondayInRow={hasMondayInRow}
                        />
                      );
                    })}
                  </div>

                  {/* Month Divider */}
                  <div ref="{monthDividerRef}" classname="py-6 sm:py-12 px-4 flex items-center gap-6">
                    <div classname="h-[1px] flex-grow bg-outline-variant/30"/>
                    <span classname="font-headline text-xs font-bold tracking-[0.2em] text-on-surface-variant/60 uppercase">
                      November 2026
                    </span>
                    <div classname="h-[1px] flex-grow bg-outline-variant/30"/>
                  </div>

                  {/* Render November days in a grid */}
                  <div classname="grid grid-cols-2 gap-4 pb-4">
                    {futureDaysNovember.map((day, i) => {
                      const isMonday = day.dayName === 'Monday';
                      const hasMondayInRow = isMonday || (i % 2 === 0 ? futureDaysNovember[i+1]?.dayName === 'Monday' : futureDaysNovember[i-1]?.dayName === 'Monday');
                      return (
                        <daycard key="{day.date}" day="{{...day," ishighlighted:="" false}}="" onclick="{()" ==""> handleDayClick(day)}
                          onDoubleClick={() => handleDayDoubleClick(day)}
                          onCheckIn={() => handleCheckIn(day.date, false)}
                          isSimplified={isSimplifiedView}
                          index={pastDays.length + (currentDay ? 1 : 0) + futureDaysOctober.length + i}
                          projectTeammates={projectTeammates}
                          showWeekSeparator={isMonday}
                          hasMondayInRow={hasMondayInRow}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : activeTab === 'stats' && !showOnboarding ? (
          <stats days="{processedDays}" currentmonth="{isHistoricalView" ?="" 'september="" 2026'="" :="" activemonth}="" projectteammates="{projectTeammates}" onaddteammates="{()" ==""> setActiveTab('profile')}
          />
        ) : !showOnboarding ? (
          <profile thememode="{themeMode}" onsetthememode="{setThemeMode}" issimplifiedview="{isSimplifiedView}" ontogglesimplifiedview="{()" ==""> setIsSimplifiedView(!isSimplifiedView)}
            projectTeammates={projectTeammates}
            onUpdateProjectTeammates={setProjectTeammates}
          />
        ) : null}
      </AnimatePresence>

      <animatepresence>
        {roomSelectionDate && (
          <roomselection date="{roomSelectionDate}" mode="confirm" plannedroom="{days.find(d" ==""> d.date === roomSelectionDate)?.room}
            onBack={() => setRoomSelectionDate(null)}
            onSelect={handleRoomSelect}
          />
        )}
      </AnimatePresence>

      <animatepresence>
        {notification && (
          <motion.div initial="{{" y:="" 100,="" opacity:="" 0="" }}="" animate="{{" y:="" 0,="" opacity:="" 1="" }}="" exit="{{" y:="" 100,="" opacity:="" 0="" }}="" classname="{`fixed" bottom-32="" left-6="" right-6="" z-[60]="" p-4="" ${notification.isretrofit="" ?="" 'py-5'="" :="" ''}="" rounded-2xl="" shadow-2xl="" flex="" items-center="" justify-between="" pointer-events-auto="" border="" border-outline-variant="" 30="" bg-surface-container="" text-on-surface="" opacity-100`}="">
            <div classname="flex flex-col flex-grow pr-3">
              <p classname="text-sm font-bold leading-tight">
                {notification.message.split(/("[^"]+")/g).map((part, i) => {
                  if (part.startsWith('"') && part.endsWith('"')) {
                    return <span key="{i}" classname="text-primary">{part}</span>;
                  }
                  return (
                    <fragment key="{i}">
                      {part.split(' ').map((word, j) => {
                        const isCancelled = word.toLowerCase().includes('cancelled');
                        return (
                          <span key="{j}" classname="{isCancelled" ?="" 'text-red-500'="" :="" ''}="">
                            {word}{j < part.split(' ').length - 1 ? ' ' : ''}
                          </span>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </p>
            </div>
            {notification.isCheckInNotification ? (
              <button onclick="{(e)" ==""> {
                  e.stopPropagation();
                  notification.undoAction?.();
                }}
                className="bg-surface-container-lowest text-on-surface border border-outline-variant/30 px-5 py-2 rounded-full text-xs font-extrabold shadow-sm active:scale-95 transition-all shrink-0 hover:bg-surface-container"
              >
                Undo {notificationCountdown !== null && `(${notificationCountdown})`}
              </button>
            ) : notification.undoAction ? (
              <button onclick="{(e)" ==""> {
                  e.stopPropagation();
                  notification.undoAction?.();
                }}
                className="text-on-surface-variant text-xs font-bold px-3 py-2 -mr-1 hover:bg-on-surface/5 rounded-xl transition-all active:scale-95 shrink-0 bg-on-surface/[0.03]"
              >
                Undo
              </button>
            ) : !notification.isRetrofit && !notification.message.toLowerCase().includes('cancelled') && (
              <button onclick="{()" ==""> {
                  const day = processedDays.find(d => d.date === notification.date);
                  if (day) {
                    const step = notification.showWorkspaceAction ? 'WORKSPACE' : 'VIEW';
                    handleOpenDay(day, step);
                  }
                  setNotification(null);
                }}
                className="bg-primary text-white px-4 py-2 rounded-full text-xs font-extrabold shadow-sm active:scale-95 transition-transform shrink-0"
              >
                {notification.showWorkspaceAction 
                  ? "Define Workspace Use" 
                  : (notification.message.includes("unbooked") ? "Set up a new working status now" : "Go to the Daily List")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {selectedDay && (
        <dailydetail day="{processedDays.find(d" ==""> d.date === selectedDay.date) || selectedDay}
          allDays={processedDays}
          initialStep={selectedDayInitialStep}
          isMandatory={isMandatoryWorkspace}
          projectTeammates={projectTeammates}
          onClose={handleCloseDetail}
          onCancel={handleCancelDetail}
          onCheckIn={() => handleCheckIn(selectedDay.date)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateOffTime={handleUpdateOffTime}
          onNavigate={handleNavigate}
          onUpdateBulkStatus={handleUpdateBulkStatus}
          onUpdateLabBooking={handleUpdateLabBooking}
          onOpenProfile={() => {
            setSelectedDay(null);
            setActiveTab('profile');
          }}
        />
      )}

      {/* Last Minute Warning Dialog */}
      <animatepresence>
        {lastMinuteWarning && (
          <>
            {/* Backdrop */}
            <motion.div initial="{{" opacity:="" 0="" }}="" animate="{{" opacity:="" 1="" }}="" exit="{{" opacity:="" 0="" }}="" onclick="{()" ==""> setLastMinuteWarning(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] cursor-pointer"
            />
            
            {/* Responsive Container */}
            <div classname="fixed inset-0 z-[101] flex items-end sm:items-center justify-center p-0 sm:p-6 pointer-events-none">
              <motion.div initial="{{" y:="" '100%',="" opacity:="" 0="" }}="" animate="{{" y:="" 0,="" opacity:="" 1="" }}="" exit="{{" y:="" '100%',="" opacity:="" 0="" }}="" transition="{{" type:="" 'spring',="" damping:="" 25,="" stiffness:="" 300="" }}="" classname="w-full sm:max-w-md bg-surface-container-lowest sm:rounded-[32px] rounded-t-[32px] p-8 sm:p-10 shadow-2xl pointer-events-auto border-t sm:border border-outline-variant/20 flex flex-col items-center text-center relative">
                {/* Close Button */}
                <button onclick="{()" ==""> setLastMinuteWarning(null)}
                  className="absolute top-6 right-6 p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
                >
                  <x classname="w-5 h-5"/>
                </button>

                <div classname="w-16 h-16 bg-warning-bg border border-warning-stroke rounded-full flex items-center justify-center mb-6">
                  <alerttriangle classname="w-8 h-8 text-warning-text"/>
                </div>
                <h3 classname="font-headline text-xl sm:text-2xl font-extrabold mb-3 leading-tight text-warning-text">Last-Minute Change</h3>
                <p classname="text-warning-secondary text-sm sm:text-base mb-8 font-sans">
                  You are about to do a last-minute booking change for {new Date(lastMinuteWarning.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. This might have an impact on other colleagues' planning. 
                  <br classname="hidden sm:block"/> Are you sure you want to proceed?
                </p>
                <div classname="flex flex-col gap-4 w-full">
                  <button onclick="{()" ==""> {
                      lastMinuteWarning.action();
                    }}
                    className="w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all text-sm sm:text-base"
                  >
                    Yes, change it
                  </button>
                  <button onclick="{()" ==""> setLastMinuteWarning(null)}
                    className="w-full text-warning-secondary font-bold py-2 hover:text-warning-text transition-all text-sm sm:text-base"
                  >
                    Forget about it
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Historical Back to today FAB */}
      <animatepresence>
        {isHistoricalView && (
          <motion.div initial="{{" y:="" 100,="" opacity:="" 0="" }}="" animate="{{" y:="" 0,="" opacity:="" 1="" }}="" exit="{{" y:="" 100,="" opacity:="" 0="" }}="" classname="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <button onclick="{()" ==""> handleMonthSelect('October 2026')}
              className="bg-primary text-white font-headline text-xs sm:text-sm font-extrabold px-8 py-3 rounded-full shadow-[0_8px_30px_rgba(54,169,194,0.4)] hover:shadow-[0_8px_40px_rgba(54,169,194,0.6)] active:scale-95 transition-all border border-white/10"
            >
              Back to today
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll-triggered Back to today FAB */}
      <animatepresence>
        {!isHistoricalView && !isCurrentInView && !showOnboarding && activeTab === 'plan' && 
         days.find(d => d.date === '2026-10-09')?.isCheckedIn && fabCheckStatus === 'idle' && (
          <motion.div initial="{{" y:="" 100,="" opacity:="" 0="" }}="" animate="{{" y:="" 0,="" opacity:="" 1="" }}="" exit="{{" y:="" 100,="" opacity:="" 0="" }}="" classname="fixed bottom-24 right-6 z-50 pointer-events-auto">
            <button onclick="{()" ==""> scrollToToday('smooth')}
              className="bg-surface-container-lowest text-primary font-headline text-xs sm:text-sm font-extrabold px-6 py-3 rounded-full shadow-2xl hover:bg-surface-container active:scale-95 transition-all border border-outline-variant/30"
            >
              Back to today
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Check-in Button */}
      <animatepresence>
        {!isHistoricalView && !isCurrentInView && !showOnboarding &&
         activeTab === 'plan' && 
         days.find(d => d.date === '2026-10-09') &&
         ![WorkStatus.PENDING, WorkStatus.WAITING_LIST].includes(days.find(d => d.date === '2026-10-09')!.status) &&
         !(days.find(d => d.date === '2026-10-09')?.isCheckedIn && fabCheckStatus === 'idle') && (
          <motion.div initial="{{" opacity:="" 0,="" y:="" 100="" }}="" animate="{{" opacity:="" 1,="" y:="" 0="" }}="" exit="{{" opacity:="" 0,="" y:="" 100,="" transition:="" {="" duration:="" 0.3,="" ease:="" "easeinout"="" }="" }}="" transition="{{" duration:="" 0.4,="" ease:="" "easeout"="" }}="" classname="fixed bottom-24 right-6 z-50 pointer-events-auto">
            <motion.button onclick="{(e)" ==""> { e.stopPropagation(); handleFabCheckIn(); }}
              className="bg-primary text-white text-[11px] font-bold h-10 sm:h-12 px-6 rounded-full shadow-2xl hover:opacity-90 active:scale-95 transition-all outline-none flex items-center justify-center min-w-[3.5rem] overflow-hidden"
              style={{
                boxShadow: themeMode === 'dark' ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 25px -5px rgba(54, 169, 194, 0.3)'
              }}
            >
              {fabCheckStatus === 'idle' ? (
                <motion.span initial="{{" opacity:="" 0="" }}="" animate="{{" opacity:="" 1="" }}="" classname="whitespace-nowrap">
                  Say Good Morning
                </motion.span>
              ) : (
                <motion.div initial="{{" scale:="" 0,="" rotate:="" -45="" }}="" animate="{{" scale:="" 1,="" rotate:="" 0="" }}="" classname="flex items-center">
                  <svg classname="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewbox="0 0 24 24">
                    <path strokelinecap="round" strokelinejoin="round" strokewidth="{4}" d="M5 13l4 4L19 7"/>
                  </svg>
                </motion.div>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
    </>
  );
}
