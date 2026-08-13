import type { NavTab } from '@/components/ui/bottom-nav';
import type { ScrollRestoreProps } from '@/hooks/use-scroll-restore';
import { useConstant, useStableCallback } from '@/hooks/use-stable-value';

/**
 * 탭별 스크롤 위치 기억 (#763). 서브화면(설정→도움말, 나의 방→꾸미기 …)으로
 * 가면 `activeTab`이 null이 되어 탭 페이저가 통째로 언마운트되므로, 세 탭
 * 화면의 ScrollView 상태가 함께 사라져 돌아왔을 때 맨 위로 튄다. 위치는
 * **항상 마운트된 셸**이 들고 있어야 살아남는다.
 *
 * 오프셋은 state가 아니라 ref 객체에 담는다 — 스크롤마다 셸이 리렌더되면
 * 세 화면이 전부 다시 그려진다. 화면으로 내리는 것도 값이 아닌 게터라
 * (`getInitialScrollY`) memo 경계(#539)를 건드리지 않는다.
 */
export function useTabScroll(): Record<NavTab, ScrollRestoreProps> {
  const offsets = useConstant(
    () => ({ myRoom: 0, house: 0, settings: 0 }) as Record<NavTab, number>,
  );

  const myRoom: ScrollRestoreProps = {
    getInitialScrollY: useStableCallback(() => offsets.myRoom),
    onScrollY: useStableCallback((y: number) => {
      offsets.myRoom = y;
    }),
  };
  const house: ScrollRestoreProps = {
    getInitialScrollY: useStableCallback(() => offsets.house),
    onScrollY: useStableCallback((y: number) => {
      offsets.house = y;
    }),
  };
  const settings: ScrollRestoreProps = {
    getInitialScrollY: useStableCallback(() => offsets.settings),
    onScrollY: useStableCallback((y: number) => {
      offsets.settings = y;
    }),
  };

  return { myRoom, house, settings };
}
