import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Check, Users, ArrowRight } from 'lucide-react';
import { COLLEAGUES, Colleague } from '../constants/colleagues';

interface OnboardingProps {
 onComplete: (selectedTeammates: Colleague[]) => void;
 onSkip: () => void;
}

export default function Onboarding({ onComplete, onSkip }: OnboardingProps) {
 const [step, setStep] = useState<1 | 2>(1);
 const [selectedColleagues, setSelectedColleagues] = useState<Colleague[]>([]);
 const [searchQuery, setSearchQuery] = useState('');

 const filteredColleagues = COLLEAGUES.filter(c => 
 `${c.name} ${c.surname}`.toLowerCase().includes(searchQuery.toLowerCase())
 );

 const toggleColleague = (Colleague: Colleague) => {
 setSelectedColleagues(prev => {
 const isSelected = prev.find(c => c.initials === Colleague.initials && c.name === Colleague.name);
 if (isSelected) {
 return prev.filter(c => !(c.initials === Colleague.initials && c.name === Colleague.name));
 }
 if (prev.length >= 5) return prev;
 
 // Clear search query when a teammate is selected (added)
 setSearchQuery('');
 return [...prev, Colleague];
 });
 };

 const isSelected = (Colleague: Colleague) => 
 selectedColleagues.some(c => c.initials === Colleague.initials && c.name === Colleague.name);

 return (
 <div className="fixed inset-0 z-[500] bg-surface flex flex-col font-sans overflow-hidden">
 <AnimatePresence mode="wait">
 {step === 1 ? (
 <motion.div key="step1" initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, scale: 0.95}} className="flex-grow flex flex-col items-center justify-center p-8 max-w-lg mx-auto text-center">
 <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center mb-10">
 <Users className="w-10 h-10 text-primary" strokeWidth={2.5}/>
 </div>
 
 <h1 className="text-3xl font-extrabold text-on-surface mb-6 leading-tight">
 Who do you currently work with most?
 </h1>
 
 <p className="text-on-surface-variant text-lg font-medium leading-relaxed mb-12">
 Pick up to 5 project teammates and the app will help you plan office days where you overlap. Make collaboration count!
 </p>

 <div className="w-full space-y-4">
 <button onClick={() => setStep(2)}
 className="w-full bg-primary text-white font-bold py-5 rounded-[24px] shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
 >
 <span>Choose my project teammates</span>
 <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
 </button>
 
 <button onClick={onSkip} className="w-full py-4 text-on-surface-variant font-bold hover:bg-surface-container rounded-[24px] transition-colors">
 Skip (for now)
 </button>
 </div>

 <p className="mt-8 text-on-surface-variant/50 text-sm font-medium">
 You can edit your project teammates preferences later in "Profile"
 </p>
 </motion.div>
 ) : (
 <motion.div key="step2" initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}} className="flex-grow flex flex-col h-full overflow-hidden">
 <header className="px-6 pt-12 pb-6 flex flex-col gap-6">
 <div className="flex items-center justify-between">
 <h1 className="text-2xl font-extrabold text-on-surface">Choose your project teammates</h1>
 <div className="px-3 py-1 bg-surface-container rounded-full text-xs font-bold text-on-surface-variant">
 {selectedColleagues.length}/5 selected
 </div>
 </div>

 <div className="relative">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/40"/>
 <input type="text" placeholder="Search by name..." className="w-full bg-surface-container-low rounded-2xl py-4 pl-12 pr-4 text-on-surface font-bold placeholder:text-on-surface-variant/30 outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-outline-variant/10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 </header>

 <main className="flex-grow overflow-y-auto px-6 pb-40 space-y-2">
 {filteredColleagues.map((Colleague) => {
 const active = isSelected(Colleague);
 return (
 <button key={`${Colleague.name}-${Colleague.surname}`} onClick={() => toggleColleague(Colleague)}
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

 {/* Selection Tray */}
 <div className="fixed bottom-0 left-0 right-0 p-6 bg-surface-container-lowest/80 backdrop-blur-xl border-t border-outline-variant/10 flex flex-col gap-6 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
 <div className="flex items-center justify-center gap-3">
 {[...Array(5)].map((_, i) => {
 const Colleague = selectedColleagues[i];
 return (
 <motion.div layout key={Colleague ? `${Colleague.name}-${Colleague.surname}` : `empty-${i}`} onClick={Colleague ? () => toggleColleague(Colleague) : undefined}
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

 <button disabled={selectedColleagues.length === 0} onClick={() => onComplete(selectedColleagues)}
 className="w-full bg-primary text-white font-bold py-5 rounded-[24px] shadow-lg shadow-primary/20 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-[0.98]"
 >
 Start planning
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}
