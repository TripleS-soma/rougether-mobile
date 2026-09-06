import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, SheetDragExclude } from '@/components/ui/bottom-sheet';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Icon } from '@/components/ui/icon';
import { WHEEL_ITEM_HEIGHT, WHEEL_VISIBLE_ROWS, WheelPicker } from '@/components/ui/wheel-picker';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type Ampm = 'AM' | 'PM';

const AMPM_ITEMS = [
  { value: 'AM' as Ampm, label: '오전' },
  { value: 'PM' as Ampm, label: '오후' },
];
const HOUR_ITEMS = HOURS.map((h) => ({ value: h, label: String(h), accessibilityLabel: `${h}시` }));
const MINUTE_ITEMS = MINUTES.map((m) => ({
  value: m,
  label: String(m).padStart(2, '0'),
  accessibilityLabel: `${String(m).padStart(2, '0')}분`,
}));

/** "HH:MM" 24h → { ampm, hour12, minute (snapped to 5) }. Exported for tests. */
export function parse(time: string) {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const ampm: Ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minute = MINUTES.reduce((p, c) => (Math.abs(c - m) < Math.abs(p - m) ? c : p));
  return { ampm, hour12, minute };
}

/** { ampm, hour12, minute } → "HH:MM" 24h. Exported for tests. */
export function to24(ampm: Ampm, hour12: number, minute: number) {
  let h = hour12 % 12;
  if (ampm === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export type TimePickerSheetProps = {
  visible: boolean;
  initialEnabled: boolean;
  initialTime: string;
  onSave: (enabled: boolean, time: string) => void;
  onClose: () => void;
};

/**
 * "알림 시간" bottom sheet, ported from the prototype `TimePickerSheet`: an
 * enable toggle plus AM/PM, hour, and minute choosers. Pure JS (no native
 * date-time picker), so it ships over EAS Update. Chrome is inline (not a
 * wrapper's children) so its controls stay interactive in tests.
 */
export function TimePickerSheet({
  visible,
  initialEnabled,
  initialTime,
  onSave,
  onClose,
}: TimePickerSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const init = parse(initialTime || '07:00');
  const [enabled, setEnabled] = useState(initialEnabled);
  const [ampm, setAmpm] = useState<Ampm>(init.ampm);
  const [hour12, setHour12] = useState(init.hour12);
  const [minute, setMinute] = useState(init.minute);

  useEffect(() => {
    if (!visible) return;
    const p = parse(initialTime || '07:00');
    setEnabled(initialEnabled);
    setAmpm(p.ampm);
    setHour12(p.hour12);
    setMinute(p.minute);
  }, [visible, initialEnabled, initialTime]);

  const save = () => {
    onSave(enabled, to24(ampm, hour12, minute));
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={[styles.head, { borderBottomColor: t.border }]}>
        <Text style={[Typography.h3, { color: t.text }]}>알림 시간</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          style={[styles.close, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="close" size={16} color={t.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={[styles.enableRow, { backgroundColor: t.surface }]}>
          <Icon name={enabled ? 'bell' : 'bell-off'} size={20} color={t.text} />
          <View style={styles.flex}>
            <Text style={[Typography.body, { color: t.text }]}>알림 받기</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {enabled ? '설정한 시간에 알려드려요' : '알림 없이 진행해요'}
            </Text>
          </View>
          <ToggleSwitch
            value={enabled}
            onToggle={() => setEnabled((v) => !v)}
            accessibilityLabel="알림 받기"
          />
        </View>

        {enabled ? (
          <>
            {/* 오전/오후 · 시 · 분 3열 스와이프 휠 (#390) — 중앙 밴드 하나가
                  세 휠을 가로지른다. 스와이프 외에 행 탭으로도 선택 가능. */}
            <View style={styles.wheelWrap}>
              <View
                style={[styles.band, { backgroundColor: t.surfaceMuted }]}
                pointerEvents="none"
              />
              {/* 휠은 세로 스와이프를 스스로 쓴다 — 시트 끌어내리기에서 제외 (#1132). */}
              <SheetDragExclude style={styles.wheels}>
                <WheelPicker
                  items={AMPM_ITEMS}
                  value={ampm}
                  onChange={setAmpm}
                  accessibilityLabel="오전/오후 선택"
                  testID="wheel-ampm"
                />
                <WheelPicker
                  items={HOUR_ITEMS}
                  value={hour12}
                  onChange={setHour12}
                  accessibilityLabel="시 선택"
                  testID="wheel-hour"
                />
                <WheelPicker
                  items={MINUTE_ITEMS}
                  value={minute}
                  onChange={setMinute}
                  accessibilityLabel="분 선택"
                  testID="wheel-minute"
                />
              </SheetDragExclude>
            </View>
          </>
        ) : null}
      </View>

      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <Pressable
          onPress={save}
          accessibilityRole="button"
          accessibilityLabel="알림 저장"
          style={[styles.save, { backgroundColor: t.primary }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>저장</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '92%',
    paddingBottom: Spacing.four,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    fontSize: 18,
  },
  body: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  wheelWrap: {
    position: 'relative',
  },
  wheels: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (WHEEL_ITEM_HEIGHT * (WHEEL_VISIBLE_ROWS - 1)) / 2,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: Radius.md,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  save: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
