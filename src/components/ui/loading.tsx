import { useEffect, useState } from 'react';
import { ActivityIndicator, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTokens } from '@/hooks/use-tokens';

/**
 * 표시를 미루는 시간(ms) — 이보다 빨리 끝나는 로딩은 **아무것도 안 보인다**.
 *
 * 캐시가 warm한 상태의 `/today`·`/rooms/me` 같은 건 순식간에 끝난다. 거기에
 * 스피너를 그리면 개선이 아니라 깜빡임이다. 눈에 띄는 연출일수록 더 거슬린다.
 */
export const LOADING_DELAY_MS = 250;

export type LoadingProps = {
  /** 목록 하단 '더 불러오기'처럼 작은 자리엔 small. */
  size?: 'small' | 'large';
  /** 지연을 끄거나 조절 — 0이면 즉시 표시. */
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
  /** 화면 가운데 크게 채우는 자리(전체 로딩)인지. */
  fill?: boolean;
};

/**
 * 앱 공용 로딩 표시 (#849).
 *
 * 화면마다 `<ActivityIndicator color={t.primary} />`를 직접 쓰던 16곳을
 * 대체한다. 한곳으로 모으는 이유는 두 가지다:
 * - **지연 표시**를 한 번만 구현하면 전 화면에 적용된다
 * - 나중에 연출을 바꿀 때(발바닥 등) 이 파일만 고치면 된다 — 당겨서
 *   새로고침만 우리 캐릭터고 나머지는 OS 기본이던 불일치를 여기서 끝낸다
 */
export function Loading({ size, delayMs = LOADING_DELAY_MS, style, fill }: LoadingProps) {
  const t = useTokens();
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  // 지연 중에는 자리도 잡지 않는다 — 빈 상자가 잠깐 보이면 그것도 깜빡임이다.
  if (!visible) return null;

  const indicator = <ActivityIndicator size={size} color={t.primary} />;
  if (!fill) return style ? <View style={style}>{indicator}</View> : indicator;
  return <View style={[styles.fill, style]}>{indicator}</View>;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
