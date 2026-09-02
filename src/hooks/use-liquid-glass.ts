import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * iOS 26 리퀴드 글래스를 그려도 되는가 (#1049).
 *
 * - 컴포넌트 가용성: iOS 26+ 이고 Xcode 26으로 빌드된 바이너리 — 그 밖의
 *   플랫폼·구버전·구빌드는 라이브러리가 false를 준다(모듈은 expo-router가
 *   이미 링크해 두어 지문이 안 바뀐다).
 * - 접근성 "투명도 줄이기": 라이브러리는 이걸 안 보므로 직접 구독한다. 켜져
 *   있으면 글래스 대신 기존 불투명 바를 쓴다.
 */
export function useLiquidGlass(): boolean {
  const capable = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    if (!capable) return;
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
  }, [capable]);
  return capable && !reduceTransparency;
}
