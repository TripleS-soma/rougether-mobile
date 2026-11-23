import { useContext, useMemo } from 'react';
import { type EdgeInsets, SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAppFrame } from '@/hooks/use-app-frame';

/**
 * 창을 다 쓰는 2단에서 왼쪽 칸이 보는 위 인셋의 상한.
 *
 * 0이 아닌 이유: 떠 있는 제목 알약(`ScreenHeader`)이 화면 끝에서 8pt에 붙으면 iOS 27의 글래스
 * 면이 제목 글자를 아주 작게 찌그러뜨렸다(아이폰 Duo 시뮬레이터 실측: 0 → 깨짐, 16·24 → 정상).
 */
export const SPLIT_LEFT_TOP_INSET = Spacing.three;

/**
 * 2단의 **왼쪽 칸**에 내려 줄 안전 영역 인셋.
 *
 * 펼친 아이폰 Duo는 시스템 표시(시계·와이파이)가 오른쪽 위 모서리에만 있는데 안전 영역은 위쪽
 * 전체 폭(82)으로 온다. 왼쪽 칸은 그 밑이 아니므로 통째로 비우지 않고 작은 위 여백만 둔다.
 * 오른쪽 칸은 인셋을 그대로 쓴다. 창을 다 쓰는 2단(`splitFill`)이 아니면 인셋 그대로다.
 *
 * 왼쪽 칸을 `<SafeAreaInsetsContext.Provider value={...}>`로 감싸면 칸 안의 화면·헤더가
 * 줄어든 인셋을 본다.
 */
export function useSplitLeftPaneInsets(): EdgeInsets | null {
  const { splitFill = false } = useAppFrame();
  const insets = useContext(SafeAreaInsetsContext);
  return useMemo(
    () =>
      splitFill && insets ? { ...insets, top: Math.min(insets.top, SPLIT_LEFT_TOP_INSET) } : insets,
    [splitFill, insets],
  );
}

/**
 * 창을 다 쓰는 2단에서 오른쪽 칸의 머리를 시스템 안전 영역보다 이만큼 더 내린다.
 *
 * 펼친 아이폰 Duo의 안전 영역은 위 82인데, 오른쪽 위 모서리의 와이파이 그림은 98pt쯤까지 내려온다
 * (시뮬레이터 캡처 실측). 인셋대로만 두면 오른쪽 칸 머리의 버튼(위 90pt부터)이 그 그림에 겹쳐 보인다.
 */
export const SPLIT_RIGHT_TOP_EXTRA = Spacing.three;

/**
 * 2단의 **오른쪽 칸**에 내려 줄 안전 영역 인셋 — 위쪽에 시스템 표시가 있는 기기(위 인셋이 0이
 * 아님)의 창을 다 쓰는 2단에서만 위를 조금 더 비운다. 그 밖에는 인셋 그대로다.
 */
export function useSplitRightPaneInsets(): EdgeInsets | null {
  const { splitFill = false } = useAppFrame();
  const insets = useContext(SafeAreaInsetsContext);
  return useMemo(
    () =>
      splitFill && insets && insets.top > 0
        ? { ...insets, top: insets.top + SPLIT_RIGHT_TOP_EXTRA }
        : insets,
    [splitFill, insets],
  );
}
