import { Station } from '@/constants/Station';

export type Show = {
  id: string;
  name: string;
  day: string;
  time: string;
  icon: 'child' | 'microphone' | 'star' | 'music';
};

const icons = new Set(['child', 'microphone', 'star', 'music']);

export const bundledSchedule: Show[] = Station.schedule.map((show, index) => ({
  ...show,
  id: `bundled-${index}`,
}));

export function parseSchedule(value: unknown): Show[] {
  if (!Array.isArray(value)) throw new Error('Schedule response is not a list');
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null) throw new Error('Invalid show');
    const show = item as Record<string, unknown>;
    if (
      typeof show.id !== 'string' || !show.id ||
      typeof show.name !== 'string' || !show.name.trim() ||
      typeof show.day !== 'string' || !show.day.trim() ||
      typeof show.time !== 'string' || !show.time.trim() ||
      typeof show.icon !== 'string' || !icons.has(show.icon)
    ) throw new Error('Invalid show fields');
    return {
      id: show.id,
      name: show.name,
      day: show.day,
      time: show.time,
      icon: show.icon as Show['icon'],
    };
  });
}
