import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { StaticWhite } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type BearCheckProps = {
  checked: boolean;
  /** 완료 시 채울 색 (카테고리 색). 없으면 브랜드 primary. */
  color?: string;
  /** 없으면 표시 전용 — 퀵애드 장식·친구 방 읽기 전용 리스트. */
  onPress?: () => void;
  /** 행 제목 등 — onPress가 있을 때 체크박스 접근성 라벨. */
  accessibilityLabel?: string;
  /** 헤드 지름(px). 귀 포함 전체 높이는 약 size * 1.14. */
  size?: number;
};

/**
 * 곰 헤드 체크 토글 (#344, design-sync 시안 A) — 둥근 귀 2개가 달린 헤드
 * 실루엣. 미완료는 윤곽선만, 완료되면 실루엣 전체가 카테고리 색으로 차고
 * 흰 체크가 찍힌다. 기존 네모 체크박스와 같은 접근성 계약(checkbox role +
 * checked state)을 유지한다.
 */
export function BearCheck({
  checked,
  color,
  onPress,
  accessibilityLabel,
  size = 26,
}: BearCheckProps) {
  const t = useTokens();
  const fill = color ?? t.primary;
  const line = checked ? fill : t.textDisabled;
  const bg = checked ? fill : t.surface;
  const earSize = size * 0.42;

  const figure = (
    <View style={{ width: size, height: size * 1.14, paddingTop: size * 0.18 }}>
      {/* 귀 — 헤드보다 먼저 그려서 뒤에 깔린다. */}
      <View
        style={[
          styles.ear,
          {
            width: earSize,
            height: earSize,
            borderRadius: earSize / 2,
            borderColor: line,
            backgroundColor: bg,
            left: 0,
            transform: [{ rotate: '-14deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.ear,
          {
            width: earSize,
            height: earSize,
            borderRadius: earSize / 2,
            borderColor: line,
            backgroundColor: bg,
            right: 0,
            transform: [{ rotate: '14deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.head,
          { borderColor: line, backgroundColor: bg, borderRadius: size * 0.46 },
        ]}>
        {checked ? (
          <View testID="bear-check-tick">
            <Icon name="check" size={size * 0.5} color={StaticWhite} />
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return figure;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {figure}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ear: {
    position: 'absolute',
    top: 0,
    borderWidth: 2.5,
  },
  head: {
    flex: 1,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.9 }],
  },
});
