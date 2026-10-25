import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 업데이트 안내를 미룬 기억 (#1572) — **계정별 키**. 기기 단위 키는 다른 계정으로
 * 로그인했을 때 남의 상태를 물려받는다(#1298). `rougether.` 접두는 탈퇴 시
 * `wipeLocalAppData`가 함께 지운다.
 *
 * 저장하는 값은 "미뤘다"가 아니라 **미룬 시점의 `recommendedBuild`** 다. 그래야
 * 다음 버전이 나왔을 때(번호가 올라갔을 때) 다시 안내할 수 있다. 불리언이면 한 번
 * 미룬 사람에게는 영영 안내가 안 간다.
 */
const key = (userId: number) => `rougether.version-gate.v1.${userId}`;

export async function loadDismissedBuild(userId: number | undefined): Promise<number | undefined> {
  if (userId == null) return undefined;
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return undefined;
    const value = JSON.parse(raw) as { dismissedBuild?: unknown };
    return Number.isInteger(value.dismissedBuild) ? (value.dismissedBuild as number) : undefined;
  } catch {
    return undefined;
  }
}

export async function saveDismissedBuild(userId: number | undefined, build: number): Promise<void> {
  if (userId == null || !Number.isInteger(build)) return;
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify({ dismissedBuild: build }));
  } catch {
    // 저장 실패가 앱을 막아선 안 된다 — 다음 실행에 다시 안내될 뿐이다.
  }
}
