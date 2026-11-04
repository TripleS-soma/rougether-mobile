import type { ViewStyle } from 'react-native';

import type { SemanticColors } from '@/constants/theme';

/**
 * 탭 요소 눌림 피드백의 역할 (#1614) — 누를 수 있는 요소는 반드시 눌림 상태를
 * 보여준다. 다만 전부 축소(scale)시키면 목록 행까지 쪼그라드는 "Squish Reflex"가
 * 되므로 요소의 생김새에 맞춰 넷으로 나눈다.
 *
 * - `fill` — 브랜드색(`primary`)으로 채운 버튼. 배경을 `primaryActive`로 진하게.
 * - `row`  — 설정·목록 행. 배경을 `primarySoft`로 옅게 물들인다(`ListRow`와 같은 결).
 * - `card` — 표면색 위에 놓인 카드·타일. 배경을 `surfaceMuted`로.
 * - `dim`  — 아이콘·칩·글자 버튼, 그리고 primary/표면이 아닌 색으로 채운 버튼.
 *   투명도만 낮춰 원래 색을 지킨다.
 *
 * 배경 닫기 영역(backdrop)과 이벤트를 막으려고 감싼 Pressable에는 쓰지 않는다 —
 * 거기가 반응하면 누른 곳이 아닌 곳이 깜빡인다.
 *
 * ```tsx
 * <Pressable style={({ pressed }) => [styles.btn, { backgroundColor: t.primary },
 *   pressed && pressedStyle('fill', t)]} />
 * ```
 */
export type PressRole = 'fill' | 'row' | 'card' | 'dim';

/** `dim` 역할의 눌림 투명도. */
export const PRESSED_OPACITY = 0.6;

export function pressedStyle(role: PressRole, t: SemanticColors): ViewStyle {
  switch (role) {
    case 'fill':
      return { backgroundColor: t.primaryActive };
    case 'row':
      return { backgroundColor: t.primarySoft };
    case 'card':
      return { backgroundColor: t.surfaceMuted };
    case 'dim':
      return { opacity: PRESSED_OPACITY };
  }
}
