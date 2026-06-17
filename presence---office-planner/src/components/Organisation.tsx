import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  Clock, 
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
  const [selectedColleague, setSelectedColleague] = useState<colleague |="" null="">(null);
  const [isColleagueDropdownOpen, setIsColleagueDropdownOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(activeMonth);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  
  const [trendWindow, setTrendWindow] = useState('12m');
  const [weekdayWindow, setWeekdayWindow] = useState('1m');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['adherence']);
  const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
  
  const totalEmployees = 100;

  const metricLabel = 'Adherence Rate';

  const adherenceRates: Record<string, string=""> = {
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
    <div classname="flex flex-col gap-6 sm:gap-8 pb-10 pt-16">
      {/* Header Section with Tabs */}
      <section classname="flex flex-col gap-6">
        <div classname="flex items-center justify-between gap-4 px-1">
          <h1 classname="font-headline text-2xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
            Org. stats
          </h1>
          <div classname="flex p-1 bg-surface-container-low rounded-2xl border border-outline-variant/10 shrink-0 shadow-sm">
            <button onclick="{()" ==""> setView('aggregated')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${view === 'aggregated' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
            >
              Aggregated
            </button>
            <button onclick="{()" ==""> setView('individual')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${view === 'individual' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
            >
              Individual
            </button>
          </div>
        </div>
        {view === 'aggregated' && (
          <div classname="flex items-center gap-2 -mt-2">
            <span classname="font-sans text-on-surface-variant text-sm">Overview of</span>
            <div classname="relative">
              <button onclick="{()" ==""> setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                className="flex items-center gap-1 px-3 py-1 bg-surface-container-low rounded-xl border border-outline-variant/10 text-primary font-bold text-sm transition-all hover:bg-surface-container-high"
              >
                {selectedMonth}
                <chevrondown classname="{`w-4" h-4="" transition-transform="" duration-200="" ${ismonthdropdownopen="" ?="" 'rotate-180'="" :="" ''}`}=""/>
              </button>
              
              <animatepresence>
                {isMonthDropdownOpen && (
                  <>
                    <div classname="fixed inset-0 z-30" onclick="{()" ==""> setIsMonthDropdownOpen(false)} 
                    />
                    <motion.div initial="{{" opacity:="" 0,="" scale:="" 0.95,="" y:="" 10="" }}="" animate="{{" opacity:="" 1,="" scale:="" 1,="" y:="" 0="" }}="" exit="{{" opacity:="" 0,="" scale:="" 0.95,="" y:="" 10="" }}="" classname="absolute left-0 mt-2 w-64 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xl z-40 py-2 overflow-hidden">
                      {historicalMonths.map((month) => {
                        const isClickable = true; // All months visible/clickable as per request
                        const isOctober = month === 'October 2026';
                        return (
                          <button key="{month}" onclick="{()" ==""> {
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
                              <span classname="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">Still in progress</span>
                            ) : (
                              <span classname="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">{adherenceRates[month] ? `${adherenceRates[month]}, adherence` : '—'}</span>
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

      <animatepresence mode="wait">
        {view === 'aggregated' ? (
          <motion.div key="aggregated" initial="{{" opacity:="" 0,="" x:="" -20="" }}="" animate="{{" opacity:="" 1,="" x:="" 0="" }}="" exit="{{" opacity:="" 0,="" x:="" 20="" }}="" transition="{{" duration:="" 0.3="" }}="" classname="flex flex-col gap-6 sm:gap-8">
            {/* Partial Data Banner for October */}
            {selectedMonth === 'October 2026' && (
              <motion.div initial="{{" opacity:="" 0,="" y:="" -10="" }}="" animate="{{" opacity:="" 1,="" y:="" 0="" }}="" classname="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center gap-3">
                <div classname="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <alertcircle classname="w-4 h-4 text-primary"/>
                </div>
                <div classname="flex flex-col">
                  <p classname="text-xs font-bold text-primary uppercase tracking-widest leading-none mb-1">In-progress data</p>
                  <p classname="text-[11px] text-on-surface-variant/70 font-medium leading-tight">These statistics are partial and calculated up to the current day (Oct 9th).</p>
                </div>
              </motion.div>
            )}

            {/* KPI Cards Grid */}
            <section classname="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <kpicard title="Adherence Rate" value="{selectedMonth" =="=" 'september="" 2026'="" ?="" "82%"="" :="" "78%"}="" delta="{selectedMonth" =="=" 'september="" 2026'="" ?="" "+5%"="" :="" "+3%"}="" ispositive="{true}" description="Met presence target this month" secondarydescription="{" <="">Avg <span classname="font-bold">1.4 days</span> behind among those missing target</>
                }
              />
              <kpicard title="Average Office co-presence" value="2.5" delta="-0.5" ispositive="{false}" description="Avg teammates overlap per day"/>
              <kpicard title="Average office days" value="{selectedMonth" =="=" 'september="" 2026'="" ?="" "2.6"="" :="" "2.4"}="" delta="+0.2" ispositive="{true}" description="Per person per week"/>
              <kpicard title="Last-minute unbooking" value="{selectedMonth" =="=" 'september="" 2026'="" ?="" "18"="" :="" "20"}="" delta="+7" ispositive="{false}" description="Cancellations ≤ 24h"/>
            </section>

            {/* Higher temporal window Section */}
            <div classname="flex items-center gap-4 py-4">
              <h2 classname="font-headline text-xs font-black text-on-surface-variant/40 uppercase tracking-[0.2em] shrink-0">Higher temporal window</h2>
              <div classname="h-[1px] flex-grow bg-outline-variant/20"/>
            </div>

            {/* 12-Month Trend Chart */}
            <section classname="bg-surface-container-lowest rounded-[32px] p-6 sm:p-8 shadow-ambient border border-outline-variant/5">
              <div classname="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                <div classname="flex flex-col gap-1">
                  <h2 classname="font-headline text-xl font-bold text-on-surface tracking-tight">12-Month Trend</h2>
                  <p classname="text-xs text-on-surface-variant opacity-60 font-sans uppercase tracking-widest font-bold">Rates Comparison</p>
                </div>
                
                <div classname="flex flex-wrap items-center gap-4 self-end sm:self-auto">
                  {/* Metric Selector Dropdown - Hidden as only one metric remains */}
                  <div classname="hidden">
                    <button onclick="{()" ==""> setIsMetricDropdownOpen(!isMetricDropdownOpen)}
                      className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl border border-outline-variant/10 text-xs font-bold text-primary transition-all hover:bg-surface-container-high"
                    >
                      <div classname="flex items-center gap-1.5">
                        {selectedMetrics.includes('adherence') && <div classname="w-2 h-2 rounded-full bg-[#36A9C2]"/>}
                        {metricLabel}
                      </div>
                      <chevrondown classname="{`w-4" h-4="" transition-transform="" duration-200="" ${ismetricdropdownopen="" ?="" 'rotate-180'="" :="" ''}`}=""/>
                    </button>

                    <animatepresence>
                      {isMetricDropdownOpen && (
                        <>
                          <div classname="fixed inset-0 z-30" onclick="{()" ==""> setIsMetricDropdownOpen(false)} 
                          />
                          <motion.div initial="{{" opacity:="" 0,="" scale:="" 0.95,="" y:="" 10="" }}="" animate="{{" opacity:="" 1,="" scale:="" 1,="" y:="" 0="" }}="" exit="{{" opacity:="" 0,="" scale:="" 0.95,="" y:="" 10="" }}="" classname="absolute right-0 mt-2 w-40 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-2xl z-40 py-2 overflow-hidden">
                            {[
                              { label: 'Adherence', value: ['adherence'] }
                            ].map((opt) => (
                              <button key="{opt.label}" onclick="{()" ==""> {
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

                  <div classname="relative">
                    <select value="{trendWindow}" onchange="{(e)" ==""> setTrendWindow(e.target.value)}
                      className="appearance-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer pr-10"
                    >
                      <option value="12m">Last 12 Month</option>
                      <option value="6m">Last 6 Month</option>
                      <option value="3m">Last 3 Month</option>
                      <option value="1m">Last Month</option>
                    </select>
                    <chevrondown classname="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none"/>
                  </div>
                </div>
              </div>
              <div classname="h-[300px] w-full mt-4">
                <responsivecontainer width="100%" height="100%">
                  <barchart data="{TREND_DATA_12M.slice(trendWindow" =="=" '12m'="" ?="" 0="" :="" trendwindow="==" '6m'="" ?="" 7="" :="" trendwindow="==" '3m'="" ?="" 10="" :="" 12)}="" margin="{{" top:="" 20,="" right:="" 0,="" left:="" -20,="" bottom:="" 0="" }}="">
                    <cartesiangrid strokedasharray="3 3" vertical="{false}" stroke="var(--outline-variant)" opacity="{0.2}"/>
                    <xaxis datakey="month" axisline="{false}" tickline="{false}" tick="{{" fontsize:="" 10,="" fill:="" 'var(--on-surface-variant)',="" fontweight:="" 600="" }}="" dy="{10}"/>
                    <yaxis axisline="{false}" tickline="{false}" tick="{{" fontsize:="" 10,="" fill:="" 'var(--on-surface-variant)',="" fontweight:="" 600="" }}="" unit="%"/>
                    <tooltip cursor="{{" fill:="" 'var(--surface-container-low)',="" opacity:="" 0.4="" }}="" contentstyle="{{" borderradius:="" '16px',="" border:="" '1px="" solid="" var(--outline-variant)',="" backgroundcolor:="" 'var(--surface-container-lowest)',="" boxshadow:="" '0="" 10px="" 25px="" -5px="" rgba(0,="" 0,="" 0,="" 0.1)'="" }}=""/>
                    <legend verticalalign="top" align="right" icontype="circle" wrapperstyle="{{" paddingbottom:="" '24px',="" fontsize:="" '10px',="" fontweight:="" '700',="" texttransform:="" 'uppercase',="" tracking:="" '0.05em'="" }}=""/>
                    {selectedMetrics.includes('adherence') && (
                      <bar name="Adherence Rate" datakey="adherence" fill="#36A9C2" radius="{[4," 4,="" 0,="" 0]}="" barsize="{trendWindow" =="=" '12m'="" ?="" 12="" :="" 20}="">
                        {TREND_DATA_12M.map((entry, index) => (
                          <cell key="{`cell-adh-${index}`}" fill="#36A9C2" fillopacity="{entry.isCurrent" ?="" 1="" :="" 0.4}=""/>
                        ))}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Office Presence by Weekday */}
            <section classname="bg-surface-container-lowest rounded-[32px] p-6 sm:p-8 shadow-ambient border border-outline-variant/5">
              <div classname="flex justify-between items-start mb-8">
                <div classname="flex flex-col gap-1">
                  <h2 classname="font-headline text-xl font-bold text-on-surface tracking-tight">Office Presence by Day</h2>
                  <p classname="text-xs text-on-surface-variant opacity-60 font-sans uppercase tracking-widest font-bold">Weekday Distribution</p>
                </div>
                <div classname="relative">
                  <select value="{weekdayWindow}" onchange="{(e)" ==""> setWeekdayWindow(e.target.value)}
                    className="appearance-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer pr-10"
                  >
                    <option value="12m">Last 12 Month</option>
                    <option value="6m">Last 6 Month</option>
                    <option value="3m">Last 3 Month</option>
                    <option value="1m">Last Month</option>
                  </select>
                  <chevrondown classname="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none"/>
                </div>
              </div>
              <div classname="h-[250px] w-full">
                <responsivecontainer width="100%" height="100%">
                  <barchart data="{WEEKDAY_DATA}" margin="{{" top:="" 20,="" right:="" 0,="" left:="" -20,="" bottom:="" 0="" }}="">
                    <cartesiangrid strokedasharray="3 3" vertical="{false}" stroke="var(--outline-variant)" opacity="{0.2}"/>
                    <xaxis datakey="day" axisline="{false}" tickline="{false}" tick="{{" fontsize:="" 12,="" fill:="" 'var(--on-surface-variant)',="" fontweight:="" 600="" }}="" dy="{10}"/>
                    <yaxis axisline="{false}" tickline="{false}" tick="{{" fontsize:="" 12,="" fill:="" 'var(--on-surface-variant)',="" fontweight:="" 600="" }}="" unit="%"/>
                    <tooltip cursor="{{" fill:="" 'var(--surface-container-low)',="" opacity:="" 0.4="" }}="" contentstyle="{{" borderradius:="" '16px',="" border:="" '1px="" solid="" var(--outline-variant)',="" backgroundcolor:="" 'var(--surface-container-lowest)',="" }}=""/>
                    <bar datakey="presence" radius="{[8," 8,="" 8,="" 8]}="">
                      {WEEKDAY_DATA.map((entry, index) => (
                        <cell key="{`cell-${index}`}" fill="var(--outline-variant)" fillopacity="{0.5}"/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div key="individual" initial="{{" opacity:="" 0,="" x:="" 20="" }}="" animate="{{" opacity:="" 1,="" x:="" 0="" }}="" exit="{{" opacity:="" 0,="" x:="" -20="" }}="" transition="{{" duration:="" 0.3="" }}="" classname="flex flex-col gap-6 sm:gap-8">
            {/* Employee Selector Dropdown */}
            <section classname="bg-surface-container-lowest rounded-[32px] p-6 shadow-ambient border border-outline-variant/10">
              <div classname="flex flex-col gap-1 mb-4">
                <h3 classname="text-xs font-bold text-on-surface-variant uppercase tracking-widest opacity-50">Filter by Employee</h3>
              </div>
              <div classname="relative">
                <button onclick="{()" ==""> setIsColleagueDropdownOpen(!isColleagueDropdownOpen)}
                  className="w-full flex items-center justify-between px-6 py-4 bg-surface-container-low rounded-[24px] border border-outline-variant/10 text-on-surface font-bold transition-all hover:bg-surface-container-high group"
                >
                  <div classname="flex items-center gap-3">
                    <div classname="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <user classname="w-5 h-5 text-primary"/>
                    </div>
                    <span classname="{selectedColleague" ?="" "text-on-surface"="" :="" "text-on-surface-variant="" 40"}="">
                      {selectedColleague ? `${selectedColleague.name} ${selectedColleague.surname}` : "Choose an employee"}
                    </span>
                  </div>
                  <chevrondown classname="{`w-5" h-5="" transition-transform="" duration-300="" ${iscolleaguedropdownopen="" ?="" 'rotate-180'="" :="" ''}`}=""/>
                </button>

                <animatepresence>
                  {isColleagueDropdownOpen && (
                    <>
                      <div classname="fixed inset-0 z-30" onclick="{()" ==""> setIsColleagueDropdownOpen(false)} />
                      <motion.div initial="{{" opacity:="" 0,="" scale:="" 0.95,="" y:="" 10="" }}="" animate="{{" opacity:="" 1,="" scale:="" 1,="" y:="" 0="" }}="" exit="{{" opacity:="" 0,="" scale:="" 0.95,="" y:="" 10="" }}="" classname="absolute left-0 right-0 mt-4 max-h-[400px] overflow-y-auto bg-surface-container-lowest border border-outline-variant/20 rounded-[32px] shadow-2xl z-40 py-4 scrollbar-hide">
                        <div classname="px-6 py-2 mb-2">
                          <div classname="relative">
                            <search classname="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40"/>
                            <input type="text" placeholder="Search employees..." classname="w-full bg-surface-container p-3 pl-10 rounded-2xl border-none text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" onclick="{(e)" ==""> e.stopPropagation()}
                            />
                          </div>
                        </div>

                        {COLLEAGUES.map((colleague) => {
                          const isRoberto = colleague.name === "Roberto" && colleague.surname === "Venditti";
                          return (
                            <button key="{colleague.id}" disabled="{!isRoberto}" onclick="{()" ==""> {
                                setSelectedColleague(colleague);
                                setIsColleagueDropdownOpen(false);
                              }}
                              className={`w-full text-left px-6 py-4 flex items-center justify-between transition-colors ${
                                !isRoberto 
                                  ? 'opacity-20 cursor-not-allowed filter grayscale' 
                                  : colleague.id === selectedColleague?.id 
                                    ? 'bg-primary/10 text-primary font-bold' 
                                    : 'text-on-surface hover:bg-surface-container-high'
                              }`}
                            >
                              <div classname="flex items-center gap-3">
                                <div classname="{`w-8" h-8="" rounded-full="" flex="" items-center="" justify-center="" text-[10px]="" font-black="" text-white="" ${colleague.color}`}="">
                                  {colleague.initials}
                                </div>
                                <span classname="text-sm font-bold">{colleague.name} {colleague.surname}</span>
                              </div>
                              {isRoberto && <span classname="text-[10px] font-black uppercase text-primary tracking-tighter bg-primary/10 px-2 py-0.5 rounded-full">Interactive</span>}
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
            <animatepresence mode="wait">
              {!selectedColleague ? (
                <motion.div key="empty" initial="{{" opacity:="" 0="" }}="" animate="{{" opacity:="" 1="" }}="" exit="{{" opacity:="" 0="" }}="" classname="flex flex-col items-center justify-center py-20 px-10 text-center bg-surface-container-low/30 rounded-[40px] border border-dashed border-outline-variant/30">
                  <div classname="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-6">
                    <users classname="w-10 h-10 text-on-surface-variant/30"/>
                  </div>
                  <h3 classname="font-headline text-xl font-extrabold text-on-surface mb-2">No employee selected</h3>
                  <p classname="text-sm text-on-surface-variant/60 font-sans max-w-xs">
                    Choose Roberto Venditti from the list above to view his detailed attendance records and statistics.
                  </p>
                </motion.div>
              ) : (
                <motion.div key="stats" initial="{{" opacity:="" 0,="" y:="" 20="" }}="" animate="{{" opacity:="" 1,="" y:="" 0="" }}="" exit="{{" opacity:="" 0,="" y:="" 20="" }}="" transition="{{" duration:="" 0.4="" }}="">
                  <stats days="{days}" currentmonth="{selectedMonth}"/>
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
    <div classname="bg-surface-container-lowest rounded-[32px] p-6 shadow-ambient border border-outline-variant/10 flex flex-col gap-4 min-h-[190px]">
      <div classname="flex justify-between items-start">
        <div classname="{`flex" items-center="" gap-1.5="" px-3="" py-1="" rounded-full="" text-[10px]="" font-bold="" ${ispositive="" ?="" 'bg-green-500="" 10="" text-green-600'="" :="" 'bg-red-500="" 10="" text-red-600'}`}="">
          {delta}
          <span classname="opacity-60 ml-0.5">(vs previous month)</span>
        </div>
      </div>
      
      <div classname="flex flex-col flex-1">
        <span classname="text-3xl font-headline font-black text-on-surface tracking-tight">{value}</span>
        <span classname="text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-1">{title}</span>
        <p classname="text-xs text-on-surface-variant opacity-50 mt-1 font-medium">{description}</p>
        
        {secondaryDescription && (
          <div classname="mt-auto pt-3 border-t border-outline-variant/10">
            <p classname="text-[10px] text-on-surface-variant/60 font-medium">
              {secondaryDescription}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertItem({ type, title, description, icon: Icon }: any) {
  const isWarning = type === 'warning';
  return (
    <div classname="{`flex" gap-4="" p-5="" rounded-2xl="" border="" ${iswarning="" ?="" 'bg-amber-500="" [0.03]="" border-amber-500="" 10'="" :="" 'bg-green-500="" [0.03]="" border-green-500="" 10'}`}="">
      <div classname="{`p-2" h-fit="" rounded-full="" ${iswarning="" ?="" 'bg-amber-500="" 10="" text-amber-600'="" :="" 'bg-green-500="" 10="" text-green-600'}`}="">
        <icon classname="w-4 h-4"/>
      </div>
      <div classname="flex flex-col gap-0.5">
        <h4 classname="{`text-sm" font-extrabold="" font-headline="" ${iswarning="" ?="" 'text-amber-900'="" :="" 'text-green-900'}`}="">{title}</h4>
        <p classname="{`text-xs" leading-relaxed="" font-medium="" ${iswarning="" ?="" 'text-amber-800="" 70'="" :="" 'text-green-800="" 70'}`}="">{description}</p>
      </div>
    </div>
  );
}
