import React, { useState, useMemo, useEffect } from 'react';
import RoomConfigMock from './RoomConfigMock';
import { motion, AnimatePresence } from 'motion/react';
import { 
 Palette, 
 LogOut, 
 Sun, 
 Moon, 
 Monitor, 
 ChevronRight,
 Edit2,
 User as UserIcon,
 Users,
 X,
 Search,
 Plus,
 MoreVertical,
 Trash2,
 Copy,
 Move,
 ChevronLeft,
 Check,
 Mail,
 Eye,
 Zap,
 Type,
 Ear,
 Accessibility as AccessibilityIcon,
 Book,
 ExternalLink,
 Star
} from 'lucide-react';

import type { Colleague } from '../constants/colleagues';
import { useAuth } from '../context/AuthContext';
import { updatePreferences, getUsers } from '../services/api';
import { mapUserToColleague } from '../hooks/useColleagues';

interface ProfileProps {
 themeMode: 'light' | 'dark' | 'system';
 onSetThemeMode: (newMode: 'light' | 'dark' | 'system') => void;
 isSimplifiedView: boolean;
 onToggleSimplifiedView: () => void;
 isHighContrast: boolean;
 onToggleHighContrast: () => void;
 isLargeText: boolean;
 onToggleLargeText: () => void;
 isScreenReader: boolean;
 onToggleScreenReader: () => void;
 projectTeammates: Colleague[];
 onUpdateProjectTeammates: (teammates: Colleague[]) => void;
 allColleagues?: Colleague[];
 onLogout?: () => void;
}

interface GroupMember {
 id: string;
 name: string;
 initials: string;
 color: string;
}

const ALL_AREAS = [
 "AMT",
 "Business Development",
 "DAAM",
 "Dissemination",
 "Energy&Environment",
 "Grant Office",
 "HF Applied",
 "HF Innovative",
 "Manufacturing",
 "Marketing",
 "Railway",
 "Secure Societies",
 "Tech",
 "Training"
].sort();

const OTHER_AREAS = [
 "Administration",
 "Management"
];

const TARGET_AREAS = [...ALL_AREAS, ...OTHER_AREAS];

interface MemberActionSheetProps {
 member: GroupMember;
 currentArea: string;
 areas: string[];
 onClose: () => void;
 onRemove: (area: string, memberId: string) => void;
 onMove: (fromArea: string, toArea: string, member: GroupMember) => void;
 onDuplicate: (toArea: string, member: GroupMember) => void;
}

function MemberActionSheet({ 
 member, 
 currentArea, 
 areas, 
 onClose, 
 onRemove, 
 onMove, 
 onDuplicate 
}: MemberActionSheetProps) {
 const [step, setStep] = useState<1 | 2>(1);
 const [actionType, setActionType] = useState<'move' | 'duplicate' | null>(null);

 const handleAreaSelect = (targetArea: string) => {
 if (actionType === 'move') {
 onMove(currentArea, targetArea, member);
 } else if (actionType === 'duplicate') {
 onDuplicate(targetArea, member);
 }
 };

 return (
 <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center">
 {/* Backdrop */}
 <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"/>

 {/* Sheet / Modal */}
 <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} transition={{type: "spring", damping: 25, stiffness: 200}} className="relative w-full md:max-w-[400px] bg-surface-container-lowest rounded-t-[32px] md:rounded-[32px] overflow-hidden shadow-2xl">
 <AnimatePresence mode="wait">
 {step === 1 ? (
 <motion.div key="step1" initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}} className="p-6">
 <div className="flex items-center gap-4 mb-8">
 <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-outline-variant/10 ${member.color}`}>
 {member.initials}
 </div>
 <div>
 <h4 className="font-bold text-lg text-on-surface">{member.name}</h4>
 <p className="text-xs text-on-surface-variant">Currently in {currentArea}</p>
 </div>
 </div>

 <div className="space-y-2">
 <button onClick={() => onRemove(currentArea, member.id)}
 className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-red-50 text-red-600 transition-colors group"
 >
 <div className="p-2 bg-red-100/50 rounded-xl group-hover:bg-red-100">
 <Trash2 className="w-5 h-5"/>
 </div>
 <span className="font-bold">Remove from {currentArea}</span>
 </button>

 <button onClick={() => { setActionType('duplicate'); setStep(2); }}
 className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-surface-container transition-colors group"
 >
 <div className="flex items-center gap-4 text-on-surface">
 <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/20">
 <Copy className="w-5 h-5 text-primary"/>
 </div>
 <span className="font-bold">Duplicate to...</span>
 </div>
 <ChevronRight className="w-5 h-5 text-on-surface-variant/40"/>
 </button>

 <button onClick={() => { setActionType('move'); setStep(2); }}
 className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-surface-container transition-colors group"
 >
 <div className="flex items-center gap-4 text-on-surface">
 <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/20">
 <Move className="w-5 h-5 text-primary"/>
 </div>
 <span className="font-bold">Move to...</span>
 </div>
 <ChevronRight className="w-5 h-5 text-on-surface-variant/40"/>
 </button>
 </div>
 </motion.div>
 ) : (
 <motion.div key="step2" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: 20}} className="flex flex-col max-h-[70vh] md:max-h-[500px]">
 <header className="p-6 border-b border-outline-variant/10 flex items-center gap-4">
 <button onClick={() => setStep(1)}
 className="p-2 -ml-2 hover:bg-surface-container rounded-full transition-colors"
 >
 <ChevronLeft className="w-5 h-5 text-on-surface"/>
 </button>
 <h4 className="font-bold text-lg text-on-surface capitalize">
 {actionType} to...
 </h4>
 </header>

 <div className="flex-grow overflow-y-auto p-4 space-y-1">
 {areas.map(area => {
 const isCurrent = area === currentArea;
 return (
 <button key={area} disabled={isCurrent} onClick={() => handleAreaSelect(area)}
 className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${isCurrent ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:bg-surface-container active:scale-[0.98]'}`}
 >
 <span className="font-bold text-on-surface">{area}</span>
 {isCurrent && (
 <span className="text-[10px] uppercase font-bold tracking-widest text-primary px-2 py-1 bg-primary/10 rounded-lg">
 Current
 </span>
 )}
 </button>
 );
 })}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 
 {/* Drag Handle for Mobile */}
 <div className="md:hidden absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-on-surface/10 rounded-full"/>
 </motion.div>
 </div>
 );
}

