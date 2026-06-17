import React from 'react';
import { ArrowLeft, Headset, Check } from 'lucide-react';
import { motion } from 'motion/react';

import { getFictionalDayName, months } from '../utils/dateUtils';

interface Room {
  id: string;
  name: string;
  color: string;
  capacity?: string;
}

const ROOMS: Room[] = [
  { id: 'blue', name: 'Blue Room', color: 'bg-blue-500', capacity: '6/8' },
  { id: 'red', name: 'Red Room', color: 'bg-red-500', capacity: '3/8' },
  { id: 'green', name: 'Green Room', color: 'bg-green-500', capacity: '7/8' },
  { id: 'innovation', name: 'Lab', color: 'bg-gradient-to-r from-[#ff0000] via-[#0000ff] to-[#00ff00]', capacity: '3/6' },
  { id: 'management', name: 'Management Room', color: 'bg-amber-500', capacity: '0/4' },
  { id: 'admin', name: 'Admin', color: 'bg-indigo-500', capacity: '0/4' },
];

interface RoomSelectionProps {
  date: string;
  onSelect: (roomName: string) => void;
  onBack: () => void;
  mode?: 'confirm' | 'plan';
  plannedRoom?: string;
}

export default function RoomSelection({ date, onSelect, onBack, mode = 'confirm', plannedRoom }: RoomSelectionProps) {
  const d = new Date(date + 'T00:00:00');
  const formattedDate = `${getFictionalDayName(d, 'long')}, ${d.getDate()} ${months[d.getMonth()]}`.toUpperCase();

  const title = mode === 'confirm' ? 'Confirm your status' : 'Plan Workspace Use';
  const subtitle = mode === 'confirm' ? 'Where are you sitting today?' : 'What do you plan to do at the office?';
  const sectionTitle = mode === 'confirm' ? 'Say good morning from...' : 'I plan to use a desk in...';

  return (
    <motion.div initial="{{" opacity:="" 0,="" x:="" 20="" }}="" animate="{{" opacity:="" 1,="" x:="" 0="" }}="" exit="{{" opacity:="" 0,="" x:="" -20="" }}="" classname="fixed inset-0 z-[150] bg-surface flex flex-col">
      <header classname="px-6 py-8 flex flex-col gap-8">
        <button onclick="{onBack}" classname="flex items-center gap-2 font-headline font-semibold text-on-surface hover:text-primary transition-colors active:scale-95 w-fit">
          <arrowleft classname="w-5 h-5"/>
          <span>Back to planning</span>
        </button>

        <div classname="text-center max-w-xl mx-auto w-full">
          <div classname="font-headline text-on-surface-variant font-bold text-sm tracking-widest mb-6 opacity-80 uppercase">{formattedDate}</div>
          <h1 classname="font-headline font-extrabold text-4xl text-on-surface mb-2 tracking-tight">{title}</h1>
          <p classname="text-on-surface-variant text-base">{subtitle}</p>
        </div>
      </header>

      <main classname="px-6 flex flex-col gap-6 max-w-xl mx-auto w-full">
        <div>
          <h3 classname="font-headline font-bold text-lg text-on-surface/70 mb-4 tracking-tight">{sectionTitle}</h3>
          <div classname="flex flex-col gap-3">
            {ROOMS.map(room => {
              const isPlanned = room.name === plannedRoom;
              return (
                <button key="{room.id}" onclick="{()" ==""> onSelect(room.name)}
                  className={`w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center justify-between transition-all duration-200 border ${isPlanned ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant/10'} hover:border-primary/40 hover:shadow-lg active:scale-[0.98] group shadow-sm relative`}
                >
                  {isPlanned && (
                    <div classname="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-bounce-subtle">
                      Planned
                    </div>
                  )}
                  <div classname="flex items-center gap-4">
                    <div classname="{`w-6" h-6="" rounded-full="" flex-shrink-0="" shadow-sm="" ${room.color}`}=""/>
                    <span classname="{`font-headline" font-bold="" text-lg="" transition-colors="" ${isplanned="" ?="" 'text-primary'="" :="" 'text-on-surface="" group-hover:text-primary'}`}="">
                      {room.name}
                    </span>
                  </div>
                  <div classname="flex items-center gap-3">
                    {room.capacity && (
                      <span classname="text-sm font-sans font-semibold text-on-surface-variant/60">{room.capacity}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div classname="h-[1px] w-full bg-outline-variant/20 my-2"/>

        <button onclick="{()" ==""> onSelect('No Desk')}
          className={`w-full bg-surface-container-lowest rounded-2xl p-6 flex items-center gap-4 transition-all duration-200 border ${plannedRoom === 'No Desk' || plannedRoom === 'No desk' ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant/20'} hover:border-primary/40 hover:shadow-lg active:scale-[0.98] shadow-sm group`}
        >
          <div classname="bg-primary/5 p-3 rounded-full group-hover:bg-primary/10 transition-colors">
             <headset classname="w-6 h-6 text-primary"/>
          </div>
          <span classname="{`font-headline" font-bold="" text-xl="" ${plannedroom="==" 'no="" desk'="" ||="" plannedroom="==" 'no="" desk'="" ?="" 'text-primary'="" :="" 'text-on-surface'}`}="">Not Using a Desk</span>
        </button>
      </main>
    </motion.div>
  );
}
