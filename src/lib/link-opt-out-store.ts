import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 사용자가 직접 끊은 연동 기록 — 계정별 키.
 *
 * 부팅 때 도는 이름 매칭 승격(#578, `use-mission-links`)은 "이름이 같은데 링크 id가
 * 없는" 카테고리·루틴에 링크를 다시 심는다. 사용자가 연동을 해제하면 바로 그 조건이
 * 되므로, 기록이 없으면 다음 실행에 연동이 되살아난다. 그래서 해제한 **집 id**(카테고리
 * 연동)와 **미션 id**(루틴 연동)를 남겨 승격이 건너뛰게 한다 — 루틴 id는 스케줄 수정으로
 * 버전이 갈리면 바뀌어서 쓰지 않는다. 연동의 진실은 서버이고, 이 기록은 "자동으로
 * 다시 걸지 말라"는 표시일 뿐이다.
 */
export type LinkOptOuts = { houseIds: number[]; missionIds: number[] };

const EMPTY: LinkOptOuts = { houseIds: [], missionIds: [] };
const key = (userId: number) => `rougether.link-opt-outs.v1.${userId}`;

const ids = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : [];

export async function loadLinkOptOuts(userId: number | undefined): Promise<LinkOptOuts> {
  if (userId == null) return EMPTY;
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LinkOptOuts>;
    return { houseIds: ids(parsed.houseIds), missionIds: ids(parsed.missionIds) };
  } catch {
    return EMPTY;
  }
}

/** 해제한 집·미션 id를 더한다(중복 무시). 저장 실패는 조용히 넘긴다. */
export async function addLinkOptOut(
  userId: number | undefined,
  add: { houseId?: number; missionId?: number },
): Promise<void> {
  if (userId == null) return;
  const cur = await loadLinkOptOuts(userId);
  const next: LinkOptOuts = {
    houseIds:
      add.houseId != null && !cur.houseIds.includes(add.houseId)
        ? [...cur.houseIds, add.houseId]
        : cur.houseIds,
    missionIds:
      add.missionId != null && !cur.missionIds.includes(add.missionId)
        ? [...cur.missionIds, add.missionId]
        : cur.missionIds,
  };
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(next));
  } catch {
    // 기록 실패는 해제 자체를 되돌리지 않는다 — 최악은 다음 실행의 재연동.
  }
}
