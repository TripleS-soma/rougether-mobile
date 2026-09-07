import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * 시스템의 동작 줄이기 설정을 구독한다.
 *
 * 첫 조회가 끝나기 전에는 기존 동작을 유지하고, 설정이 바뀌면 열려 있는 화면도
 * 즉시 따라간다. 플랫폼이 API를 지원하지 않으면 애니메이션을 그대로 사용한다.
 */
export function useReducedMotion() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
