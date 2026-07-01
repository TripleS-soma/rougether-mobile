import AsyncStorage from '@react-native-async-storage/async-storage';

import { type CharacterId } from '@/constants/characters';

const KEY = 'rougether.onboarding.v1';

export type OnboardingData = { characterId: CharacterId; goals: string[] };

/**
 * First-launch onboarding result (chosen character + goals), persisted locally
 * so the flow only shows once. This is a client-side stopgap — once a backend
 * profile exists, the character/goals move there and this becomes a cache.
 */
export async function loadOnboarding(): Promise<OnboardingData | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingData) : null;
  } catch {
    return null;
  }
}

export async function saveOnboarding(data: OnboardingData): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Ignore persistence failures — the app still works this session.
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
