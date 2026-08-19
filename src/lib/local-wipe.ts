import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearWidgetData } from '@/widgets/widget-data';

/** 앱이 쓰는 AsyncStorage 키는 전부 이 접두를 단다. */
const PREFIX = 'rougether.';

/**
 * 탈퇴 시 이 기기의 로컬 흔적을 지운다 (#922).
 *
 * **삭제가 기본값이고 보존은 예외**다 — 고정 목록을 지우는 방식이 아니다.
 * 방 배치는 `rougether.roomLayout.v1.{userId}.{houseId}`처럼 키를 동적으로
 * 만들어(room-layout-store.ts) 목록으로는 애초에 다 잡을 수 없고, 앞으로 키가
 * 늘어도 여기를 고치는 걸 잊으면 남의 계정 데이터가 조용히 남는다. 접두로
 * 쓸어 담으면 새 키가 자동으로 포함된다.
 *
 * 지워지는 것: 세션·온보딩·온보딩 미션·루틴 정렬·방 배치·주간 리포트 열람
 * 기록·위젯 3종·테마/폰트·효과음·마지막 로그인 수단.
 *
 * 위젯은 별도로 처리한다 — iOS 위젯이 읽는 곳은 AsyncStorage가 아니라 App
 * Group UserDefaults라 접두 삭제가 닿지 않는다.
 *
 * **로그아웃에는 쓰지 않는다.** 같은 사람이 다시 들어오므로 세션만 지우는 게
 * 맞다. 탈퇴는 계정이 사라지니 계정 파생 로컬 데이터도 함께 사라져야 한다.
 */
export async function wipeLocalAppData(): Promise<string[]> {
  await clearWidgetData();
  let removed: string[] = [];
  try {
    const keys = await AsyncStorage.getAllKeys();
    removed = keys.filter((k) => k.startsWith(PREFIX));
    if (removed.length > 0) await AsyncStorage.multiRemove(removed);
  } catch {
    // 저장소 정리 실패로 탈퇴 자체를 되돌리지는 않는다 — 서버 계정은 이미
    // 삭제됐고, 세션은 호출측이 따로 지운다.
  }
  return removed;
}
