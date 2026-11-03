import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 기능 첫 진입 튜토리얼을 본 기록 — 계정별 키(#1298 교훈: 기기 키는 새 계정이 건너뛴다).
 * 값은 끝냈거나 건너뛴 투어 id 배열. 서버엔 남기지 않는다(기기를 바꾸면 한 번 더 보는 정도).
 */
const key = (userId: number) => `rougether.feature-tours.v1.${userId}`;

export async function loadSeenTours(userId: number | undefined): Promise<Set<string>> {
  if (userId == null) return new Set();
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/** 쓰기를 한 줄로 세운다 — 읽고 고쳐 쓰는 사이에 다른 투어 기록이 덮이지 않게. */
let writes: Promise<void> = Promise.resolve();

export function markTourSeen(userId: number | undefined, tourId: string): Promise<void> {
  if (userId == null) return Promise.resolve();
  writes = writes.then(() => writeSeen(userId, tourId));
  return writes;
}

async function writeSeen(userId: number, tourId: string): Promise<void> {
  try {
    const seen = await loadSeenTours(userId);
    if (seen.has(tourId)) return;
    seen.add(tourId);
    await AsyncStorage.setItem(key(userId), JSON.stringify([...seen]));
  } catch {
    // 저장 실패면 다음 진입에 한 번 더 보일 뿐이다.
  }
}
