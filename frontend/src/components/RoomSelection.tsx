import { ArrowLeft, Headset } from 'lucide-react';
import { motion } from 'motion/react';

import { getFictionalDayName, months } from '../utils/dateUtils';
import type { Room } from '../services/api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const roomTypeColor: Record<string, string> = {
  open_space: 'bg-blue-500',
  lab: 'bg-gradient-to-r from-[#ff0000] via-[#0000ff] to-[#00ff00]',
  admin: 'bg-indigo-500',
  management: 'bg-amber-500',
};
const fallbackColors = ['bg-red-500', 'bg-green-500', 'bg-purple-500', 'bg-teal-500'];

interface RoomSelectionProps {
  date: string;
  rooms: Room[];
  onSelect: (roomName: string) => void;
  onBack: () => void;
  mode?: 'confirm' | 'plan';
  plannedRoom?: string;
}

export default function RoomSelection({ date, rooms, onSelect, onBack, mode = 'confirm', plannedRoom }: RoomSelectionProps) {
  useBodyScrollLock();
  const d = new Date(date + 'T00:00:00');
  const formattedDate = `${getFictionalDayName(d, 'long')}, ${d.getDate()} ${months[d.getMonth()]}`.toUpperCase();

  const title = mode === 'confirm' ? 'Confirm your status' : 'Plan Workspace Use';
  const subtitle = mode === 'confirm' ? 'Where are you sitting today?' : 'What do you plan to do at the office?';
  const sectionTitle = mode === 'confirm' ? 'Say good morning from...' : 'I plan to use a desk in...';

  return (
    <motion.div initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -20}} className="fixed inset-0 z-[150] bg-surface flex flex-col">
      <header className="px-6 py-8 flex flex-col gap-8">
        <button onClick={onBack} className="flex items-center gap-2 font-headline font-semibold text-on-surface hover:text-primary transition-colors active:scale-95 w-fit">
          <ArrowLeft className="w-5 h-5"/>
          <span>Back to planning</span>
        </button>

        <div className="text-center max-w-xl mx-auto w-full">
          <div className="font-headline text-on-surface-variant font-bold text-sm tracking-widest mb-6 opacity-80 uppercase">{formattedDate}</div>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface mb-2 tracking-tight">{title}</h1>
          <p className="text-on-surface-variant text-base">{subtitle}</p>
        </div>
      </header>

      <main className="px-6 flex flex-col gap-6 max-w-xl mx-auto w-full flex-1 overflow-y-auto pb-8">
        <div>
          <h3 className="font-headline font-bold text-lg text-on-surface/70 mb-4 tracking-tight">{sectionTitle}</h3>
          <div className="flex flex-col gap-3">
            {rooms.map((room, i) => {
              const color = roomTypeColor[room.type] ?? fallbackColors[i % fallbackColors.length];
              const isPlanned = room.name === plannedRoom;
              return (
                <button key={room.id} onClick={() => onSelect(room.name)}
                  className={`w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center justify-between transition-all duration-200 border ${isPlanned ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant/10'} hover:border-primary/40 hover:shadow-lg active:scale-[0.98] group shadow-sm relative`}
                >
                  {isPlanned && (
                    <div className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-bounce-subtle">
                      Planned
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 shadow-sm ${color}`}/>
                    <span className={`font-headline font-bold text-lg transition-colors ${isPlanned ? 'text-primary' : 'text-on-surface group-hover:text-primary'}`}>
                      {room.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-[1px] w-full bg-outline-variant/20 my-2"/>

        <button onClick={() => onSelect('No Desk')}
          className={`w-full bg-surface-container-lowest rounded-2xl p-6 flex items-center gap-4 transition-all duration-200 border ${plannedRoom === 'No Desk' ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant/20'} hover:border-primary/40 hover:shadow-lg active:scale-[0.98] shadow-sm group`}
        >
          <div className="bg-primary/5 p-3 rounded-full group-hover:bg-primary/10 transition-colors">
            <Headset className="w-6 h-6 text-primary"/>
          </div>
          <span className={`font-headline font-bold text-xl ${plannedRoom === 'No Desk' ? 'text-primary' : 'text-on-surface'}`}>Not Using a Desk</span>
        </button>
      </main>
    </motion.div>
  );
}
