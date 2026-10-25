import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 업데이트 안내를 미룬 기억 (#1572) — **계정별 키**. 기기 단위 키는 다른 계정으로
 * 로그인했을 때 남의 상태를 물려받는다(#1298). `rougether.` 접두는 탈퇴 시
 * `wipeLocalAppData`가 함께 지운다.
 *
 * 저장하는 값은 "미뤘다"가 아니라 **미룬 시점의 `latestVersion`** 이다. 그래야 다음
 * 버전이 나왔을 때 다시 안내할 수 있다. 불리언이면 한 번 미룬 사람에게는 영영 안내가
 * 안 간다 — 이 사람은 업데이트를 안 했으니 런타임 지문도 그대로라, 목록에서 빠지는
 * 일도 없다.
 */
const key = (userId: number) => `rougether.version-gate.v1.${userId}`;

export async function loadDismissedVersion(
  userId: number | undefined,
): Promise<string | undefined> {
  if (userId == null) return undefined;
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return undefined;
    const value = JSON.parse(raw) as { dismissedVersion?: unknown };
    return typeof value.dismissedVersion === 'string' ? value.dismissedVersion : undefined;
  } catch {
    return undefined;
  }
}

export async function saveDismissedVersion(
  userId: number | undefined,
  version: string | undefined,
): Promise<void> {
  if (userId == null || !version) return;
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify({ dismissedVersion: version }));
  } catch {
    // 저장 실패가 앱을 막아선 안 된다 — 다음 실행에 다시 안내될 뿐이다.
  }
}
