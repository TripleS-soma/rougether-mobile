import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 새 소식 읽음 집합 (#1320) — **계정별 키**. 기기 단위 키는 다른 계정으로
 * 로그인했을 때 남의 읽음 상태를 물려받는다(#1298의 온보딩 사고와 같은 꼴).
 * `rougether.` 접두는 탈퇴 시 `wipeLocalAppData`가 함께 지운다.
 */
const key = (userId: number) => `rougether.announcements.v1.${userId}`;

export async function loadReadAnnouncements(userId: number | undefined): Promise<Set<string>> {
  if (userId == null) return new Set();
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return new Set();
    const value = JSON.parse(raw) as { read?: unknown };
    if (!Array.isArray(value.read)) return new Set();
    return new Set(value.read.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export async function saveReadAnnouncements(
  userId: number | undefined,
  read: ReadonlySet<string>,
): Promise<void> {
  if (userId == null) return;
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify({ read: [...read] }));
  } catch {
    // Persistence failure must not block the notification list.
  }
}
