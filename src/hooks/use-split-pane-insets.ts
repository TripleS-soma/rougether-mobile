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
