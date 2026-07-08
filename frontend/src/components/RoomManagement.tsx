import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Edit2, Check, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRooms, createRoom, updateRoom, deleteRoom } from '../services/api';
import type { Room, Role } from '../services/api';

const ROOM_TYPE_LABELS: Record<Room['type'], string> = {
  open_space: 'Open Space',
  lab: 'Lab',
  admin: 'Admin',
  management: 'Management',
};

// 'owner' is deliberately excluded — the owner always sees every room regardless.
const SELECTABLE_ROLES: Role[] = ['employee', 'lab_responsible', 'admin_member', 'director'];
const ROLE_LABELS: Record<Role, string> = {
  employee: 'Employee',
  lab_responsible: 'Lab Responsible',
  admin_member: 'Admin Member',
  director: 'Director',
  owner: 'Owner',
};

const DEFAULT_COLOR = '#3b82f6';

interface RoomManagementProps {
  onBack: () => void;
  onRoomsChanged?: (rooms: Room[]) => void;
}

export default function RoomManagement({ onBack, onRoomsChanged }: RoomManagementProps) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState(0);
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [editVisibleRoles, setEditVisibleRoles] = useState<Role[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newType, setNewType] = useState<Room['type']>('open_space');

  const loadRooms = () => {
    getRooms()
      .then((data) => {
        setRooms(data);
        onRoomsChanged?.(data);
      })
      .catch((err) => setError((err as Error).message));
  };

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user || user.role !== 'owner') return null;

  const handleEdit = (room: Room) => {
    setIsCreating(false);
    setEditingId(room.id);
    setEditName(room.name);
    setEditCapacity(room.capacity);
    setEditColor(room.color || DEFAULT_COLOR);
    setEditVisibleRoles(room.visibleRoles ?? []);
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await updateRoom(editingId, { name: editName, capacity: editCapacity, color: editColor, visibleRoles: editVisibleRoles });
      setEditingId(null);
      loadRooms();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (room: Room) => {
    if (!window.confirm(`Eliminare la stanza "${room.name}"?`)) return;
    try {
      await deleteRoom(room.id);
      loadRooms();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    setEditName('New Room');
    setEditCapacity(10);
    setEditColor(DEFAULT_COLOR);
    setNewType('open_space');
    setEditVisibleRoles([]);
  };

  const handleCreate = async () => {
    try {
      await createRoom({ name: editName, capacity: editCapacity, type: newType, color: editColor, visibleRoles: editVisibleRoles });
      setIsCreating(false);
      loadRooms();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleRole = (role: Role) => {
    setEditVisibleRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  return createPortal(
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="fixed inset-0 bg-surface z-[200] flex flex-col font-sans">
      <header className="px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/10 flex items-center gap-4 shadow-sm">
        <button onClick={onBack} className="p-2 hover:bg-surface-container rounded-full transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5 text-on-surface"/>
        </button>
        <div className="flex-grow">
          <h1 className="font-headline text-lg font-bold text-on-surface">Gestisci Stanze</h1>
          <p className="text-xs text-on-surface-variant">Solo owner &middot; nome, colore e capienza</p>
        </div>
        <button onClick={startCreate} className="p-2 bg-primary/10 hover:bg-primary/20 rounded-full transition-colors text-primary">
          <Plus className="w-5 h-5"/>
        </button>
      </header>

      <main className="flex-grow overflow-y-auto p-6 space-y-4 max-w-2xl mx-auto w-full pb-24">
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4"/>
            </button>
          </div>
        )}

        <div className="grid gap-4">
          {isCreating && (
            <div className="bg-surface-container-lowest rounded-3xl p-5 border border-primary/40 shadow-sm">
              <div className="flex flex-col gap-3">
                <input
                  className="bg-surface-container rounded-lg px-3 py-1.5 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    className="bg-surface-container rounded-lg px-2 py-1.5 text-xs font-bold border-none outline-none"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as Room['type'])}
                  >
                    {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Capienza:</span>
                    <input
                      type="number"
                      min={1}
                      className="bg-surface-container rounded-lg px-2 py-1 text-xs font-bold border-none outline-none w-16"
                      value={editCapacity}
                      onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <input
                    type="color"
                    className="w-8 h-8 rounded-full border-none cursor-pointer bg-transparent"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                  />
                </div>
                {newType !== 'open_space' && (
                  <RoleVisibilityPicker selected={editVisibleRoles} onToggle={toggleRole} />
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsCreating(false)} className="px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">
                    Annulla
                  </button>
                  <button onClick={handleCreate} className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-lg hover:opacity-90 transition-opacity">
                    Crea
                  </button>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {rooms.map((room) => (
              <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={room.id} className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4 flex-grow">
                  <div className="w-6 h-6 rounded-full shadow-inner shrink-0" style={{ backgroundColor: room.color || DEFAULT_COLOR }}/>

                  {editingId === room.id ? (
                    <div className="flex flex-col gap-2 flex-grow mr-4">
                      <input
                        className="bg-surface-container rounded-lg px-3 py-1.5 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase">Capienza:</span>
                        <input
                          type="number"
                          min={1}
                          className="bg-surface-container rounded-lg px-2 py-1 text-xs font-bold border-none outline-none w-16"
                          value={editCapacity}
                          onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)}
                        />
                        <input
                          type="color"
                          className="w-6 h-6 rounded-full border-none cursor-pointer bg-transparent"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                        />
                      </div>
                      {room.type !== 'open_space' && (
                        <RoleVisibilityPicker selected={editVisibleRoles} onToggle={toggleRole} />
                      )}
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-bold text-on-surface">{room.name}</h3>
                      <p className="text-xs text-on-surface-variant">
                        {ROOM_TYPE_LABELS[room.type]} &middot; Capienza: {room.capacity}
                        {room.type !== 'open_space' && (
                          <> &middot; Visibile a: {room.visibleRoles?.length ? room.visibleRoles.map((r) => ROLE_LABELS[r]).join(', ') : 'solo Owner'}</>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {editingId === room.id ? (
                    <button onClick={handleSave} className="p-2 hover:bg-green-50 text-green-600 rounded-full transition-colors">
                      <Check className="w-5 h-5"/>
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleEdit(room)} className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant">
                        <Edit2 className="w-4 h-4"/>
                      </button>
                      <button onClick={() => handleDelete(room)} className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </motion.div>,
    document.body
  );
}

function RoleVisibilityPicker({ selected, onToggle }: { selected: Role[]; onToggle: (role: Role) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-bold text-on-surface-variant uppercase">Visibile a:</span>
      {SELECTABLE_ROLES.map((role) => (
        <label key={role} className="flex items-center gap-1 text-xs font-bold text-on-surface cursor-pointer">
          <input type="checkbox" checked={selected.includes(role)} onChange={() => onToggle(role)} />
          {ROLE_LABELS[role]}
        </label>
      ))}
    </div>
  );
}
