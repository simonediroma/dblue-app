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
import AdminBar from './components/AdminBar';
import { WorkStatus, DayPresence, OffTimeType, UserRole, ColleagueAvatarInfo } from './types';
import type { Colleague } from './constants/colleagues';
import { parseAppDate, getTodayStr, toAppDateStr, months, getFictionalDayName } from './utils/dateUtils';
import { ChevronDown, Check, X, AlertTriangle, Building2, Home, Plane, Palmtree, Thermometer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './context/AuthContext';
import type { User } from './types/api';
import { usePresence } from './hooks/usePresence';
import { useColleagues, mapUserToColleague } from './hooks/useColleagues';
import { getPresence, checkIn, undoCheckIn, getRooms, getUsers, updateTeammates, completeOnboarding, updatePreferences, retrofitStatus } from './services/api';
import type { Room } from './services/api';
import { useWebSocket } from './hooks/useWebSocket';

const TODAY = getTodayStr();

function addMonthsToDate(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function monthKeyToLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${months[parseInt(month) - 1]} ${year}`;
}

function monthLabelToKey(label: string): string {
  const parts = label.split(' ');
  const monthName = parts[0];
  const year = parts[1];
  const monthIndex = months.indexOf(monthName);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

const statusLabels: Record<string, string> = {
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
 const today = parseAppDate(TODAY);
 const target = parseAppDate(dateStr);
 const diffTime = target.getTime() - today.getTime();
 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 return diffDays > 0 && diffDays <= LAST_MINUTE_THRESHOLD_DAYS;
}

function mapRole(apiRole: User['role']): UserRole {
 return apiRole === 'director' || apiRole === 'owner'
 ? UserRole.DIRECTOR
 : UserRole.EMPLOYEE;
}

export default function App() {
 const { user, logout, refreshUser } = useAuth();
 const userName = user?.name ?? '';
 const userRole = mapRole(user?.role ?? 'employee');
 const [showSplash, setShowSplash] = useState(!user?.onboardingCompleted);
 const [showOnboarding, setShowOnboarding] = useState(false);
 const [projectTeammates, setProjectTeammates] = useState<Colleague[]>([]);
 const [rooms, setRooms] = useState<Room[]>([]);

 const today = new Date();
 const currentMonthKey = toAppDateStr(today).slice(0, 7);
 const nextMonthKey = toAppDateStr(addMonthsToDate(today, 1)).slice(0, 7);
 const currentMonthLabel = monthKeyToLabel(currentMonthKey);
 const nextMonthLabel = monthKeyToLabel(nextMonthKey);

 const { days, setDays, loading, updateStatus: hookUpdateStatus, bulkUpdateStatus: hookBulkUpdateStatus, updateOffTime: hookUpdateOffTime } = usePresence([currentMonthKey, nextMonthKey]);
 const colleagues = useColleagues();

 const [historicalDays, setHistoricalDays] = useState<DayPresence[]>([]);

 const loadHistoricalMonth = async (monthKey: string) => {
   try {
     const data = await getPresence(monthKey);
     setHistoricalDays(data.map(d => d.dayName ? d : { ...d, dayName: getFictionalDayName(d.date, 'long') }));
   } catch {
     setHistoricalDays([]);
   }
 };

 const [selectedDay, setSelectedDay] = useState<DayPresence | null>(null);
 const [activeTab, setActiveTab] = useState<'plan' | 'stats' | 'profile' | 'organisation'>('plan');
 const [roomSelectionDate, setRoomSelectionDate] = useState<string | null>(null);
 const [isCurrentInView, setIsCurrentInView] = useState(true);
 const currentDayRef = useRef<HTMLDivElement>(null);
 const monthDividerRef = useRef<HTMLDivElement>(null);
 const [activeMonth, setActiveMonth] = useState(currentMonthLabel);
 const [, setShowMonthBanner] = useState(false);
 const [fabCheckStatus, setFabCheckStatus] = useState<'idle' | 'checking' | 'done'>('idle');
 const [notification, setNotification] = useState<{message: string, date: string, isRetrofit?: boolean, showWorkspaceAction?: boolean, undoAction?: () => void, isCheckInNotification?: boolean} | null>(null);
 const [notificationCountdown, setNotificationCountdown] = useState<number | null>(null);
 const [selectedDayInitialStep, setSelectedDayInitialStep] = useState<'VIEW' | 'WORKSPACE'>('VIEW');
 const [isMandatoryWorkspace, setIsMandatoryWorkspace] = useState(false);
 const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light');
 const [isSimplifiedView, setIsSimplifiedView] = useState(false);
 const [isHighContrast, setIsHighContrast] = useState(false);
 const [isLargeText, setIsLargeText] = useState(false);
 const [isScreenReader, setIsScreenReader] = useState(false);
 const [isHistoricalView, setIsHistoricalView] = useState(false);
 const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
 const [originalDaysSnapshot, setOriginalDaysSnapshot] = useState<DayPresence[] | null>(null);
 const [lastMinuteWarning, setLastMinuteWarning] = useState<{ date: string, action: () => void } | null>(null);

 const monthCounts = useMemo(() => {
 const monthPrefix = monthLabelToKey(activeMonth);
 const relevantDays = isHistoricalView ? historicalDays : days.filter(d => d.date.startsWith(monthPrefix));

 return {
 office: relevantDays.filter(d => d.status === WorkStatus.IN_OFFICE || d.status === WorkStatus.OFFICE_NO_DESK).length,
 remote: relevantDays.filter(d => d.status === WorkStatus.REMOTE).length,
 leave: relevantDays.filter(d => d.status === WorkStatus.LEAVE || d.status === WorkStatus.PARENTAL_LEAVE).length,
 mission: relevantDays.filter(d => d.status === WorkStatus.MISSION).length,
 sick: relevantDays.filter(d => d.status === WorkStatus.SICK).length,
 };
 }, [activeMonth, days, isHistoricalView, historicalDays]);

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
 const monthKey = monthLabelToKey(month);
 const isPast = monthKey < currentMonthKey;

 if (isPast) {
 setIsHistoricalView(true);
 setActiveMonth(month);
 setIsCurrentInView(true);
 loadHistoricalMonth(monthKey);
 } else if (monthKey === nextMonthKey) {
 setIsHistoricalView(false);
 setActiveMonth(month);
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
 setActiveMonth(month);
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
 setActiveMonth(prev => prev !== currentMonthLabel ? currentMonthLabel : prev);
 setShowMonthBanner(false);
 } else {
 setActiveMonth(prev => prev !== nextMonthLabel ? nextMonthLabel : prev);
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
 const currentDay = days.find(d => d.date === TODAY);
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

 useEffect(() => {
 if (user) {
  setThemeMode(user.preferences.theme);
  setIsSimplifiedView(user.preferences.accessibility.reducedMotion);
  setIsHighContrast(user.preferences.accessibility.highContrast ?? false);
  setIsLargeText(user.preferences.accessibility.textSize === 'large');
  setIsScreenReader(user.preferences.accessibility.screenReader ?? false);
 }
 }, [user]);

 useEffect(() => {
 document.documentElement.classList.toggle('high-contrast', isHighContrast);
 }, [isHighContrast]);

 useEffect(() => {
 document.documentElement.classList.toggle('large-text', isLargeText);
 }, [isLargeText]);

 useEffect(() => {
 document.documentElement.classList.toggle('screen-reader-focus', isScreenReader);
 }, [isScreenReader]);

 const handleSetThemeMode = (mode: 'light' | 'dark' | 'system') => {
 setThemeMode(mode);
 updatePreferences({ theme: mode }).catch((err) => console.error('App: failed to save theme preference', err));
 };

 const handleToggleSimplifiedView = () => {
 const newValue = !isSimplifiedView;
 setIsSimplifiedView(newValue);
 updatePreferences({ accessibility: { reducedMotion: newValue, textSize: isLargeText ? 'large' : 'default', screenReader: isScreenReader, highContrast: isHighContrast } }).catch(() => {
  setIsSimplifiedView(!newValue);
 });
 };

 const handleToggleHighContrast = () => {
 const newValue = !isHighContrast;
 setIsHighContrast(newValue);
 updatePreferences({ accessibility: { reducedMotion: isSimplifiedView, textSize: isLargeText ? 'large' : 'default', screenReader: isScreenReader, highContrast: newValue } }).catch(() => {
  setIsHighContrast(!newValue);
 });
 };

 const handleToggleLargeText = () => {
 const newValue = !isLargeText;
 setIsLargeText(newValue);
 updatePreferences({ accessibility: { reducedMotion: isSimplifiedView, textSize: newValue ? 'large' : 'default', screenReader: isScreenReader, highContrast: isHighContrast } }).catch(() => {
  setIsLargeText(!newValue);
 });
 };

 const handleToggleScreenReader = () => {
 const newValue = !isScreenReader;
 setIsScreenReader(newValue);
 updatePreferences({ accessibility: { reducedMotion: isSimplifiedView, textSize: isLargeText ? 'large' : 'default', screenReader: newValue, highContrast: isHighContrast } }).catch(() => {
  setIsScreenReader(!newValue);
 });
 };

 const handleTabChange = (newTab: 'plan' | 'stats' | 'profile' | 'organisation') => {
 if (newTab === activeTab) return;
 
 setActiveTab(newTab);
 
 // Reset scroll instantly
 if (newTab !== 'plan') {
 window.scrollTo({ top: 0, behavior: 'auto' });
 }
 };

 const handleCheckIn = async (date: string, autoOpen = false) => {
 const day = days.find(d => d.date === date);
 const isToday = date === TODAY;

 if (isToday && day?.status === WorkStatus.IN_OFFICE) {
 setRoomSelectionDate(date);
 } else {
 setDays(prev => prev.map(d => d.date === date ? { ...d, isCheckedIn: true } : d));

 setNotification({
 message: "Successfully checked in",
 date: date,
 isCheckInNotification: true,
 undoAction: () => {
 setDays(prev => prev.map(d => d.date === date ? { ...d, isCheckedIn: false } : d));
 setNotification(null);
 setNotificationCountdown(null);
 undoCheckIn(date).catch((err) => console.error('undoCheckIn error:', err));
 }
 });

 if (autoOpen) {
 if (day) handleOpenDay(day);
 }

 try {
  await checkIn(date);
 } catch {
  setDays(prev => prev.map(d => d.date === date ? { ...d, isCheckedIn: false } : d));
  setNotification({ message: "Check-in failed. Please try again.", date });
 }
 }
 };

 const handleRoomSelect = async (roomName: string) => {
 if (!roomSelectionDate) return;

 const isUsingDesk = roomName !== 'No Desk';
 const oldDaySnapshot = days.find(d => d.date === roomSelectionDate);
 if (!oldDaySnapshot) return;
 const dateForRequest = roomSelectionDate;

 setDays(prev => {
 const index = prev.findIndex(d => d.date === dateForRequest);
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
 date: dateForRequest,
 isCheckInNotification: true,
 undoAction: () => {
 setDays(prev => prev.map(d => d.date === dateForRequest ? {
 ...d,
 isCheckedIn: false,
 room: oldDaySnapshot.room,
 isUsingDesk: oldDaySnapshot.isUsingDesk,
 bookedCount: oldDaySnapshot.bookedCount
 } : d));
 setNotification(null);
 setNotificationCountdown(null);
 undoCheckIn(dateForRequest).catch((err) => console.error('undoCheckIn error:', err));
 }
 });

 setRoomSelectionDate(null);
 setSelectedDay(null);

 try {
 await checkIn(dateForRequest, isUsingDesk ? roomName : undefined, isUsingDesk);
 } catch {
 setDays(prev => prev.map(d => d.date === dateForRequest ? {
  ...d,
  isCheckedIn: false,
  room: oldDaySnapshot.room,
  isUsingDesk: oldDaySnapshot.isUsingDesk,
  bookedCount: oldDaySnapshot.bookedCount
 } : d));
 setNotification({ message: "Check-in failed. Please try again.", date: dateForRequest });
 }
 };

 const isConsumingDesk = (status: WorkStatus, isUsingDesk?: boolean) => {
 return status === WorkStatus.IN_OFFICE && isUsingDesk !== false;
 };

 const handleUpdateStatus = async (dateOrDates: string | string[], status: WorkStatus, isUsingDesk?: boolean, isRetrofit = false, room?: string, showWorkspaceAction = false, bypassWarning = false, shouldClose = true) => {
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

 try {
 if (isHistoricalView && targetDates.length === 1) {
 await retrofitStatus(targetDates[0], { status });
 } else if (targetDates.length === 1) {
 await hookUpdateStatus(targetDates[0], status, isUsingDesk, room);
 } else {
 await hookBulkUpdateStatus(targetDates.map(date => ({
 date,
 status,
 isUsingDesk: isUsingDesk ?? false,
 room: room ?? '',
 })));
 }
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Retrofit non riuscito';
 setNotification({ message, date: targetDates[0] });
 return;
 }

 if (isHistoricalView) {
 loadHistoricalMonth(monthLabelToKey(activeMonth));
 }

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
 setSelectedDay(null);
 setSelectedDayInitialStep('VIEW');
 }
 };

 const handleUpdateBulkStatus = async (updates: Array<{date: string, status: WorkStatus, isUsingDesk: boolean, room: string}>) => {
 const snapshotForUndo = originalDaysSnapshot ? [...originalDaysSnapshot] : [...days];

 try {
 await hookBulkUpdateStatus(updates);
 } catch (err) {
 setNotification({
 message: `Impossibile estendere lo stato: ${(err as Error).message}`,
 date: updates[0].date,
 });
 return;
 }

 setNotification({
 message: `Working Status "${statusLabels[updates[0].status]}" correctly extended for selected days`,
 date: updates[0].date,
 undoAction: () => {
 setDays(prev => {
 const newDays = [...prev];
 updates.forEach(update => {
 const index = newDays.findIndex(d => d.date === update.date);
 if (index !== -1) {
 const originalDay = snapshotForUndo.find(d => d.date === update.date);
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

 const handleUpdateOffTime = async (date: string, offTime: { type: OffTimeType, hours?: number } | undefined) => {
 const isPast = isHistoricalView || !!(days.find(d => d.date === date)?.isPast);
 const dayNum = date.split('-')[2];

 try {
 await hookUpdateOffTime(date, offTime ?? null);
 } catch {
 return;
 }

 if (isHistoricalView) {
 loadHistoricalMonth(monthLabelToKey(activeMonth));
 }

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

 const stickyHeaderRef = useRef<HTMLDivElement>(null);

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
 let timer: ReturnType<typeof setTimeout>;
 if (notificationCountdown !== null && notificationCountdown > 0) {
 timer = setTimeout(() => {
 setNotificationCountdown(prev => prev !== null ? prev - 1 : null);
 }, 1000);
 }
 return () => clearTimeout(timer);
 }, [notificationCountdown]);

 const currentDay = days.find(d => d.date === TODAY);
 const pastDays = days.filter(d => d.isPast);
 const futureDaysCurrentMonth = days.filter(d => !d.isPast && d.date !== TODAY && d.date.startsWith(currentMonthKey));
 const futureDaysNextMonth = days.filter(d => d.date.startsWith(nextMonthKey));

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
 }, [showOnboarding, activeTab, currentDay?.date]);

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
 setActiveMonth(nextMonthLabel);
 } else {
 setActiveMonth(currentMonthLabel);
 }
 }
 };

 window.addEventListener('scroll', handleScroll, { passive: true });
 return () => window.removeEventListener('scroll', handleScroll);
 }, [activeTab, isHistoricalView]);

 const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 useEffect(() => {
 if (lastMinuteWarning) {
  document.body.style.overflow = 'hidden';
 } else {
  document.body.style.overflow = '';
 }
 return () => { document.body.style.overflow = ''; };
 }, [lastMinuteWarning]);

 useEffect(() => {
 getRooms().then(setRooms).catch((err) => console.error('App: failed to load rooms', err));
 }, []);

 useWebSocket((update) => {
 setDays(prev => prev.map(d =>
  d.date === update.date
   ? {
    ...d,
    bookedCount: update.totalBooked,
    totalCapacity: update.totalCapacity,
    rooms: update.rooms,
    extras: update.extras,
   }
   : d
 ));
 });

 useEffect(() => {
 if (user && user.onboardingCompleted && user.teammates.length > 0) {
  getUsers()
   .then(allUsers => {
    if (!Array.isArray(allUsers)) throw new Error(`Expected array, got ${typeof allUsers}`);
    const myTeammates = allUsers
     .filter(u => user.teammates.includes(u.id))
     .map(mapUserToColleague);
    setProjectTeammates(myTeammates);
   })
   .catch((err) => console.error('App: failed to load project teammates', err));
 }
 }, [user]);

 useEffect(() => {
 // Hide splash screen after 2 seconds, then show onboarding only for new users
 const timer = setTimeout(() => {
  setShowSplash(false);
  if (!user?.onboardingCompleted) {
   setShowOnboarding(true);
  }
 }, 2000);
 return () => clearTimeout(timer);
 }, []);

 const handleOnboardingComplete = async (selected: Colleague[]) => {
 setProjectTeammates(selected);
 try {
  await updateTeammates(selected.map(c => c.id));
  await completeOnboarding();
  await refreshUser();
  setShowOnboarding(false);
  setTimeout(() => scrollToToday('auto'), 100);
  setTimeout(() => scrollToToday('auto'), 400);
 } catch {
  setNotification({ message: "Failed to save teammates. Please try again.", date: TODAY });
 }
 };

 const handleOnboardingSkip = () => {
 setShowOnboarding(false);
 setTimeout(() => scrollToToday('auto'), 100);
 setTimeout(() => scrollToToday('auto'), 400);
 };

 const handleUpdateProjectTeammates = async (newTeammates: Colleague[]) => {
 const prev = projectTeammates;
 setProjectTeammates(newTeammates);
 try {
  await updateTeammates(newTeammates.map(c => c.id));
 } catch {
  setProjectTeammates(prev);
  setNotification({ message: "Failed to update teammates. Please try again.", date: TODAY });
 }
 };

 // Re-inject project teammates into days avatars if they are in office.
 // Everything here is derived from real per-day presence data: officeUserIds and
 // colleagueAvatars both come from the backend (getStatusForUser). The previous
 // version fabricated extra "in office" colleagues (hash-pseudo-random picks plus a
 // synthetic minimum of 5 avatars per future day) and force-raised bookedCount to
 // match — making the "office full"/waiting-list display wrong whenever real room
 // capacity was smaller than the synthetic floor.
 const processedDays = useMemo(() => {
 return days.map(day => {
 // Project teammates who are in office, re-intersected client-side so a
 // freshly-edited teammates selection reflects without a refetch. Their
 // initials/colors come from the local Colleague mapping.
 const officeUserIds = new Set(day.officeUserIds || []);
 const officeProjectTeammates = projectTeammates.filter(c => officeUserIds.has(c.id));

 const projectAvatars: ColleagueAvatarInfo[] = officeProjectTeammates.map(c => ({
 initials: c.initials,
 color: c.color
 }));

 // Other people genuinely in office that day, as reported by the backend —
 // teammates first, then the rest, deduped by initials.
 const projectInitials = new Set(projectAvatars.map(a => a.initials));
 const otherOfficeAvatars = (day.colleagueAvatars || []).filter(a => a.initials && !projectInitials.has(a.initials));

 const finalAvatars = [...projectAvatars, ...otherOfficeAvatars];

 return {
 ...day,
 colleagueAvatars: finalAvatars.slice(0, 10),
 bookedCount: day.bookedCount || 0,
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
 
 const isCurrentDay = day.date === TODAY;
 
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

 // Book presence — server decides if IN_OFFICE or WAITING_LIST
 handleOpenDay({ ...day, status: WorkStatus.IN_OFFICE }, 'WORKSPACE', true);
 handleUpdateStatus(day.date, WorkStatus.IN_OFFICE, undefined, false, undefined, false, false, false);
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
 <AnimatePresence mode="wait">
 {(showSplash || loading) && <SplashScreen key="splash"/>}
 {showOnboarding && !showSplash && !loading && (
 <Onboarding onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip}/>
 )}
 </AnimatePresence>
 <Layout activeTab={activeTab} onTabChange={handleTabChange} isSimplifiedView={isSimplifiedView} userRole={userRole}>
 <AnimatePresence mode="wait">
 {activeTab === 'organisation' ? (
 <motion.div key="organisation" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}} transition={{duration: 0.3}}>
 <Organisation days={processedDays} activeMonth={activeMonth}/>
 </motion.div>
 ) : activeTab === 'plan' && !showOnboarding ? (
 <motion.div key="plan" data-testid="plan-page" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="flex flex-col">
 <div ref={stickyHeaderRef} className="sticky top-[52px] sm:top-[56px] z-40 bg-surface -mx-4 px-4 sm:-mx-6 sm:px-6 pt-6 sm:pt-12 pb-2 border-b border-outline-variant/10 transition-all flex flex-col">
 <section className="mb-2 sm:mb-4 text-center">
 <h2 className="font-headline text-2xl sm:text-4xl tracking-tight leading-tight">
 {!isSimplifiedView ? <>Good Morning, <span className="text-primary">{userName}</span></> : <span className="text-primary">Office Planner</span>}
 </h2>
 </section>

 <div className="relative">
 <section className="mb-1 flex justify-between items-center text-on-surface">
 <div className="relative">
 <button data-testid="month-selector-button" onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
 className={`flex items-center gap-2 group transition-all px-2 py-1 -ml-2 rounded-lg ${isMonthDropdownOpen ? 'bg-primary/5 shadow-inner' : 'hover:bg-surface-container'}`}
 >
 <h1 className="font-headline text-lg sm:text-2xl font-extrabold tracking-tight">
 {activeMonth}
 </h1>
 <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 ${isMonthDropdownOpen ? 'rotate-180' : ''}`}/>
 </button>

 <AnimatePresence>
 {isMonthDropdownOpen && (
 <motion.div initial={{opacity: 0, y: 10, scale: 0.95}} animate={{opacity: 1, y: 0, scale: 1}} exit={{opacity: 0, y: 10, scale: 0.95}} className="absolute top-full left-0 mt-2 w-48 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 z-50 overflow-hidden py-2">
 <div className="px-3 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-50">Select Month</div>
 {Array.from({ length: 6 }, (_, i) => monthKeyToLabel(toAppDateStr(addMonthsToDate(today, 1 - i)).slice(0, 7))).map((month) => {
 const mKey = monthLabelToKey(month);
 const isFuture = mKey > nextMonthKey;
 return (
 <button key={month} data-testid="month-option" onClick={() => handleMonthSelect(month)}
 disabled={isFuture}
 className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors flex justify-between items-center ${
 activeMonth === month
 ? 'bg-primary text-white'
 : isFuture
 ? 'text-on-surface/20 cursor-not-allowed'
 : 'text-on-surface hover:bg-surface-container-high bg-surface-container-lowest'
 }`}
 >
 {month}
 {activeMonth === month && <Check className="w-4 h-4"/>}
 </button>
 );
 })}
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {!isSimplifiedView && (
 <div className="ml-auto">
 {/* Mobile Layout (Unified right-aligned block) */}
 <div className="flex sm:hidden flex-col items-end gap-1">
 <div className="flex items-baseline gap-1.5">
 <span className="font-headline text-[13px] font-bold text-primary leading-none">
 {isHistoricalView 
 ? '10/10' 
 : `${days.filter(d => d.date.startsWith(monthLabelToKey(activeMonth)) && d.isCheckedIn && (d.status === WorkStatus.IN_OFFICE || d.status === WorkStatus.OFFICE_NO_DESK)).length}/10`}
 </span>
 <span className="font-sans text-[9px] text-on-surface-variant whitespace-nowrap">Presence days</span>
 </div>
 </div>

 {/* Desktop Layout (Current structure with divider) */}
 <div className="hidden sm:flex items-center gap-4">
 {/* Presence Days Block */}
 <div className="flex flex-col items-end">
 <span className="font-headline text-sm font-bold text-primary block leading-none">
 {isHistoricalView 
 ? '10/10' 
 : `${days.filter(d => d.date.startsWith(monthLabelToKey(activeMonth)) && d.isCheckedIn && (d.status === WorkStatus.IN_OFFICE || d.status === WorkStatus.OFFICE_NO_DESK)).length}/10`}
 </span>
 <p className="font-sans text-[10px] leading-tight text-on-surface-variant mt-0.5 whitespace-nowrap">
 Presence days
 </p>
 </div>

 <div className="w-[1px] h-7 bg-outline-variant/20 self-center"/>

 {/* Planned Days Block */}
 <div className="flex flex-col items-start">
 <div className="flex items-center gap-2.5 h-[16px]">
 <div className="flex items-center gap-1">
 <Building2 className="w-3 h-3 text-on-surface-variant/30"/>
 <span className="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.office}</span>
 </div>
 <div className="flex items-center gap-1">
 <Home className="w-3 h-3 text-on-surface-variant/30"/>
 <span className="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.remote}</span>
 </div>
 <div className="flex items-center gap-1">
 <Plane className="w-3 h-3 text-on-surface-variant/30"/>
 <span className="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.mission}</span>
 </div>
 <div className="flex items-center gap-1">
 <Palmtree className="w-3 h-3 text-on-surface-variant/30"/>
 <span className="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.leave}</span>
 </div>
 <div className="flex items-center gap-1">
 <Thermometer className="w-3 h-3 text-on-surface-variant/30"/>
 <span className="text-[11px] font-bold text-on-surface-variant/70 leading-none">{monthCounts.sick}</span>
 </div>
 </div>
 <p className="font-sans text-[10px] leading-tight text-on-surface-variant mt-0.5 whitespace-nowrap">
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
 <div className="flex sm:hidden items-center justify-between pt-3 mt-1 border-t border-outline-variant/10">
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1.5">
 <Building2 className="w-3.5 h-3.5 text-on-surface-variant/30"/>
 <span className="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.office}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <Home className="w-3.5 h-3.5 text-on-surface-variant/30"/>
 <span className="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.remote}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <Plane className="w-3.5 h-3.5 text-on-surface-variant/30"/>
 <span className="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.mission}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <Palmtree className="w-3.5 h-3.5 text-on-surface-variant/30"/>
 <span className="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.leave}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <Thermometer className="w-3.5 h-3.5 text-on-surface-variant/30"/>
 <span className="text-xs font-bold text-on-surface-variant/70 leading-none">{monthCounts.sick}</span>
 </div>
 </div>
 <span className="font-sans text-[9px] text-on-surface-variant whitespace-nowrap">Planned days</span>
 </div>
 )}
 </div>

 <div className="pt-4 sm:pt-6 flex flex-col gap-3 sm:gap-4">
 {isHistoricalView ? (
 <div className="grid grid-cols-2 gap-4 pb-32">
 {historicalDays.map((day, i) => {
 const isMonday = day.dayName === 'Monday';
 const hasMondayInRow = isMonday || (i % 2 === 0 ? historicalDays[i+1]?.dayName === 'Monday' : historicalDays[i-1]?.dayName === 'Monday');
 return (
 <DayCard key={day.date} day={day} onClick={() => handleDayClick(day)} isSimplified={isSimplifiedView} index={i} projectTeammates={projectTeammates} showWeekSeparator={isMonday} hasMondayInRow={hasMondayInRow}/>
 );
 })}
 </div>
 ) : (
 <>
 {/* Unified grid: past days + today (col-span-2) + future days of current month */}
 <div className="grid grid-cols-2 gap-4">
 {pastDays.map((day, i) => {
 const isMonday = day.dayName === 'Monday';
 const hasMondayInRow = isMonday || (i % 2 === 0 ? pastDays[i+1]?.dayName === 'Monday' : pastDays[i-1]?.dayName === 'Monday');
 return (
 <DayCard key={day.date} day={day} onClick={() => handleDayClick(day)}
 onDoubleClick={() => handleDayDoubleClick(day)}
 isSimplified={isSimplifiedView}
 index={i}
 projectTeammates={projectTeammates}
 showWeekSeparator={isMonday}
 hasMondayInRow={hasMondayInRow}
 />
 );
 })}

 {currentDay && (
 <div ref={currentDayRef} className={`col-span-2 snap-start scroll-mt-[176px] sm:scroll-mt-[236px]`}>
 <DayCard key={currentDay.date} day={{...currentDay, isHighlighted: true}} onClick={() => handleDayClick(currentDay)}
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

 {futureDaysCurrentMonth.map((day, i) => {
 const isMonday = day.dayName === 'Monday';
 const hasMondayInRow = isMonday || (i % 2 === 0 ? futureDaysCurrentMonth[i+1]?.dayName === 'Monday' : futureDaysCurrentMonth[i-1]?.dayName === 'Monday');
 return (
 <DayCard key={day.date} day={{...day, isHighlighted: false}} onClick={() => handleDayClick(day)}
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
 <div ref={monthDividerRef} className="py-6 sm:py-12 px-4 flex items-center gap-6">
 <div className="h-[1px] flex-grow bg-outline-variant/30"/>
 <span className="font-headline text-xs font-bold tracking-[0.2em] text-on-surface-variant/60 uppercase">
 {nextMonthLabel}
 </span>
 <div className="h-[1px] flex-grow bg-outline-variant/30"/>
 </div>

 {/* Render next month days in a grid */}
 <div className="grid grid-cols-2 gap-4 pb-4">
 {futureDaysNextMonth.map((day, i) => {
 const isMonday = day.dayName === 'Monday';
 const hasMondayInRow = isMonday || (i % 2 === 0 ? futureDaysNextMonth[i+1]?.dayName === 'Monday' : futureDaysNextMonth[i-1]?.dayName === 'Monday');
 return (
 <DayCard key={day.date} day={{...day, isHighlighted: false}} onClick={() => handleDayClick(day)}
 onDoubleClick={() => handleDayDoubleClick(day)}
 onCheckIn={() => handleCheckIn(day.date, false)}
 isSimplified={isSimplifiedView}
 index={pastDays.length + (currentDay ? 1 : 0) + futureDaysCurrentMonth.length + i}
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
 <div data-testid="stats-page">
 <Stats days={processedDays} currentMonth={activeMonth} projectTeammates={projectTeammates} onAddTeammates={() => setActiveTab('profile')}
 />
 </div>
 ) : !showOnboarding ? (
 <div data-testid="profile-page">
 <Profile themeMode={themeMode} onSetThemeMode={handleSetThemeMode} isSimplifiedView={isSimplifiedView} onToggleSimplifiedView={handleToggleSimplifiedView}
 isHighContrast={isHighContrast} onToggleHighContrast={handleToggleHighContrast}
 isLargeText={isLargeText} onToggleLargeText={handleToggleLargeText}
 isScreenReader={isScreenReader} onToggleScreenReader={handleToggleScreenReader}
 projectTeammates={projectTeammates}
 onUpdateProjectTeammates={handleUpdateProjectTeammates}
 allColleagues={colleagues}
 onLogout={logout}
 />
 </div>
 ) : null}
 </AnimatePresence>

 <AnimatePresence>
 {roomSelectionDate && (
 <RoomSelection date={roomSelectionDate} rooms={rooms} mode="confirm" plannedRoom={days.find(d => d.date === roomSelectionDate)?.room}
 onBack={() => { setRoomSelectionDate(null); setSelectedDay(null); }}
 onSelect={handleRoomSelect}
 />
 )}
 </AnimatePresence>

 <AnimatePresence>
 {notification && (
 <motion.div initial={{y: 100, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: 100, opacity: 0}} className={`fixed bottom-32 left-6 right-6 z-[60] p-4 ${notification.isRetrofit ? 'py-5' : ''} rounded-2xl shadow-2xl flex items-center justify-between pointer-events-auto border border-outline-variant/30 bg-surface-container text-on-surface opacity-100`}>
 <div className="flex flex-col flex-grow pr-3">
 <p className="text-sm font-bold leading-tight">
 {notification.message.split(/("[^"]+")/g).map((part, i) => {
 if (part.startsWith('"') && part.endsWith('"')) {
 return <span key={i} className="text-primary">{part}</span>;
 }
 return (
 <Fragment key={i}>
 {part.split(' ').map((word, j) => {
 const isCancelled = word.toLowerCase().includes('cancelled');
 return (
 <span key={j} className={isCancelled ? 'text-red-500' : ''}>
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
 <button onClick={(e) => {
 e.stopPropagation();
 notification.undoAction?.();
 }}
 className="bg-surface-container-lowest text-on-surface border border-outline-variant/30 px-5 py-2 rounded-full text-xs font-extrabold shadow-sm active:scale-95 transition-all shrink-0 hover:bg-surface-container"
 >
 Undo {notificationCountdown !== null && `(${notificationCountdown})`}
 </button>
 ) : notification.undoAction ? (
 <button onClick={(e) => {
 e.stopPropagation();
 notification.undoAction?.();
 }}
 className="text-on-surface-variant text-xs font-bold px-3 py-2 -mr-1 hover:bg-on-surface/5 rounded-xl transition-all active:scale-95 shrink-0 bg-on-surface/[0.03]"
 >
 Undo
 </button>
 ) : !notification.isRetrofit && !notification.message.toLowerCase().includes('cancelled') && (
 <button onClick={() => {
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
 <DailyDetail day={processedDays.find(d => d.date === selectedDay.date) || selectedDay}
 allDays={processedDays}
 initialStep={selectedDayInitialStep}
 isMandatory={isMandatoryWorkspace}
 projectTeammates={projectTeammates}
 rooms={rooms}
 currentUserName={user?.name}
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
 <AnimatePresence>
 {lastMinuteWarning && (
 <>
 {/* Backdrop */}
 <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={() => setLastMinuteWarning(null)}
 className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] cursor-pointer"
 />
 
 {/* Responsive Container */}
 <div className="fixed inset-0 z-[101] flex items-end sm:items-center justify-center p-0 sm:p-6 pointer-events-none">
 <motion.div data-testid="last-minute-warning" initial={{y: '100%', opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: '100%', opacity: 0}} transition={{type: 'spring', damping: 25, stiffness: 300}} className="w-full sm:max-w-md bg-surface-container-lowest sm:rounded-[32px] rounded-t-[32px] p-8 sm:p-10 shadow-2xl pointer-events-auto border-t sm:border border-outline-variant/20 flex flex-col items-center text-center relative">
 {/* Close Button */}
 <button onClick={() => setLastMinuteWarning(null)}
 className="absolute top-6 right-6 p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
 >
 <X className="w-5 h-5"/>
 </button>

 <div className="w-16 h-16 bg-warning-bg border border-warning-stroke rounded-full flex items-center justify-center mb-6">
 <AlertTriangle className="w-8 h-8 text-warning-text"/>
 </div>
 <h3 className="font-headline text-xl sm:text-2xl font-extrabold mb-3 leading-tight text-warning-text">Last-Minute Change</h3>
 <p className="text-warning-secondary text-sm sm:text-base mb-8 font-sans">
 You are about to do a last-minute booking change for {new Date(lastMinuteWarning.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. This might have an impact on other colleagues' planning. 
 <br className="hidden sm:block"/> Are you sure you want to proceed?
 </p>
 <div className="flex flex-col gap-4 w-full">
 <button onClick={() => {
 lastMinuteWarning.action();
 }}
 className="w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all text-sm sm:text-base"
 >
 Yes, change it
 </button>
 <button onClick={() => setLastMinuteWarning(null)}
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
 <AnimatePresence>
 {isHistoricalView && (
 <motion.div initial={{y: 100, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: 100, opacity: 0}} className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
 <button onClick={() => handleMonthSelect('October 2026')}
 className="bg-primary text-white font-headline text-xs sm:text-sm font-extrabold px-8 py-3 rounded-full shadow-[0_8px_30px_rgba(54,169,194,0.4)] hover:shadow-[0_8px_40px_rgba(54,169,194,0.6)] active:scale-95 transition-all border border-white/10"
 >
 Back to today
 </button>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Scroll-triggered Back to today FAB */}
 <AnimatePresence>
 {!isHistoricalView && !isCurrentInView && !showOnboarding && activeTab === 'plan' && 
 days.find(d => d.date === TODAY)?.isCheckedIn && fabCheckStatus === 'idle' && (
 <motion.div initial={{y: 100, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: 100, opacity: 0}} className="fixed bottom-24 right-6 z-50 pointer-events-auto">
 <button onClick={() => scrollToToday('smooth')}
 className="bg-surface-container-lowest text-primary font-headline text-xs sm:text-sm font-extrabold px-6 py-3 rounded-full shadow-2xl hover:bg-surface-container active:scale-95 transition-all border border-outline-variant/30"
 >
 Back to today
 </button>
 </motion.div>
 )}
 </AnimatePresence>

 {/* FAB Check-in Button */}
 <AnimatePresence>
 {!isHistoricalView && !isCurrentInView && !showOnboarding &&
 activeTab === 'plan' && 
 days.find(d => d.date === TODAY) &&
 [WorkStatus.IN_OFFICE, WorkStatus.REMOTE, WorkStatus.OFFICE_NO_DESK].includes(days.find(d => d.date === TODAY)!.status) &&
 !(days.find(d => d.date === TODAY)?.isCheckedIn && fabCheckStatus === 'idle') && (
 <motion.div initial={{opacity: 0, y: 100}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 100, transition: { duration: 0.3, ease: "easeInOut" }}} transition={{duration: 0.4, ease: "easeOut"}} className="fixed bottom-24 right-6 z-50 pointer-events-auto">
 <motion.button data-testid="fab-checkin" onClick={(e) => { e.stopPropagation(); handleFabCheckIn(); }}
 className="bg-primary text-white text-[11px] font-bold h-10 sm:h-12 px-6 rounded-full shadow-2xl hover:opacity-90 active:scale-95 transition-all outline-none flex items-center justify-center min-w-[3.5rem] overflow-hidden"
 style={{
 boxShadow: themeMode === 'dark' ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 25px -5px rgba(54, 169, 194, 0.3)'
 }}
 >
 {fabCheckStatus === 'idle' ? (
 <motion.span initial={{opacity: 0}} animate={{opacity: 1}} className="whitespace-nowrap">
 Say Good Morning
 </motion.span>
 ) : (
 <motion.div initial={{scale: 0, rotate: -45}} animate={{scale: 1, rotate: 0}} className="flex items-center">
 <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7"/>
 </svg>
 </motion.div>
 )}
 </motion.button>
 </motion.div>
 )}
 </AnimatePresence>
 </Layout>
 <AdminBar onRoomsChanged={setRooms}/>
 </>
 );
}
