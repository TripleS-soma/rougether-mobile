import type { NewRoutine } from '@/constants/routines';
import { isScheduledOn } from '@/components/screens/my-room/schedule';
import { shiftIso } from '@/utils/datetime';
import { i18n } from '@/i18n';

/** Same scheduling rule as the day list, including skipped month ends and leap years. */
export function firstRoutineDate(routine: NewRoutine): string | null {
  if ((routine.repeat === 'weekly' || routine.repeat === 'biweekly') && !routine.days.length)
    return null;
  // A leap day can be eight years away across a non-leap century (2096 → 2104).
  for (let offset = 0; offset <= 366 * 8; offset += 1) {
    const date = shiftIso(routine.startDate, offset);
    if (routine.endDate && date > routine.endDate) return null;
    if (isScheduledOn({ ...routine, id: '', kind: 'routine' }, date)) return date;
  }
  return null;
}

export function routineComposeError(routine: NewRoutine, today: string): string | null {
  if (routine.startDate < today) return i18n.t('routineTodo.compose.error.startDatePast');
  if ((routine.repeat === 'weekly' || routine.repeat === 'biweekly') && !routine.days.length)
    return i18n.t('routineTodo.compose.error.pickWeekday');
  if (routine.endDate && routine.endDate < routine.startDate)
    return i18n.t('routineTodo.compose.error.endBeforeStart');
  if (!firstRoutineDate(routine)) return i18n.t('routineTodo.compose.error.noOccurrence');
  return null;
}
