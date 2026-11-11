import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: number) => `rougether.weeklyReport.dismissedWeek.v1.${userId}`;

/** Keep reminder dismissal separate from actually reading the report. */
export async function loadDismissedReportWeek(userId: number | undefined): Promise<string | null> {
  if (userId == null) return null;
  try {
    return await AsyncStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

export async function saveDismissedReportWeek(
  userId: number | undefined,
  week: string,
): Promise<void> {
  if (userId == null) return;
  try {
    await AsyncStorage.setItem(key(userId), week);
  } catch {
    // Still suppress the reminder for this session when storage is unavailable.
  }
}
