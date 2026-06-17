import { useState, useEffect } from 'react';
import { getUsers } from '../services/api';
import type { User } from '../types/api';
import type { Colleague } from '../constants/colleagues';

const colors = [
  'bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function hashColor(id: string): string {
  return colors[Math.floor(Math.abs(hashString(id)) % colors.length)];
}

export function mapUserToColleague(u: User): Colleague {
  const parts = u.name.split(' ');
  return {
    id: u.id,
    name: parts[0],
    surname: parts.slice(1).join(' '),
    initials: parts.map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
    color: hashColor(u.id),
  };
}

export function useColleagues(): Colleague[] {
  const [colleagues, setColleagues] = useState<Colleague[]>([]);

  useEffect(() => {
    getUsers().then(users => {
      setColleagues(users.map(mapUserToColleague));
    }).catch(() => {});
  }, []);

  return colleagues;
}
