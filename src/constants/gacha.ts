import type { GachaMachine } from '@/api/adapters';

/**
 * 뽑아도 **쓸 수 없는** 기계는 상점에 올리지 않는다 (#983).
 *
 * 서버는 캐릭터 뽑기(500코인)와 악세사리 뽑기를 `active: true`로 내려주지만,
 * 앱에는 그 결과를 장착할 경로가 없다:
 *
 * - **캐릭터** — `CHARACTER_SELECTION_ENABLED = false` (#637 MVP 고양이 단일).
 *   교체 진입점이 숨어 있어 뽑아도 바꿔 낄 수 없다.
 * - **악세사리** — 장착 배선이 아예 없다 (#618 on-hold).
 *
 * 코드 접두로 거른다. 숫자 id보다 안정적이고, `kind`로는 못 거른다 — 악세사리
 * 기계는 `themeId`가 있어 **가구로 분류**된다(`toGachaMachine`).
 *
 * 2026-08-26 서버 실측: 방 테마 12종은 `bakery_morning`·`calm_hanok`처럼 테마
 * 이름이고, `character`로 시작하는 건 `character_gacha`와
 * `character_accessories_accessories` 정확히 둘뿐이다.
 *
 * **되돌리는 시점**: #637의 스위치를 켜거나 #618이 풀릴 때 이 필터를 지운다.
 * 서버가 `active: false`로 내려주면 그쪽이 더 옳은 해결이다.
 */
const BLOCKED_CODE_PREFIX = 'character';

export function isDrawableGacha(machine: GachaMachine): boolean {
  // 코드가 없으면(구 서버·목) 막지 않는다 — 모르는 것을 숨기지는 않는다.
  return !machine.code?.startsWith(BLOCKED_CODE_PREFIX);
}
