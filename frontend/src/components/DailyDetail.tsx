import React from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { Alert } from './Alert';
import { motion, AnimatePresence } from 'motion/react';
import { DayPresence, WorkStatus, OffTimeType } from '../types';
import type { Colleague } from '../constants/colleagues';
import type { User } from '../types/api';
import { getColleaguePresence, type ColleaguePresenceItem } from '../services/api';
import { mapUserToColleague } from '../hooks/useColleagues';
import {
 getFictionalDayName,
 getFictionalIsWeekend,
 toAppDateStr,
 formatAppDate,
 parseAppDate,
 getTodayStr,
 months
} from '../utils/dateUtils';
import type { Room } from '../services/api';

const roomTypeColor: Record<string, string> = {
 open_space: 'bg-blue-500',
 lab: 'bg-gradient-to-r from-[#ff0000] via-[#0000ff] to-[#00ff00]',
 admin: 'bg-indigo-500',
 management: 'bg-amber-500',
};
const roomFallbackColors = ['bg-red-500', 'bg-green-500', 'bg-purple-500', 'bg-teal-500'];

function mapBackendStatus(s: string): WorkStatus {
  const map: Record<string, WorkStatus> = {
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
  return map[s] ?? WorkStatus.PENDING;
}
import { 
 Building2,
 Home,
 Plane,
 Palmtree,
 Thermometer,
 ChevronLeft,
 X,
 Edit2,
 Clock,
 Check,
 Monitor,
 Headset,
 Sunrise,
 Sunset,
 ChevronDown,
 Search,
 AlertCircle,
 Star,
 Beaker,
 Trash2,
 ArrowRight,
 Heart as Crib,
 AlertTriangle
} from 'lucide-react';


interface DailyDetailProps {
 day: DayPresence;
 allDays: DayPresence[];
 initialStep?: FlowStep;
 isMandatory?: boolean;
 onClose: () => void;
 onCancel: () => void;
 onCheckIn: () => void;
 onUpdateStatus: (dateOrDates: string | string[], status: WorkStatus, isUsingDesk?: boolean, isRetrofit?: boolean, room?: string) => void;
 onUpdateOffTime: (date: string, offTime: { type: OffTimeType, hours?: number } | undefined) => void;
 onNavigate: (direction: 'next' | 'prev') => void;
 onUpdateBulkStatus?: (updates: Array<{date: string, status: WorkStatus, isUsingDesk: boolean, room: string}>) => void;
 onUpdateLabBooking: (date: string, isBooked: boolean) => void;
 projectTeammates?: Colleague[];
 onOpenProfile?: () => void;
 rooms?: Room[];
 currentUserName?: string;
}

type FlowStep = 'VIEW' | 'PLANNING' | 'WORKSPACE' | 'EXTEND' | 'HOURS_OFF' | 'ALL_COLLEAGUES';

export default function DailyDetail({
 day,
 allDays,
 initialStep = 'VIEW',
 isMandatory = false,
 onClose,
 onCancel,
 onCheckIn,
 onUpdateStatus,
 onUpdateOffTime,
 onNavigate,
 onUpdateBulkStatus,
 onUpdateLabBooking,
 projectTeammates = [],
 onOpenProfile,
 rooms = [],
 currentUserName = 'You',
}: DailyDetailProps) {
 const todayStr = getTodayStr();
 const currentUserInitials = currentUserName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'ME';
 const currentUserFirstName = currentUserName.split(' ')[0] || currentUserName;
 const [step, setStep] = React.useState<FlowStep>(initialStep);
 const [extendedDates, setExtendedDates] = React.useState<string[]>([]);
 const [extendedOfficeConfigs, setExtendedOfficeConfigs] = React.useState<Record<string, { room: string, isUsingDesk: boolean }>>({});
 const [isSpecialLeaveOpen, setIsSpecialLeaveOpen] = React.useState(false);
 const [isSpecialCalendarOpen, setIsSpecialCalendarOpen] = React.useState(false);
 const [extendedSickType, setExtendedSickType] = React.useState<'MATERNITY' | 'LONG_TERM' | null>(null);
 const [sickRange, setSickRange] = React.useState<{ start: string | null, end: string | null }>({ start: day.date, end: null });
 const [retrofitConfirmation, setRetrofitConfirmation] = React.useState<WorkStatus | null>(null);
 const [searchQuery, setSearchQuery] = React.useState('');
 const [_selectedBookingDate, _setSelectedBookingDate] = React.useState<string>(day.date);
 const [showUnbookingModal, setShowUnbookingModal] = React.useState(false);
 const [showLabConfirmModal, setShowLabConfirmModal] = React.useState(false);
 const [unbookingWarningDays, setUnbookingWarningDays] = React.useState<string[]>([]);
 const [pendingStatusUpdate, setPendingStatusUpdate] = React.useState<WorkStatus | null>(null);
 const [colleagueData, setColleagueData] = React.useState<ColleaguePresenceItem[]>([]);

 useBodyScrollLock();

 React.useEffect(() => {
   setColleagueData([]);
   getColleaguePresence(day.date).then(setColleagueData).catch((err) => console.error('DailyDetail: failed to load colleague presence', err));
 }, [day.date]);

 const displayMonth = months[parseAppDate(day.date).getMonth()];
 const dayNumDisplay = day.date.split('-')[2];

 interface ColleagueData extends Partial<Colleague> {
 status?: WorkStatus;
 role: string;
 hasOffTime?: boolean;
 offTimeType?: OffTimeType;
 remind?: boolean;
 isConfirmed?: boolean;
 isMe?: boolean;
 isGoldStar?: boolean;
 showQuestionMark?: boolean;
 workspaceIcon?: 'desk' | 'headset';
 }

 // Memoize Colleague generation to avoid re-renders
 const allColleagues = React.useMemo(() => {
 const isFutureDay = day.date > todayStr;
 const data: ColleagueData[] = [
 ...(day.status !== WorkStatus.IN_OFFICE && day.status !== WorkStatus.PENDING && day.status !== WorkStatus.OFFICE_NO_DESK ? [{
 name: currentUserFirstName,
 surname: currentUserName.split(' ').slice(1).join(' '),
 initials: currentUserInitials,
 color: "bg-primary",
 status: day.status,
 role: (day.status === WorkStatus.LEAVE || day.status === WorkStatus.MISSION || day.status === WorkStatus.SICK)
 ? (day.status === WorkStatus.LEAVE ? 'On Leave (Vacation)' : day.status === WorkStatus.MISSION ? 'On a Mission' : 'On a sick leave')
 : (day.isCheckedIn && !isFutureDay ? 'Remote' : (isFutureDay ? 'Remote' : 'Remote | Not checked-in yet')),
 isConfirmed: day.isCheckedIn && !isFutureDay,
 isMe: true
 } as ColleagueData] : [])
 ];
 
 colleagueData.forEach((item) => {
 const mapped = mapUserToColleague({ id: item.userId, name: item.name } as User);
 const isPendingStatus = item.status === 'pending';
 const status: WorkStatus | undefined = isPendingStatus ? undefined : mapBackendStatus(item.status);
 const showQuestionMark = isPendingStatus && isFutureDay;
 const remind = isPendingStatus && !isFutureDay;
 let role = '';
 if (remind) {
 role = "Remind them to update their status!";
 } else if (item.status === 'in_office' || item.status === 'office_no_desk') {
 const room = item.room || 'In Office';
 role = item.isConfirmed ? room : `${room} | Not checked-in yet`;
 } else if (item.status === 'remote') {
 role = item.isConfirmed ? 'Remote' : 'Remote | Not checked-in yet';
 } else if (item.status === 'leave') {
 role = 'On Leave (Vacation)';
 } else if (item.status === 'mission') {
 role = 'On a Mission';
 } else if (item.status === 'sick') {
 role = 'On a sick leave';
 } else if (item.status === 'parental_leave') {
 role = 'Parental Leave';
 } else if (item.status === 'waiting_list') {
 role = 'Waiting List';
 }
 data.push({
 id: mapped.id,
 name: mapped.name,
 surname: mapped.surname,
 initials: mapped.initials,
 color: mapped.color,
 status,
 role,
 showQuestionMark,
 remind,
 isConfirmed: item.isConfirmed ?? !isFutureDay,
 isGoldStar: false,
 });
 });

 // Sort: Group by status, then "Me" first, then by confirmation, then name
 return data.sort((a, b) => {
 const getOrder = (c: ColleagueData) => {
 if (c.showQuestionMark || c.remind) return 7;
 if (c.status === WorkStatus.REMOTE) return c.isConfirmed ? 1 : 2;
 if (c.status === WorkStatus.LEAVE) return 3;
 if (c.status === WorkStatus.MISSION) return 4;
 if (c.status === WorkStatus.SICK) return 5;
 return 6;
 };
 
 const orderA = getOrder(a);
 const orderB = getOrder(b);
 
 if (orderA !== orderB) return orderA - orderB;
 if (a.isMe) return -1;
 if (b.isMe) return 1;
 
 return (a.name ?? '').localeCompare(b.name ?? '');
 });
 }, [day.status, day.isCheckedIn, day.date, colleagueData]);

 const inOfficeColleagues = React.useMemo(() => {
 if (day.isClosed || day.isOfficeClosed) return [];

 const data: ColleagueData[] = [];
 const isFutureDay = day.date > todayStr;

 if (day.status === WorkStatus.IN_OFFICE || day.status === WorkStatus.OFFICE_NO_DESK) {
 const isUserConfirmed = isFutureDay ? false : day.isCheckedIn;
 const roomLabel = day.room || "In Office";
 data.push({
 name: currentUserFirstName,
 surname: currentUserName.split(' ').slice(1).join(' '),
 initials: currentUserInitials,
 color: "bg-primary",
 status: WorkStatus.IN_OFFICE,
 role: (isUserConfirmed || isFutureDay) ? roomLabel : `${roomLabel} | Not checked-in yet`,
 workspaceIcon: day.isUsingDesk ? "desk" : "headset",
 isConfirmed: isUserConfirmed,
 isMe: true
 });
 }

 colleagueData
 .filter(c => c.status === 'in_office' || c.status === 'office_no_desk')
 .forEach((item) => {
 const mapped = mapUserToColleague({ id: item.userId, name: item.name } as User);
 const room = item.room || 'In Office';
 const isConfirmed = item.isConfirmed ?? !isFutureDay;
 data.push({
 id: mapped.id,
 name: mapped.name,
 surname: mapped.surname,
 initials: mapped.initials,
 color: mapped.color,
 status: WorkStatus.IN_OFFICE,
 role: isConfirmed ? room : `${room} | Not checked-in yet`,
 workspaceIcon: item.status === 'office_no_desk' || room === 'No Desk' ? 'headset' : 'desk',
 isConfirmed,
 });
 });

 return data.sort((a, b) => {
 if (a.isMe) return -1;
 if (b.isMe) return 1;
 if (a.isConfirmed !== b.isConfirmed) return a.isConfirmed ? -1 : 1;
 return (a.name ?? '').localeCompare(b.name ?? '');
 });
 }, [day.date, day.status, day.room, day.isCheckedIn, day.bookedCount, day.isClosed, day.isOfficeClosed, day.isUsingDesk, colleagueData]);

 const goldStarProjectTeammates = React.useMemo(() => {
 if (projectTeammates.length > 0) {
 const teammateNames = new Set(projectTeammates.map(c => c.name ?? ''));
 const fromOffice = inOfficeColleagues.filter(c => teammateNames.has(c.name ?? '') && !c.isMe);
 const fromAll = allColleagues.filter(c => teammateNames.has(c.name ?? '') && !c.isMe);
 
 const seen = new Set();
 return [...fromOffice, ...fromAll].filter(c => {
 if (seen.has(c.name)) return false;
 seen.add(c.name);
 return true;
 });
 }
 // If skipped onboarding, we don't show any project teammates by default as per request
 return [];
 }, [inOfficeColleagues, allColleagues, projectTeammates]);

 const goldStarNames = React.useMemo(() => 
 new Set(goldStarProjectTeammates.map(c => c.name)), 
 [goldStarProjectTeammates]
 );

 const isPending = day.status === WorkStatus.PENDING;
 const statusConfig = {
 [WorkStatus.IN_OFFICE]: { label: 'In Office', icon: Building2, color: 'bg-primary/10 text-primary', deskIcon: 'desk', emoji: '🏢' },
 [WorkStatus.REMOTE]: { label: 'Remote', icon: Home, color: 'bg-green-500/10 text-green-500', deskIcon: 'home', emoji: '🏠' },
 [WorkStatus.MISSION]: { label: 'On a mission', icon: Plane, color: 'bg-orange-500/10 text-orange-500', emoji: '✈️' },
 [WorkStatus.LEAVE]: { label: 'On Leave (Vacation)', icon: Palmtree, color: 'bg-fuchsia-500/10 text-fuchsia-500', emoji: '🏖️' },
 [WorkStatus.SICK]: { label: 'On a sick leave', icon: Thermometer, color: 'bg-red-500/10 text-red-500', emoji: '🤒' },
 [WorkStatus.PARENTAL_LEAVE]: { label: 'Parental Leave', icon: Crib, color: 'bg-indigo-500/10 text-indigo-500', emoji: '👶' },
 [WorkStatus.PENDING]: { label: 'Pending', icon: null, color: 'bg-surface-container text-on-surface-variant', emoji: '⏳' },
 [WorkStatus.WAITING_LIST]: { label: 'Waiting List', icon: null, color: 'bg-amber-500/10 text-amber-500', emoji: '⏳' },
 [WorkStatus.OFFICE_NO_DESK]: { label: 'Office (No Desk)', icon: Headset, color: 'bg-primary/10 text-primary', emoji: '🏢' },
 };
 const config = !isPending ? statusConfig[day.status] : null;

 const IS_CLOSED_DAYS = ['2026-11-01']; // Add closed days here

 const handleStatusSelect = (status: WorkStatus) => {
 // Check for last-minute change on the current day
 const isCurrentDay = day.date === todayStr;
 const isUnbookingToday = isCurrentDay && day.status === WorkStatus.IN_OFFICE && status !== WorkStatus.IN_OFFICE;

 if (isUnbookingToday && !showUnbookingModal) {
 setUnbookingWarningDays([day.date]);
 setPendingStatusUpdate(status);
 setShowUnbookingModal(true);
 return;
 }

 if (day.isPast) {
 setRetrofitConfirmation(status);
 } else if (status === WorkStatus.IN_OFFICE) {
 setStep('WORKSPACE');
 } else if (status === WorkStatus.OFFICE_NO_DESK) {
 onUpdateStatus(day.date, WorkStatus.IN_OFFICE, false, false, 'No Desk');
 setStep('VIEW');
 } else {
 onUpdateStatus(day.date, status);
 setStep('VIEW');
 }
 };

 const handleRoomSelect = (roomName: string, isUsingDesk: boolean = true) => {
 onUpdateStatus(day.date, WorkStatus.IN_OFFICE, isUsingDesk, false, roomName);
 onClose();
 };

 const handleConfirmRetrofit = () => {
 if (retrofitConfirmation) {
 onUpdateStatus(day.date, retrofitConfirmation, undefined, true);
 setRetrofitConfirmation(null);
 }
 };

 const handleClose = () => {
 if (step === 'VIEW') {
 onClose();
 } else {
 onCancel();
 }
 };

 const handleBack = () => {
 executeBack();
 };

 const executeBack = () => {
 switch (step) {
 case 'PLANNING':
 setStep('VIEW');
 break;
 case 'WORKSPACE':
 setStep('PLANNING');
 break;
 case 'EXTEND':
 case 'ALL_COLLEAGUES':
 setStep('VIEW');
 break;
 case 'HOURS_OFF':
 setStep('PLANNING');
 break;
 case 'VIEW':
 onClose();
 break;
 default:
 onCancel();
 }
 };

 const ModalHeader = ({ title }: { title?: string }) => {
 return (
 <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-surface shadow-sm border-b border-outline-variant/10 font-sans">
 <div className="flex items-center gap-1 min-w-[80px]">
 {!isMandatory && (
 <button onClick={handleBack} className="flex items-center gap-1 px-3 py-2 -ml-2 rounded-xl text-on-surface hover:bg-surface-container transition-all active:scale-95 group font-bold text-sm">
 <ChevronLeft className="w-4 h-4 text-on-surface-variant"/>
 <span className="text-on-surface-variant">Back</span>
 </button>
 )}
 </div>

 {title && (
 <h1 className="font-headline font-bold text-lg text-on-surface absolute left-1/2 -translate-x-1/2 truncate max-w-[40%]">
 {title}
 </h1>
 )}

 <div className="flex items-center justify-end min-w-[80px]">
 {step !== 'VIEW' && step !== 'ALL_COLLEAGUES' && (
 <button onClick={handleClose} className="px-3 py-2 -mr-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all active:scale-95 font-bold text-sm">
 Cancel
 </button>
 )}
 </div>
 </header>
 );
 };



 if (step === 'PLANNING') {
 return (
 <div className="fixed inset-0 bg-surface z-[110] flex flex-col overflow-y-auto pb-10 font-sans">
 <ModalHeader title={day.isPast ? "retrofit" : "planning"}/>

 <main className="pt-24 px-6 max-w-xl mx-auto w-full">
 <div className="flex items-center justify-between mb-8">
 <button onClick={() => onNavigate('prev')}
 className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/20 shadow-sm hover:bg-surface-container-low transition-colors"
 >
 <ChevronLeft className="w-5 h-5 text-on-surface"/>
 </button>
 <div className="font-headline font-bold text-lg text-on-surface">
 {day.dayName}, {dayNumDisplay} {displayMonth}
 </div>
 <button onClick={() => onNavigate('next')}
 className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/20 shadow-sm hover:bg-surface-container-low transition-colors text-on-surface hover:bg-surface-container-low transition-colors"
 >
 <ChevronLeft className="w-5 h-5 rotate-180"/>
 </button>
 </div>

 <h2 className="text-on-surface-variant text-base font-medium mb-6 px-2">
 {day.isPast ? "Retrofit Work Status for the day" : "Let your team know about your Work Status for the day"}
 </h2>

 <div className="space-y-3">
 {!day.isPast && !day.isClosed && (
 <>
 {day.isOfficeClosed ? (
 <div className="bg-orange-500/10 border border-orange-500/20 rounded-[24px] p-6 mb-4 flex gap-4 items-start">
 <div className="bg-orange-500/20 p-3 rounded-full shrink-0">
 <AlertCircle className="w-6 h-6 text-orange-600"/>
 </div>
 <div className="flex-grow pt-1">
 <p className="text-sm font-bold text-orange-700 leading-tight">
 The office is closed and it is not possible to plan an In Office presence
 </p>
 </div>
 </div>
 ) : (
 <>
 {(day.bookedCount ?? 0) >= (day.totalCapacity ?? 23) ? (
 <div className="flex flex-col gap-4 mb-4">
 {/* Waiting List Card */}
 <button onClick={() => handleStatusSelect(WorkStatus.WAITING_LIST)}
 className={ `w-full bg-surface-container-lowest border border-outline-variant/10 rounded-[28px] p-6 text-left shadow-sm hover:shadow-md transition-all active:scale-[0.98] group ${day.status === WorkStatus.WAITING_LIST ? 'ring-2 ring-primary/40' : ''}` }
 >
 <div className="flex gap-4 items-center">
 <div className="w-14 h-14 bg-amber-100 rounded-[22px] flex items-center justify-center shrink-0 text-3xl">
 ⌛
 </div>
 <div className="flex flex-col flex-grow">
 <h3 className="text-xl font-bold text-on-surface font-headline tracking-tight">Waiting List</h3>
 </div>
 </div>
 </button>

 {/* No Desk Card */}
 <button onClick={() => handleStatusSelect(WorkStatus.OFFICE_NO_DESK)}
 className={ `w-full bg-surface-container-lowest border border-outline-variant/10 rounded-[28px] p-6 text-left shadow-sm hover:shadow-md transition-all active:scale-[0.98] group ${day.status === WorkStatus.OFFICE_NO_DESK ? 'ring-2 ring-primary/40' : ''}` }
 >
 <div className="flex gap-4 items-center">
 <div className="w-14 h-14 bg-blue-100 rounded-[22px] flex items-center justify-center shrink-0">
 <Headset className="w-8 h-8 text-blue-600"/>
 </div>
 <div className="flex flex-col flex-grow">
 <h3 className="text-xl font-bold text-on-surface font-headline tracking-tight">In Office / Not using a desk</h3>
 </div>
 </div>
 </button>
 </div>
 ) : (
 <StatusOption emoji="🏢" label="In Office" color="bg-blue-100 text-blue-600" onClick={() => handleStatusSelect(WorkStatus.IN_OFFICE)}
 showChevron={!day.isPast}
 isActive={day.status === WorkStatus.IN_OFFICE}
 />
 )}
 </>
 )}
 </>
 )}
 
 {!day.isPast && (
 <StatusOption emoji="🏠" label="Remote Working" color="bg-green-100 text-green-600" onClick={() => handleStatusSelect(WorkStatus.REMOTE)}
 isActive={day.status === WorkStatus.REMOTE}
 />
 )}

 <StatusOption emoji="✈️" label="On a mission" color="bg-orange-100 text-orange-600" onClick={() => handleStatusSelect(WorkStatus.MISSION)}
 isActive={day.status === WorkStatus.MISSION}
 />
 <StatusOption emoji="🏖️" label="On Leave (Vacation)" color="bg-fuchsia-100 text-fuchsia-600" onClick={() => handleStatusSelect(WorkStatus.LEAVE)}
 isActive={day.status === WorkStatus.LEAVE}
 />
 <StatusOption emoji="🤒" label="On a sick leave" color="bg-red-100 text-red-600" onClick={() => handleStatusSelect(WorkStatus.SICK)}
 isActive={day.status === WorkStatus.SICK}
 />
 <StatusOption emoji="👶" label="Parental Leave" color="bg-purple-100 text-purple-600" onClick={() => handleStatusSelect(WorkStatus.PARENTAL_LEAVE)}
 isActive={day.status === WorkStatus.PARENTAL_LEAVE}
 />
 </div>

 <div className="mt-12 pt-8 border-t border-outline-variant/20">
 <h2 className="text-on-surface-variant text-base font-medium mb-4 px-2">
 {day.isPast ? "Retrofit hours off" : "Or take hours off"}
 </h2>
 <button onClick={() => setStep('HOURS_OFF')}
 className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-[24px] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
 >
 <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
 <span className="text-2xl font-bold text-amber-500">⏱️</span>
 </div>
 <span className="font-headline font-bold text-lg text-on-surface flex-grow text-left">
 {day.isPast ? "Retrofit hours off" : "Take hours off"}
 </span>
 <ChevronLeft className="w-5 h-5 rotate-180 text-on-surface-variant/70"/>
 </button>
 </div>
 </main>

 <AnimatePresence>
 {retrofitConfirmation && (
 <>
 <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={() => setRetrofitConfirmation(null)}
 className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
 />
 <motion.div initial={{opacity: 0, scale: 0.9, y: 20}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.9, y: 20}} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-48px)] max-w-sm bg-surface-container-lowest rounded-[32px] p-8 z-[201] shadow-2xl overflow-hidden">
 <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
 <Clock className="w-8 h-8 text-amber-600"/>
 </div>
 
 <h3 className="font-headline text-xl font-bold text-on-surface text-center mb-3">Retrofitting status</h3>
 <p className="font-sans text-sm text-on-surface-variant text-center mb-8 px-2 leading-relaxed">
 Are you sure you want to retrofit this working status?
 <span className="block mt-4 py-3 px-4 bg-surface-container rounded-xl border border-outline-variant/10 text-on-surface/80">
 <span className="font-bold text-primary">{statusConfig[retrofitConfirmation]?.label}</span> 
 <span className="mx-2 opacity-40">→</span> 
 <span className="font-bold opacity-60">{config?.label || 'Pending'}</span>
 </span>
 </p>

 <div className="flex flex-col gap-3">
 <button onClick={handleConfirmRetrofit} className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all">
 Confirm
 </button>
 <button onClick={() => setRetrofitConfirmation(null)}
 className="w-full bg-surface-container-low text-on-surface-variant font-bold py-4 rounded-2xl active:scale-[0.98] transition-all"
 >
 Cancel
 </button>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>

 <AnimatePresence>
 {showUnbookingModal && (
 <>
 <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={() => setShowUnbookingModal(false)}
 className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
 />
 <motion.div initial={{opacity: 0, scale: 0.9, y: 20}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.9, y: 20}} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-48px)] max-w-sm bg-surface-container-lowest rounded-[32px] p-8 z-[201] shadow-2xl overflow-hidden">
 <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
 <AlertTriangle className="w-8 h-8 text-red-600"/>
 </div>
 
 <h3 className="font-headline text-xl font-bold text-on-surface text-center mb-3">Last-minute change</h3>
 <p className="font-sans text-sm text-on-surface-variant text-center mb-8 px-2 leading-relaxed">
 If you change the status for <span className="font-bold text-on-surface">today</span> you will do a last-minute unbooking.
 <br/><br/>
 Are you sure you want to proceed?
 </p>

 <div className="flex flex-col gap-3">
 <button onClick={() => {
 setShowUnbookingModal(false);
 if (pendingStatusUpdate) {
 onUpdateStatus(day.date, pendingStatusUpdate);
 setPendingStatusUpdate(null);
 setStep('VIEW');
 }
 }}
 className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all"
 >
 Confirm & Proceed
 </button>
 <button onClick={() => {
 setShowUnbookingModal(false);
 setPendingStatusUpdate(null);
 }}
 className="w-full bg-surface-container-low text-on-surface-variant font-bold py-4 rounded-2xl active:scale-[0.98] transition-all"
 >
 Cancel
 </button>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 );
 }

 if (step === 'HOURS_OFF') {
 return (
 <div className="fixed inset-0 bg-surface z-[125] flex flex-col overflow-y-auto pb-10 font-sans">
 <ModalHeader title="Time Off"/>

 <main className="pt-24 px-6 max-w-xl mx-auto w-full">
 <div className="mb-10 text-center">
 <div className="w-20 h-20 bg-amber-500/10 rounded-[32px] flex items-center justify-center mx-auto mb-4 shadow-sm text-3xl">
 ⏱️
 </div>
 <h2 className="font-headline text-2xl font-bold text-on-surface">Select how much time</h2>
 <p className="text-on-surface-variant text-sm mt-1">For {day.dayName}, {dayNumDisplay} {displayMonth}</p>
 </div>

 <div className="space-y-4">
 <button onClick={() => onUpdateOffTime(day.date, { type: OffTimeType.MORNING })}
 className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-[28px] p-6 text-left shadow-sm hover:shadow-md hover:border-primary/30 transition-all group active:scale-[0.98] flex items-center gap-5"
 >
 <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
 <Sunrise className="w-7 h-7 text-orange-500"/>
 </div>
 <div className="flex-grow">
 <h3 className="text-xl font-bold text-on-surface font-headline tracking-tight">Whole Morning</h3>
 <p className="text-sm text-on-surface-variant/60 font-medium">From 9:00 to 12:30</p>
 </div>
 </button>

 <button onClick={() => onUpdateOffTime(day.date, { type: OffTimeType.AFTERNOON })}
 className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-[28px] p-6 text-left shadow-sm hover:shadow-md hover:border-primary/30 transition-all group active:scale-[0.98] flex items-center gap-5"
 >
 <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
 <Sunset className="w-7 h-7 text-indigo-500"/>
 </div>
 <div className="flex-grow">
 <h3 className="text-xl font-bold text-on-surface font-headline tracking-tight">Whole Afternoon</h3>
 <p className="text-sm text-on-surface-variant/60 font-medium">From 14:00 to 18:00</p>
 </div>
 </button>

 <div className="pt-6 mt-6 border-t border-outline-variant/10">
 <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-widest mb-4 pl-2 opacity-60 font-sans">Manual Input</h3>
 
 <div className="relative group">
 <select onChange={(e) => {
 const val = parseInt(e.target.value);
 if (val > 0) {
 onUpdateOffTime(day.date, { type: OffTimeType.CUSTOM, hours: val });
 }
 }}
 value={day.offTime?.type === OffTimeType.CUSTOM ? day.offTime.hours : "0"}
 className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-[24px] p-6 appearance-none font-headline font-bold text-lg text-on-surface focus:border-primary outline-none shadow-sm transition-all pr-12"
 >
 <option value="0">Select hours...</option>
 {[1, 2, 3, 4, 5, 6].map(h => (
 <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>
 ))}
 <option value="7">7 hours (Whole day)</option>
 </select>
 <ChevronDown className="w-6 h-6 absolute right-6 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none transition-transform group-focus-within:rotate-180"/>
 </div>
 </div>

 {day.offTime && (
 <button onClick={() => onUpdateOffTime(day.date, undefined)}
 className="w-full mt-8 text-red-500 font-bold py-4 hover:bg-red-50 rounded-2xl transition-colors"
 >
 Remove time off
 </button>
 )}
 </div>
 </main>
 </div>
 );
 }

 if (step === 'WORKSPACE') {
 const formattedDate = formatAppDate(day.date, 'long').toUpperCase();

 return (
 <div className="fixed inset-0 bg-surface z-[120] flex flex-col overflow-y-auto font-sans">
 <ModalHeader title="Workspace Use"/>

 <div className={`pt-24 max-w-xl mx-auto w-full text-center px-6 pb-20`}>
 <div className="font-headline text-on-surface-variant font-bold text-sm tracking-widest mb-6 opacity-80 uppercase">{formattedDate}</div>
 <h1 className="font-headline font-extrabold text-4xl text-on-surface mb-2 tracking-tight">Plan Workspace Use</h1>
 <p className="text-on-surface-variant text-base mb-12">What do you plan to do at the office?</p>

 <section className="mb-10">
 <h3 className="font-headline font-bold text-lg text-on-surface/70 mb-4 tracking-tight">I plan to use a desk in...</h3>
 <div className="flex flex-col gap-3">
 {rooms.map((room, roomIdx) => {
 const isLab = room.type === 'lab';
 const hasActivityPlanned = isLab && day.isLabBooked;
 const isCurrentRoom = isLab && day.room === room.name;
 const roomColor = roomTypeColor[room.type] ?? roomFallbackColors[roomIdx % roomFallbackColors.length];

 if (isLab && hasActivityPlanned && !isCurrentRoom) {
 return (
 <div key={room.id} className="w-full bg-surface-container-low/50 rounded-2xl p-5 border border-outline-variant/10 text-left opacity-60">
 <div className="flex items-center gap-4">
 <div className={`w-6 h-6 rounded-full flex-shrink-0 shadow-sm ${roomColor}`}/>
 <div className="flex flex-col">
 <span className="font-headline font-bold text-base text-on-surface">
 {room.name}
 </span>
 <span className="text-xs font-bold text-red-500 mt-1 uppercase tracking-wider">
 Activity planned for day, lab unavailable
 </span>
 </div>
 </div>
 </div>
 );
 }

 const isSelectedRoom = room.name === day.room;

 return (
 <button key={room.id} onClick={() => handleRoomSelect(room.name, true)}
 className={`w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center justify-between transition-all duration-200 border ${
 isCurrentRoom && hasActivityPlanned
 ? 'border-orange-500 ring-1 ring-orange-500/20 shadow-orange-500/10'
 : isSelectedRoom
 ? 'border-green-500 ring-2 ring-green-500/20 shadow-green-200/50'
 : 'border-outline-variant/10'
 } hover:border-primary/40 hover:shadow-lg active:scale-[0.98] group shadow-sm text-left`}
 >
 <div className="flex items-center gap-4">
 <div className={`w-6 h-6 rounded-full flex-shrink-0 shadow-sm ${roomColor}`}/>
 <div className="flex flex-col">
 <div className="flex items-center gap-2">
 <span className="font-headline font-bold text-lg text-on-surface group-hover:text-primary transition-colors">
 {room.name}
 </span>
 {isSelectedRoom && (
 <span className="text-[10px] font-bold bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Planned</span>
 )}
 </div>
 {isCurrentRoom && hasActivityPlanned && (
 <div className="flex items-center gap-1.5 mt-0.5">
 <div className="w-4 h-4 rounded-full bg-orange-600 flex items-center justify-center text-[10px] text-white font-bold leading-none">!</div>
 <span className="text-xs font-bold text-orange-600 uppercase tracking-tight">
 Conflict with scheduled activities
 </span>
 </div>
 )}
 </div>
 </div>
 </button>
 );
 })}
 </div>
 </section>

 <div className="h-[1px] w-full bg-outline-variant/20 mb-10"/>

 <button onClick={() => handleRoomSelect('No Desk', false)}
 className="w-full bg-surface-container-lowest rounded-2xl p-6 flex items-center gap-4 transition-all duration-200 border border-outline-variant/20 hover:border-primary/40 hover:shadow-lg active:scale-[0.98] shadow-sm group"
 >
 <div className="bg-primary/5 p-3 rounded-full group-hover:bg-primary/10 transition-colors">
 <Headset className="w-6 h-6 text-primary"/>
 </div>
 <span className="font-headline font-bold text-xl text-on-surface">Not Using a Desk</span>
 </button>
 </div>
 </div>
 );
 }

 if (step === 'EXTEND') {
 const isOffice = day.status === WorkStatus.IN_OFFICE;
 const isFutureDay = day.date > todayStr;
 const isSpecialLeaveEligible = (day.status === WorkStatus.SICK || day.status === WorkStatus.LEAVE) && isFutureDay;
 const stackEndDateObj = parseAppDate(todayStr);
 stackEndDateObj.setDate(stackEndDateObj.getDate() + 30);
 const STACK_END_DATE = toAppDateStr(stackEndDateObj);
 const startExtensionDate = parseAppDate(day.date);
 let rangeDays = (isSpecialLeaveEligible && extendedSickType) ? 180 : 30;

 // Capacity for future dates is not available from the API per day; the backend
 // enforces the capacity gate at booking time (auto-downgrade to waiting_list).
 const isOfficeFullForDate = (_date: string) => false;

 // Generate selectable business days
 const selectableDates: Array<{
 dateStr: string, 
 dayNum: number, 
 isWeekend: boolean, 
 isClosed: boolean, 
 dayLabel: string, 
 dateLabel: string, 
 monthLabel: string, 
 isFull: boolean, 
 isAlreadyExtended: boolean,
 currentStatus?: WorkStatus,
 currentIsUsingDesk?: boolean
 }> = [];
 for (let i = 1; i <= rangeDays; i++) {
 const d = new Date(startExtensionDate);
 d.setDate(startExtensionDate.getDate() + i);
 const dateStr = toAppDateStr(d);
 
 // Standard extension guardrail (not applying to special leave)
 if (!extendedSickType && dateStr > STACK_END_DATE) {
 break;
 }

 const isWeekend = getFictionalIsWeekend(d);
 const dayPresence = allDays.find(ad => ad.date === dateStr);

 selectableDates.push({
 dateStr,
 dayNum: d.getDate(),
 isWeekend,
 isClosed: IS_CLOSED_DAYS.includes(dateStr),
 dayLabel: getFictionalDayName(d, 'short'),
 dateLabel: `${months[d.getMonth()].slice(0, 3)} ${d.getDate()}`,
 monthLabel: `${months[d.getMonth()]} ${d.getFullYear()}`,
 isFull: isOfficeFullForDate(dateStr),
 isAlreadyExtended: dayPresence?.isExtended || false,
 currentStatus: dayPresence?.status,
 currentIsUsingDesk: dayPresence?.isUsingDesk
 });
 }

 const isAtEndOfWeek = !extendedSickType && selectableDates.length === 0;

 const toggleDate = (dateStr: string) => {
 if (isSpecialLeaveEligible && extendedSickType) {
 // Range selection for extended special leave
 // Start date is fixed to day.date
 const start = day.date;
 const end = dateStr;
 
 if (new Date(end) <= new Date(start)) {
 // If user picks a date before or same as start, we ignore or reset end if it was there
 setSickRange({ start, end: null });
 setExtendedDates([]);
 return;
 }

 setSickRange({ start, end });
 
 // Fill dates in between
 const range: string[] = [];
 const curr = new Date(start);
 const d2 = new Date(end);
 
 // Skip the first day (day.date) as we are extending FROM it
 curr.setDate(curr.getDate() + 1);
 
 while (curr <= d2) {
 const ds = toAppDateStr(curr);
 const isWeekend = getFictionalIsWeekend(curr);
 if (!isWeekend) {
 range.push(ds);
 }
 curr.setDate(curr.getDate() + 1);
 }
 setExtendedDates(range);
 return;
 }

 setExtendedDates(prev => {
 if (prev.includes(dateStr)) {
 const newDates = prev.filter(x => x !== dateStr);
 if (isOffice) {
 setExtendedOfficeConfigs(prevConfigs => {
 const { [dateStr]: _, ...rest } = prevConfigs;
 return rest;
 });
 }
 return newDates;
 } else {
 if (isOffice) {
 setExtendedOfficeConfigs(prevConfigs => ({
 ...prevConfigs,
 [dateStr]: { room: day.room || 'Blue Room', isUsingDesk: day.isUsingDesk ?? false }
 }));
 }
 return [...prev, dateStr];
 }
 });
 };

 const updateRoomConfig = (date: string, room: string, isUsingDesk: boolean) => {
 setExtendedOfficeConfigs(prev => ({
 ...prev,
 [date]: { room, isUsingDesk }
 }));
 };

 const handleApply = () => {
 // Check for last minute unbookings
 // If we are extending a NON-OFFICE status to a day that is currently OFFICE
 // AND it's a "last minute" (tomorrow, Oct 10th)
 const lastMinuteUnbookings = extendedDates.filter(dateStr => {
 const targetDay = allDays.find(ad => ad.date === dateStr);
 const isTargetOffice = targetDay?.status === WorkStatus.IN_OFFICE;
 const willBeOffice = isOffice; // isOffice is true if current day.status is IN_OFFICE
 
 const isChangingFromOffice = isTargetOffice && !willBeOffice;
 const isTomorrow = dateStr === '2026-10-10'; // Hardcoded "last minute window" for this prototype
 
 return isChangingFromOffice && isTomorrow;
 });

 if (lastMinuteUnbookings.length > 0 && !showUnbookingModal) {
 setUnbookingWarningDays(lastMinuteUnbookings);
 setShowUnbookingModal(true);
 return;
 }

 if (isOffice) {
 const updates = extendedDates.map(date => {
 const config = extendedOfficeConfigs[date] || { room: day.room || '', isUsingDesk: day.isUsingDesk };
 return {
 date,
 status: WorkStatus.IN_OFFICE,
 ...config
 };
 });
 if (updates.length > 0) {
 if (onUpdateBulkStatus) {
 onUpdateBulkStatus(updates);
 } else {
 updates.forEach(u => onUpdateStatus(u.date, u.status, u.isUsingDesk, false, u.room));
 }
 }
 onClose();
 } else {
 const isParental = extendedSickType === 'MATERNITY';
 const finalStatus = isParental ? WorkStatus.PARENTAL_LEAVE : day.status;

 if (onUpdateBulkStatus) {
 onUpdateBulkStatus(extendedDates.map(date => ({
 date,
 status: finalStatus,
 isUsingDesk: false,
 room: ''
 })));
 } else {
 onUpdateStatus(extendedDates, finalStatus);
 }
 onClose();
 }
 };

 const auxLabel = day.isUsingDesk ? `Using a desk in ${day.room}` : 'Not using a desk';
 return (
 <div data-testid="daily-detail" className="fixed inset-0 bg-surface z-[130] flex flex-col font-sans overflow-y-auto pb-40">
 <ModalHeader title="Extend status"/>

 <main className="pt-24 px-6 max-w-xl mx-auto w-full pb-10">
 {/* Status Context Header */}
 <div className="mb-8 text-center bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/5 shadow-sm">
 <p className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] mb-2">Extended from</p>
 <div className="font-headline font-bold text-xl text-on-surface mb-4">
 {day.dayName}, {dayNumDisplay} {displayMonth}
 </div>
 <div className="inline-flex items-center gap-3 px-5 py-3 bg-primary/5 rounded-2xl border border-primary/10">
 <div className="w-8 h-8 rounded-xl bg-surface-container-lowest shadow-sm border border-primary/5 flex items-center justify-center">
 {config?.icon ? (
 <config.icon className="w-4 h-4 text-primary"/>
 ) : (
 <span className="text-lg">{config?.emoji}</span>
 )}
 </div>
 <span className="text-sm font-bold text-on-surface">
 {config?.label} {isOffice && <> <span className="mx-1 text-primary/40 font-normal">|</span> <span className="text-primary">{auxLabel}</span></>}
 </span>
 </div>

 {/* Special leave controls */}
 {isSpecialLeaveEligible ? (
 <div className="mt-8 pt-6 border-t border-outline-variant/10">
 <button onClick={() => setIsSpecialLeaveOpen(!isSpecialLeaveOpen)}
 className="w-full flex items-center justify-between py-2 text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest hover:text-on-surface transition-colors"
 >
 <span>I need a special extended leave</span>
 <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isSpecialLeaveOpen ? 'rotate-180' : ''}`}/>
 </button>
 
 <AnimatePresence>
 {isSpecialLeaveOpen && (
 <motion.div initial={{height: 0, opacity: 0, marginTop: 0}} animate={{height: 'auto', opacity: 1, marginTop: 12}} exit={{height: 0, opacity: 0, marginTop: 0}} className="overflow-hidden flex flex-col gap-4">
 <div className="grid grid-cols-2 gap-3">
 <button onClick={() => {
 const newVal = extendedSickType === 'MATERNITY' ? null : 'MATERNITY';
 setExtendedSickType(newVal);
 if (!newVal) {
 setExtendedDates([]);
 setSickRange({ start: day.date, end: null });
 setIsSpecialCalendarOpen(false);
 }
 }}
 className={`flex items-center justify-center p-4 rounded-2xl border transition-all text-center h-14 ${extendedSickType === 'MATERNITY' ? 'bg-primary/5 border-primary shadow-sm' : 'bg-surface-container-low border-outline-variant/10 hover:border-primary/20'}`}
 >
 <span className={`text-[10px] font-bold leading-tight ${extendedSickType === 'MATERNITY' ? 'text-primary' : 'text-on-surface'}`}>Parental Leave</span>
 </button>
 <button onClick={() => {
 const newVal = extendedSickType === 'LONG_TERM' ? null : 'LONG_TERM';
 setExtendedSickType(newVal);
 if (!newVal) {
 setExtendedDates([]);
 setSickRange({ start: day.date, end: null });
 setIsSpecialCalendarOpen(false);
 }
 }}
 className={`flex items-center justify-center p-4 rounded-2xl border transition-all text-center h-14 ${extendedSickType === 'LONG_TERM' ? 'bg-primary/5 border-primary shadow-sm' : 'bg-surface-container-low border-outline-variant/10 hover:border-primary/20'}`}
 >
 <span className={`text-[10px] font-bold leading-tight ${extendedSickType === 'LONG_TERM' ? 'text-primary' : 'text-on-surface'}`}>I need more than 2 weeks</span>
 </button>
 </div>

 {extendedSickType && (
 <div className="flex flex-col gap-4">
 <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
 {/* Start Field (Read-only) */}
 <div className="w-full bg-surface-container-low rounded-2xl p-4 border border-outline-variant/10 opacity-60">
 <label className="block text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest mb-1">Start of extended leave</label>
 <div className="text-sm font-bold text-on-surface">
 {formatAppDate(day.date, 'long')}
 </div>
 </div>
 
 <ArrowRight className="w-5 h-5 text-on-surface-variant/30 hidden sm:block shrink-0"/>
 <ChevronDown className="w-5 h-5 text-on-surface-variant/30 block sm:hidden shrink-0"/>

 {/* End Field (Tappable) */}
 <button onClick={() => setIsSpecialCalendarOpen(!isSpecialCalendarOpen)}
 className={`w-full text-left rounded-2xl p-4 border transition-all ${isSpecialCalendarOpen ? 'bg-primary/5 border-primary/40' : 'bg-surface-container-low border-outline-variant/10'}`}
 >
 <label className="block text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest mb-1">End of extended leave</label>
 <div className={`text-sm font-bold ${sickRange.end ? 'text-primary' : 'text-on-surface-variant/30'}`}>
 {sickRange.end ? formatAppDate(sickRange.end, 'long') : 'Select end date...'}
 </div>
 </button>
 </div>

 {/* Collapsible Calendar for Special Leave */}
 <AnimatePresence>
 {isSpecialCalendarOpen && (
 <motion.div initial={{height: 0, opacity: 0}} animate={{height: 'auto', opacity: 1}} exit={{height: 0, opacity: 0}} className="overflow-hidden">
 <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/10 mt-2">
 <div className="flex justify-between items-center mb-4 px-1">
 <span className="font-headline font-bold text-sm text-on-surface">Select end date (Upcoming 6 months)</span>
 </div>
 <div className="max-h-[300px] overflow-y-auto px-1 pr-2 space-y-6">
 {Object.entries(selectableDates.reduce((acc, curr) => {
 const month = curr.monthLabel;
 if (!acc[month]) acc[month] = [];
 acc[month].push(curr);
 return acc;
 }, {} as Record<string, typeof selectableDates>)).map(([month, dates]) => (
 <div key={month} className="space-y-3">
 <h4 className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest border-b border-outline-variant/5 pb-1">{month}</h4>
 <div className="grid grid-cols-7 gap-1.5">
 {dates.map((item) => {
 const isSelected = item.dateStr === sickRange.end;
 const isOriginal = item.dateStr === day.date;
 const isBeforeStart = new Date(item.dateStr) < new Date(day.date);
 const isInRange = sickRange.start && sickRange.end && 
 new Date(item.dateStr) > new Date(sickRange.start) && 
 new Date(item.dateStr) < new Date(sickRange.end);
 
 const currentConfig = item.currentStatus ? statusConfig[item.currentStatus] : null;

 return (
 <button key={item.dateStr} disabled={item.isWeekend || item.isClosed || isBeforeStart || isOriginal} onClick={() => {
 toggleDate(item.dateStr);
 // Optional: auto-close calendar after selecting end date
 // setIsSpecialCalendarOpen(false);
 }}
 className={`
 aspect-square rounded-lg flex items-center justify-center text-[11px] font-bold transition-all relative
 ${isOriginal ? 'bg-primary/10 text-primary cursor-default' : ''}
 ${(!item.isWeekend && !item.isClosed && !isBeforeStart) ? 
 ((isSelected || isInRange) ? 'bg-primary text-white shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container') 
 : 'text-on-surface-variant/10 cursor-not-allowed opacity-30 shadow-none'}
 `}
 >
 {item.dayNum}
 {currentConfig && !isOriginal && (
 <div className="absolute top-0.5 right-0.5 flex items-center justify-center">
 {currentConfig.icon ? (
 <currentConfig.icon className={`w-1.5 h-1.5 sm:w-2 sm:h-2 ${isSelected || isInRange ? 'text-white' : currentConfig.color.split(' ')[1]}`}/>
 ) : (
 <span className="text-[6px] sm:text-[8px]">{currentConfig.emoji}</span>
 )}
 </div>
 )}
 </button>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 )}
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 ) : (
 <div className="h-4"/>
 )}
 </div>

 {/* Standard Extension Calendar (Show only if special leave is NOT open/configured) */}
 <div className={`transition-all duration-500 overflow-hidden ${extendedSickType ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[1000px] opacity-100'}`}>
 {day.status === WorkStatus.SICK && !extendedSickType ? (
 <div data-testid="extend-sick-info" className="bg-surface-container-lowest rounded-[28px] p-6 shadow-sm border border-outline-variant/10 mb-8 flex flex-col items-center text-center gap-3">
 <span className="text-2xl">🤒</span>
 <p className="text-sm text-on-surface-variant leading-relaxed max-w-xs">
 Sick leave cannot be planned in advance. Use the <span className="font-bold text-on-surface">"I need a special extended leave"</span> section above for parental leave or long-term absence.
 </p>
 </div>
 ) : (
 <div className="bg-surface-container-lowest rounded-[28px] p-6 shadow-sm border border-outline-variant/10 mb-8">
 <div className="flex flex-col mb-6 px-1">
 <span className="font-headline font-bold text-lg text-on-surface">
 Select individual days
 </span>
 <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">
 Available Days within the planning window
 </span>
 </div>

 {isAtEndOfWeek ? (
 <div className="bg-surface-container-low/50 rounded-2xl p-8 border border-dashed border-outline-variant/20 flex flex-col items-center justify-center text-center">
 <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-4 text-on-surface-variant/30">
 <AlertTriangle className="w-6 h-6"/>
 </div>
 <p className="text-sm font-medium text-on-surface-variant max-w-[240px] leading-relaxed">
 You cannot extend further because you are at the end of the planning window
 </p>
 </div>
 ) : (
 <div className={`space-y-8 max-h-[400px] overflow-y-auto px-1 scrollbar-hide py-2`}>
 {/* Standard calendar content... */}
 {Object.entries(selectableDates.reduce((acc, curr) => {
 const month = curr.monthLabel;
 if (!acc[month]) acc[month] = [];
 acc[month].push(curr);
 return acc;
 }, {} as Record<string, typeof selectableDates>)).map(([month, dates]) => (
 <div key={month} className="space-y-4">
 <h4 className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest border-b border-outline-variant/10 pb-2">{month}</h4>
 <div className="grid grid-cols-7 gap-3">
 {dates.map((item) => {
 const isSelected = extendedDates.includes(item.dateStr);
 const isOriginal = item.dateStr === day.date;
 const currentConfig = item.currentStatus ? statusConfig[item.currentStatus] : null;
 
 return (
 <div key={item.dateStr} className="flex flex-col items-center gap-1.5">
 <span className="text-[9px] font-bold text-on-surface-variant/30 uppercase tracking-wider">{item.dayLabel}</span>
 <button disabled={item.isWeekend || item.isClosed || isOriginal} onClick={() => toggleDate(item.dateStr)}
 className={`
 w-full aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all relative
 ${isOriginal ? 'bg-primary/5 text-primary border border-primary/20 cursor-default' : ''}
 ${(!item.isWeekend && !item.isClosed) ? 
 ((isSelected) ? (isOffice && item.isFull ? 'bg-red-500 text-white shadow-md scale-105' : 'bg-primary text-white shadow-md scale-105') : 'bg-surface-container-low text-on-surface hover:bg-surface-container') 
 : 'text-on-surface-variant/20 cursor-not-allowed opacity-40 shadow-none'}
 ${isOffice && item.isFull && !isSelected && !isOriginal ? 'ring-2 ring-red-500/30' : ''}
 `}
 >
 {item.dayNum}
 {currentConfig && !isOriginal && (
 <div className={`absolute -top-1 -right-1 w-4 h-4 sm:w-6 sm:h-6 bg-surface-container-lowest rounded-full flex items-center justify-center shadow-sm border border-outline-variant/10 z-10`}>
 {currentConfig.icon ? (
 <currentConfig.icon className={`w-2 h-2 sm:w-3.5 sm:h-3.5 ${currentConfig.color.split(' ')[1]}`}/>
 ) : (
 <span className="text-[10px] sm:text-xs leading-none">{currentConfig.emoji}</span>
 )}
 </div>
 )}
 {isSelected && (
 <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 ${isOffice && item.isFull ? 'bg-red-100' : 'bg-primary/10'} rounded-full flex items-center justify-center shadow-sm z-20`}>
 {isOffice && item.isFull ? (
 <AlertCircle className="w-2 h-2 text-red-500"/>
 ) : (
 <Check className="w-2 h-2 text-primary"/>
 )}
 </div>
 )}
 </button>
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 {/* Room Assignment List */}
 {isOffice && extendedDates.length > 0 && (
 <div className="space-y-6">
 <h3 className="font-sans text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-[0.15em] pl-1 mb-2">Room Assignment FOR NEW DAYS</h3>
 
 {extendedDates.sort().map((dateStr) => {
 const d = new Date(dateStr);
 const dayLabel = getFictionalDayName(d, 'short');
 const dateLabel = `${months[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
 const currentConfig = extendedOfficeConfigs[dateStr] || { room: day.room || '', isUsingDesk: day.isUsingDesk };
 const isRoomFull = false;
 
 // Deterministic project teammates logic for mock
 const tHash = dateStr.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
 const projectTeammatesCount = (tHash % 6) + 1;

 return (
 <div key={dateStr} className={`bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border ${isRoomFull ? 'border-red-500/20 bg-red-50/10' : 'border-outline-variant/10'} hover:border-outline-variant/30 transition-all flex flex-col sm:flex-row gap-6`}>
 {/* Date Column */}
 <div className="flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 sm:w-24 shrink-0 sm:border-r border-outline-variant/10 sm:pr-4">
 <div className="flex flex-col">
 <span className="font-headline font-bold text-base text-on-surface leading-tight">{dayLabel}</span>
 <span className="font-sans text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-wide">{dateLabel}</span>
 </div>
 
 <div className="flex items-center gap-1.5 mt-2 bg-surface-container-low px-2 py-1 rounded-lg">
 <span className="text-[10px] font-bold text-on-surface/60">{projectTeammatesCount} project teammates</span>
 <div className="flex -space-x-1.5">
 {[...Array(Math.min(projectTeammatesCount, 3))].map((_, i) => (
 <div key={i} className="w-3.5 h-3.5 rounded-full bg-primary/20 border border-white"/>
 ))}
 </div>
 </div>

 {isRoomFull && (
 <div className="mt-2 flex flex-col gap-1">
 <div className="flex items-center gap-1.5 text-red-500 bg-red-50 px-2 py-1.5 rounded-lg border border-red-100">
 <AlertCircle className="w-3 h-3"/>
 <span className="text-[9px] font-bold uppercase shrink-0">Office Full</span>
 </div>
 </div>
 )}
 </div>

 {/* Rooms Grid Column */}
 <div className="flex-grow">
 {isOfficeFullForDate(dateStr) ? (
 <div className="flex flex-col gap-2">
 <button onClick={() => updateRoomConfig(dateStr, currentConfig.room || rooms[0]?.name || 'No Desk', true)}
 className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${currentConfig.isUsingDesk ? 'bg-amber-500/10 border-amber-500 text-amber-700 shadow-sm ring-1 ring-amber-500/20' : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface/60 hover:bg-surface-container'}`}
 >
 <div className="bg-amber-500/20 p-2 rounded-lg">
 <Clock className="w-5 h-5 text-amber-600"/>
 </div>
 <span className="font-headline font-bold text-sm">Join Waiting List</span>
 </button>
 <button onClick={() => updateRoomConfig(dateStr, 'No Desk', false)}
 className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${!currentConfig.isUsingDesk ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary/20' : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface/60 hover:bg-surface-container'}`}
 >
 <div className="bg-primary/20 p-2 rounded-lg">
 <Headset className="w-5 h-5 text-primary"/>
 </div>
 <span className="font-headline font-bold text-sm">Not using a desk</span>
 </button>
 </div>
 ) : (
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
 {rooms.map((room, roomIdx) => {
 const isActive = currentConfig.room === room.name && currentConfig.isUsingDesk;
 const extRoomColor = roomTypeColor[room.type] ?? roomFallbackColors[roomIdx % roomFallbackColors.length];

 return (
 <button key={room.id} onClick={() => updateRoomConfig(dateStr, room.name, true)}
 className={`
 flex flex-col gap-0.5 px-2.5 py-2.5 rounded-xl border text-left transition-all
 ${isActive ? 'bg-primary/5 border-primary shadow-sm' : 'bg-surface-container-lowest border-outline-variant/30 hover:border-primary/40'}
 `}
 >
 <div className="flex items-center gap-1.5 overflow-hidden">
 <div className={`w-2 h-2 rounded-full ${extRoomColor} shrink-0`}/>
 <span className={`text-[10px] font-bold truncate ${isActive ? 'text-on-surface' : 'text-on-surface/80'}`}>
 {room.type === 'lab' ? 'Lab' : room.type === 'management' ? 'Management' : room.name}
 </span>
 </div>
 <span className={`text-[9px] font-bold ml-3.5 ${isActive ? 'text-primary' : 'text-on-surface-variant/40'}`}>{room.capacity} seats</span>
 </button>
 );
 })}
 <button onClick={() => updateRoomConfig(dateStr, 'No Desk', false)}
 className={`
 flex items-center justify-center gap-2 px-2.5 py-2.5 rounded-xl border transition-all text-center
 ${!currentConfig.isUsingDesk ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface/60 hover:border-primary/40'}
 `}
 >
 <span className="text-[10px] font-bold leading-tight">(Not using a desk)</span>
 </button>
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </main>

 <footer className="fixed bottom-0 left-0 w-full p-6 bg-surface-container-highest border-t border-outline-variant/10 z-[140] flex flex-col gap-3">
 <p className="text-[10px] text-on-surface-variant/60 text-center font-bold uppercase tracking-wider">
 Extensions will overwrite existing working statuses (if any)
 </p>
 <button data-testid="extend-confirm" onClick={handleApply} disabled={extendedDates.length === 0} className="w-full bg-primary text-white font-headline font-extrabold py-5 rounded-[24px] shadow-lg shadow-primary/20 disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.98] text-center">
 {extendedDates.length > 0 
 ? `Extend status to ${extendedDates.length} other day${extendedDates.length === 1 ? '' : 's'}` 
 : 'Select dates to extend'}
 </button>
 </footer>

 <AnimatePresence>
 {showUnbookingModal && (
 <>
 <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={() => setShowUnbookingModal(false)}
 className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
 />
 <motion.div initial={{opacity: 0, scale: 0.9, y: 20}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.9, y: 20}} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-48px)] max-w-sm bg-surface-container-lowest rounded-[32px] p-8 z-[201] shadow-2xl overflow-hidden">
 <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
 <AlertTriangle className="w-8 h-8 text-red-600"/>
 </div>
 
 <h3 className="font-headline text-xl font-bold text-on-surface text-center mb-3">Last-minute change</h3>
 <p className="font-sans text-sm text-on-surface-variant text-center mb-8 px-2 leading-relaxed">
 If you change the status for <span className="font-bold text-on-surface">{day.date === todayStr && unbookingWarningDays.includes(day.date) ? 'today' : unbookingWarningDays.map(d => formatAppDate(d, 'short')).join(', ')}</span> you will do a last-minute unbooking.
 <br/><br/>
 Are you sure you want to proceed?
 </p>

 <div className="flex flex-col gap-3">
 <button onClick={() => {
 setShowUnbookingModal(false);
 if (pendingStatusUpdate) {
 onUpdateStatus(day.date, pendingStatusUpdate);
 setPendingStatusUpdate(null);
 setStep('VIEW');
 } else {
 handleApply();
 }
 }}
 className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all"
 >
 Confirm & Proceed
 </button>
 <button onClick={() => setShowUnbookingModal(false)}
 className="w-full bg-surface-container-low text-on-surface-variant font-bold py-4 rounded-2xl active:scale-[0.98] transition-all"
 >
 Cancel
 </button>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 );
 }

 const isCurrentDay = day.date === todayStr;

 if (step === 'ALL_COLLEAGUES') {
 const otherColleaguesFiltered = allColleagues;
 const dayDisplay = day.date.split('-')[2];
 const monthDisplay = months[parseAppDate(day.date).getMonth()];
 
 return (
 <div className="fixed inset-0 bg-surface z-[130] flex flex-col font-sans overflow-hidden">
 <ModalHeader title={`All colleagues' plans for ${dayDisplay} ${monthDisplay}`}/>

 <main className="pt-24 px-6 max-w-xl mx-auto w-full pb-10 overflow-y-auto h-full">
 <div className="space-y-3">
 <h3 className="font-sans text-[11px] font-bold text-on-surface-variant uppercase tracking-widest pl-1">Other colleagues ({otherColleaguesFiltered.length})</h3>
 <div className="bg-surface-container-lowest rounded-[24px] overflow-hidden shadow-sm border border-outline-variant/10 mb-10">
 {otherColleaguesFiltered.map((c, idx) => (
 <ColleagueItem key={idx} name={c.name ?? ''} role={c.role ?? ''} status={c.status} initials={c.initials} color={c.color} hasOffTime={c.hasOffTime} offTimeType={c.offTimeType} dimRole={c.remind} isConfirmed={c.isConfirmed} isMe={c.isMe} isGoldStar={c.isGoldStar} showQuestionMark={c.showQuestionMark}/>
 ))}
 </div>
 </div>
 </main>
 </div>
 );
 }
 return (
 <div className="fixed inset-0 bg-surface z-[100] flex flex-col overflow-y-auto pb-10 font-sans">
 <ModalHeader title=""/>

 <header className="pt-24 pb-6 px-6 relative">
 <div className="flex flex-col items-center justify-center gap-1">
 {isCurrentDay && (
 <span className="font-sans text-[11px] font-bold text-on-surface-variant/40 tracking-[0.2em] uppercase">Today</span>
 )}
 <div className="flex items-center justify-center gap-6">
 {!isMandatory && (
 <button onClick={() => onNavigate('prev')}
 className="p-1 rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant"
 >
 <ChevronLeft className="w-6 h-6 text-on-surface/40 hover:text-on-surface transition-colors"/>
 </button>
 )}
 <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">
 {day.dayName}, {day.date.split('-')[2]}{day.date.split('-')[2] === '01' ? 'st' : day.date.split('-')[2] === '02' ? 'nd' : day.date.split('-')[2] === '03' ? 'rd' : 'th'}{' '}
 {months[parseAppDate(day.date).getMonth()]}
 </h1>
 {!isMandatory && (
 <button onClick={() => onNavigate('next')}
 className="p-1 rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant"
 >
 <ChevronLeft className="w-6 h-6 rotate-180 text-on-surface/40 hover:text-on-surface transition-colors"/>
 </button>
 )}
 </div>
 </div>
 </header>

 <div className="px-6 py-4 max-w-xl mx-auto w-full space-y-8">
 {day.isPast && isPending && (
 <Alert icon={AlertCircle} title="You didn&#39;t confirm your presence on this day" description="It&#39;s possible to retrofit your status for this past day." className="rounded-[28px] border-orange-500/20 bg-orange-500/5 shadow-none"/>
 )}
 <section>
 <div className="flex justify-between items-center mb-4 pl-1">
 <h2 className="font-sans text-sm font-bold text-on-surface-variant uppercase tracking-wider">Your status</h2>
 {day.offTime && (
 <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full border border-amber-500/10">
 <Clock className="w-3 h-3"/>
 <span className="text-[10px] font-bold uppercase tracking-wider">
 {day.offTime.type === OffTimeType.MORNING ? 'Morning off' : 
 day.offTime.type === OffTimeType.AFTERNOON ? 'Afternoon off' : 
 `${day.offTime.hours}h off`}
 </span>
 </div>
 )}
 </div>
 <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[28px] p-6 shadow-sm">
 {isPending ? (
 <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
 <div className="flex items-center gap-5 w-full sm:w-auto">
 <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-3xl">
 {"\u2753"}
 </div>
 <h3 className="font-headline text-xl font-bold text-on-surface leading-tight">
 {day.isPast ? "Status not set" : "You haven't planned for this day yet"}
 </h3>
 </div>
 <button onClick={() => setStep('PLANNING')}
 className="w-full sm:w-auto bg-primary hover:opacity-90 text-white px-8 py-3.5 rounded-full font-bold text-sm transition-all shadow-md active:scale-95 shrink-0"
 >
 {day.isPast ? "Retrofit status" : "Define working status"}
 </button>
 </div>
 ) : (
 <div>
 <div className="flex items-center justify-between mb-8">
 <div className="flex items-center gap-5">
 <div className={`w-8 h-8 sm:w-14 sm:h-14 rounded-[18px] ${config?.color} flex items-center justify-center shrink-0 shadow-sm`}>
 {config?.icon ? (
 <config.icon className="w-5 h-5 sm:w-7 sm:h-7 fill-current"/>
 ) : (
 <span className="text-xl sm:text-3xl">{config?.emoji}</span>
 )}
 </div>
 <div>
 <p className="font-headline text-xl font-extrabold text-on-surface tracking-tight">{config?.label}</p>
 <div className="flex items-center gap-1.5 mt-0.5 text-on-surface-variant/70">
 {day.status === WorkStatus.IN_OFFICE || day.status === WorkStatus.OFFICE_NO_DESK ? (
 <>
 <div className="p-0.5 rounded-md bg-on-surface-variant/5">
 {day.status === WorkStatus.OFFICE_NO_DESK 
 ? <Headset className="w-3.5 h-3.5"/> 
 : (day.isUsingDesk 
 ? <Monitor className="w-3.5 h-3.5"/> 
 : <Headset className="w-3.5 h-3.5"/>
 )
 }
 </div>
 <p className="font-sans text-xs font-semibold text-on-surface-variant/60">
 {day.status === WorkStatus.OFFICE_NO_DESK 
 ? 'Not using a desk' 
 : (day.isUsingDesk === undefined 
 ? 'No workspace defined yet' 
 : (day.isUsingDesk 
 ? `${day.isCheckedIn ? 'Using a desk' : 'Planning to use a desk'} ${day.room ? `in ${day.room}` : ''}` 
 : 'Not using a desk'))}
 </p>
 </>
 ) : (
 <p className="font-sans text-xs font-semibold">
 {day.status === WorkStatus.REMOTE ? 'Working from home' : ''}
 </p>
 )}
 </div>
 </div>
 </div>
 {day.isPast ? (
 <button onClick={() => setStep('PLANNING')}
 className="px-4 py-2.5 bg-primary rounded-xl font-bold text-xs text-white shadow-sm hover:bg-primary/90 transition-all active:scale-95 shrink-0"
 >
 Retrofit Working Status
 </button>
 ) : (isCurrentDay || !day.isCheckedIn) && !isMandatory && (
 <button onClick={() => setStep('PLANNING')}
 className="p-2 text-primary hover:bg-primary/5 rounded-full transition-colors shrink-0"
 >
 <Edit2 className="w-5 h-5 shadow-sm"/>
 </button>
 )}
 </div>

 <div className="flex flex-col gap-4">
 {isCurrentDay && !day.isCheckedIn && [WorkStatus.IN_OFFICE, WorkStatus.REMOTE, WorkStatus.OFFICE_NO_DESK].includes(day.status) && (
 <button onClick={onCheckIn} className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-base shadow-md hover:shadow-lg active:scale-[0.98] transition-all">
 Say Good Morning
 </button>
 )}
 
 {(isCurrentDay || day.isPast) && (day.isCheckedIn || day.status === WorkStatus.REMOTE) && (
 <div className="flex flex-col gap-2">
 <div className="w-full bg-green-500/10 text-green-500 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-green-500/10">
 <div className="bg-green-600 text-white p-0.5 rounded-full">
 <Check className="w-3 h-3"/>
 </div>
 {day.status === WorkStatus.REMOTE && !day.isCheckedIn ? 'Confirmed status' : 'Confirmed'}
 </div>
 {day.room && day.isCheckedIn && (
 <div className="text-center font-sans text-xs font-bold text-on-surface-variant/50">
 Checked in @ {day.room}
 </div>
 )}
 </div>
 )}

 {!isCurrentDay && !day.isPast && (day.status === WorkStatus.IN_OFFICE || day.status === WorkStatus.REMOTE || day.status === WorkStatus.WAITING_LIST) && (
 <div className="w-full flex items-center justify-center gap-2 py-2 text-on-surface-variant/50 font-medium text-xs mb-2 text-center">
 <span className="text-xl opacity-80 shrink-0">{"\u2600\uFE0F"}</span>
 {day.status === WorkStatus.WAITING_LIST 
 ? "You will be notified when a place is freed on the list. When that happens, book a place"
 : "Remember to say good morning on the day!"
 }
 </div>
 )}

 {!day.isPast && !day.isCheckedIn && day.status !== WorkStatus.WAITING_LIST && (
 <button data-testid="extend-trigger" onClick={() => setStep('EXTEND')}
 className="w-full bg-surface-container-low/40 border border-outline-variant/10 rounded-2xl py-3.5 flex items-center justify-center gap-2 text-on-surface font-bold text-[13px] hover:bg-surface-container transition-colors shadow-sm"
 >
 Extend to other days
 </button>
 )}
 </div>
 </div>
 )}
 </div>
 </section>

 {(!day.isPast || day.date === '2026-10-06') && (
 <section>
 <div className="mb-4 px-1">
 <h2 className="font-sans text-sm font-bold text-on-surface-variant uppercase tracking-wider">Activities</h2>
 </div>
 <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[28px] overflow-hidden shadow-sm divide-y divide-outline-variant/5">
 {day.isOfficeClosed ? (
 <div className="p-8 text-center bg-surface-container-low/20">
 <p className="text-on-surface-variant font-medium text-sm">No activities planned because office is closed</p>
 </div>
 ) : (
 <div className="flex items-center justify-between group">
 <div className={`flex-grow p-6 flex items-center justify-between transition-colors group text-left ${day.date === '2026-10-06' ? 'bg-primary/5' : (day.isLabBooked && day.labBookerName === 'roberto' ? 'bg-surface-container-low/20' : 'hover:bg-surface-container cursor-pointer')}`} onClick={() => {
 if (day.date === '2026-10-06' || (day.isLabBooked && day.labBookerName === 'Roberto')) return;
 setShowLabConfirmModal(true);
 }}
 >
 <div className="flex items-center gap-4">
 <div className="w-6 h-6 sm:w-12 sm:h-12 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
 <Beaker className="w-4 h-4 sm:w-6 sm:h-6 text-primary"/>
 </div>
 <div className="flex flex-col items-start translate-y-[-1px]">
 <span className="font-headline font-bold text-lg text-on-surface">
 {day.date === '2026-10-06' 
 ? 'Lab is occupied'
 : day.isLabBooked && day.labBookerName === 'Roberto' 
 ? 'There is a Lab activity booked for the Day' 
 : 'Book Lab'}
 </span>
 <span className="text-xs text-on-surface-variant/70 font-medium font-sans">
 {day.date === '2026-10-06'
 ? 'Lab is occupied'
 : day.isLabBooked && day.labBookerName === 'Roberto' 
 ? 'Lab' 
 : 'Book the lab'}
 </span>
 </div>
 </div>
 </div>
 {!day.isPast && day.isLabBooked && day.labBookerName === 'Roberto' && (
 <button onClick={(e) => {
 e.stopPropagation();
 onUpdateLabBooking(day.date, false);
 }}
 className="p-6 text-red-500 hover:bg-red-500/5 transition-colors"
 title="Remove booking"
 >
 <Trash2 className="w-5 h-5"/>
 </button>
 )}
 </div>
 )}
 </div>
 </section>
 )}

 <section className="space-y-6">
 <div className="flex flex-col gap-4">
 <h2 className="font-headline text-lg font-bold text-on-surface">Your colleagues</h2>
 
 {/* Search Bar */}
 <div className="relative group">
 <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors"/>
 <input type="text" placeholder="Search colleagues..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-2xl py-3 pl-11 pr-4 font-sans text-sm focus:border-primary outline-none shadow-sm transition-all placeholder:text-on-surface-variant/30"
 />
 {searchQuery && (
 <button onClick={() => setSearchQuery('')}
 className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-container-low rounded-full transition-colors"
 >
 <X className="w-3 h-3 text-on-surface-variant/40"/>
 </button>
 )}
 </div>
 </div>
 
 {/* Project Teammates Section */}
 {(() => {
 if (projectTeammates.length === 0 && searchQuery === '') {
 return (
 <div className="space-y-3">
 <div className="flex items-center gap-2 pl-1">
 <Star className="w-4 h-4 text-amber-400 fill-amber-400"/>
 <h3 className="font-sans text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest">Project Teammates</h3>
 </div>
 <button onClick={onOpenProfile} className="w-full bg-surface-container-lowest border border-dashed border-outline-variant/30 rounded-[24px] p-8 text-center transition-all hover:bg-primary/5 hover:border-primary/30 group">
 <p className="text-sm font-medium text-on-surface-variant/60 group-hover:text-primary transition-colors">
 You didn't select any teammates - <span className="text-primary font-bold decoration-primary/30 decoration-2 underline-offset-4 group-hover:underline">click here to add them</span>
 </p>
 </button>
 </div>
 );
 }

 const filteredProjectTeammates = goldStarProjectTeammates.filter(c =>
 searchQuery === '' || (c.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
 );

 if (filteredProjectTeammates.length === 0) return null;

 return (
 <div className="space-y-3">
 <div className="flex items-center gap-2 pl-1">
 <Star className="w-4 h-4 text-amber-400 fill-amber-400"/>
 <h3 className="font-sans text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest">Project Teammates</h3>
 </div>
 <div className="bg-surface-container-lowest rounded-[24px] overflow-hidden shadow-sm border border-outline-variant/10">
 {filteredProjectTeammates.map((c, idx) => (
 <ColleagueItem key={`project-teammate-${idx}`} name={c.name ?? ''} role={c.role ?? ''} status={c.status} initials={c.initials} color={c.color} isConfirmed={c.isConfirmed} isGoldStar={true} dimRole={c.remind} showQuestionMark={c.showQuestionMark} workspaceIcon={c.workspaceIcon}/>
 ))}
 </div>
 </div>
 );
 })()}

 {/* In the office Section */}
 {(() => {
 const displayInOffice = inOfficeColleagues;
 const filteredInOffice = displayInOffice.filter(c => searchQuery === '' || ((c.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) && !goldStarNames.has(c.name ?? '')));
 
 if ((day.isClosed || day.isOfficeClosed) && searchQuery === '') {
 return (
 <div className="space-y-3">
 <div className="flex justify-between items-center px-1">
 <h3 className="font-sans text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest">In the office</h3>
 </div>
 <Alert icon={AlertCircle} title={day.isClosed ? "office closed for the day" : "the office is closed"} description={day.isClosed ? "you cannot book a place for this date." : "no presence is allowed in the office today."} className="p-8 justify-center text-center flex-col items-center shadow-lg rounded-[28px]"/>
 </div>
 );
 }

 if (filteredInOffice.length === 0 && searchQuery !== '') return null;
 if (displayInOffice.length === 0 && searchQuery === '') return null;

 return (
 <div className="space-y-3">
 <div className="flex justify-between items-center px-1">
 <h3 className="font-sans text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest">In the office</h3>
 <span className="font-sans text-[11px] font-bold text-on-surface-variant/40">
 {day.bookedCount || 20}/{day.totalCapacity || 23}
 {(day.bookedCount ?? 0) >= (day.totalCapacity ?? 23) && (
 <span className="ml-1">| 7 in waiting list</span>
 )}
 </span>
 </div>
 <div className="bg-surface-container-lowest rounded-[24px] overflow-hidden shadow-sm border border-outline-variant/10">
 {filteredInOffice.map((c, idx) => (
 <ColleagueItem key={idx} name={c.name ?? ''} role={c.role ?? ''} status={WorkStatus.IN_OFFICE} initials={c.initials} color={c.color} isConfirmed={c.isConfirmed} isMe={c.isMe} isGoldStar={c.isGoldStar} workspaceIcon={c.workspaceIcon}/>
 ))}
 </div>
 </div>
 );
 })()}

 {/* Other colleagues Section */}
 {(() => {
 const displayOthers = allColleagues;
 const filteredOthers = displayOthers.filter(c => searchQuery === '' || ((c.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) && !goldStarNames.has(c.name ?? '')));
 
 if (filteredOthers.length === 0 && searchQuery !== '') return null;
 if (displayOthers.length === 0 && searchQuery === '') return null;

 return (
 <div className="space-y-3">
 <div className="flex justify-between items-center px-1">
 <h3 className="font-sans text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Other colleagues</h3>
 <button onClick={() => setStep('ALL_COLLEAGUES')}
 className="text-[11px] font-bold text-primary hover:underline transition-all"
 >
 See all
 </button>
 </div>
 
 <div className="bg-surface-container-lowest p-4 rounded-[24px] shadow-sm border border-outline-variant/10">
 <div className="grid grid-cols-5 lg:grid-cols-10 gap-3">
 {(searchQuery === '' 
 ? filteredOthers.slice(0, 10) 
 : filteredOthers
 ).map((c, i) => {
 const status = c.status || WorkStatus.OFFICE_NO_DESK;
 return (
 <div key={i} className="relative flex justify-center aspect-square">
 <div className="w-6 h-6 sm:w-11 sm:h-11 relative shrink-0">
 <div className={`w-full h-full rounded-full border-2 border-surface-container-lowest shadow-sm flex items-center justify-center text-[10px] sm:text-xs font-bold text-white ${c.color}`}>
 {c.initials}
 </div>
 {(c.status || c.showQuestionMark || c.remind) && (
 <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border border-surface-container-lowest shadow-sm z-10 ${ status === WorkStatus.REMOTE ? 'bg-green-500 text-white' : status === WorkStatus.LEAVE ? 'bg-fuchsia-500 text-white' : status === WorkStatus.SICK ? 'bg-red-500 text-white' : status === WorkStatus.PARENTAL_LEAVE ? 'bg-indigo-500 text-white' : status === WorkStatus.MISSION ? 'bg-orange-500 text-white' : 'bg-surface-container text-on-surface-variant/40' }`}>
 {status === WorkStatus.REMOTE && <Home className={`w-1.5 sm:w-2.5 h-1.5 sm:h-2.5`}/>}
 {status === WorkStatus.LEAVE && <Palmtree className="w-1.5 sm:w-2.5 h-1.5 sm:h-2.5"/>}
 {status === WorkStatus.SICK && <Thermometer className="w-1.5 sm:w-2.5 h-1.5 sm:h-2.5"/>}
 {status === WorkStatus.PARENTAL_LEAVE && <Crib className="w-1.5 sm:w-2.5 h-1.5 sm:h-2.5"/>}
 {status === WorkStatus.MISSION && <Plane className="w-1.5 sm:w-2.5 h-1.5 sm:h-2.5"/>}
 {(c.showQuestionMark || (c.remind && !c.status)) && <span className="text-[8px] sm:text-[10px] font-bold">?</span>}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 );
 })()}
 </section>
 <AnimatePresence>
 {showLabConfirmModal && (
 <>
 <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={() => setShowLabConfirmModal(false)}
 className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
 />
 <motion.div initial={{opacity: 0, scale: 0.9, y: 20}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.9, y: 20}} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-48px)] max-w-sm bg-surface-container-lowest rounded-[32px] p-8 z-[201] shadow-2xl overflow-hidden">
 <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
 <Beaker className="w-8 h-8 text-primary"/>
 </div>
 
 <h3 className="font-headline text-xl font-bold text-on-surface text-center mb-3">Book Innovation Lab</h3>
 <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 mb-8">
 <p className="font-sans text-sm text-amber-700 leading-relaxed text-center">
 There are people that plan to use the Lab on this day.
 </p>
 <p className="font-sans text-[13px] text-amber-700/80 mt-2 text-center leading-relaxed">
 These people are: <span className="font-bold text-amber-800">Marco Rossi, Sofia Bianchi, Elena Verdi, Francesco Russo, Giulia Ferrari</span>. 
 </p>
 <p className="font-sans text-[12px] text-amber-700/60 mt-3 text-center italic">
 If you book the lab when there are people that plan to go there, coordinate with them outside the app.
 </p>
 </div>

 <div className="flex flex-col gap-3">
 <button onClick={() => {
 onUpdateLabBooking(day.date, true);
 setShowLabConfirmModal(false);
 }}
 className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all"
 >
 Confirm Lab Booking
 </button>
 <button onClick={() => setShowLabConfirmModal(false)}
 className="w-full bg-surface-container-low text-on-surface-variant font-bold py-4 rounded-2xl active:scale-[0.98] transition-all"
 >
 Never mind
 </button>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 </div>
 );
}

function StatusOption({ 
 emoji, 
 label, 
 color, 
 onClick, 
 showChevron, 
 isActive
}: { 
 emoji: string, 
 label: string, 
 color: string, 
 onClick: () => void, 
 showChevron?: boolean,
 isActive?: boolean
}) {
 return (
 <button onClick={onClick} className={`w-full bg-surface-container-lowest border ${isActive ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-outline-variant/20'} rounded-[20px] p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group active:scale-[0.98] relative overflow-hidden`}>
 {isActive && (
 <div className="absolute top-2 right-2">
 <div className="bg-primary text-white p-0.5 rounded-full">
 <Check className="w-3 h-3"/>
 </div>
 </div>
 )}
 <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center shrink-0 text-2xl`}>
 {emoji}
 </div>
 <div className="flex flex-col flex-grow text-left">
 <span className="font-headline font-bold text-lg text-on-surface leading-tight">{label}</span>
 </div>
 {showChevron && <ChevronLeft className="w-5 h-5 rotate-180 text-on-surface-variant/40"/>}
 </button>
 );
}

function ColleagueItem({ name, role, status, initials, color, workspaceIcon, hasOffTime, offTimeType, isMe, dimRole, isGoldStar, isConfirmed: _isConfirmed = true, showQuestionMark }: { name: string, role: string, status?: WorkStatus, initials?: string, color?: string, workspaceIcon?: 'desk' | 'headset', hasOffTime?: boolean, offTimeType?: OffTimeType, isMe?: boolean, dimRole?: boolean, isGoldStar?: boolean, isConfirmed?: boolean, showQuestionMark?: boolean, key?: React.Key }) {
 const Icon = status ? (
 status === WorkStatus.REMOTE ? Home : 
 status === WorkStatus.LEAVE ? Palmtree : 
 status === WorkStatus.SICK ? Thermometer : 
 status === WorkStatus.PARENTAL_LEAVE ? Crib :
 status === WorkStatus.MISSION ? Plane :
 Building2
 ) : null;
 const colorClass = 
 status === WorkStatus.REMOTE ? 'bg-green-500/10 text-green-500' : 
 status === WorkStatus.LEAVE ? 'bg-fuchsia-500/10 text-fuchsia-500' : 
 status === WorkStatus.SICK ? 'bg-red-500/10 text-red-500' : 
 status === WorkStatus.PARENTAL_LEAVE ? 'bg-indigo-500/10 text-indigo-500' :
 status === WorkStatus.MISSION ? 'bg-orange-500/10 text-orange-500' :
 'bg-primary/10 text-primary';

 const WorkspaceIconComp = workspaceIcon === 'desk' ? Monitor : Headset;

 return (
 <div className={`flex items-center justify-between p-3 sm:p-4 hover:bg-surface-container transition-colors border-b border-outline-variant/5 last:border-b-0`}>
 <div className="flex items-center gap-2 sm:gap-3">
 <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white border border-outline-variant/10 shadow-sm ${color || 'bg-surface-container-low'}`}>
 {initials || name.substring(0, 2).toUpperCase()}
 </div>
 <div>
 <div className="flex items-center gap-1.5">
 <p className="text-sm font-bold text-on-surface">{name}</p>
 {isGoldStar && !isMe && (
 <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0"/>
 )}
 </div>
 <p className={`text-[11px] font-medium ${dimRole ? 'text-red-600 dark:text-red-400 font-bold' : 'text-on-surface-variant/60'}`}>{role}</p>
 </div>
 </div>
 <div className="flex items-center gap-1.5 sm:gap-2">
 {hasOffTime && (
 <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface border border-outline-variant/10">
 {offTimeType === OffTimeType.MORNING ? <Sunrise className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> : 
 offTimeType === OffTimeType.AFTERNOON ? <Sunset className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> : 
 <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>}
 </div>
 )}
 {status && Icon && (
 <div className="flex items-center gap-1.5 sm:gap-2">
 <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${colorClass}`}>
 <div className="flex items-center justify-center">
 <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current`}/>
 </div>
 </div>
 {status === WorkStatus.IN_OFFICE && workspaceIcon && (
 <WorkspaceIconComp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-on-surface-variant"/>
 )}
 </div>
 )}
 {showQuestionMark && (
 <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant/40 border border-outline-variant/10 font-bold text-xs">
 ?
 </div>
 )}
 </div>
 </div>
 )
}
