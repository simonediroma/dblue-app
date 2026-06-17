import { useState, useEffect } from 'react';
import type { Colleague } from '../constants/colleagues';
import { getUsers } from '../services/api';

const COLORS = [
  'bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500',
];

function hashColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function useColleagues(): Colleague[] {
  const [colleagues, setColleagues] = useState<Colleague[]>([]);

  useEffect(() => {
    getUsers()
      .then(users =>
        setColleagues(
          users.map(u => ({
            id: u.id,
            name: u.name.split(' ')[0],
            surname: u.name.split(' ').slice(1).join(' '),
            initials: u.name
              .split(' ')
              .map(w => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2),
            color: hashColor(u.id),
          })),
        ),
      )
      .catch(() => {});
  }, []);

  return colleagues;
}