function AccessibilityCard({ icon, label, description, isActive, onToggle }: { icon: React.ReactNode, label: string, description: string, isActive: boolean, onToggle: () => void }) {
 return (
 <div className={`relative p-5 rounded-3xl border transition-all duration-200 shadow-sm flex flex-col gap-4 ${isActive ? 'bg-surface-container-lowest border-primary ring-4 ring-primary/5' : 'bg-surface-container-lowest border-outline-variant/10'}`}>
 <div className="flex items-start justify-between">
 <div className="p-3 bg-primary/5 rounded-2xl">
 {icon}
 </div>
 <button onClick={onToggle} className={`relative w-12 h-6 rounded-full transition-colors duration-200 outline-none shrink-0 ${isActive ? 'bg-primary' : 'bg-outline-variant/30'}`}>
 <motion.div animate={{x: isActive ? 26 : 2}} initial={false} transition={{type: "spring", stiffness: 500, damping: 30}} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"/>
 </button>
 </div>
 <div>
 <h4 className="font-bold text-on-surface leading-tight mb-1">{label}</h4>
 <p className="text-xs text-on-surface-variant/70 leading-relaxed font-medium">{description}</p>
 </div>
 </div>
 );
}

function NotificationToggle({ label, isActive, onToggle }: { label: string, isActive: boolean, onToggle: () => void }) {
 return (
 <div className="flex items-center justify-between p-5 gap-4 hover:bg-on-surface/[0.02] transition-colors">
 <p className="text-sm font-medium text-on-surface leading-snug">{label}</p>
 <button onClick={onToggle} className={`relative w-12 h-6 rounded-full transition-colors duration-200 outline-none shrink-0 ${isActive ? 'bg-primary' : 'bg-outline-variant/30'}`}>
 <motion.div animate={{x: isActive ? 26 : 2}} initial={false} transition={{type: "spring", stiffness: 500, damping: 30}} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"/>
 </button>
 </div>
 );
}


