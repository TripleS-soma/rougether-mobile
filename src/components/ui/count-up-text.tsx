import { useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, type TextStyle } from 'react-native';

import { useAnimatedValue } from '@/hooks/use-stable-value';

export type CountUpTextProps = {
  value: number;
  /** 애니메이션 길이(ms). 0이면 즉시 값으로 — 테스트·접근성 축소 모드용. */
  duration?: number;
  style?: StyleProp<TextStyle>;
  /** 숫자 앞뒤 문구 (예: suffix="일차"). */
  suffix?: string;
};

/**
 * 숫자가 목표값까지 굴러 올라가는 텍스트 (#851) — 출석 연속일수처럼
 * "하나 늘었다"가 요점인 값에 쓴다.
 *
 * 값이 **줄거나 처음 마운트될 때는 애니메이션하지 않는다.** 시트를 다시 열
 * 때마다 0부터 세는 건 성취가 아니라 소음이다 — 증가한 경우만 굴린다.
 */
export function CountUpText({ value, duration = 300, style, suffix }: CountUpTextProps) {
  const anim = useAnimatedValue(value);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (duration <= 0 || value <= shown) {
      anim.setValue(value);
      setShown(value);
      return;
    }
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      // 텍스트 내용을 바꾸는 애니메이션이라 JS 드라이버여야 한다.
      useNativeDriver: false,
    }).start(() => setShown(value));
    return () => anim.removeListener(id);
    // shown을 의존성에서 뺀다 — 리스너가 shown을 올릴 때마다 재시작하면 멈추지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, anim]);

  return (
    <Animated.Text style={style}>
      {shown}
      {suffix ?? ''}
    </Animated.Text>
  );
}
