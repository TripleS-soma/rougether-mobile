import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * 떠 있는 크롬 면의 재질 (#1074).
 *
 * - `glass`: iOS 26 리퀴드 글래스 — iOS 26+ 이고 Xcode 26으로 빌드된 바이너리
 *   (모듈은 expo-router가 이미 링크해 두어 지문이 안 바뀐다).
 * - `translucent`: 그 밖의 플랫폼·구버전 — 반투명 surface + 그림자. 레이아웃
 *   (오버레이·언더랩)은 글래스와 같고 면만 다르다.
 * - `opaque`: 접근성 "투명도 줄이기"(iOS) — 알파 없는 불투명 면. 라이브러리는
 *   이 설정을 안 보므로 직접 구독한다.
 */
export type GlassMaterial = 'glass' | 'translucent' | 'opaque';

export function useGlassMaterial(): GlassMaterial {
  const ios = Platform.OS === 'ios';
  const capable = ios && isLiquidGlassAvailable();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    if (!ios) return;
    let alive = true;
    // 구버전 RN 타입엔 없을 수 있는 메서드 — 없으면 켜지지 않은 것으로 본다.
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((enabled) => {
        if (alive) setReduceTransparency(enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, [ios]);
  if (reduceTransparency) return 'opaque';
  return capable ? 'glass' : 'translucent';
}

/** iOS 26 리퀴드 글래스를 그려도 되는가 — `useGlassMaterial() === 'glass'`. */
export function useLiquidGlass(): boolean {
  return useGlassMaterial() === 'glass';
}
