import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Icon } from '@/components/ui/icon';
import { Overlay, Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type Ampm = 'AM' | 'PM';

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

  if (!visible) return null;

  const save = () => {
    onSave(enabled, to24(ampm, hour12, minute));
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: t.screen }]}>
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
              <View style={styles.ampmRow}>
                {(['AM', 'PM'] as const).map((p) => {
                  const active = ampm === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setAmpm(p)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.ampm, { backgroundColor: active ? t.primary : t.surface }]}>
                      <Text
                        style={[Typography.label, { color: active ? t.onPrimary : t.textMuted }]}>
                        {p === 'AM' ? '오전' : '오후'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[Typography.supporting, { color: t.textMuted }]}>시</Text>
              <View style={styles.chipRow}>
                {HOURS.map((h) => {
                  const active = hour12 === h;
                  return (
                    <Pressable
                      key={h}
                      onPress={() => setHour12(h)}
                      accessibilityRole="button"
                      accessibilityLabel={`${h}시`}
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, { backgroundColor: active ? t.primary : t.surface }]}>
                      <Text style={[Typography.label, { color: active ? t.onPrimary : t.text }]}>
                        {h}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[Typography.supporting, { color: t.textMuted }]}>분</Text>
              <View style={styles.chipRow}>
                {MINUTES.map((m) => {
                  const active = minute === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMinute(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`${String(m).padStart(2, '0')}분`}
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, { backgroundColor: active ? t.primary : t.surface }]}>
                      <Text style={[Typography.label, { color: active ? t.onPrimary : t.text }]}>
                        {String(m).padStart(2, '0')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[Typography.h2, styles.preview, { color: t.text }]}>
                {ampm === 'AM' ? '오전' : '오후'} {hour12}:{String(minute).padStart(2, '0')}
              </Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay.dim,
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
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    fontSize: 16,
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
  ampmRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  ampm: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    textAlign: 'center',
    marginTop: Spacing.two,
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
