import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
 Users,
 AlertCircle,
 ChevronDown,
 User,
 Search
} from 'lucide-react';
import {
 BarChart,
 Bar,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 ResponsiveContainer,
 Cell,
 Legend
} from 'recharts';
import { DayPresence } from '../types';
import { getStatsArea, getStatsByUser, getUsers, type AreaStats, type MonthlyStats } from '../services/api';
import { mapUserToColleague } from '../hooks/useColleagues';
import type { Colleague } from '../constants/colleagues';

interface OrganisationProps {
 days?: DayPresence[];
 activeMonth?: string;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function buildHistoricalMonths(): string[] {
 const months: string[] = [];
 const now = new Date();
 for (let i = 0; i < 12; i++) {
 const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
 months.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
 }
 return months;
}

function monthToYYYYMM(displayMonth: string): string {
 const [monthName, year] = displayMonth.split(' ');
 const monthNum = MONTH_NAMES.indexOf(monthName) + 1;
 return `${year}-${String(monthNum).padStart(2, '0')}`;
}

function formatAdherence(stats: AreaStats | null): string {
 if (!stats || stats.totalUsers === 0) return '–';
 return `${Math.round((stats.usersAboveTarget / stats.totalUsers) * 100)}%`;
}

const historicalMonths = buildHistoricalMonths();
const currentMonthDisplay = historicalMonths[0];

export default function Organisation({ days: _days = [], activeMonth }: OrganisationProps) {
 const [view, setView] = useState<'aggregated' | 'individual'>('aggregated');
 const [selectedColleague, setSelectedColleague] = useState<Colleague | null>(null);
 const [isColleagueDropdownOpen, setIsColleagueDropdownOpen] = useState(false);
 const [colleagueSearch, setColleagueSearch] = useState('');
 const [selectedMonth, setSelectedMonth] = useState(activeMonth ?? historicalMonths[0]);
 const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
 const [trendWindow, setTrendWindow] = useState('12m');
 const [trendData, setTrendData] = useState<Array<{month: string; adherence: number; isCurrent?: boolean}>>([]);
 const [selectedMonthStats, setSelectedMonthStats] = useState<AreaStats | null>(null);
 const [colleagueStats, setColleagueStats] = useState<MonthlyStats | null>(null);
 const [colleagueStatsLoading, setColleagueStatsLoading] = useState(false);

 const [colleagues, setColleagues] = useState<Colleague[]>([]);
 const [colleaguesLoading, setColleaguesLoading] = useState(false);

 useEffect(() => {
   if (!isColleagueDropdownOpen || colleagues.length > 0) return;
   setColleaguesLoading(true);
   getUsers()
     .then(users => {
       if (!Array.isArray(users)) throw new Error(`Expected array, got ${typeof users}`);
       setColleagues(users.map(mapUserToColleague));
     })
     .catch((err) => console.error('Organisation: failed to load colleagues', err))
     .finally(() => setColleaguesLoading(false));
 }, [isColleagueDropdownOpen]);

 const filteredColleagues = colleagueSearch
   ? colleagues.filter(c => `${c.name} ${c.surname}`.toLowerCase().includes(colleagueSearch.toLowerCase()))
   : colleagues;

 // Fetch 12-month trend on mount
 useEffect(() => {
 const reversed = [...historicalMonths].reverse();
 Promise.all(
 reversed.map(m => getStatsArea(monthToYYYYMM(m)).catch(() => null))
 ).then(results => {
 setTrendData(
 reversed.map((m, i) => {
 const s = results[i];
 const adherence = s && s.totalUsers > 0
 ? Math.round((s.usersAboveTarget / s.totalUsers) * 100)
 : 0;
 return { month: m.substring(0, 3) + ' ' + m.split(' ')[1].slice(2), adherence, isCurrent: m === currentMonthDisplay };
 })
 );
 });
 }, []);

 // Fetch stats for selected month
 useEffect(() => {
 setSelectedMonthStats(null);
 getStatsArea(monthToYYYYMM(selectedMonth)).then(setSelectedMonthStats).catch((err) => console.error('Organisation: failed to load area stats', err));
 }, [selectedMonth]);

 // Fetch stats for selected colleague
 useEffect(() => {
 if (!selectedColleague) { setColleagueStats(null); return; }
 setColleagueStatsLoading(true);
 setColleagueStats(null);
 getStatsByUser(selectedColleague.id, monthToYYYYMM(selectedMonth))
 .then(s => { setColleagueStats(s); setColleagueStatsLoading(false); })
 .catch(() => setColleagueStatsLoading(false));
 }, [selectedColleague, selectedMonth]);

 const isCurrentMonth = selectedMonth === currentMonthDisplay;

 return (
 <div className="flex flex-col gap-6 sm:gap-8 pb-10 pt-16">
 {/* Header Section with Tabs */}
 <section className="flex flex-col gap-6">
 <div className="flex items-center justify-between gap-4 px-1">
 <h1 className="font-headline text-2xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
 Org. stats
 </h1>
 <div className="flex p-1 bg-surface-container-low rounded-2xl border border-outline-variant/10 shrink-0 shadow-sm">
 <button data-testid="org-view-aggregated" onClick={() => setView('aggregated')}
 className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${view === 'aggregated' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
 >
 Aggregated
 </button>
 <button data-testid="org-view-individual" onClick={() => setView('individual')}
 className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${view === 'individual' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
 >
 Individual
 </button>
 </div>
 </div>
 {view === 'aggregated' && (
 <div className="flex items-center gap-2 -mt-2">
 <span className="font-sans text-on-surface-variant text-sm">Overview of</span>
 <div className="relative">
 <button data-testid="org-month-select" onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
 className="flex items-center gap-1 px-3 py-1 bg-surface-container-low rounded-xl border border-outline-variant/10 text-primary font-bold text-sm transition-all hover:bg-surface-container-high"
 >
 {selectedMonth}
 <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMonthDropdownOpen ? 'rotate-180' : ''}`}/>
 </button>

 <AnimatePresence>
 {isMonthDropdownOpen && (
 <>
 <div className="fixed inset-0 z-30" onClick={() => setIsMonthDropdownOpen(false)} />
 <motion.div initial={{opacity: 0, scale: 0.95, y: 10}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.95, y: 10}} className="absolute left-0 mt-2 w-64 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xl z-40 py-2 overflow-hidden">
 {historicalMonths.map((month) => (
 <button key={month} onClick={() => { setSelectedMonth(month); setIsMonthDropdownOpen(false); }}
 className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
 month === selectedMonth ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface hover:bg-surface-container-high'
 }`}
 >
 <span>{month}</span>
 {month === currentMonthDisplay ? (
 <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">Still in progress</span>
 ) : selectedMonthStats && month === selectedMonth ? (
 <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">{formatAdherence(selectedMonthStats)} adherence</span>
 ) : null}
 </button>
 ))}
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 </div>
 )}
 </section>

 <AnimatePresence mode="wait">
 {view === 'aggregated' ? (
 <motion.div key="aggregated" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: 20}} transition={{duration: 0.3}} className="flex flex-col gap-6 sm:gap-8">
 {/* Partial Data Banner for current month */}
 {isCurrentMonth && (
 <motion.div initial={{opacity: 0, y: -10}} animate={{opacity: 1, y: 0}} className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
 <AlertCircle className="w-4 h-4 text-primary"/>
 </div>
 <div className="flex flex-col">
 <p className="text-xs font-bold text-primary uppercase tracking-widest leading-none mb-1">In-progress data</p>
 <p className="text-[11px] text-on-surface-variant/70 font-medium leading-tight">These statistics are partial and calculated up to the current day.</p>
 </div>
 </motion.div>
 )}

 {/* KPI Cards Grid */}
 <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <KPICard
 title="Adherence Rate"
 value={formatAdherence(selectedMonthStats)}
 description="Users that met their presence target this month"
 secondaryDescription={selectedMonthStats ? <>{selectedMonthStats.usersAboveTarget} of {selectedMonthStats.totalUsers} employees</> : undefined}
 />
 <KPICard
 title="Avg. office days / month"
 value={selectedMonthStats ? selectedMonthStats.avgPresenceDaysConfirmed.toFixed(1) : '–'}
 description="Confirmed in-office days per person"
 />
 <KPICard
 title="Last-minute unbooking"
 value={selectedMonthStats ? String(selectedMonthStats.totalUnbooking.lastMinute) : '–'}
 description="Cancellations ≤ 24h before the day"
 />
 <KPICard
 title="Avg. office co-presence"
 value="–"
 description="Data not yet available"
 />
 </section>

 {/* Higher temporal window Section */}
 <div className="flex items-center gap-4 py-4">
 <h2 className="font-headline text-xs font-black text-on-surface-variant/40 uppercase tracking-[0.2em] shrink-0">Higher temporal window</h2>
 <div className="h-[1px] flex-grow bg-outline-variant/20"/>
 </div>

 {/* 12-Month Trend Chart */}
 <section className="bg-surface-container-lowest rounded-[32px] p-6 sm:p-8 shadow-ambient border border-outline-variant/5">
 <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
 <div className="flex flex-col gap-1">
 <h2 className="font-headline text-xl font-bold text-on-surface tracking-tight">12-Month Trend</h2>
 <p className="text-xs text-on-surface-variant opacity-60 font-sans uppercase tracking-widest font-bold">Adherence Rate</p>
 </div>
 <div className="relative">
 <select value={trendWindow} onChange={(e) => setTrendWindow(e.target.value)}
 className="appearance-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer pr-10"
 >
 <option value="12m">Last 12 months</option>
 <option value="6m">Last 6 months</option>
 <option value="3m">Last 3 months</option>
 </select>
 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none"/>
 </div>
 </div>
 {trendData.length === 0 ? (
 <div className="h-[300px] flex items-center justify-center text-on-surface-variant/40 text-sm font-bold">Loading...</div>
 ) : (
 <div className="h-[300px] w-full mt-4">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={trendData.slice(trendWindow === '12m' ? 0 : trendWindow === '6m' ? 6 : 9)} margin={{top: 20, right: 0, left: -20, bottom: 0}}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.2}/>
 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 600}} dy={10}/>
 <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 600}} unit="%"/>
 <Tooltip cursor={{fill: 'var(--surface-container-low)', opacity: 0.4}} contentStyle={{borderRadius: '16px', border: '1px solid var(--outline-variant)', backgroundColor: 'var(--surface-container-lowest)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'}}/>
 <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '24px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em'}}/>
 <Bar name="Adherence Rate" dataKey="adherence" fill="#36A9C2" radius={[4, 4, 0, 0]} barSize={trendWindow === '12m' ? 12 : 20}>
 {trendData.map((entry, index) => (
 <Cell key={`cell-adh-${index}`} fill="#36A9C2" fillOpacity={entry.isCurrent ? 1 : 0.4}/>
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}
 </section>

 {/* Office Presence by Weekday — no backend support */}
 <section className="bg-surface-container-lowest rounded-[32px] p-6 sm:p-8 shadow-ambient border border-outline-variant/5">
 <div className="flex flex-col gap-1 mb-4">
 <h2 className="font-headline text-xl font-bold text-on-surface tracking-tight">Office Presence by Day</h2>
 <p className="text-xs text-on-surface-variant opacity-60 font-sans uppercase tracking-widest font-bold">Weekday Distribution</p>
 </div>
 <div className="flex flex-col items-center justify-center py-10 gap-3">
 <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
 <AlertCircle className="w-5 h-5 text-on-surface-variant/30"/>
 </div>
 <p className="text-sm font-bold text-on-surface-variant/50">Coming soon</p>
 <p className="text-xs text-on-surface-variant/30 text-center max-w-xs">Per-weekday breakdown requires additional backend aggregation.</p>
 </div>
 </section>
 </motion.div>
 ) : (
 <motion.div key="individual" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}} transition={{duration: 0.3}} className="flex flex-col gap-6 sm:gap-8">
 {/* Employee Selector Dropdown */}
 <section className="bg-surface-container-lowest rounded-[32px] p-6 shadow-ambient border border-outline-variant/10">
 <div className="flex flex-col gap-1 mb-4">
 <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest opacity-50">Filter by Employee</h3>
 </div>
 <div className="relative">
 <button data-testid="org-colleague-select" onClick={() => setIsColleagueDropdownOpen(!isColleagueDropdownOpen)}
 className="w-full flex items-center justify-between px-6 py-4 bg-surface-container-low rounded-[24px] border border-outline-variant/10 text-on-surface font-bold transition-all hover:bg-surface-container-high group"
 >
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
 <User className="w-5 h-5 text-primary"/>
 </div>
 <span className={selectedColleague ? "text-on-surface" : "text-on-surface-variant/40"}>
 {selectedColleague ? `${selectedColleague.name} ${selectedColleague.surname}` : "Choose an employee"}
 </span>
 </div>
 <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isColleagueDropdownOpen ? 'rotate-180' : ''}`}/>
 </button>

 <AnimatePresence>
 {isColleagueDropdownOpen && (
 <>
 <div className="fixed inset-0 z-30" onClick={() => setIsColleagueDropdownOpen(false)} />
 <motion.div initial={{opacity: 0, scale: 0.95, y: 10}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.95, y: 10}} className="absolute left-0 right-0 mt-4 max-h-[400px] overflow-y-auto bg-surface-container-lowest border border-outline-variant/20 rounded-[32px] shadow-2xl z-40 py-4 scrollbar-hide">
 <div className="px-6 py-2 mb-2">
 <div className="relative">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40"/>
 <input
 type="text"
 placeholder="Search employees..."
 value={colleagueSearch}
 onChange={e => setColleagueSearch(e.target.value)}
 className="w-full bg-surface-container p-3 pl-10 rounded-2xl border-none text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
 onClick={(e) => e.stopPropagation()}
 />
 </div>
 </div>

 {colleaguesLoading ? (
 <p className="px-6 py-4 text-sm text-on-surface-variant/40 font-bold">Loading…</p>
 ) : filteredColleagues.length === 0 ? (
 <p className="px-6 py-4 text-sm text-on-surface-variant/40 font-bold">No employees found</p>
 ) : filteredColleagues.map((colleague) => (
 <button key={colleague.id} onClick={() => { setSelectedColleague(colleague); setIsColleagueDropdownOpen(false); setColleagueSearch(''); }}
 className={`w-full text-left px-6 py-4 flex items-center gap-3 transition-colors ${
 colleague.id === selectedColleague?.id ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface hover:bg-surface-container-high'
 }`}
 >
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white ${colleague.color}`}>
 {colleague.initials}
 </div>
 <span className="text-sm font-bold">{colleague.name} {colleague.surname}</span>
 </button>
 ))}
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 </section>

 {/* Selection Result */}
 <AnimatePresence mode="wait">
 {!selectedColleague ? (
 <motion.div key="empty" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="flex flex-col items-center justify-center py-20 px-10 text-center bg-surface-container-low/30 rounded-[40px] border border-dashed border-outline-variant/30">
 <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-6">
 <Users className="w-10 h-10 text-on-surface-variant/30"/>
 </div>
 <h3 className="font-headline text-xl font-extrabold text-on-surface mb-2">No employee selected</h3>
 <p className="text-sm text-on-surface-variant/60 font-sans max-w-xs">
 Choose an employee from the list above to view their attendance statistics.
 </p>
 </motion.div>
 ) : colleagueStatsLoading ? (
 <motion.div key="loading" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="flex items-center justify-center py-20">
 <p className="text-sm font-bold text-on-surface-variant/40">Loading...</p>
 </motion.div>
 ) : colleagueStats ? (
 <motion.div key="stats" initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 20}} transition={{duration: 0.4}} className="flex flex-col gap-4">
 <div className="flex items-center gap-3 px-1">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-white ${selectedColleague.color}`}>
 {selectedColleague.initials}
 </div>
 <div>
 <p className="font-bold text-on-surface">{selectedColleague.name} {selectedColleague.surname}</p>
 <p className="text-xs text-on-surface-variant/50 font-bold uppercase tracking-widest">{selectedMonth}</p>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-ambient border border-outline-variant/10 flex flex-col gap-2">
 <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest opacity-50">Office days</span>
 <span className="text-3xl font-headline font-black text-on-surface">{colleagueStats.presenceDaysConfirmed}<span className="text-base text-on-surface-variant/40 font-bold ml-1">/{colleagueStats.presenceDaysTarget}</span></span>
 <span className="text-xs text-on-surface-variant/50">target days this month</span>
 </div>
 <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-ambient border border-outline-variant/10 flex flex-col gap-2">
 <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest opacity-50">Unbooking</span>
 <span className="text-3xl font-headline font-black text-on-surface">{colleagueStats.unbooking.lastMinute}</span>
 <span className="text-xs text-on-surface-variant/50">last-minute cancellations</span>
 </div>
 </div>
 <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-ambient border border-outline-variant/10">
 <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest opacity-50 block mb-4">Month distribution</span>
 <div className="flex flex-col gap-2">
 {([
 { label: 'In Office', value: colleagueStats.distribution.inOffice, color: 'bg-primary' },
 { label: 'Remote', value: colleagueStats.distribution.remote, color: 'bg-green-500' },
 { label: 'Mission', value: colleagueStats.distribution.mission, color: 'bg-orange-500' },
 { label: 'Leave', value: colleagueStats.distribution.leave, color: 'bg-fuchsia-500' },
 { label: 'Sick', value: colleagueStats.distribution.sick, color: 'bg-red-500' },
 ] as const).filter(r => r.value > 0).map(row => (
 <div key={row.label} className="flex items-center gap-3">
 <div className={`w-2 h-2 rounded-full ${row.color} shrink-0`}/>
 <span className="text-sm font-bold text-on-surface flex-1">{row.label}</span>
 <span className="text-sm font-bold text-on-surface-variant">{row.value}d</span>
 </div>
 ))}
 </div>
 </div>
 </motion.div>
 ) : (
 <motion.div key="nodata" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="flex flex-col items-center justify-center py-16 px-10 text-center bg-surface-container-low/30 rounded-[40px] border border-dashed border-outline-variant/30">
 <p className="text-sm font-bold text-on-surface-variant/50">No data for {selectedMonth}</p>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}

function KPICard({ title, value, description, secondaryDescription }: {
 title: string;
 value: string;
 description: string;
 secondaryDescription?: ReactNode;
}) {
 return (
 <div className="bg-surface-container-lowest rounded-[32px] p-6 shadow-ambient border border-outline-variant/10 flex flex-col gap-4 min-h-[160px]">
 <div className="flex flex-col flex-1">
 <span className="text-3xl font-headline font-black text-on-surface tracking-tight">{value}</span>
 <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-1">{title}</span>
 <p className="text-xs text-on-surface-variant opacity-50 mt-1 font-medium">{description}</p>

 {secondaryDescription && (
 <div className="mt-auto pt-3 border-t border-outline-variant/10">
 <p className="text-[10px] text-on-surface-variant/60 font-medium">
 {secondaryDescription}
 </p>
 </div>
 )}
 </div>
 </div>
 );
}
