import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { WorkStatus, DayPresence, OffTimeType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CalendarX, AlertTriangle, ChevronDown, Users, Info, Settings } from 'lucide-react';
import { Alert } from './Alert';
import { Colleague } from '../constants/colleagues';
import { useAuth } from '../context/AuthContext';
import { getStatsMonthly, getStatsAnnual, getPresence } from '../services/api';
import type { MonthlyStats, AnnualStats } from '../services/api';
import { months, shortMonths } from '../utils/dateUtils';

interface StatsProps {
 days: DayPresence[];
 currentMonth?: string;
 projectTeammates?: Colleague[];
 onAddTeammates?: () => void;
}

const statusColors: Record<string, string> = {
 [WorkStatus.IN_OFFICE]: '#36A9C2',
 [WorkStatus.REMOTE]: '#4ADE80',
 [WorkStatus.MISSION]: '#FB923C',
 [WorkStatus.LEAVE]: '#E879F9',
 [WorkStatus.SICK]: '#F87171',
 [WorkStatus.PARENTAL_LEAVE]: '#6366F1',
 [WorkStatus.PENDING]: '#CBD5E1',
 [WorkStatus.WAITING_LIST]: '#FBBF24',
};


function monthLabelToKey(label: string): string {
 const parts = label.split(' ');
 const idx = months.indexOf(parts[0]);
 return `${parts[1]}-${String(idx + 1).padStart(2, '0')}`;
}

