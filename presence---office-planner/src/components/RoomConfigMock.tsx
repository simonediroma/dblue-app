import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Edit2, Check, ChevronLeft } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  color: string;
  capacity: number;
}

const INITIAL_ROOMS: Room[] = [
  { id: '1', name: 'Blue Room', color: 'bg-blue-500', capacity: 10 },
  { id: '2', name: 'Red Room', color: 'bg-red-500', capacity: 8 },
  { id: '3', name: 'Green Room', color: 'bg-green-500', capacity: 12 },
  { id: '4', name: 'Lab', color: 'bg-gradient-to-r from-[#ff0000] via-[#0000ff] to-[#00ff00]', capacity: 6 },
  { id: '5', name: 'Admin', color: 'bg-indigo-500', capacity: 4 },
  { id: '6', name: 'Management Room', color: 'bg-amber-500', capacity: 4 },
];

interface RoomConfigMockProps {
  onBack: () => void;
}

export default function RoomConfigMock({ onBack }: RoomConfigMockProps) {
  const [rooms, setRooms] = useState<room[]>(INITIAL_ROOMS);
  const [editingId, setEditingId] = useState<string |="" null="">(null);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState(0);

  const handleDelete = (id: string) => {
    setRooms(rooms.filter(r => r.id !== id));
  };

  const handleEdit = (room: Room) => {
    setEditingId(room.id);
    setEditName(room.name);
    setEditCapacity(room.capacity);
  };

  const saveEdit = () => {
    setRooms(rooms.map(r => r.id === editingId ? { ...r, name: editName, capacity: editCapacity } : r));
    setEditingId(null);
  };

  const addRoom = () => {
    const newRoom: Room = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Room',
      color: 'bg-primary',
      capacity: 10
    };
    setRooms([...rooms, newRoom]);
    handleEdit(newRoom);
  };

  return (
    <motion.div initial="{{" opacity:="" 0,="" x:="" 20="" }}="" animate="{{" opacity:="" 1,="" x:="" 0="" }}="" exit="{{" opacity:="" 0,="" x:="" -20="" }}="" classname="fixed inset-0 bg-surface z-[200] flex flex-col font-sans">
      <header classname="px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/10 flex items-center gap-4 shadow-sm">
        <button onclick="{onBack}" classname="p-2 hover:bg-surface-container rounded-full transition-colors shrink-0">
          <x classname="w-5 h-5 text-on-surface"/>
        </button>
        <div classname="flex-grow">
          <h1 classname="text-lg font-bold text-on-surface">Configure Rooms</h1>
          <p classname="text-xs text-on-surface-variant">Mock-up room management</p>
        </div>
        <button onclick="{addRoom}" classname="p-2 bg-primary/10 hover:bg-primary/20 rounded-full transition-colors text-primary">
          <plus classname="w-5 h-5"/>
        </button>
      </header>

      <main classname="flex-grow overflow-y-auto p-6 space-y-4 max-w-2xl mx-auto w-full pb-24">
        <div classname="bg-warning-bg border border-warning-stroke p-4 rounded-2xl mb-6">
          <p classname="text-xs font-medium text-warning-text leading-tight">
            <strong>Note:</strong> This is a mock-up interface. Changes made here will not persist or affect actual bookings.
          </p>
        </div>

        <div classname="grid gap-4">
          <animatepresence mode="popLayout">
            {rooms.map(room => (
              <motion.div layout="" initial="{{" opacity:="" 0,="" scale:="" 0.95="" }}="" animate="{{" opacity:="" 1,="" scale:="" 1="" }}="" exit="{{" opacity:="" 0,="" scale:="" 0.95="" }}="" key="{room.id}" classname="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10 shadow-sm flex items-center justify-between">
                <div classname="flex items-center gap-4 flex-grow">
                  <div classname="{`w-6" h-6="" rounded-full="" shadow-inner="" ${room.color}`}=""/>
                  
                  {editingId === room.id ? (
                    <div classname="flex flex-col gap-2 flex-grow mr-4">
                      <input classname="bg-surface-container rounded-lg px-3 py-1.5 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value="{editName}" onchange="{(e)" ==""> setEditName(e.target.value)}
                        autoFocus
                      />
                      <div classname="flex items-center gap-2">
                        <span classname="text-[10px] font-bold text-on-surface-variant uppercase">Capacity:</span>
                        <input type="number" classname="bg-surface-container rounded-lg px-2 py-1 text-xs font-bold border-none outline-none w-16" value="{editCapacity}" onchange="{(e)" ==""> setEditCapacity(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 classname="font-bold text-on-surface">{room.name}</h3>
                      <p classname="text-xs text-on-surface-variant">Capacity: {room.capacity} places</p>
                    </div>
                  )}
                </div>

                <div classname="flex items-center gap-1">
                  {editingId === room.id ? (
                    <button onclick="{saveEdit}" classname="p-2 hover:bg-green-50 text-green-600 rounded-full transition-colors">
                      <check classname="w-5 h-5"/>
                    </button>
                  ) : (
                    <>
                      <button onclick="{()" ==""> handleEdit(room)}
                        className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
                      >
                        <edit2 classname="w-4 h-4"/>
                      </button>
                      <button onclick="{()" ==""> handleDelete(room.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors"
                      >
                        <trash2 classname="w-4 h-4"/>
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </motion.div>
  );
}
