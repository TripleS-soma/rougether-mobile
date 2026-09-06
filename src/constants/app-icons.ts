import type { AppIconState } from '@/api/app-icon';

const NAMES: Record<AppIconState, string | null> = {
  NORMAL: null,
  MISSING_YOU: 'MissingYou',
  TEARY: 'Teary',
  SOBBING: 'Sobbing',
  DAILY_SUCCESS: 'DailySuccess',
  STREAK_CHAMPION: 'StreakChampion',
};

export function appIconName(state: AppIconState): string | null {
  return NAMES[state] ?? null;
}
