import { motion, AnimatePresence } from 'motion/react';
import { WorkStatus, DayPresence, OffTimeType } from '../types';
import { 
 Building2, 
 Home, 
 Plane, 
 Palmtree, 
 Thermometer,
 Clock,
 Sunrise,
 Sunset,
 Headset,
 Monitor,
 Heart as Crib
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import React from 'react';

import { COLLEAGUES, Colleague } from '../constants/colleagues';

interface DayCardProps {
 day: DayPresence;
 onClick?: () => void;
 onDoubleClick?: () => void;
 onCheckIn?: () => void;
 isSimplified?: boolean;
 index: number;
 projectTeammates?: Colleague[];
 showWeekSeparator?: boolean;
 hasMondayInRow?: boolean;
 key?: React.Key;
}

const statusConfig = {
 [WorkStatus.IN_OFFICE]: { color: 'bg-primary/10 text-primary', icon: Building2 },
 [WorkStatus.REMOTE]: { color: 'bg-green-500/10 text-green-500', icon: Home },
 [WorkStatus.MISSION]: { color: 'bg-orange-500/10 text-orange-500', icon: Plane },
 [WorkStatus.LEAVE]: { color: 'bg-fuchsia-500/10 text-fuchsia-500', icon: Palmtree },
 [WorkStatus.SICK]: { color: 'bg-red-500/10 text-red-500', icon: Thermometer },
 [WorkStatus.PARENTAL_LEAVE]: { color: 'bg-indigo-500/10 text-indigo-500', icon: Crib },
 [WorkStatus.PENDING]: { color: 'bg-on-surface-variant/10 text-on-surface-variant', icon: null },
 [WorkStatus.WAITING_LIST]: { color: 'bg-amber-500/10 text-amber-500', icon: null, emoji: '⌛' },
 [WorkStatus.OFFICE_NO_DESK]: { color: 'bg-primary/10 text-primary', icon: Headset },
};

export default function DayCard({ day, onClick, onDoubleClick, onCheckIn, isSimplified: _isSimplified, index, projectTeammates = [], showWeekSeparator, hasMondayInRow }: DayCardProps) {
 const [isVisible, setIsVisible] = useState(false);
 const [isInitialBatch, setIsInitialBatch] = useState(false);
 const [shouldWillChange, setShouldWillChange] = useState(true);
 const containerRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 // Determine if we are in the initial load phase (first 100ms of card lifecycle)
 const timer = setTimeout(() => {
 // Any card becoming visible after 1s is definitely not initial batch
 }, 1000);
 
 const observer = new IntersectionObserver(
 ([entry]) => {
 if (entry.isIntersecting) {
 // If it's intersecting almost immediately after mount, it's initial batch
 if (performance.now() < 500) {
 setIsInitialBatch(true);
 }
 setIsVisible(true);
 observer.unobserve(entry.target);
 
 // Remove will-change after animation completes (cardStartTime + 320ms + some buffer)
 const delay = (isInitialBatch ? index : (entry.target.classList.contains('dynamic-border-card') ? 0 : (index % 2))) * 60 + 100;
 setTimeout(() => setShouldWillChange(false), delay + 500);
 }
 },
 { threshold: 0.15 }
 );

 if (containerRef.current) {
 observer.observe(containerRef.current);
 }

 return () => {
 observer.disconnect();
 clearTimeout(timer);
 };
 }, []);

 // Stagger logic: initial batch uses index, scroll-in uses row stagger (index % 2)
 const staggerIndex = isInitialBatch ? index : (day.isHighlighted ? 0 : (index % 2));
 // Add 100ms globally to allow the first card's gradient to lead
 const cardStartTime = isVisible ? (staggerIndex * 60) + 100 : 0;
 
 const cardStyle = { 
 '--card-delay': `${cardStartTime}ms`,
 'animationDelay': `${cardStartTime}ms`,
 } as React.CSSProperties;

 const config = statusConfig[day.status] || { color: 'bg-on-surface-variant/10 text-on-surface-variant', icon: null };
 const StatusIcon = config.icon;
 const isFull = day.bookedCount && day.totalCapacity && day.bookedCount >= day.totalCapacity;
 const isClosed = day.isClosed;
 const isOfficeClosed = day.isOfficeClosed;

 const marginClass = hasMondayInRow ? 'mt-8' : '';

 if (day.isHighlighted) {
 return (
 <div ref={containerRef} className={`w-full relative group rounded-[24px] sm:rounded-[28px] overflow-hidden dynamic-border-card mb-2 sm:mb-4 ${marginClass} ${isClosed ? 'opacity-40 pointer-events-none' : 'cursor-pointer'} animate-card-entrance ${isVisible ? 'is-visible' : ''} ${shouldWillChange ? 'will-change' : ''}`} style={{...cardStyle, '--angle-start-delay': `${cardStartTime - 100}ms` } as any} onClick={onClick} onDoubleClick={(!isClosed && !isOfficeClosed) ? onDoubleClick : undefined}>
 {showWeekSeparator && (
 <div className="absolute -top-7 sm:-top-8 left-1 right-0 flex items-center gap-3 z-20 pointer-events-none">
 <span className="font-sans text-[10px] sm:text-[11px] font-bold text-[#AEBECF] tracking-wider uppercase">New week</span>
 <div className="h-[1px] flex-grow opacity-60" style={{background: 'linear-gradient(to right, #aebecf 0%, #aebecf 20%, transparent 70%)'}}/>
 </div>
 )}
 <div className="bg-surface-container-lowest rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 flex flex-col justify-between h-36 sm:h-44 shadow-lg relative z-10">
 <div className="flex justify-between items-start">
 <div className="flex items-center gap-4 animate-content-fade-in" style={{animationDelay: `${cardStartTime + 0}ms`}}>
 <div>
 <span className={`font-headline text-2xl sm:text-3xl font-extrabold block leading-none ${(isClosed || day.isPast) ? 'text-on-surface-variant/40' : 'text-on-surface'}`}>{day.date.split('-')[2]}</span>
 <span className="font-sans text-[9px] sm:text-[11px] text-on-surface-variant uppercase tracking-[0.1em] font-bold block mt-1">{day.dayName}</span>
 </div>
 </div>

 <div className="flex flex-col items-end gap-2">
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2 sm:gap-3">
 {day.status === WorkStatus.PENDING && !isClosed && !day.isPast ? (
 <button className={`font-headline text-[12px] sm:text-[14px] bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-extrabold px-5 sm:px-7 py-2 sm:py-2.5 rounded-full shadow-sm transition-all hover:shadow-md active:scale-95 animate-content-scale-in`} style={{animationDelay: `${cardStartTime + 80}ms`}}>
 Set
 </button>
 ) : !isClosed ? (
 <div className="flex items-center gap-2">
 {day.status === WorkStatus.PENDING && day.isPast && (
 <span className="font-sans text-[10px] sm:text-xs font-bold text-on-surface-variant/40 mr-1 animate-content-fade-in" style={{animationDelay: `${cardStartTime + 50}ms`}}>
 Status not set
 </span>
 )}
 <div className={`${day.isPast ? 'bg-surface-container-high text-on-surface-variant' : config.color} rounded-full w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center shadow-sm animate-content-fade-in`} style={{animationDelay: `${cardStartTime + 60}ms`}}>
 {StatusIcon ? (
 <StatusIcon className="w-4 h-4 sm:w-5 sm:h-5 fill-current"/>
 ) : (
 <span className="text-lg sm:text-xl">{(config as any).emoji || "\u2753"}</span>
 )}
 </div>
 </div>
 ) : null}
 </div>
 
 {!isClosed && <div className="h-8 w-[1px] bg-outline-variant/30 animate-content-fade-in" style={{animationDelay: `${cardStartTime + 40}ms`}}/>}

 <AnimatePresence mode="wait">
 {day.isCheckedIn ? (
 <motion.div key="checked" initial={{scale: 0.2, opacity: 0}} animate={{scale: 1, opacity: 1}} className={`${day.isPast ? 'bg-outline-variant text-on-surface-low' : 'bg-primary text-white'} rounded-full w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center shadow-md font-extrabold animate-content-scale-in`} style={{animationDelay: `${cardStartTime + 80}ms`}}>
 <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7"/>
 </svg>
 </motion.div>
 ) : (!isClosed && !day.isPast) ? (
 <motion.button key="button" exit={{opacity: 0, scale: 0.8}} onClick={(e) => { e.stopPropagation(); onCheckIn?.(); }}
 className="bg-primary text-white text-[9px] sm:text-[11px] font-bold py-2 sm:py-2.5 px-4 sm:px-5 rounded-full shadow-md hover:opacity-90 active:scale-95 transition-all outline-none animate-content-scale-in"
 style={{ animationDelay: `${cardStartTime + 80}ms` }}
 >
 Say Good Morning
 </motion.button>
 ) : null}
 </AnimatePresence>
 </div>

 {(day.status === WorkStatus.IN_OFFICE || day.status === WorkStatus.OFFICE_NO_DESK) && (
 <div className={`flex items-center gap-1 mt-1 animate-content-fade-in text-[9px] sm:text-[11px] font-bold ${day.isPast ? 'text-on-surface-variant/40' : 'text-primary'} whitespace-nowrap`}>
 {day.status === WorkStatus.OFFICE_NO_DESK || day.room === 'No Desk' ? (
 <Headset className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
 ) : (
 <Monitor className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
 )}
 <span className="">{day.room || (day.status === WorkStatus.OFFICE_NO_DESK ? 'No Desk' : 'Blue Room')}</span>
 {!day.isCheckedIn && (
 <span className="text-on-surface-variant/40 ml-0.5">(planned)</span>
 )}
 </div>
 )}
 </div>
 </div>

 <div className="flex items-end justify-between mt-auto">
 {(!isClosed && !isOfficeClosed) ? (
 <div className="flex items-center gap-3 w-full">
 <div className="flex -space-x-1.5 sm:-space-x-2">
 {(() => {
 let avatarsToDisplay: Array<{initials: string, color: string}> = [];
 
 const limit = 10;
 
 if (projectTeammates.length > 0) {
 // Priority 1: Project Teammates
 avatarsToDisplay = projectTeammates.map(c => ({ initials: c.initials, color: c.color }));
 
 // Priority 2: Fill up to limit if needed
 if (avatarsToDisplay.length < limit) {
 const existingInitials = new Set(avatarsToDisplay.map(a => a.initials));
 for (let i = 0; avatarsToDisplay.length < limit && i < 30; i++) {
 const seed = day.date.split('-').reduce((acc, char) => acc + char.charCodeAt(0), 0) + i + 100;
 const Colleague = COLLEAGUES[seed % COLLEAGUES.length];
 if (!existingInitials.has(Colleague.initials)) {
 avatarsToDisplay.push({ initials: Colleague.initials, color: Colleague.color });
 existingInitials.add(Colleague.initials);
 }
 }
 }
 } else {
 // Old behavior: random or from day data
 avatarsToDisplay = [...(day.colleagueAvatars || [])];
 if (!day.isPast && avatarsToDisplay.length < limit) {
 for (let i = avatarsToDisplay.length; i < limit; i++) {
 const seed = day.date.split('-').reduce((acc, char) => acc + char.charCodeAt(0), 0) + i;
 const Colleague = COLLEAGUES[seed % COLLEAGUES.length];
 avatarsToDisplay.push({ initials: Colleague.initials, color: Colleague.color });
 }
 }
 }

 return avatarsToDisplay.slice(0, limit).map((Colleague, i) => (
 <div key={i} className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-surface-container-lowest shadow-sm flex items-center justify-center text-[8px] sm:text-[9px] font-bold text-white ${Colleague.color} ${day.isPast ? 'grayscale opacity-70' : ''} animate-content-fade-in`} style={{animationDelay: `${cardStartTime + 100 + (i * 25)}ms`}}>
 {Colleague.initials}
 </div>
 ));
 })()}
 </div>
 {!day.isPast && !isOfficeClosed && (
 <div className="flex flex-col items-start gap-1 animate-content-fade-in" style={{animationDelay: `${cardStartTime + 220}ms`}}>
 <span className={`font-headline text-[10px] sm:text-[12px] tracking-tight font-extrabold ${isFull ? 'text-red-500' : 'text-on-surface'}`}>
 {day.bookedCount}/{day.totalCapacity}
 </span>
 <div className="w-10 sm:w-12 h-[1px] bg-surface-container-low rounded-full overflow-hidden">
 <div className={`h-full rounded-full transition-all duration-500 ease-out ${isFull ? 'bg-red-500' : 'bg-outline-variant'}`} style={{width: `${Math.min(100, ((day.bookedCount || 0) / (day.totalCapacity || 1)) * 100)}%`}}/>
 </div>
 </div>
 )}
 </div>
 ) : isClosed ? (
 <div className="flex flex-col animate-content-fade-in" style={{animationDelay: `${cardStartTime + 150}ms`}}>
 <span className="font-headline text-[10px] sm:text-[12px] text-on-surface-variant/40 tracking-widest font-extrabold uppercase">
 No working day
 </span>
 <span className="font-sans text-[9px] sm:text-[10px] text-on-surface-variant/20 font-medium mt-1">
 Office closed
 </span>
 </div>
 ) : (
 <div className="flex flex-col animate-content-fade-in" style={{animationDelay: `${cardStartTime + 150}ms`}}>
 <span className="font-headline text-[10px] sm:text-[12px] text-orange-500 tracking-tight font-extrabold uppercase">
 Office Closed
 </span>
 <span className="font-sans text-[9px] sm:text-[11px] text-orange-500 font-medium mt-1">
 Remote Booking only
 </span>
 </div>
 )}
 
 {(!isClosed && !isOfficeClosed) && (
 <div className="px-2 sm:px-3 py-1 sm:py-1.5 flex items-center justify-center gap-1.5 sm:gap-2 border border-primary/20 rounded-full h-[24px] sm:h-[28px] w-[95px] sm:w-[115px] bg-surface-container-lowest/50 backdrop-blur-sm shadow-sm self-end mb-0.5 animate-content-fade-in" style={{animationDelay: `${cardStartTime + 260}ms`}}>
 <StatusCarousel isCheckedIn={day.isCheckedIn} room={day.room}/>
 </div>
 )}
 </div>
 </div>
 </div>
 );
 }

 return (
 <div ref={containerRef} className={`bg-surface-container-lowest rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col justify-between h-28 sm:h-36 shadow-ambient hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 border border-transparent hover:border-outline-variant/30 relative ${marginClass} ${isClosed ? 'opacity-40 pointer-events-none' : 'cursor-pointer'} animate-card-entrance ${isVisible ? 'is-visible' : ''} ${shouldWillChange ? 'will-change' : ''}`} style={{...cardStyle, animationDelay: `${cardStartTime}ms`}} onClick={onClick} onDoubleClick={(!isClosed && !isOfficeClosed) ? onDoubleClick : undefined}>
 {showWeekSeparator && (
 <div className="absolute -top-6 left-1 right-0 flex items-center gap-3 z-0 pointer-events-none">
 <span className="font-sans text-[10px] sm:text-[11px] font-bold text-[#AEBECF] tracking-wider uppercase shrink-0">New week</span>
 <div className="h-[1px] flex-grow opacity-30" style={{background: 'linear-gradient(to right, #aebecf 0%, #aebecf 20%, transparent 70%)'}}></div>
 </div>
 )}
 <div className="flex justify-between items-start gap-3">
 <div className="animate-content-fade-in relative min-w-0 flex-1" style={{animationDelay: `${cardStartTime + 0}ms`}}>
 <span className={`font-headline text-2xl sm:text-[30px] font-bold block leading-none ${(isClosed || day.isPast) ? 'text-on-surface-variant/40' : 'text-on-surface'}`}>{day.date.split('-')[2]}</span>
 <span className={`font-sans text-[10px] uppercase tracking-widest font-bold block mt-1.5 ${(isClosed || day.isPast) ? 'text-on-surface-variant/30' : 'text-on-surface-variant'}`}>{day.dayName}</span>
 {(day.status === WorkStatus.IN_OFFICE || day.status === WorkStatus.OFFICE_NO_DESK) && (
 <div className={`flex items-center gap-1 mt-1.5 animate-content-fade-in text-[9px] sm:text-[11px] font-bold ${day.isPast ? 'text-on-surface-variant/40' : 'text-primary'} whitespace-nowrap`}>
 <div className="flex-shrink-0">
 {day.status === WorkStatus.OFFICE_NO_DESK || day.room === 'No Desk' ? (
 <Headset className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
 ) : (
 <Monitor className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
 )}
 </div>
 <span className="">{day.room || (day.status === WorkStatus.OFFICE_NO_DESK ? 'No Desk' : 'Blue Room')}</span>
 {!day.isCheckedIn && (
 <span className="text-on-surface-variant/40 ml-0.5 whitespace-nowrap">(planned)</span>
 )}
 </div>
 )}
 </div>
 <div className="flex flex-col items-end gap-1.5 animate-content-fade-in flex-shrink-0" style={{animationDelay: `${cardStartTime + 60}ms`}}>
 {day.status === WorkStatus.PENDING && !isClosed && !day.isPast ? (
 <div className="flex gap-1 items-center">
 {day.offTime && (
 <div className="bg-surface-container text-on-surface-variant rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center shadow-sm">
 {day.offTime.type === OffTimeType.MORNING ? <Sunrise className="w-3 h-3 sm:w-4 sm:h-4"/> :
 day.offTime.type === OffTimeType.AFTERNOON ? <Sunset className="w-3 h-3 sm:w-4 sm:h-4"/> :
 <Clock className="w-3 h-3 sm:w-4 sm:h-4"/>}
 </div>
 )}
 <button className="bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-extrabold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-sm transition-all hover:shadow-md active:scale-95 text-[10px] sm:text-[12px] uppercase">
 Set
 </button>
 </div>
 ) : !isClosed ? (
 <div className="flex flex-col items-end gap-1.5">
 <div className="flex gap-2 items-center">
 {day.offTime && (
 <div className="bg-surface-container-high text-on-surface-variant rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center shadow-sm">
 {day.offTime.type === OffTimeType.MORNING ? <Sunrise className="w-3 h-3 sm:w-4 sm:h-4"/> :
 day.offTime.type === OffTimeType.AFTERNOON ? <Sunset className="w-3 h-3 sm:w-4 sm:h-4"/> :
 <Clock className="w-3 h-3 sm:w-4 sm:h-4"/>}
 </div>
 )}
 {day.status === WorkStatus.PENDING && day.isPast && (
 <span className="font-sans text-[10px] font-bold text-on-surface-variant/40 leading-none mr-0.5 animate-content-fade-in" style={{animationDelay: `${cardStartTime + 50}ms`}}>Status not set</span>
 )}
 <div className={`${day.isPast ? 'bg-surface-container-high text-on-surface-variant' : config.color} rounded-full w-[30px] h-[30px] flex items-center justify-center shadow-sm shrink-0 animate-content-fade-in`} style={{animationDelay: `${cardStartTime + 60}ms`}}>
 {StatusIcon ? (
 <StatusIcon className="w-[14px] h-[14px] fill-current"/>
 ) : (
 <span className="text-[10px] sm:text-sm">{(config as any).emoji || "\u2753"}</span>
 )}
 </div>
 {day.isCheckedIn && (
 <div className={`${day.isPast ? 'bg-surface-container-high text-on-surface-low' : 'bg-primary text-white'} p-0.5 rounded-full shadow-sm`}>
 <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7"/>
 </svg>
 </div>
 )}
 </div>
 </div>
 ) : null}
 </div>
 </div>

 <div className="mt-auto">
 {(!isClosed && !isOfficeClosed) ? (
 <div className="flex items-center justify-between w-full pt-1.5 sm:pt-2">
 <div className="flex -space-x-2 sm:space-x-[-7px]">
 {(() => {
 let avatarsToDisplay: Array<{initials: string, color: string}> = [];
 
 if (projectTeammates.length > 0) {
 // Priority 1: Project Teammates
 avatarsToDisplay = projectTeammates.map(c => ({ initials: c.initials, color: c.color }));
 
 // Priority 2: Fill up to 5 if needed
 if (avatarsToDisplay.length < 5) {
 const existingInitials = new Set(avatarsToDisplay.map(a => a.initials));
 for (let i = 0; avatarsToDisplay.length < 5 && i < 20; i++) {
 const seed = day.date.split('-').reduce((acc, char) => acc + char.charCodeAt(0), 0) + i + 100;
 const Colleague = COLLEAGUES[seed % COLLEAGUES.length];
 if (!existingInitials.has(Colleague.initials)) {
 avatarsToDisplay.push({ initials: Colleague.initials, color: Colleague.color });
 existingInitials.add(Colleague.initials);
 }
 }
 }
 } else {
 // Old behavior: random or from day data
 avatarsToDisplay = [...(day.colleagueAvatars || [])];
 if (!day.isPast && avatarsToDisplay.length < 5) {
 for (let i = avatarsToDisplay.length; i < 5; i++) {
 const seed = day.date.split('-').reduce((acc, char) => acc + char.charCodeAt(0), 0) + i;
 const Colleague = COLLEAGUES[seed % COLLEAGUES.length];
 avatarsToDisplay.push({ initials: Colleague.initials, color: Colleague.color });
 }
 }
 }

 return avatarsToDisplay.slice(0, 5).map((Colleague, i) => (
 <div key={i} className={`w-[20px] h-[20px] sm:w-[26px] sm:h-[26px] rounded-full border-2 border-surface-container-lowest overflow-hidden flex-shrink-0 flex items-center justify-center text-[7px] sm:text-[9px] font-bold text-white shadow-sm ${Colleague.color} ${day.isPast ? 'grayscale opacity-70' : ''} animate-content-fade-in`} style={{animationDelay: `${cardStartTime + 100 + (i * 25)}ms`}}>
 {Colleague.initials}
 </div>
 ));
 })()}
 </div>
 
 {!day.isPast && !isOfficeClosed && (
 <div className="flex flex-col items-end gap-0.5 sm:gap-1 flex-shrink-0 pl-1 animate-content-fade-in" style={{animationDelay: `${cardStartTime + 220}ms`}}>
 <span className={`font-sans text-[11px] sm:text-[13px] font-bold leading-none ${isFull ? 'text-red-500' : 'text-on-surface'}`}>
 {day.bookedCount}/{day.totalCapacity}
 </span>
 <div className="w-8 sm:w-11 h-[2px] sm:h-[3px] bg-[#F1F1F1] rounded-full overflow-hidden">
 <div className={`h-full rounded-full transition-all duration-500 ease-out ${isFull ? 'bg-red-500' : 'bg-[#d1d5db]'}`} style={{width: `${Math.min(100, ((day.bookedCount || 0) / (day.totalCapacity || 1)) * 100)}%`}}/>
 </div>
 </div>
 )}
 </div>
 ) : isClosed ? (
 <div className="flex flex-col animate-content-fade-in" style={{animationDelay: `${cardStartTime + 150}ms`}}>
 <span className="font-headline text-[8px] sm:text-[10px] text-on-surface-variant/40 font-extrabold tracking-widest uppercase">
 No working day
 </span>
 <span className="font-sans text-[8px] sm:text-[9px] text-on-surface-variant/30 font-medium mt-0.5">
 Office closed
 </span>
 </div>
 ) : (
 <div className="flex flex-col animate-content-fade-in" style={{animationDelay: `${cardStartTime + 150}ms`}}>
 <span className="font-headline text-[8px] sm:text-[10px] text-orange-500 font-extrabold tracking-tight uppercase leading-tight">
 Office Closed
 </span>
 <span className="font-sans text-[8px] sm:text-[9px] text-orange-500 font-medium mt-0.5">
 Remote Booking only
 </span>
 </div>
 )}
 </div>
 </div>
 );
}

function StatusCarousel({ isCheckedIn, room: _room }: { isCheckedIn?: boolean, room?: string }) {
 const baseNames = ["Linda N. \u2600\uFE0F", "Giuseppe F. \u2600\uFE0F"];
 const names = isCheckedIn ? [...baseNames, "Roberto V. \u2600\uFE0F"] : baseNames;
 const [index, setIndex] = useState(0);

 useEffect(() => {
 const timer = setInterval(() => {
 setIndex((i) => (i + 1) % names.length);
 }, 3000);
 return () => clearInterval(timer);
 }, [names.length]);

 return (
 <AnimatePresence mode="wait">
 <motion.span key={index} initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: -20, opacity: 0}} transition={{duration: 0.5, ease: "easeInOut"}} className="text-[10px] font-bold text-primary whitespace-nowrap">
 {names[index]}
 </motion.span>
 </AnimatePresence>
 );
}
