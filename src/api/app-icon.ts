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

export const fetchAppIcon = () =>
  apiGet<AppIconResponse>('/me/app-icon', { expectedStatuses: [404] });
export const recordAppActivity = () =>
  apiPost<AppIconResponse>('/me/app-activity', undefined, { expectedStatuses: [404] });
