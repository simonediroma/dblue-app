import type { Room } from '../services/api';

const FALLBACK_COLORS = ['bg-red-500', 'bg-green-500', 'bg-purple-500', 'bg-teal-500'];

export interface RoomColorInfo {
  className?: string;
  style?: { backgroundColor: string };
}

// room.color arriva già valorizzato per-stanza sia dal Room model locale sia dal
// catalogo dblue-office — preferirlo evita di derivare un colore dal tipo/categoria
// (fissa in locale, dinamica in modalità API). Va applicato come inline style (non
// una classe Tailwind: Tailwind non genera classi per valori arbitrari a runtime),
// con fallback a una classe Tailwind statica quando manca.
export function roomColorInfo(room: Pick<Room, 'color'>, fallbackIndex: number): RoomColorInfo {
  if (room.color) return { style: { backgroundColor: room.color } };
  return { className: FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length] };
}