export default function Stats({ currentMonth, projectTeammates = [], onAddTeammates }: Omit<StatsProps, 'days'> & { days?: DayPresence[] }) {
 const { user } = useAuth();
 const isDirectorOrOwner = user?.role === 'director' || user?.role === 'owner';

 const defaultMonth = currentMonth || `${months[new Date().getMonth()]} ${new Date().getFullYear()}`;

 const historicalMonths = useMemo(() => {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
   const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
   result.push(`${months[d.getMonth()]} ${d.getFullYear()}`);
  }
  return result;
 }, []);

 const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
 const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
 const [isDropdownOpen, setIsDropdownOpen] = useState(false);
 const [showTooltip, setShowTooltip] = useState(false);
 const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
 const [annualStats, setAnnualStats] = useState<AnnualStats | null>(null);
 const [presenceDays, setPresenceDays] = useState<DayPresence[]>([]);

 useEffect(() => {
  if (view !== 'monthly') return;
  const key = monthLabelToKey(selectedMonth);
  getStatsMonthly(key).then(setMonthlyStats).catch((err) => { console.error('Stats: failed to load monthly stats', err); setMonthlyStats(null); });
  getPresence(key).then(setPresenceDays).catch(() => setPresenceDays([]));
 }, [selectedMonth, view]);

 useEffect(() => {
  if (view !== 'yearly') return;
  const year = parseInt(selectedMonth.split(' ')[1]) || new Date().getFullYear();
  getStatsAnnual(year).then(setAnnualStats).catch((err) => { console.error('Stats: failed to load annual stats', err); setAnnualStats(null); });
 }, [view, selectedMonth]);

 const inOfficeDays = monthlyStats?.presenceDaysConfirmed ?? 0;
 const targetDays = monthlyStats?.presenceDaysTarget ?? user?.contract?.presenceDaysTarget ?? 10;
 const progress = targetDays > 0 ? Math.min((inOfficeDays / targetDays) * 100, 100) : 0;

 const chartData = monthlyStats ? [
  { name: 'Office', count: monthlyStats.distribution.inOffice, status: WorkStatus.IN_OFFICE },
  { name: 'Remote', count: monthlyStats.distribution.remote, status: WorkStatus.REMOTE },
  { name: 'Mission', count: monthlyStats.distribution.mission, status: WorkStatus.MISSION },
  { name: 'Leave', count: monthlyStats.distribution.leave, status: WorkStatus.LEAVE },
  { name: 'Sick', count: monthlyStats.distribution.sick, status: WorkStatus.SICK },
 ].filter(item => item.count > 0) : [];

 const yearlyData = annualStats ? annualStats.monthlyBreakdown.map(m => ({
  name: shortMonths[parseInt(m.month.split('-')[1]) - 1],
  count: m.presenceDaysConfirmed,
 })) : [];

 const averagePresence = annualStats?.averageMonthlyPresenceDays ?? 0;

 return (
 <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} className="flex flex-col gap-6 pb-32 pt-8">
 <header className="flex flex-col gap-6">
 <div className="flex justify-between items-center px-1">
 <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
 My stats
 </h2>
 <div className="flex p-1 bg-surface-container-low rounded-2xl border border-outline-variant/10">
 <button onClick={() => setView('monthly')}
 className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${view === 'monthly' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
 >
 Monthly
 </button>
 <button onClick={() => setView('yearly')}
 className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${view === 'yearly' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
 >
 Yearly
 </button>
 </div>
 </div>
 <div className="flex justify-between items-center relative">
 {view === 'monthly' ? (
 <div className="flex items-center gap-2 -mt-4">
 <span className="font-sans text-on-surface-variant text-sm">Overview of</span>
 <div className="relative">
 <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}
 className="flex items-center gap-1 px-3 py-1 bg-surface-container-low rounded-xl border border-outline-variant/10 text-primary font-bold text-sm transition-all hover:bg-surface-container-high"
 >
 {selectedMonth}
 <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}/>
 </button>
 
 <AnimatePresence>
 {isDropdownOpen && (
 <>
 <div className="fixed inset-0 z-30" onClick={() => setIsDropdownOpen(false)} 
 />
 <motion.div initial={{opacity: 0, scale: 0.95, y: 10}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.95, y: 10}} className="absolute left-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xl z-40 py-2 overflow-hidden">
 {historicalMonths.map((month) => (
 <button key={month} onClick={() => {
 setSelectedMonth(month);
 setIsDropdownOpen(false);
 }}
 className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
 month === selectedMonth
 ? 'bg-primary/10 text-primary font-bold'
 : 'text-on-surface hover:bg-surface-container-high'
 }`}
 >
 {month}
 </button>
 ))}
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 </div>
 ) : (
 <p className="font-sans text-on-surface-variant text-sm -mt-4">Year {selectedMonth.split(' ')[1]} Summary</p>
 )}
 </div>
 </header>

 <AnimatePresence mode="wait">
 {view === 'monthly' ? (
 <motion.div key="monthly" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: 20}} transition={{duration: 0.2}} className="flex flex-col gap-8">
 {/* Warning Alert */}
 <Alert icon={AlertCircle} title="Timesheet Warning" description="Your Working Status stats are fed into your timesheet. Remember to update your planning daily!" className="shadow-sm"/>

 {/* Progress Section */}
 <section className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-outline-variant/10">
 <div className="flex justify-between items-end mb-4">
 <div>
 <h3 className="font-headline text-sm font-bold text-on-surface-variant uppercase tracking-wider">Presence Target</h3>
 <p className="font-headline text-4xl font-extrabold text-primary mt-1">
 {inOfficeDays} <span className="text-sm text-on-surface-variant font-medium">/ {targetDays} days</span>
 </p>
 </div>
 <div className="text-right">
 <span className="font-headline text-2xl font-extrabold text-primary">{Math.round(progress)}%</span>
 </div>
 </div>
 
 <div className="h-4 bg-surface-container rounded-full overflow-hidden">
 <motion.div initial={{width: 0}} animate={{width: `${progress}%`}} transition={{duration: 1, ease: "easeOut"}} className="h-full bg-primary rounded-full shadow-[0_0_12px_rgba(54,169,194,0.4)]"/>
 </div>
 <p className="font-sans text-[10px] text-on-surface-variant mt-3 leading-relaxed">
 {inOfficeDays < targetDays 
 ? `You need ${targetDays - inOfficeDays} more "presence days" to reach your monthly goal.`
 : "Congratulations! You've reached your monthly office target."}
 </p>
 </section>

 {/* Teammates co-presence Section */}
 <section className="flex flex-col gap-4">
 {projectTeammates.length === 0 ? (
 <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-outline-variant/10 flex flex-col items-center text-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-on-surface/5 flex items-center justify-center">
 <Users className="w-6 h-6 text-on-surface-variant/40"/>
 </div>
 <div>
 <h4 className="font-bold text-on-surface text-sm">Teammates co-presence</h4>
 <p className="text-[10px] text-on-surface-variant mt-1 px-4">Add teammates to track your office overlap and coordinate your presence.</p>
 </div>
 <button onClick={onAddTeammates} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-all active:scale-95">
 <Settings className="w-4 h-4"/>
 Manage teammates
 </button>
 </div>
 ) : (
 <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-outline-variant/10">
 <div className="flex flex-col">
 <div className="flex items-center gap-1.5 relative">
 <h3 className="font-headline text-sm font-bold text-on-surface-variant uppercase tracking-wider">Teammates co-presence</h3>
 <button onMouseEnter={() => setShowTooltip(true)}
 onMouseLeave={() => setShowTooltip(false)}
 onClick={() => setShowTooltip(!showTooltip)}
 className="p-0.5 hover:bg-on-surface/5 rounded-full transition-colors"
 >
 <Info className="w-3 h-3 text-on-surface-variant/40"/>
 </button>
 
 <AnimatePresence>
 {showTooltip && (
 <motion.div initial={{opacity: 0, y: 5}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 5}} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-on-surface text-surface text-[9px] font-medium rounded-lg shadow-xl z-50 text-center">
 How many of your declared teammates were also in the office on the days you came in this month.
 <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-on-surface"/>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 <p className="font-headline text-4xl font-extrabold text-primary mt-1">
 2.1 <span className="text-sm text-on-surface-variant font-medium">avg teammates present on your {inOfficeDays} office days</span>
 </p>
 </div>
 </div>
 )}
 </section>

 {/* distribution Section */}
 <section className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-outline-variant/10">
 <h3 className="font-headline text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-6 flex items-baseline gap-2">
 Days Distribution <span className="text-[10px] font-medium opacity-40 lowercase font-sans">(Confirmed)</span>
 </h3>
 
 <div className="h-64 w-full">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={chartData} margin={{top: 0, right: 0, left: -25, bottom: 0}}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.2}/>
 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'currentcolor', fontSize: 10, fontWeight: 600, opacity: 0.4}} dy={10} className="text-on-surface"/>
 <YAxis axisLine={false} tickLine={false} tick={{fill: 'currentcolor', fontSize: 10, fontWeight: 600, opacity: 0.4}} className="text-on-surface"/>
 <Tooltip cursor={{fill: 'var(--surface-container)', opacity: 0.4}} contentStyle={{borderRadius: '16px', border: '1px solid var(--outline-variant)', backgroundColor: 'var(--surface-container-lowest)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px'}} itemStyle={{fontFamily: 'inter, sans-serif', fontSize: '12px', fontWeight: 'bold', color: 'var(--on-surface)'}} labelStyle={{display: 'none'}}/>
 <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
 {chartData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={statusColors[entry.status]}/>
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>

 <div className="grid grid-cols-2 gap-3 mt-8">
 {chartData.map((item) => (
 <div key={item.name} className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low/50">
 <div className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor: statusColors[item.status]}}/>
 <div className="flex flex-col">
 <span className="font-sans text-[10px] text-on-surface-variant font-bold uppercase tracking-wide leading-none">{item.name}</span>
 <span className="font-headline text-sm font-extrabold text-on-surface mt-0.5">{item.count} days</span>
 </div>
 </div>
 ))}
 </div>
 </section>

 {/* Permesso ore Section */}
 {(() => {
  const mornings = presenceDays.filter(d => d.offTime?.type === OffTimeType.MORNING).length;
  const afternoons = presenceDays.filter(d => d.offTime?.type === OffTimeType.AFTERNOON).length;
  const customHours = presenceDays.filter(d => d.offTime?.type === OffTimeType.CUSTOM).reduce((sum, d) => sum + (d.offTime?.hours ?? 0), 0);
  const hasAny = mornings > 0 || afternoons > 0 || customHours > 0;
  if (!hasAny) return null;
  return (
  <section className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-outline-variant/10">
  <h3 className="font-headline text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4">Hours Off</h3>
  <div className="grid grid-cols-2 gap-3">
  {mornings > 0 && (
  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex flex-col gap-1">
  <span className="font-sans text-[10px] text-amber-700 font-bold uppercase tracking-wide">Mornings</span>
  <span className="font-headline text-3xl font-extrabold text-amber-600">{mornings}</span>
  </div>
  )}
  {afternoons > 0 && (
  <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex flex-col gap-1">
  <span className="font-sans text-[10px] text-orange-700 font-bold uppercase tracking-wide">Afternoons</span>
  <span className="font-headline text-3xl font-extrabold text-orange-600">{afternoons}</span>
  </div>
  )}
  {customHours > 0 && (
  <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl flex flex-col gap-1">
  <span className="font-sans text-[10px] text-purple-700 font-bold uppercase tracking-wide">Custom hrs</span>
  <span className="font-headline text-3xl font-extrabold text-purple-600">{customHours}h</span>
  </div>
  )}
  </div>
  </section>
  );
 })()}

 {/* Unbookings Section */}
 <section className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-outline-variant/10">
 <h3 className="font-headline text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-6">Booking Changes</h3>
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-surface-container-low/50 p-4 rounded-2xl border border-outline-variant/10 flex flex-col gap-3">
 <div className="w-8 h-8 rounded-xl bg-on-surface/5 flex items-center justify-center">
 <CalendarX className="w-4 h-4 text-on-surface-variant"/>
 </div>
 <div>
 <p className="font-headline text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Unbookings</p>
 <span className="font-headline text-3xl font-extrabold text-on-surface">{monthlyStats?.unbooking.standard ?? 0}</span>
 </div>
 </div>
 <div className="bg-warning-bg p-4 rounded-2xl border border-warning-stroke flex flex-col gap-3">
 <div className="w-8 h-8 rounded-xl bg-on-surface/5 flex items-center justify-center">
 <AlertTriangle className="w-4 h-4 text-warning-text"/>
 </div>
 <div>
 <p className="font-headline text-[10px] font-bold text-warning-text/80 uppercase tracking-wider mb-1">Last-minute</p>
 <span className="font-headline text-3xl font-extrabold text-warning-text">{monthlyStats?.unbooking.lastMinute ?? 0}</span>
 </div>
 </div>
 </div>
 <p className="font-sans text-[10px] text-warning-secondary mt-4 leading-relaxed italic opacity-70">
 * Last-minute: changes made 1 day or less before the date.
 </p>
 </section>
 </motion.div>
 ) : (
 <motion.div key="yearly" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}} transition={{duration: 0.2}} className="flex flex-col gap-8">
 {/* Average Section */}
 <section className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-outline-variant/10">
 <h3 className="font-headline text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Yearly Presence Average</h3>
 <div className="flex items-baseline gap-2">
 <span className="font-headline text-5xl font-extrabold text-primary">{averagePresence.toFixed(1)}</span>
 <span className="text-on-surface-variant font-medium">days / month</span>
 </div>
 <p className="font-sans text-[10px] text-on-surface-variant mt-4 leading-relaxed">
 Calculated across completed months of {selectedMonth.split(' ')[1]}.
 </p>
 {isDirectorOrOwner && (
 <p className="font-sans text-[10px] text-primary/70 mt-2 leading-relaxed italic">
 Dati aggregati area disponibili nella prossima release.
 </p>
 )}
 </section>

 {/* Yearly Bar Chart Section */}
 <section className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-outline-variant/10">
 <h3 className="font-headline text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-6">Monthly Presence</h3>
 
 <div className="h-64 w-full">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={yearlyData} margin={{top: 0, right: 0, left: -25, bottom: 0}}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.2}/>
 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'currentcolor', fontSize: 10, fontWeight: 600, opacity: 0.4}} dy={10} className="text-on-surface"/>
 <YAxis axisLine={false} tickLine={false} tick={{fill: 'currentcolor', fontSize: 10, fontWeight: 600, opacity: 0.4}} className="text-on-surface"/>
 <Tooltip cursor={{fill: 'var(--surface-container)', opacity: 0.4}} contentStyle={{borderRadius: '16px', border: '1px solid var(--outline-variant)', backgroundColor: 'var(--surface-container-lowest)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px'}} itemStyle={{fontFamily: 'inter, sans-serif', fontSize: '12px', fontWeight: 'bold', color: 'var(--on-surface)'}} labelStyle={{display: 'none'}}/>
 <ReferenceLine y={averagePresence} stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5"/>
 <Bar dataKey="count" fill="#36A9C2" radius={[6, 6, 0, 0]} barSize={24}/>
 </BarChart>
 </ResponsiveContainer>
 </div>

 <div className="mt-8 flex items-center gap-3">
 <div className="flex items-center gap-2">
 <div className="flex gap-1">
 <div className="w-1.5 h-0.5 bg-error rounded-full"/>
 <div className="w-1.5 h-0.5 bg-error rounded-full"/>
 <div className="w-1.5 h-0.5 bg-error rounded-full"/>
 </div>
 <span className="text-[10px] font-medium text-on-surface-variant">Average number of Presence Days</span>
 </div>
 </div>
 </section>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
}
