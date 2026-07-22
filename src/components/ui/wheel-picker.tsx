import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

/** Row height — the selection band and snap interval both derive from this. */
export const WHEEL_ITEM_HEIGHT = 44;
/** Odd row count: the middle row is the selection, 2 rows fade above/below. */
export const WHEEL_VISIBLE_ROWS = 5;
const PAD = (WHEEL_ITEM_HEIGHT * (WHEEL_VISIBLE_ROWS - 1)) / 2;

export type WheelItem<T extends string | number> = {
  value: T;
  label: string;
  /** Per-item a11y label ("7시"); defaults to the label. */
  accessibilityLabel?: string;
};

export type WheelPickerProps<T extends string | number> = {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Wheel-level a11y label, e.g. "시 선택". */
  accessibilityLabel: string;
  testID?: string;
};

/**
 * Vertical swipe wheel (디자인 시스템 Time wheel picker 채택안, #390): a
 * ScrollView snapping to 44px rows — swipe with momentum or tap a row to
 * select. Pure JS (no native picker), so it ships over EAS Update and runs
 * on the web harness. The selection band behind the middle row is drawn by
 * the parent so one band can span several adjacent wheels.
 */
export function WheelPicker<T extends string | number>({
  items,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: WheelPickerProps<T>) {
  const t = useTokens();
  const scrollRef = useRef<ScrollView>(null);
  const index = Math.max(
    0,
    items.findIndex((i) => i.value === value),
  );
  const [focused, setFocused] = useState(index);
  const focusedRef = useRef(index);
  // True while the user's finger drives the wheel — external value changes
  // must not scrollTo mid-gesture (it would yank the momentum).
  const interacting = useRef(false);
  // RN-web fires no momentum-end — settle on scroll idle instead.
  const webSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastY = useRef(index * WHEEL_ITEM_HEIGHT);

  const clampIndex = (i: number) => Math.min(Math.max(i, 0), items.length - 1);

  useEffect(() => {
    if (interacting.current) return;
    scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: false });
    focusedRef.current = index;
    setFocused(index);
  }, [index, items.length]);

  const commit = (i: number) => {
    const item = items[clampIndex(i)];
    if (item && item.value !== value) onChange(item.value);
  };

  const settleAt = (y: number) => {
    interacting.current = false;
    commit(Math.round(y / WHEEL_ITEM_HEIGHT));
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    lastY.current = y;
    const i = clampIndex(Math.round(y / WHEEL_ITEM_HEIGHT));
    if (i !== focusedRef.current) {
      focusedRef.current = i;
      setFocused(i);
      // Row tick while the wheel turns — silently unavailable on web.
      if (interacting.current) void Haptics.selectionAsync().catch(() => {});
    }
    if (Platform.OS === 'web') {
      if (webSettle.current) clearTimeout(webSettle.current);
      webSettle.current = setTimeout(() => settleAt(lastY.current), 160);
    }
  };

  const select = (i: number) => {
    interacting.current = false;
    scrollRef.current?.scrollTo({ y: i * WHEEL_ITEM_HEIGHT, animated: true });
    commit(i);
  };

  return (
    <View
      style={styles.wheel}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[index]?.label ?? '' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        // increment = 다음 값(아래로 스크롤), decrement = 이전 값.
        select(clampIndex(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
      }}
      testID={testID}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          interacting.current = true;
        }}
        onMomentumScrollEnd={(e) => settleAt(e.nativeEvent.contentOffset.y)}
        testID={testID ? `${testID}-scroll` : undefined}>
        <View style={{ height: PAD }} />
        {items.map((item, i) => {
          const active = i === focused;
          // 선택에서 멀어질수록 흐리게 — 페이드 그라디언트 없이 깊이감을 낸다.
          const distance = Math.min(Math.abs(i - focused), 2);
          return (
            <Pressable
              key={String(item.value)}
              onPress={() => select(i)}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              accessibilityState={{ selected: item.value === value }}
              style={styles.item}>
              <Text
                style={[
                  active ? Typography.h3 : Typography.large,
                  { color: active ? t.text : t.textDisabled, opacity: 1 - distance * 0.25 },
                ]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ height: PAD }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: {
    flex: 1,
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS,
  },
  item: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
