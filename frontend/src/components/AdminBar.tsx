import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { triggerSeed } from '../services/api';
import type { SeedSummary, Room } from '../services/api';
import RoomManagement from './RoomManagement';

type SeedState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; summary: SeedSummary }
  | { status: 'error'; message: string };

interface AdminBarProps {
  onRoomsChanged?: (rooms: Room[]) => void;
}

export default function AdminBar({ onRoomsChanged }: AdminBarProps) {
  const { user } = useAuth();
  const [state, setState] = useState<SeedState>({ status: 'idle' });
  const [showRoomManagement, setShowRoomManagement] = useState(false);

  if (!user || (user.role !== 'owner' && user.role !== 'director')) return null;

  async function handleSeed(fresh: boolean) {
    setState({ status: 'loading' });
    try {
      const { summary } = await triggerSeed(fresh);
      setState({ status: 'success', summary });
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  }

  return (
    <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-50 bg-[#0f172a]/95 border-t border-violet-500/40 backdrop-blur-sm px-4 py-2 flex items-center gap-3 text-xs">
      <span className="text-violet-400 font-mono font-semibold shrink-0">⚙ Dev</span>

      <div className="flex items-center gap-2 flex-1 flex-wrap">
        <button
          onClick={() => handleSeed(true)}
          disabled={state.status === 'loading'}
          className="px-3 py-1 rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium transition-colors"
        >
          {state.status === 'loading' ? '...' : 'Seed DB (fresh)'}
        </button>
        <button
          onClick={() => handleSeed(false)}
          disabled={state.status === 'loading'}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium transition-colors"
        >
          {state.status === 'loading' ? '...' : 'Seed DB (upsert)'}
        </button>

        {user.role === 'owner' && (
          <button
            onClick={() => setShowRoomManagement(true)}
            className="px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white font-medium transition-colors"
          >
            Gestisci Stanze
          </button>
        )}

        {state.status === 'success' && (
          <span className="text-green-400">
            ✓ {state.summary.users} utenti · {state.summary.rooms} rooms · {state.summary.workingStatuses} status · {state.summary.rangeMe}
            {state.summary.fullCapacityTestDate && (
              <> · full capacity il {state.summary.fullCapacityTestDate} (per test waiting list)</>
            )}
          </span>
        )}
        {state.status === 'error' && (
          <span className="text-red-400">✗ {state.message}</span>
        )}
      </div>

      {(state.status === 'success' || state.status === 'error') && (
        <button
          onClick={() => setState({ status: 'idle' })}
          className="text-slate-500 hover:text-slate-300 shrink-0"
        >
          ✕
        </button>
      )}

      {showRoomManagement && (
        <RoomManagement
          onBack={() => setShowRoomManagement(false)}
          onRoomsChanged={onRoomsChanged}
        />
      )}
    </div>
  );
}
