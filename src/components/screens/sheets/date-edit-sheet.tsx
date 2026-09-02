import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SheetHandle } from '@/components/ui/sheet-handle';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Calendar } from '@/components/ui/calendar';
import type { Routine } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { todayIso } from '@/utils/datetime';

export type DateEditSheetProps = {
  /** 날짜를 바꿀 루틴/투두 — null이면 시트가 닫힌다. */
  item: Routine | null;
  onClose: () => void;
  /** Change a todo's due date. */
  onUpdateTodoDueDate?: (id: string, dueDate: string) => void;
  /** Move a routine's occurrence for that day only (repeat stays). */
  onMoveRoutineOccurrence?: (id: string, dueDate: string) => void;
};

/**
 * 날짜 바꾸기 calendar bottom sheet — the pick stays a draft until 확인.
 * Extracted from my-room-screen (pure move, no behavior change); the draft
 * date lives here and is thrown away on cancel.
 */
export function DateEditSheet({
  item,
  onClose,
  onUpdateTodoDueDate,
  onMoveRoutineOccurrence,
}: DateEditSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const [draft, setDraft] = useState(() => todayIso());
  useEffect(() => {
    if (item) setDraft(item.dueDate ?? todayIso());
  }, [item]);

  return (
    <BottomSheet
      visible={item !== null}
      onClose={onClose}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <SheetHandle />
      <Text style={[Typography.h3, styles.sheetTitle, { color: t.text }]} numberOfLines={1}>
        날짜 바꾸기
      </Text>
      {item?.kind !== 'todo' ? (
        <Text style={[Typography.supporting, styles.sheetNote, { color: t.textMuted }]}>
          루틴 반복은 그대로 두고, 선택한 날짜에 이 날 몫이 할 일로 추가돼요.{'\n'}(원래 날짜에서
          숨기는 건 서버 준비 중이에요)
        </Text>
      ) : null}
      <Calendar value={draft} onSelect={setDraft} />
      <View style={styles.dialogBtns}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="취소"
          style={[styles.dialogBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[Typography.label, { color: t.text }]}>취소</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const r = item;
            onClose();
            if (!r) return;
            if (r.kind === 'todo') onUpdateTodoDueDate?.(r.id, draft);
            else onMoveRoutineOccurrence?.(r.id, draft);
          }}
          accessibilityRole="button"
          accessibilityLabel="확인"
          style={[styles.dialogBtn, { backgroundColor: t.primary }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>확인</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sheetTitle: {
    textAlign: 'center',
  },
  sheetNote: {
    textAlign: 'center',
  },
  dialogBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dialogBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
