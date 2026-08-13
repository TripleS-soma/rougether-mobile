import type { Routine } from '@/constants/routines';
import { localDate, weekdayOf } from '@/utils/datetime';

/**
 * Biweekly parity: scheduled on even week-distances from the startDate's week
 * (the server counts the startsOn week as week 1 and repeats every 2 weeks;
 * weeks anchor on Monday, matching KST server behavior).
 */
const inBiweeklyWeek = (dateIso: string, startIso: string) => {
  const mondayOf = (d: Date) => {
    const shifted = new Date(d);
    shifted.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return shifted;
  };
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const diff = mondayOf(localDate(dateIso)).getTime() - mondayOf(localDate(startIso)).getTime();
  return Math.round(diff / weekMs) % 2 === 0;
};

/**
 * Whether an item is scheduled on a date: todos by dueDate; routines by their
 * start/end range and repeat cadence (daily / weekly / biweekly / monthly /
 * yearly — same rules the server applies to /today and /calendar). Shared by
 * the 방 tab (today) and the 달력 tab (selected date) so both always agree.
 */
export const isScheduledOn = (r: Routine, dateIso: string) => {
  if (r.kind === 'todo') return r.dueDate === dateIso;
  if (r.startDate && dateIso < r.startDate) return false;
  if (r.endDate && dateIso > r.endDate) return false;
  const repeat = r.repeat ?? (r.days && r.days.length ? 'weekly' : 'daily');
  const [, month, day] = dateIso.split('-').map(Number);
  switch (repeat) {
    case 'weekly':
      return !r.days?.length || r.days.includes(weekdayOf(dateIso));
    case 'biweekly':
      return (
        (!r.days?.length || r.days.includes(weekdayOf(dateIso))) &&
        (!r.startDate || inBiweeklyWeek(dateIso, r.startDate))
      );
    case 'monthly':
      // A month without that date (31st + Feb) simply skips — no clamping.
      return r.dayOfMonth === day;
    case 'yearly':
      return r.month === month && r.dayOfMonth === day;
    default:
      return true;
  }
};
