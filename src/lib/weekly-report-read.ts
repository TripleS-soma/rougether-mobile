import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'rougether.weeklyReport.lastRead.v1';

/**
 * 마지막으로 열어본 주간 회고 id (#856) — 새 회고가 도착했는지 판단해 탭에
 * 점을 찍는 용도. 서버에 읽음 상태가 없어 로컬에만 둔다. 기기를 옮기면 한 번
 * 더 점이 뜨는데, 회고는 주 1회라 그 비용이 서버 필드를 요구할 만큼 크지 않다.
 */
export async function loadLastReadReportId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function saveLastReadReportId(reportId: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(reportId));
  } catch {
    // 저장 실패해도 이번 세션 동작엔 지장 없다 — 다음에 점이 한 번 더 뜰 뿐.
  }
}
