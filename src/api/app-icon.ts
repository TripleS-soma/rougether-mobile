import { apiGet, apiPost } from '@/api/client';

export const APP_ICON_STATES = [
  'NORMAL',
  'MISSING_YOU',
  'TEARY',
  'SOBBING',
  'DAILY_SUCCESS',
  'STREAK_CHAMPION',
] as const;
export type AppIconState = (typeof APP_ICON_STATES)[number];
export type AppIconResponse = {
  state: AppIconState;
  message: string;
  evaluatedAt: string;
  lastForegroundAt: string | null;
  nextEvaluationAt: string | null;
  currentStreak: number;
  completedToday: boolean;
};

export const fetchAppIcon = (options?: { background?: boolean }) =>
  apiGet<AppIconResponse>('/me/app-icon', {
    expectedStatuses: [404],
    // 헤드리스 백그라운드에서는 토큰을 회전하지 않는다 (#1388).
    refreshOnUnauthorized: !options?.background,
  });
export const recordAppActivity = () =>
  apiPost<AppIconResponse>('/me/app-activity', undefined, { expectedStatuses: [404] });