export default function Profile({
 themeMode,
 onSetThemeMode,
 isSimplifiedView,
 onToggleSimplifiedView,
 isHighContrast,
 onToggleHighContrast,
 isLargeText,
 onToggleLargeText,
 isScreenReader,
 onToggleScreenReader,
 projectTeammates,
 onUpdateProjectTeammates,
 allColleagues = [],
 onLogout
}: ProfileProps) {
 const { user } = useAuth();
 const [activeView, setActiveView] = useState<'main' | 'groups' | 'accessibility' | 'room-config' | 'teammates'>('main');
 const [selectedTeammates, setSelectedTeammates] = useState<Colleague[]>(projectTeammates);
 const [teammateSearchQuery, setTeammateSearchQuery] = useState('');
 const [fetchedColleagues, setFetchedColleagues] = useState<Colleague[]>(allColleagues);
 const [colleaguesLoading, setColleaguesLoading] = useState(false);
 const [colleaguesError, setColleaguesError] = useState(false);
 const [osIsDark, setOsIsDark] = useState(
   () => window.matchMedia('(prefers-color-scheme: dark)').matches
 );

 useEffect(() => {
   const mq = window.matchMedia('(prefers-color-scheme: dark)');
   const handler = (e: MediaQueryListEvent) => setOsIsDark(e.matches);
   mq.addEventListener('change', handler);
   return () => mq.removeEventListener('change', handler);
 }, []);

 const ALL_COLLEAGUES: GroupMember[] = useMemo(() => fetchedColleagues.map(c => ({
   id: c.id,
   name: `${c.name} ${c.surname}`,
   initials: c.initials,
   color: c.color,
 })), [fetchedColleagues]);

 const fetchColleagues = () => {
   setColleaguesLoading(true);
   setColleaguesError(false);
   getUsers()
     .then(users => {
       if (!Array.isArray(users)) throw new Error('Invalid response');
       setFetchedColleagues(users.map(mapUserToColleague));
     })
     .catch(() => setColleaguesError(true))
     .finally(() => setColleaguesLoading(false));
 };

 useEffect(() => {
   if (activeView !== 'teammates' && activeView !== 'groups') return;
   fetchColleagues();
 }, [activeView]);
 const [areaGroups, setAreaGroups] = useState<Record<string, GroupMember[]>>({
 'Tech': [],
 'HF Innovative': [],
 'Manufacturing': [],
 'AMT': [],
 });

 const [activeSearchArea, setActiveSearchArea] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 
 // New state for Action Sheet
 const [actionSheetData, setActionSheetData] = useState<{
 member: GroupMember;
 area: string;
 } | null>(null);
 const [confirmation, setConfirmation] = useState<string | null>(null);

 const [notifications, setNotifications] = useState({
 officeAvailable: user?.preferences?.notifications?.waitingListPromotion ?? true,
 statusReminder11: user?.preferences?.notifications?.statusReminder11 ?? true,
 statusReminder18: user?.preferences?.notifications?.statusReminder18 ?? false,
 projectTeammateBooking: user?.preferences?.notifications?.projectTeammateBooking ?? true,
 monthlyOverview: user?.preferences?.notifications?.monthlyOverview ?? false,
 newActivity: user?.preferences?.notifications?.newActivity ?? true,
 });

 useEffect(() => {
 if (user?.preferences?.notifications) {
  const n = user.preferences.notifications;
  setNotifications({
  officeAvailable: n.waitingListPromotion,
  statusReminder11: n.statusReminder11,
  statusReminder18: n.statusReminder18,
  projectTeammateBooking: n.projectTeammateBooking,
  monthlyOverview: n.monthlyOverview,
  newActivity: n.newActivity,
  });
 }
 }, [user]);

 const toggleNotification = (key: keyof typeof notifications) => {
 const newValue = !notifications[key];
 const newNotifs = { ...notifications, [key]: newValue };
 setNotifications(newNotifs);
 updatePreferences({
  notifications: {
  waitingListPromotion: newNotifs.officeAvailable,
  sickLeaveReminder: user?.preferences?.notifications?.sickLeaveReminder ?? true,
  statusReminder11: newNotifs.statusReminder11,
  statusReminder18: newNotifs.statusReminder18,
  projectTeammateBooking: newNotifs.projectTeammateBooking,
  monthlyOverview: newNotifs.monthlyOverview,
  newActivity: newNotifs.newActivity,
  }
 }).catch(() => setNotifications(prev => ({ ...prev, [key]: !newValue })));
 };

 const filteredColleagues = useMemo(() => {
 if (!searchQuery) return [];
 return ALL_COLLEAGUES.filter(c =>
 c.name.toLowerCase().includes(searchQuery.toLowerCase())
 );
 }, [searchQuery, ALL_COLLEAGUES]);

 const addMemberToArea = (area: string, Colleague: GroupMember) => {
 setAreaGroups(prev => {
 const current = prev[area] || [];
 if (current.find(m => m.id === Colleague.id)) return prev;
 return { ...prev, [area]: [...current, Colleague] };
 });
 setActiveSearchArea(null);
 setSearchQuery('');
 };

 const removeMemberFromArea = (area: string, memberId: string) => {
 setAreaGroups(prev => ({
 ...prev,
 [area]: (prev[area] || []).filter(m => m.id !== memberId)
 }));
 setActionSheetData(null);
 showConfirmation("Member removed");
 };

 const moveMember = (fromArea: string, toArea: string, member: GroupMember) => {
 setAreaGroups(prev => {
 const next = { ...prev };
 next[fromArea] = (next[fromArea] || []).filter(m => m.id !== member.id);
 next[toArea] = Array.from(new Set([...(next[toArea] || []), member]));
 return next;
 });
 setActionSheetData(null);
 showConfirmation("Member moved");
 };

 const duplicateMember = (toArea: string, member: GroupMember) => {
 setAreaGroups(prev => ({
 ...prev,
 [toArea]: Array.from(new Set([...(prev[toArea] || []), member]))
 }));
 setActionSheetData(null);
 showConfirmation("Member duplicated");
 };

 const showConfirmation = (message: string) => {
 setConfirmation(message);
 setTimeout(() => setConfirmation(null), 1500);
 };

 if (activeView === 'accessibility') {
 return (
 <motion.div initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}} className="fixed inset-0 bg-surface z-[200] flex flex-col font-sans">
 <header className="px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/10 flex items-center gap-4 shadow-sm">
 <button onClick={() => setActiveView('main')}
 className="p-2 hover:bg-surface-container rounded-full transition-colors shrink-0"
 >
 <X className="w-5 h-5 text-on-surface"/>
 </button>
 <div className="flex-grow">
 <h1 className="text-lg font-bold text-on-surface">Accessibility</h1>
 <p className="text-xs text-on-surface-variant">Customise your experience</p>
 </div>
 </header>

 <main className="flex-grow overflow-y-auto p-6 space-y-10 max-w-2xl mx-auto w-full pb-24">
 <section className="space-y-4">
 <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-on-surface-variant/60 ml-2">Input Settings</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <AccessibilityCard icon={<Ear className="w-6 h-6 text-primary"/>}
 label="Screen Reader Support"
 description="Optimise navigation for screen readers"
 isActive={isScreenReader}
 onToggle={onToggleScreenReader}
 />
 </div>
 </section>

 <section className="space-y-4">
 <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-on-surface-variant/60 ml-2">Visual Settings</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <AccessibilityCard icon={<Eye className="w-6 h-6 text-primary"/>}
 label="High Contrast Mode"
 description="Increased visibility for UI elements"
 isActive={isHighContrast}
 onToggle={onToggleHighContrast}
 />
 <AccessibilityCard icon={<Zap className="w-6 h-6 text-primary"/>}
 label="Simplified View" 
 description="Only show the bare essentials of the interface"
 isActive={isSimplifiedView} 
 onToggle={onToggleSimplifiedView} 
 />
 <AccessibilityCard icon={<Type className="w-6 h-6 text-primary"/>}
 label="Large Text (200%)"
 description="Increase font size for readability"
 isActive={isLargeText}
 onToggle={onToggleLargeText}
 />
 </div>
 </section>
 </main>
 </motion.div>
 );
 }

 if (activeView === 'groups') {
 return (
 <motion.div initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}} className="fixed inset-0 bg-surface z-[200] flex flex-col font-sans">
 <header className="px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/10 flex items-center gap-4 shadow-sm">
 <button onClick={() => setActiveView('main')}
 className="p-2 hover:bg-surface-container rounded-full transition-colors shrink-0"
 >
 <X className="w-5 h-5 text-on-surface"/>
 </button>
 <div className="flex-grow">
 <h1 className="text-lg font-bold text-on-surface">Manage Groups</h1>
 <p className="text-xs text-on-surface-variant">Configure area assignments</p>
 </div>
 </header>

 <main className="flex-grow overflow-y-auto p-6 space-y-8 max-w-2xl mx-auto w-full pb-24">
 <section className="space-y-4">
 <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-on-surface-variant/60 ml-2">Company Areas</h2>
 <div className="grid gap-4">
 {ALL_AREAS.map(area => (
 <div key={area} className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10 shadow-sm relative overflow-visible">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-bold text-on-surface">{area}</h3>
 <button onClick={() => setActiveSearchArea(activeSearchArea === area ? null : area)}
 className="p-1.5 hover:bg-surface-container rounded-full transition-colors text-primary"
 >
 <Plus className="w-5 h-5"/>
 </button>
 </div>

 {activeSearchArea === area && (
 <div className="mb-4 relative z-50">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60"/>
 <input autoFocus type="text" placeholder="Search people..." className="w-full bg-surface-container rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 {filteredColleagues.length > 0 && (
 <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 overflow-hidden z-[100] max-h-48 overflow-y-auto">
 {filteredColleagues.map(c => (
 <button key={c.id} onClick={() => addMemberToArea(area, c)}
 className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-container transition-colors text-left"
 >
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${c.color}`}>
 {c.initials}
 </div>
 <span className="text-sm font-bold text-on-surface">{c.name}</span>
 </button>
 ))}
 </div>
 )}
 </div>
 )}

 <div className="flex flex-wrap gap-2">
 <AnimatePresence>
 {(areaGroups[area] || []).map(member => (
 <motion.div initial={{scale: 0.8, opacity: 0}} animate={{scale: 1, opacity: 1}} exit={{scale: 0.8, opacity: 0}} key={member.id} className="relative group">
 <div className="flex items-center gap-2 bg-on-surface/[0.03] dark:bg-on-surface/[0.08] rounded-2xl py-1.5 pl-1.5 pr-1.5 border border-outline-variant/10 transition-colors">
 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${member.color}`}>
 {member.initials}
 </div>
 <span className="text-xs font-bold text-on-surface pr-1">{member.name}</span>
 <button onClick={() => setActionSheetData({ area, member })}
 className="p-1 hover:bg-white/50 rounded-full transition-colors"
 >
 <MoreVertical className="w-3.5 h-3.5 text-on-surface-variant"/>
 </button>
 </div>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>
 </div>
 ))}
 </div>
 </section>

 <section className="space-y-4 pt-4">
 <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-on-surface-variant/60 ml-2">Other</h2>
 <div className="grid gap-4">
 {OTHER_AREAS.map(area => (
 <div key={area} className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10 shadow-sm relative overflow-visible">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-bold text-on-surface">{area}</h3>
 <button onClick={() => setActiveSearchArea(activeSearchArea === area ? null : area)}
 className="p-1.5 hover:bg-surface-container rounded-full transition-colors text-primary"
 >
 <Plus className="w-5 h-5"/>
 </button>
 </div>
 {activeSearchArea === area && (
 <div className="mb-4 relative z-50">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60"/>
 <input autoFocus type="text" placeholder="Search people..." className="w-full bg-surface-container rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 {filteredColleagues.length > 0 && (
 <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 overflow-hidden z-[100] max-h-48 overflow-y-auto">
 {filteredColleagues.map(c => (
 <button key={c.id} onClick={() => addMemberToArea(area, c)}
 className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-container transition-colors text-left"
 >
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${c.color}`}>
 {c.initials}
 </div>
 <span className="text-sm font-bold text-on-surface">{c.name}</span>
 </button>
 ))}
 </div>
 )}
 </div>
 )}
 <div className="flex flex-wrap gap-2">
 {(areaGroups[area] || []).map(member => (
 <div key={member.id} className="flex items-center gap-2 bg-on-surface/[0.03] dark:bg-on-surface/[0.08] rounded-2xl py-1.5 pl-1.5 pr-1.5 border border-outline-variant/10 transition-colors">
 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${member.color}`}>
 {member.initials}
 </div>
 <span className="text-xs font-bold text-on-surface pr-1">{member.name}</span>
 <button onClick={() => setActionSheetData({ area, member })}
 className="p-1 hover:bg-white/50 rounded-full transition-colors"
 >
 <MoreVertical className="w-3.5 h-3.5 text-on-surface-variant"/>
 </button>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </section>
 </main>

 {/* Member Action Sheet */}
 <AnimatePresence>
 {actionSheetData && (
 <MemberActionSheet member={actionSheetData.member} currentArea={actionSheetData.area} areas={TARGET_AREAS} onClose={() => setActionSheetData(null)}
 onRemove={removeMemberFromArea}
 onMove={moveMember}
 onDuplicate={duplicateMember}
 />
 )}
 </AnimatePresence>

 {/* Action Confirmation Toast */}
 <AnimatePresence>
 {confirmation && (
 <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 20}} className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-on-surface text-surface px-6 py-3 rounded-full text-sm font-bold shadow-2xl flex items-center gap-2">
 <Check className="w-4 h-4 text-primary"/>
 {confirmation}
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
 }

 if (activeView === 'room-config') {
 return <RoomConfigMock onBack={() => setActiveView('main')} />;
 }

 if (activeView === 'teammates') {
 const filteredColleaguesSelection = [...fetchedColleagues]
 .filter(c => `${c.name} ${c.surname}`.toLowerCase().includes(teammateSearchQuery.toLowerCase()))
 .sort((a, b) => a.name.localeCompare(b.name));

 const toggleTeammate = (Colleague: Colleague) => {
 setSelectedTeammates(prev => {
 const isSelected = prev.find(c => c.initials === Colleague.initials && c.name === Colleague.name);
 if (isSelected) {
 return prev.filter(c => !(c.initials === Colleague.initials && c.name === Colleague.name));
 }
 if (prev.length >= 5) return prev;
 
 // Clear search query when a teammate is selected (added)
 setTeammateSearchQuery('');
 return [...prev, Colleague];
 });
 };

 const isTeammateSelected = (Colleague: Colleague) => 
 selectedTeammates.some(c => c.initials === Colleague.initials && c.name === Colleague.name);

 return (
 <motion.div initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}} className="fixed inset-0 z-[200] bg-surface flex flex-col font-sans overflow-hidden">
 <header className="px-6 pt-12 pb-6 flex flex-col gap-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <button onClick={() => setActiveView('main')}
 className="p-2 -ml-2 hover:bg-surface-container rounded-full transition-colors"
 >
 <ChevronLeft className="w-6 h-6 text-on-surface"/>
 </button>
 <h1 className="text-2xl font-extrabold text-on-surface">Project Teammates</h1>
 </div>
 <div className="px-3 py-1 bg-surface-container rounded-full text-xs font-bold text-on-surface-variant">
 {selectedTeammates.length}/5 selected
 </div>
 </div>

 <div className="relative">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/40"/>
 <input type="text" placeholder="Search by name..." className="w-full bg-surface-container-low rounded-2xl py-4 pl-12 pr-4 text-on-surface font-bold placeholder:text-on-surface-variant/30 outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-outline-variant/10" value={teammateSearchQuery} onChange={(e) => setTeammateSearchQuery(e.target.value)}
 />
 </div>
 </header>

 <main className="flex-grow overflow-y-auto px-6 pb-40 space-y-2">
 {colleaguesLoading ? (
 <div className="flex items-center justify-center py-16 text-on-surface-variant/40 text-sm font-medium">
 Loading colleagues…
 </div>
 ) : colleaguesError ? (
 <div className="flex flex-col items-center justify-center py-16 gap-4">
   <p className="text-on-surface-variant/40 text-sm font-medium">Could not load colleagues</p>
   <button onClick={fetchColleagues} className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-2xl shadow-sm shadow-primary/20 active:scale-95 transition-transform">
     Retry
   </button>
 </div>
 ) : filteredColleaguesSelection.length === 0 ? (
 <div className="flex items-center justify-center py-16 text-on-surface-variant/40 text-sm font-medium">
 {teammateSearchQuery ? 'No results' : 'No colleagues found'}
 </div>
 ) : filteredColleaguesSelection.map((Colleague) => {
 const active = isTeammateSelected(Colleague);
 return (
 <button key={`${Colleague.name}-${Colleague.surname}`} data-testid="teammate-option" onClick={() => toggleTeammate(Colleague)}
 className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
 active 
 ? 'bg-primary/5 border-primary shadow-sm' 
 : 'bg-surface-container-lowest border-outline-variant/10 hover:border-outline-variant/30'
 } active:scale-[0.98]`}
 >
 <div className="flex items-center gap-4">
 <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ring-2 ring-white/10 ${Colleague.color}`}>
 {Colleague.initials}
 </div>
 <span className="font-bold text-on-surface">{Colleague.name} {Colleague.surname}</span>
 </div>
 {active ? (
 <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
 <Check className="w-4 h-4 text-white" strokeWidth={3}/>
 </div>
 ) : (
 <div className="w-6 h-6 rounded-full border-2 border-outline-variant/20"/>
 )}
 </button>
 );
 })}
 </main>

 <div className="fixed bottom-0 left-0 right-0 p-6 bg-surface-container-lowest/80 backdrop-blur-xl border-t border-outline-variant/10 flex flex-col gap-6 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
 <div className="flex items-center justify-center gap-3">
 {[...Array(5)].map((_, i) => {
 const Colleague = selectedTeammates[i];
 return (
 <motion.div layout key={Colleague ? `${Colleague.name}-${Colleague.surname}` : `empty-${i}`} onClick={Colleague ? () => toggleTeammate(Colleague) : undefined}
 className={`w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
 Colleague 
 ? `border-transparent ring-2 ring-primary/20 cursor-pointer ${Colleague.color}` 
 : 'border-outline-variant/30 bg-surface-container/30'
 }`}
 >
 {Colleague ? (
 <span className="text-xs font-bold text-white">{Colleague.initials}</span>
 ) : null}
 </motion.div>
 );
 })}
 </div>

 <button data-testid="teammate-save" onClick={() => {
 onUpdateProjectTeammates(selectedTeammates);
 setActiveView('main');
 showConfirmation("Project teammates updated");
 }}
 className="w-full bg-primary text-white font-bold py-5 rounded-[24px] shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
 >
 Save preferences
 </button>
 </div>
 </motion.div>
 );
 }

 return (
 <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} className="flex flex-col items-center max-w-lg mx-auto w-full">
 {/* Profile Header Section */}
 <section className="flex flex-col items-center mb-16 mt-8 w-full text-center">
 <div className="relative mb-6">
 {user?.avatar ? (
  <img src={user.avatar} alt={user.name} className="w-32 h-32 rounded-full object-cover shadow-xl" />
 ) : (
  <div className="w-32 h-32 rounded-full bg-primary flex items-center justify-center text-white text-5xl font-extrabold shadow-xl">
  {user?.name?.charAt(0).toUpperCase() ?? '?'}
  </div>
 )}
 </div>
 <h2 className="text-3xl font-bold tracking-tight text-on-surface mb-1">{user?.name ?? '—'}</h2>
 <p className="text-on-surface-variant font-medium text-sm tracking-wide">User type: {user?.role ?? '—'}</p>
 </section>

 {/* Profile Options */}
 <div className="space-y-12 w-full px-2 pb-10">
 {/* Accessibility Group */}
 <section>
 <div className="flex items-center gap-3 mb-4 px-1">
 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
 <AccessibilityIcon className="w-4 h-4" strokeWidth={3}/>
 </div>
 <h3 className="font-headline text-lg text-on-surface-variant font-semibold">Accessibility</h3>
 </div>
 <div className="flex flex-col gap-3">
 <button onClick={() => setActiveView('accessibility')}
 className="w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center justify-between transition-all duration-200 border border-outline-variant/10 hover:border-primary/30 hover:shadow-lg active:scale-[0.98] group shadow-sm"
 >
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
 <AccessibilityIcon className="w-6 h-6 text-primary" strokeWidth={2.5}/>
 </div>
 <span className="font-headline font-bold text-lg text-on-surface">Accessibility settings</span>
 </div>
 <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform"/>
 </button>
 </div>
 </section>

 {/* Account Group */}
 <section>
 <div className="flex items-center gap-3 mb-4 px-1">
 <UserIcon className="w-5 h-5 text-primary"/>
 <h3 className="font-headline text-lg text-on-surface-variant font-semibold">Account</h3>
 </div>
 <div className="flex flex-col gap-3">
 <button onClick={onLogout} className="w-full bg-surface-container-lowest rounded-2xl p-4 flex items-center justify-center gap-3 transition-all duration-200 border border-outline-variant/10 hover:bg-red-50 active:scale-[0.98] shadow-sm text-red-600">
 <LogOut className="w-5 h-5"/>
 <span className="font-headline font-bold text-lg">Logout</span>
 </button>
 </div>
 </section>

 {/* Appearance Group */}
 <section>
 <div className="flex items-center gap-3 mb-4 px-1">
 <Palette className="w-5 h-5 text-primary"/>
 <h3 className="font-headline text-lg text-on-surface-variant font-semibold">Appearance</h3>
 </div>
 <div className="space-y-4">
 <div className="grid grid-cols-3 gap-3">
 <button onClick={() => onSetThemeMode('light')}
 className={`flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200 border shadow-sm ${themeMode === 'light' ? 'bg-surface-container-lowest border-primary ring-4 ring-primary/5' : 'bg-surface-container-lowest border-outline-variant/10 hover:border-primary/20 hover:bg-surface-container-low text-on-surface-variant'}`}
 >
 <Sun className={`w-7 h-7 ${themeMode === 'light' ? 'text-primary' : 'text-slate-400'}`}/>
 <span className={`text-sm font-bold ${themeMode === 'light' ? 'text-on-surface' : 'text-slate-500'}`}>Light</span>
 </button>
 <button onClick={() => onSetThemeMode('dark')}
 className={`flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200 border shadow-sm ${themeMode === 'dark' ? 'bg-surface-container-lowest border-primary ring-4 ring-primary/5' : 'bg-surface-container-lowest border-outline-variant/10 hover:border-primary/20 hover:bg-surface-container-low text-on-surface-variant'}`}
 >
 <Moon className={`w-7 h-7 ${themeMode === 'dark' ? 'text-primary' : 'text-slate-400'}`}/>
 <span className={`text-sm font-bold ${themeMode === 'dark' ? 'text-on-surface' : 'text-slate-500'}`}>Dark</span>
 </button>
 <button onClick={() => onSetThemeMode('system')}
 className={`flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200 border shadow-sm ${themeMode === 'system' ? 'bg-surface-container-lowest border-primary ring-4 ring-primary/5' : 'bg-surface-container-lowest border-outline-variant/10 hover:border-primary/20 hover:bg-surface-container-low text-on-surface-variant'}`}
 >
 <Monitor className={`w-7 h-7 ${themeMode === 'system' ? 'text-primary' : 'text-slate-400'}`}/>
 <span className={`text-sm font-bold ${themeMode === 'system' ? 'text-on-surface' : 'text-slate-500'}`}>System</span>
 <span className={`text-[10px] leading-none ${themeMode === 'system' ? 'text-on-surface-variant' : 'text-slate-400'}`}>{osIsDark ? 'Dark' : 'Light'}</span>
 </button>
 </div>
 </div>
 </section>

 {/* Company Settings Group */}
 <section>
 <div className="flex items-center gap-3 mb-4 px-1">
 <Users className="w-5 h-5 text-primary"/>
 <h3 className="font-headline text-lg text-on-surface-variant font-semibold">Company Settings</h3>
 </div>
 <div className="flex flex-col gap-3">
 <button onClick={() => setActiveView('room-config')}
 className="w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center justify-between transition-all duration-200 border border-outline-variant/10 hover:border-primary/30 hover:shadow-lg active:scale-[0.98] group shadow-sm mb-1"
 >
 <div className="flex items-center gap-4">
 <Edit2 className="w-6 h-6 text-primary"/>
 <span className="font-headline font-bold text-lg text-on-surface">Configure Rooms</span>
 </div>
 <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform"/>
 </button>
 <button onClick={() => setActiveView('groups')}
 className="w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center justify-between transition-all duration-200 border border-outline-variant/10 hover:border-primary/30 hover:shadow-lg active:scale-[0.98] group shadow-sm"
 >
 <div className="flex items-center gap-4">
 <Users className="w-6 h-6 text-primary"/>
 <span className="font-headline font-bold text-lg text-on-surface">Manage groups</span>
 </div>
 <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform"/>
 </button>
 </div>
 </section>

 {/* Email Notification Preferences Group */}
 <section>
 <div className="flex items-center gap-3 mb-4 px-1">
 <Mail className="w-5 h-5 text-primary"/>
 <h3 className="font-headline text-lg text-on-surface-variant font-semibold">Email Notification Preferences</h3>
 </div>
 <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden divide-y divide-outline-variant/5">
 <NotificationToggle label="Receive an email when a place in the office is available (if you are in the waiting list)" isActive={notifications.officeAvailable} onToggle={() => toggleNotification('officeAvailable')}
 />
 <NotificationToggle label="Receive a reminder each day at 11 AM to confirm your working status (if you haven&#39;t yet)" isActive={notifications.statusReminder11} onToggle={() => toggleNotification('statusReminder11')}
 />
 <NotificationToggle label="Receive a 2nd reminder each day at 18 PM to confirm your working status (if you haven&#39;t yet)" isActive={notifications.statusReminder18} onToggle={() => toggleNotification('statusReminder18')}
 />
 <NotificationToggle label="Receive an email every Monday at 9.00 AM with an overview of bookings made by your project teammates for the week" isActive={notifications.projectTeammateBooking} onToggle={() => toggleNotification('projectTeammateBooking')}
 />
 <NotificationToggle label="Receive an email at the end of the month for a monthly overview of your presence stats" isActive={notifications.monthlyOverview} onToggle={() => toggleNotification('monthlyOverview')}
 />
 <NotificationToggle label="Receive an email when a new activity is organised" isActive={notifications.newActivity} onToggle={() => toggleNotification('newActivity')}
 />
 </div>
 </section>

 {/* Project Teammates Group */}
 <section>
 <div className="flex items-center gap-3 mb-4 px-1">
 <Star className="w-5 h-5 text-amber-400 fill-amber-400"/>
 <h3 className="font-headline text-lg text-on-surface-variant font-semibold">Project Teammates</h3>
 </div>
 <div className="flex flex-col gap-3">
 <button data-testid="profile-manage-teammates" onClick={() => {
 setSelectedTeammates(projectTeammates);
 setActiveView('teammates');
 }}
 className="w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center justify-between transition-all duration-200 border border-outline-variant/10 hover:border-primary/30 hover:shadow-lg active:scale-[0.98] group shadow-sm"
 >
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
 <Star className="w-6 h-6 text-amber-400 fill-amber-400"/>
 </div>
 <div className="flex flex-col items-start translate-y-[-1px]">
 <span className="font-headline font-bold text-lg text-on-surface">Manage Project Teammates</span>
 </div>
 </div>
 <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform"/>
 </button>
 </div>
 </section>

 {/* User Manual Group */}
 <section>
 <div className="flex items-center gap-3 mb-4 px-1">
 <Book className="w-5 h-5 text-primary"/>
 <h3 className="font-headline text-lg text-on-surface-variant font-semibold">User Manual</h3>
 </div>
 <div className="flex flex-col gap-3">
 <button className="w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center justify-between transition-all duration-200 border border-outline-variant/10 hover:border-primary/30 hover:shadow-lg active:scale-[0.98] group shadow-sm">
 <div className="flex items-center gap-4">
 <Book className="w-6 h-6 text-primary"/>
 <span className="font-headline font-bold text-lg text-on-surface">Read the app user manual</span>
 </div>
 <ExternalLink className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform"/>
 </button>
 </div>
 </section>
 </div>

 {/* Footer */}
 <footer className="mt-20 mb-10 text-center">
 <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400 opacity-60">Version 1.0.0 Beta</p>
 </footer>
 </motion.div>
 );
}
