import { useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import {
  CHARACTER_SCALE_MIN,
  CHARACTER_SCALE_MAX,
  CHARACTER_SCALE_STEP,
  normalizeCharacterScale,
} from '@/components/room/character-scale';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export function CharacterScaleSheet({
  visible,
  value,
  onPreview,
  onCommit,
  onClose,
}: {
  visible: boolean;
  value: number;
  onPreview: (value: number | null) => void;
  onCommit: (value: number) => void;
  onClose: () => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const slider = useRef<View>(null);
  const latest = useRef({ value, onPreview, onCommit });
  latest.current = { value, onPreview, onCommit };
  const drag = useRef({ active: false, ready: false, x: 0, width: 1, pageX: 0, value });
  const update = () => {
    const d = drag.current;
    if (!d.active || !d.ready) return;
    d.value = normalizeCharacterScale(
      CHARACTER_SCALE_MIN +
        ((d.pageX - d.x) / d.width) * (CHARACTER_SCALE_MAX - CHARACTER_SCALE_MIN),
    );
    latest.current.onPreview(d.value);
  };
  const gesture = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const current = {
          active: true,
          ready: false,
          x: 0,
          width: 1,
          pageX: event.nativeEvent.pageX,
          value: latest.current.value,
        };
        drag.current = current;
        slider.current?.measureInWindow((x, _y, width) => {
          if (drag.current !== current || !current.active || width <= 0) return;
          Object.assign(current, { x, width, ready: true });
          update();
        });
      },
      onPanResponderMove: (event) => {
        drag.current.pageX = event.nativeEvent.pageX;
        update();
      },
      onPanResponderRelease: () => {
        const d = drag.current;
        d.active = false;
        if (d.ready) latest.current.onCommit(d.value);
        latest.current.onPreview(null);
      },
      onPanResponderTerminate: () => {
        drag.current.active = false;
        latest.current.onPreview(null);
      },
    }),
  ).current;
  const commit = (next: number) => onCommit(normalizeCharacterScale(next));
  const percentage =
    ((value - CHARACTER_SCALE_MIN) / (CHARACTER_SCALE_MAX - CHARACTER_SCALE_MIN)) * 100;
  const close = () => {
    drag.current.active = false;
    onPreview(null);
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={close} dragScope="header">
      <View style={[styles.content, { backgroundColor: t.surface }]}>
        <View style={styles.row}>
          <Text style={[Typography.h2, { color: t.text }]}>
            {tr('roomShop.characterScale.title')}
          </Text>
          <Text style={[Typography.label, { color: t.primary }]}>{Math.round(value * 100)}%</Text>
        </View>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('roomShop.characterScale.hint')}
        </Text>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('roomShop.characterScale.smaller')}
            onPress={() => commit(value - CHARACTER_SCALE_STEP)}
            style={styles.step}>
            <Icon name="subtract" color={t.text} />
          </Pressable>
          <View
            ref={slider}
            {...gesture.panHandlers}
            testID="character-size-slider"
            accessibilityRole="adjustable"
            accessibilityLabel={tr('roomShop.characterScale.title')}
            accessibilityValue={{
              min: 70,
              max: 130,
              now: Math.round(value * 100),
              text: `${Math.round(value * 100)}%`,
            }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) =>
              commit(
                value +
                  (event.nativeEvent.actionName === 'increment'
                    ? CHARACTER_SCALE_STEP
                    : -CHARACTER_SCALE_STEP),
              )
            }
            style={styles.slider}>
            <View pointerEvents="none" style={[styles.rail, { backgroundColor: t.border }]}>
              <View
                style={[styles.fill, { width: `${percentage}%`, backgroundColor: t.primary }]}
              />
              <View
                style={[styles.thumb, { left: `${percentage}%`, backgroundColor: t.primary }]}
              />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('roomShop.characterScale.larger')}
            onPress={() => commit(value + CHARACTER_SCALE_STEP)}
            style={styles.step}>
            <Icon name="add" color={t.text} />
          </Pressable>
        </View>
        <View style={styles.row}>
          <Button
            variant="secondary"
            label={tr('roomShop.characterScale.reset')}
            onPress={() => commit(1)}
            style={styles.flex}
          />
          <Button label={tr('common.confirm')} onPress={close} style={styles.flex} />
        </View>
      </View>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  flex: { flex: 1 },
  step: { padding: Spacing.two, minWidth: Spacing.five, alignItems: 'center' },
  slider: { flex: 1, height: Spacing.five, justifyContent: 'center' },
  rail: { height: Spacing.one, borderRadius: Radius.pill },
  fill: { height: '100%', borderRadius: Radius.pill },
  thumb: {
    position: 'absolute',
    width: Spacing.three,
    height: Spacing.three,
    borderRadius: Radius.pill,
    top: (Spacing.one - Spacing.three) / 2,
    marginLeft: -Spacing.three / 2,
  },
});
