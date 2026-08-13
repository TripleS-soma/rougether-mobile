import { useEffect, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { type Screen, TAB_FOR_SCREEN } from '@/components/app/navigation';
import { useStableCallback } from '@/hooks/use-stable-value';

/**
 * 하단 탭 페이저 잠금 (#563, #692 6단계에서 셸로, #748에서 훅으로 분리).
 * 집 화면이 확대·자리 드래그로 제스처 전권을 가져간 동안 페이저를 잠그되,
 * 집 "페이지가 활성일 때만" — 확대를 남겨둔 채 탭 버튼으로 떠났을 때 다른
 * 페이지의 스와이프까지 막으면 안 된다.
 *
 * 공유값 쓰기(`lock.value = …`)를 이 파일에 가둔 것은 React Compiler 때문이다:
 * 컴파일러는 훅이 돌려준 값의 변형을 금지하므로 셸 본문에 두면 AppShell 전체가
 * 컴파일에서 제외됐다. 잠금은 여기서만 쓰고 셸은 콜백만 받는다.
 */
export function usePagerLock(screen: Screen) {
  const activeTab = TAB_FOR_SCREEN[screen];
  const lock = useSharedValue(false);
  const houseLockedRef = useRef(false);
  const setHouseLocked = useStableCallback((locked: boolean) => {
    houseLockedRef.current = locked;
    lock.value = locked && TAB_FOR_SCREEN[screen] === 'house';
  });
  // 탭이 바뀌면 집 잠금 의사는 유지한 채 활성 여부만 다시 판정한다.
  useEffect(() => {
    lock.value = houseLockedRef.current && activeTab === 'house';
  }, [activeTab, lock]);
  return { lock, setHouseLocked };
}
