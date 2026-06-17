import { ArrowLeft } from 'lucide-react';

interface RoomConfigMockProps {
  onBack: () => void;
}

export default function RoomConfigMock({ onBack }: RoomConfigMockProps) {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
        <ArrowLeft className="w-5 h-5"/>
        <span className="text-sm font-bold">Back</span>
      </button>
      <div className="bg-surface-container-lowest rounded-3xl p-6 text-center text-on-surface-variant text-sm">
        Room configuration coming soon.
      </div>
    </div>
  );
}
