import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import type { DrawResult } from '@/api';
import type { Screen } from '@/components/app/navigation';
import { type DecorTab, dominantDecorTab } from '@/components/screens/room-decor-screen';
import { useLatestRef, useStableCallback } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';

type DecorCatalogue = Parameters<typeof dominantDecorTab>[1];

/**
 * 꾸미기 진입 상태 — 앱 셸에서 옮겼다(리팩토링 장부 5번, 동작 그대로). 뽑기 결과를 꾸미기
 * 카탈로그에서 NEW로 강조하고(#630), 뽑은 게 가장 많은 종류의 탭을 열고(#897), 꾸미기 진입을
 * 경로별로 센다(#1043). 꾸미기를 떠나면 강조·탭을 비운다(거래소 서브화면은 예외, #1427).
 */
export function useDecorEntry({
  screen,
  setScreen,
  catalogue,
}: {
  screen: Screen;
  setScreen: Dispatch<SetStateAction<Screen>>;
  catalogue: DecorCatalogue & { furniture: { id: string }[] };
}) {
  // 뽑기 → 가구 배치하러 가기 (#630, #622 개편) — 방금 뽑은 아이템을 꾸미기
  // 카탈로그에서 NEW로 강조한다. 꾸미기를 떠나면 강조를 비워 일반 진입과 구분.
  const placeableFurnitureIds = useMemo(
    () => catalogue.furniture.map((f) => f.id),
    [catalogue.furniture],
  );
  const [newDecorItemIds, setNewDecorItemIds] = useState<string[]>([]);
  /** 뽑기에서 넘어올 때 열 종류 탭 (#897) — 그 외 경로는 기본 탭. */
  const [decorInitialTab, setDecorInitialTab] = useState<DecorTab | undefined>(undefined);
  /**
   * 뽑기 → '가구 배치하러 가기' (#630). 하이라이트만으로는 부족하다 (#897):
   * 벽지를 뽑았는데 가구 탭이 열려 있으면 표시가 안 보이는 탭에 있다.
   * 뽑은 게 가장 많은 종류의 탭을 함께 열어준다.
   */
  // 참조 고정 (#794 결) — catalogue를 deps에 넣으면 상점 구매 때마다 이
  // 콜백이 재생성된다. useStableCallback은 최신 catalogue를 읽으면서 참조는
  // 유지한다.
  const goPlaceDrawn = useStableCallback((results: DrawResult[]) => {
    const ids = results.map((r) => String(r.itemId)).filter(Boolean);
    setNewDecorItemIds(ids);
    setDecorInitialTab(dominantDecorTab(ids, catalogue));
    setScreen('decor');
  });
  // 진입 시점의 값만 필요하고 의존성에 넣으면 화면 안에서 목록이 비워질 때
  // 이펙트가 다시 돌므로 최신값 ref로 읽는다.
  const fromGachaRef = useLatestRef(newDecorItemIds.length > 0);
  useEffect(() => {
    if (screen === 'decor') {
      // 꾸미기 퍼널의 첫 단계 (#1043) — 진입 경로 셋(나의 방·뽑기·미션)이 전부
      // 이 상태 전환을 지나므로 여기서 한 번만 센다. 뽑기에서 온 경우만 구분.
      track('decor_open', { from: fromGachaRef.current ? 'gacha' : 'direct' });
    }
    if (screen !== 'decor') {
      // 이미 비어 있으면 같은 참조를 돌려 셸 렌더를 한 번 더 일으키지 않는다(성능 장부 R1).
      setNewDecorItemIds((prev) => (prev.length > 0 ? [] : prev));
      // 다음에 꾸미기를 직접 열면 기본 탭이어야 한다 — 뽑기에서 온 게 아니다.
      // 거래소 상세·내 주문(#1427)은 꾸미기로 돌아오는 서브화면이라 연 탭을 기억한다.
      if (screen !== 'marketAsset' && screen !== 'marketOrders') setDecorInitialTab(undefined);
    }
  }, [screen, fromGachaRef]);

  return {
    newDecorItemIds,
    decorInitialTab,
    setDecorInitialTab,
    placeableFurnitureIds,
    goPlaceDrawn,
  };
}
