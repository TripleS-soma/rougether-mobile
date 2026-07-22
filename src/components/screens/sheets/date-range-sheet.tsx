import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Calendar } from '@/components/ui/calendar';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Icon } from '@/components/ui/icon';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { formatDate } from '@/utils/datetime';

export type DateRangeSheetProps = {
  visible: boolean;
  initialStartDate: string;
  initialEndDate?: string;
  onSave: (startDate: string, endDate?: string) => void;
  onClose: () => void;
};

/**
 * "지속 기간" bottom sheet, ported from the prototype `DateRangeSheet`: a start
 * date, an optional end date, and a month-grid calendar that edits whichever
 * field is selected. Pure JS (ships over EAS Update). The sheet chrome is inline
 * (not a wrapper's children) so its controls stay interactive in tests.
 */
export function DateRangeSheet({
  visible,
  initialStartDate,
  initialEndDate,
  onSave,
  onClose,
}: DateRangeSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const [startDate, setStartDate] = useState(initialStartDate);
  const [hasEndDate, setHasEndDate] = useState(Boolean(initialEndDate));
  const [endDate, setEndDate] = useState(initialEndDate ?? initialStartDate);
  const [editing, setEditing] = useState<'start' | 'end'>('start');

  // Reset to the incoming values each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setStartDate(initialStartDate);
    setHasEndDate(Boolean(initialEndDate));
    setEndDate(initialEndDate ?? initialStartDate);
    setEditing('start');
  }, [visible, initialStartDate, initialEndDate]);

  if (!visible) return null;

  const endValid = !hasEndDate || endDate >= startDate;

  const save = () => {
    if (!endValid) return;
    onSave(startDate, hasEndDate ? endDate : undefined);
    onClose();
  };

  const toggleEnd = () => {
    setHasEndDate((prev) => {
      const next = !prev;
      if (next) {
        if (endDate < startDate) setEndDate(startDate);
        setEditing('end');
      } else {
        setEditing('start');
      }
      return next;
    });
  };

  const selectStart = (date: string) => {
    setStartDate(date);
    if (hasEndDate && endDate < date) setEndDate(date);
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: t.screen }]}>
        <View style={[styles.head, { borderBottomColor: t.border }]}>
          <Text style={[Typography.h3, { color: t.text }]}>지속 기간</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            style={[styles.close, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="close" size={16} color={t.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.tabs}>
            <Tab
              active={editing === 'start'}
              label="시작일"
              value={formatDate(startDate)}
              onPress={() => setEditing('start')}
            />
            <Tab
              active={editing === 'end'}
              label="종료일"
              value={hasEndDate ? formatDate(endDate) : '없음'}
              disabled={!hasEndDate}
              onPress={() => hasEndDate && setEditing('end')}
            />
          </View>

          <View style={[styles.endRow, { backgroundColor: t.surface }]}>
            <View style={styles.flex}>
              <Text style={[Typography.body, { color: t.text }]}>종료일 설정</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {hasEndDate ? '선택한 날짜까지 진행해요' : '종료일 없이 계속 진행해요'}
              </Text>
            </View>
            <ToggleSwitch
              value={hasEndDate}
              onToggle={toggleEnd}
              accessibilityLabel="종료일 설정"
            />
          </View>

          {editing === 'start' ? (
            <Calendar
              value={startDate}
              max={hasEndDate ? endDate : undefined}
              onSelect={selectStart}
            />
          ) : (
            <Calendar value={endDate} min={startDate} onSelect={setEndDate} />
          )}

          {!endValid ? (
            <Text style={[Typography.supporting, { color: t.danger }]}>
              종료일은 시작일 이후로 선택해주세요.
            </Text>
          ) : null}
        </View>

        <View style={[styles.footer, { borderTopColor: t.border }]}>
          <Pressable
            onPress={save}
            disabled={!endValid}
            accessibilityRole="button"
            accessibilityLabel="기간 저장"
            style={[styles.save, { backgroundColor: endValid ? t.primary : t.textDisabled }]}>
            <Text style={[Typography.label, { color: t.onPrimary }]}>저장</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Tab({
  active,
  label,
  value,
  disabled,
  onPress,
}: {
  active: boolean;
  label: string;
  value: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      style={[
        styles.tab,
        { backgroundColor: t.surface, borderColor: active ? t.primary : 'transparent' },
      ]}>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>{label}</Text>
      <Text style={[Typography.label, { color: disabled ? t.textDisabled : t.text }]}>{value}</Text>
    </Pressable>
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
  tabs: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tab: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  endRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    padding: Spacing.three,
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
