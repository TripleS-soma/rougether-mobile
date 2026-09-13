import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 루틴 발생분 건너뜀(#189) 로컬 사본 — **계정별 키**. 서버(`POST /routines/{id}/logs`
 * status=SKIPPED)가 진실이지만 나의 방·달력의 "오늘" 목록은 서버 `/today`가 아니라
 * 로컬 반복 규칙(`isScheduledOn`)으로 그리므로, 오늘 몫을 옮긴 사실을 기기에도
 * 남겨 재실행 뒤에도 숨김을 유지한다. 지난 날짜는 읽을 때 걷어낸다(서버 판정이 끝남).
 * `rougether.` 접두는 탈퇴 시 `wipeLocalAppData`가 함께 지운다.
 */
const key = (userId: number) => `rougether.routine-skips.v1.${userId}`;

/** 앱 루틴 id → 건너뛴 날짜("YYYY-MM-DD") 목록. */
export type RoutineSkips = Record<string, string[]>;

export async function loadRoutineSkips(
  userId: number | undefined,
  today: string,
): Promise<RoutineSkips> {
  if (userId == null) return {};
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return {};
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object') return {};
    const skips: RoutineSkips = {};
    for (const [id, dates] of Object.entries(value as Record<string, unknown>)) {
      if (!Array.isArray(dates)) continue;
      const kept = dates.filter((d): d is string => typeof d === 'string' && d >= today);
      if (kept.length) skips[id] = kept;
    }
    return skips;
  } catch {
    return {};
  }
}

export async function saveRoutineSkips(
  userId: number | undefined,
  skips: RoutineSkips,
): Promise<void> {
  if (userId == null) return;
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(skips));
  } catch {
    // 저장 실패가 날짜 변경 자체를 막으면 안 된다 — 서버엔 이미 기록됐다.
  }
}
