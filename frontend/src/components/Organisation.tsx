import { useState } from 'react';
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
import Stats from './Stats';
import { COLLEAGUES, Colleague } from '../constants/colleagues';
import { DayPresence } from '../types';

interface OrganisationProps {
 days?: DayPresence[];
 activeMonth?: string;
}

const TREND_DATA_12M = [
 { month: 'Oct 25', adherence: 65 },
 { month: 'Nov 25', adherence: 68 },
 { month: 'Dec 25', adherence: 60 },
 { month: 'Jan 26', adherence: 70 },
 { month: 'Feb 26', adherence: 72 },
 { month: 'Mar 26', adherence: 75 },
 { month: 'Apr 26', adherence: 74 },
 { month: 'May 26', adherence: 72 },
 { month: 'Jun 26', adherence: 75 },
 { month: 'Jul 26', adherence: 70 },
 { month: 'Aug 26', adherence: 68 },
 { month: 'Sep 26', adherence: 74 },
 { month: 'Oct 26', adherence: 78, isCurrent: true },
];

const WEEKDAY_DATA = [
 { day: 'Mon', presence: 65 },
 { day: 'Tue', presence: 82 },
 { day: 'Wed', presence: 88, isPeak: true },
 { day: 'Thu', presence: 75 },
 { day: 'Fri', presence: 42, isLowest: true },
];

const historicalMonths = [
 'October 2026',
 'September 2026',
 'August 2026',
 'July 2026',
 'June 2026',
 'May 2026',
 'April 2026',
 'March 2026',
 'February 2026',
 'January 2026',
 'December 2025',
 'November 2025',
];

