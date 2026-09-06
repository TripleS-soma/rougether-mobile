import AsyncStorage from '@react-native-async-storage/async-storage';

import type { OnboardingGoal } from '@/components/screens/onboarding-screen';

export type StarterRoutineProgress = {
  status: 'pending' | 'created' | 'skipped' | 'existing';
  goals: OnboardingGoal[];
};

const key = (userId: number) => `rougether.starter-routine.v1.${userId}`;

/** Per-account state: logout/login must not resume another person's step. */
export async function loadStarterRoutineProgress(
  userId: number | undefined,
): Promise<StarterRoutineProgress | null> {
  if (userId == null) return null;
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as StarterRoutineProgress;
    if (!['pending', 'created', 'skipped', 'existing'].includes(value.status)) return null;
    if (
      !Array.isArray(value.goals) ||
      !value.goals.every(
        (g) =>
          g &&
          typeof g.id === 'string' &&
          typeof g.label === 'string' &&
          (g.code == null || typeof g.code === 'string'),
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export async function saveStarterRoutineProgress(
  userId: number | undefined,
  progress: StarterRoutineProgress,
): Promise<void> {
  if (userId == null) return;
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(progress));
  } catch {
    // Persistence failure must not block starting the app.
  }
}
