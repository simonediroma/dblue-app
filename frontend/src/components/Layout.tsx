import { CalendarDays, BarChart3, User, Landmark } from 'lucide-react';
import { UserRole } from '../types';

interface LayoutProps {
 children: React.ReactNode;
 activeTab: 'plan' | 'stats' | 'profile' | 'organisation';
 onTabChange: (tab: 'plan' | 'stats' | 'profile' | 'organisation') => void;
 isSimplifiedView?: boolean;
 userRole: UserRole;
}

export default function Layout({ children, activeTab, onTabChange, isSimplifiedView, userRole }: LayoutProps) {
 const isDirector = userRole === UserRole.DIRECTOR;

 return (
 <div className="min-h-screen bg-surface flex flex-col snap-y snap-proximity">
 {/* Top App Bar - Made theme-aware to hide overflowing past days */}
 <header className="fixed top-0 w-full z-50 bg-surface-container-lowest shadow-sm flex items-center px-4 sm:px-8 h-[52px] sm:h-[56px] border-b border-outline-variant/10">
 <div className="flex-1 flex justify-center md:justify-start">
 <img alt="Deepblue Logo" className="h-6 w-auto object-contain" referrerPolicy="no-referrer" src="https://lh3.googleusercontent.com/aida/ADBb0ujox90N8fWDpkR4qn73R02zwMDUCZBglgc_7vVLHrYPRjSw9iko4im6xt4_MM1CikoU8v7DuiHFfKtxcqYMB-UWNUOwp8xv1_PdbtZK2r33ypOR1nB-2mQyCBoXdiuLU56cDP6Km-GcvpTi8Nm3sOEv9NowLpAl24yC_DQ4xCnSxAG7az5ZdpL369w7-wRBH0HDe9B2ta0Nf_gTUHQH568mmOnOVqApJjUaichLiqScyTjfj-EE3iuSmliPCGfiBRNUTrjOFMPq"/>
 </div>

 {/* Desktop Nav - Centered on LG, Right on MD */}
 <div className="hidden md:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2 items-center gap-4 lg:gap-8">
 <button onClick={() => onTabChange('plan')}
 className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${activeTab === 'plan' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
 >
 <CalendarDays className={`w-5 h-5 ${activeTab === 'plan' ? 'fill-current' : ''}`}/>
 <span className="font-headline text-sm font-bold tracking-wide uppercase">Plan</span>
 </button>
 {!isSimplifiedView && (
 <button onClick={() => onTabChange('stats')}
 className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${activeTab === 'stats' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
 >
 <BarChart3 className={`w-5 h-5 ${activeTab === 'stats' ? 'fill-current' : ''}`}/>
 <span className="font-headline text-sm font-bold tracking-wide uppercase">My stats</span>
 </button>
 )}
 <button onClick={() => onTabChange('profile')}
 className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${activeTab === 'profile' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
 >
 <User className={`w-5 h-5 ${activeTab === 'profile' ? 'fill-current' : ''}`}/>
 <span className="font-headline text-sm font-bold tracking-wide uppercase">Profile</span>
 </button>
 {isDirector && (
 <button onClick={() => onTabChange('organisation')}
 className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${activeTab === 'organisation' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
 >
 <Landmark className={`w-5 h-5 ${activeTab === 'organisation' ? 'fill-current' : ''}`}/>
 <span className="font-headline text-sm font-bold tracking-wide uppercase">Organisation</span>
 </button>
 )}
 </div>

 {/* Right side spacer for desktop layout balance only on LG */}
 <div className="hidden lg:flex flex-1 justify-end"/>
 </header>

 {/* Main Content */}
 <main className="flex-1 pb-24 sm:pb-32 px-4 sm:px-6 max-w-xl mx-auto w-full pt-8 sm:pt-10">
 {children}
 </main>

 {/* Navigation Bar - Mobile Only */}
 <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest/90 backdrop-blur-md border-t border-outline-variant/30 px-6 py-4 flex justify-around items-center z-50 md:hidden">
 <button onClick={() => onTabChange('plan')}
 className="flex flex-col items-center gap-1 group transition-all"
 >
 <CalendarDays className={`w-6 h-6 transition-all ${activeTab === 'plan' ? 'text-primary fill-current' : 'text-on-surface-variant group-hover:text-primary'}`}/>
 <span className={`font-headline text-[10px] font-bold tracking-wide uppercase transition-all ${activeTab === 'plan' ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`}>PLAN</span>
 </button>
 {!isSimplifiedView && (
 <button onClick={() => onTabChange('stats')}
 className="flex flex-col items-center gap-1 group transition-all"
 >
 <BarChart3 className={`w-6 h-6 transition-all ${activeTab === 'stats' ? 'text-primary fill-current' : 'text-on-surface-variant group-hover:text-primary'}`}/>
 <span className={`font-headline text-[10px] font-bold tracking-wide uppercase transition-all ${activeTab === 'stats' ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`}>MY STATS</span>
 </button>
 )}
 <button onClick={() => onTabChange('profile')}
 className="flex flex-col items-center gap-1 group transition-all"
 >
 <User className={`w-6 h-6 transition-all ${activeTab === 'profile' ? 'text-primary fill-current' : 'text-on-surface-variant group-hover:text-primary'}`}/>
 <span className={`font-headline text-[10px] font-bold tracking-wide uppercase transition-all ${activeTab === 'profile' ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`}>PROFILE</span>
 </button>
 {isDirector && (
 <button onClick={() => onTabChange('organisation')}
 className="flex flex-col items-center gap-1 group transition-all"
 >
 <Landmark className={`w-6 h-6 transition-all ${activeTab === 'organisation' ? 'text-primary fill-current' : 'text-on-surface-variant group-hover:text-primary'}`}/>
 <span className={`font-headline text-[10px] font-bold tracking-wide uppercase transition-all ${activeTab === 'organisation' ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`}>ORG</span>
 </button>
 )}
 </nav>
 </div>
 );
}