export default function Organisation({ days = [], activeMonth = "September 2026" }: OrganisationProps) {
 const [view, setView] = useState<'aggregated' | 'individual'>('aggregated');
 const [selectedColleague, setSelectedColleague] = useState<Colleague | null>(null);
 const [isColleagueDropdownOpen, setIsColleagueDropdownOpen] = useState(false);
 const [selectedMonth, setSelectedMonth] = useState(activeMonth);
 const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
 
 const [trendWindow, setTrendWindow] = useState('12m');
 const [weekdayWindow, setWeekdayWindow] = useState('1m');
 const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['adherence']);
 const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
 
 const metricLabel = 'Adherence Rate';

 const adherenceRates: Record<string, string> = {
 'October 2026': '78%',
 'September 2026': '82%',
 'August 2026': '74%',
 'July 2026': '70%',
 'June 2026': '75%',
 'May 2026': '72%',
 'April 2026': '74%',
 'March 2026': '75%',
 'February 2026': '72%',
 'January 2026': '70%',
 'December 2025': '60%',
 'November 2025': '68%',
 };

 return (
 <div className="flex flex-col gap-6 sm:gap-8 pb-10 pt-16">
 {/* Header Section with Tabs */}
 <section className="flex flex-col gap-6">
 <div className="flex items-center justify-between gap-4 px-1">
 <h1 className="font-headline text-2xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
 Org. stats
 </h1>
 <div className="flex p-1 bg-surface-container-low rounded-2xl border border-outline-variant/10 shrink-0 shadow-sm">
 <button onClick={() => setView('aggregated')}
 className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${view === 'aggregated' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
 >
 Aggregated
 </button>
 <button onClick={() => setView('individual')}
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
 <button onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
 className="flex items-center gap-1 px-3 py-1 bg-surface-container-low rounded-xl border border-outline-variant/10 text-primary font-bold text-sm transition-all hover:bg-surface-container-high"
 >
 {selectedMonth}
 <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMonthDropdownOpen ? 'rotate-180' : ''}`}/>
 </button>
 
 <AnimatePresence>
 {isMonthDropdownOpen && (
 <>
 <div className="fixed inset-0 z-30" onClick={() => setIsMonthDropdownOpen(false)} 
 />
 <motion.div initial={{opacity: 0, scale: 0.95, y: 10}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.95, y: 10}} className="absolute left-0 mt-2 w-64 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xl z-40 py-2 overflow-hidden">
 {historicalMonths.map((month) => {
 const isOctober = month === 'October 2026';
 return (
 <button key={month} onClick={() => {
 setSelectedMonth(month);
 setIsMonthDropdownOpen(false);
 }}
 className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
 month === selectedMonth 
 ? 'bg-primary/10 text-primary font-bold' 
 : 'text-on-surface hover:bg-surface-container-high'
 }`}
 >
 <span>{month}</span>
 {isOctober ? (
 <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">Still in progress</span>
 ) : (
 <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">{adherenceRates[month] ? `${adherenceRates[month]}, adherence` : '—'}</span>
 )}
 </button>
 );
 })}
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
 {/* Partial Data Banner for October */}
 {selectedMonth === 'October 2026' && (
 <motion.div initial={{opacity: 0, y: -10}} animate={{opacity: 1, y: 0}} className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
 <AlertCircle className="w-4 h-4 text-primary"/>
 </div>
 <div className="flex flex-col">
 <p className="text-xs font-bold text-primary uppercase tracking-widest leading-none mb-1">In-progress data</p>
 <p className="text-[11px] text-on-surface-variant/70 font-medium leading-tight">These statistics are partial and calculated up to the current day (Oct 9th).</p>
 </div>
 </motion.div>
 )}

 {/* KPI Cards Grid */}
 <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <KPICard title="Adherence Rate" value={selectedMonth === 'September 2026' ? "82%" : "78%"} delta={selectedMonth === 'September 2026' ? "+5%" : "+3%"} isPositive={true} description="Met presence target this month" secondaryDescription={<>Avg <span className="font-bold">1.4 days</span> behind among those missing target</>
 }
 />
 <KPICard title="Average Office co-presence" value="2.5" delta="-0.5" isPositive={false} description="Avg teammates overlap per day"/>
 <KPICard title="Average office days" value={selectedMonth === 'September 2026' ? "2.6" : "2.4"} delta="+0.2" isPositive={true} description="Per person per week"/>
 <KPICard title="Last-minute unbooking" value={selectedMonth === 'September 2026' ? "18" : "20"} delta="+7" isPositive={false} description="Cancellations ≤ 24h"/>
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
 <p className="text-xs text-on-surface-variant opacity-60 font-sans uppercase tracking-widest font-bold">Rates Comparison</p>
 </div>
 
 <div className="flex flex-wrap items-center gap-4 self-end sm:self-auto">
 {/* Metric Selector Dropdown - Hidden as only one metric remains */}
 <div className="hidden">
 <button onClick={() => setIsMetricDropdownOpen(!isMetricDropdownOpen)}
 className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl border border-outline-variant/10 text-xs font-bold text-primary transition-all hover:bg-surface-container-high"
 >
 <div className="flex items-center gap-1.5">
 {selectedMetrics.includes('adherence') && <div className="w-2 h-2 rounded-full bg-[#36A9C2]"/>}
 {metricLabel}
 </div>
 <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMetricDropdownOpen ? 'rotate-180' : ''}`}/>
 </button>

 <AnimatePresence>
 {isMetricDropdownOpen && (
 <>
 <div className="fixed inset-0 z-30" onClick={() => setIsMetricDropdownOpen(false)} 
 />
 <motion.div initial={{opacity: 0, scale: 0.95, y: 10}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: 0.95, y: 10}} className="absolute right-0 mt-2 w-40 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xl z-40 py-2 overflow-hidden">
 {[
 { label: 'Adherence', value: ['adherence'] }
 ].map((opt) => (
 <button key={opt.label} onClick={() => {
 setSelectedMetrics(opt.value);
 setIsMetricDropdownOpen(false);
 }}
 className={`w-full text-left px-4 py-2.5 text-[10px] font-bold transition-colors uppercase tracking-wider ${
 JSON.stringify(opt.value) === JSON.stringify(selectedMetrics)
 ? 'bg-primary/10 text-primary' 
 : 'text-on-surface hover:bg-surface-container-high'
 }`}
 >
 {opt.label}
 </button>
 ))}
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>

 <div className="relative">
 <select value={trendWindow} onChange={(e) => setTrendWindow(e.target.value)}
 className="appearance-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer pr-10"
 >
 <option value="12m">Last 12 Month</option>
 <option value="6m">Last 6 Month</option>
 <option value="3m">Last 3 Month</option>
 <option value="1m">Last Month</option>
 </select>
 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none"/>
 </div>
 </div>
 </div>
 <div className="h-[300px] w-full mt-4">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={TREND_DATA_12M.slice(trendWindow === '12m' ? 0 : trendWindow === '6m' ? 7 : trendWindow === '3m' ? 10 : 12)} margin={{top: 20, right: 0, left: -20, bottom: 0}}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.2}/>
 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 600}} dy={10}/>
 <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 600}} unit="%"/>
 <Tooltip cursor={{fill: 'var(--surface-container-low)', opacity: 0.4}} contentStyle={{borderRadius: '16px', border: '1px solid var(--outline-variant)', backgroundColor: 'var(--surface-container-lowest)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'}}/>
 <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '24px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em'}}/>
 {selectedMetrics.includes('adherence') && (
 <Bar name="Adherence Rate" dataKey="adherence" fill="#36A9C2" radius={[4, 4, 0, 0]} barSize={trendWindow === '12m' ? 12 : 20}>
 {TREND_DATA_12M.map((entry, index) => (
 <Cell key={`cell-adh-${index}`} fill="#36A9C2" fillOpacity={entry.isCurrent ? 1 : 0.4}/>
 ))}
 </Bar>
 )}
 </BarChart>
 </ResponsiveContainer>
 </div>
 </section>

 {/* Office Presence by Weekday */}
 <section className="bg-surface-container-lowest rounded-[32px] p-6 sm:p-8 shadow-ambient border border-outline-variant/5">
 <div className="flex justify-between items-start mb-8">
 <div className="flex flex-col gap-1">
 <h2 className="font-headline text-xl font-bold text-on-surface tracking-tight">Office Presence by Day</h2>
 <p className="text-xs text-on-surface-variant opacity-60 font-sans uppercase tracking-widest font-bold">Weekday Distribution</p>
 </div>
 <div className="relative">
 <select value={weekdayWindow} onChange={(e) => setWeekdayWindow(e.target.value)}
 className="appearance-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer pr-10"
 >
 <option value="12m">Last 12 Month</option>
 <option value="6m">Last 6 Month</option>
 <option value="3m">Last 3 Month</option>
 <option value="1m">Last Month</option>
 </select>
 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none"/>
 </div>
 </div>
 <div className="h-[250px] w-full">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={WEEKDAY_DATA} margin={{top: 20, right: 0, left: -20, bottom: 0}}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.2}/>
 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--on-surface-variant)', fontWeight: 600}} dy={10}/>
 <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--on-surface-variant)', fontWeight: 600}} unit="%"/>
 <Tooltip cursor={{fill: 'var(--surface-container-low)', opacity: 0.4}} contentStyle={{borderRadius: '16px', border: '1px solid var(--outline-variant)', backgroundColor: 'var(--surface-container-lowest)',}}/>
 <Bar dataKey="presence" radius={[8, 8, 8, 8]}>
 {WEEKDAY_DATA.map((_entry, index) => (
 <Cell key={`cell-${index}`} fill="var(--outline-variant)" fillOpacity={0.5}/>
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
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
 <button onClick={() => setIsColleagueDropdownOpen(!isColleagueDropdownOpen)}
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
 <input type="text" placeholder="Search employees..." className="w-full bg-surface-container p-3 pl-10 rounded-2xl border-none text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" onClick={(e) => e.stopPropagation()}
 />
 </div>
 </div>

 {COLLEAGUES.map((Colleague) => {
 const isRoberto = Colleague.name === "Roberto" && Colleague.surname === "Venditti";
 return (
 <button key={Colleague.id} disabled={!isRoberto} onClick={() => {
 setSelectedColleague(Colleague);
 setIsColleagueDropdownOpen(false);
 }}
 className={`w-full text-left px-6 py-4 flex items-center justify-between transition-colors ${
 !isRoberto 
 ? 'opacity-20 cursor-not-allowed filter grayscale' 
 : Colleague.id === selectedColleague?.id 
 ? 'bg-primary/10 text-primary font-bold' 
 : 'text-on-surface hover:bg-surface-container-high'
 }`}
 >
 <div className="flex items-center gap-3">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white ${Colleague.color}`}>
 {Colleague.initials}
 </div>
 <span className="text-sm font-bold">{Colleague.name} {Colleague.surname}</span>
 </div>
 {isRoberto && <span className="text-[10px] font-black uppercase text-primary tracking-tighter bg-primary/10 px-2 py-0.5 rounded-full">Interactive</span>}
 </button>
 );
 })}
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
 Choose Roberto Venditti from the list above to view his detailed attendance records and statistics.
 </p>
 </motion.div>
 ) : (
 <motion.div key="stats" initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 20}} transition={{duration: 0.4}}>
 <Stats days={days} currentMonth={selectedMonth}/>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}

function KPICard({ title, value, delta, isPositive, description, secondaryDescription }: any) {
 return (
 <div className="bg-surface-container-lowest rounded-[32px] p-6 shadow-ambient border border-outline-variant/10 flex flex-col gap-4 min-h-[190px]">
 <div className="flex justify-between items-start">
 <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${isPositive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
 {delta}
 <span className="opacity-60 ml-0.5">(vs previous month)</span>
 </div>
 </div>
 
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
