import type { NewRoutine } from '@/constants/routines';
import { isScheduledOn } from '@/components/screens/my-room/schedule';
import { shiftIso } from '@/utils/datetime';

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
  if (routine.startDate < today) return '루틴 시작일은 오늘 이후로 선택해 주세요.';
  if ((routine.repeat === 'weekly' || routine.repeat === 'biweekly') && !routine.days.length)
    return '반복할 요일을 선택해 주세요.';
  if (routine.endDate && routine.endDate < routine.startDate)
    return '종료일은 시작일 이후로 선택해 주세요.';
  if (!firstRoutineDate(routine))
    return '이 기간에 반복되는 날짜가 없어요. 반복과 기간을 확인해 주세요.';
  return null;
}
