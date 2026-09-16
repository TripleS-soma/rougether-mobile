import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SheetHandle } from '@/components/ui/sheet-handle';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Calendar } from '@/components/ui/calendar';
import { ROUTINE_OCCURRENCE_SKIP_ENABLED, type Routine } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { todayIso } from '@/utils/datetime';
import { useT } from '@/i18n';

export type DateEditSheetProps = {
  /** 날짜를 바꿀 루틴/투두 — null이면 시트가 닫힌다. */
  item: Routine | null;
  onClose: () => void;
  /** Change a todo's due date. */
  onUpdateTodoDueDate?: (id: string, dueDate: string) => void;
  /**
   * 옮길 몫의 원래 날짜("YYYY-MM-DD") — 메뉴를 연 날짜. 없으면 오늘. 지난 날짜 몫은
   * 서버가 건너뜀을 받지 않아 할 일만 추가된다(#189).
   */
  fromDate?: string;
  /** Move a routine's occurrence from `fromDate` to `dueDate` only (repeat stays). */
  onMoveRoutineOccurrence?: (id: string, dueDate: string, fromDate: string) => void;
};

/**
 * 날짜 바꾸기 calendar bottom sheet — the pick stays a draft until 확인.
 * Extracted from my-room-screen (pure move, no behavior change); the draft
 * date lives here and is thrown away on cancel.
 */
export function DateEditSheet({
  item,
  onClose,
  fromDate,
  onUpdateTodoDueDate,
  onMoveRoutineOccurrence,
}: DateEditSheetProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const [draft, setDraft] = useState(() => todayIso());
  useEffect(() => {
    if (item) setDraft(item.dueDate ?? todayIso());
  }, [item]);
  const origin = fromDate ?? todayIso();
  // 서버 건너뜀이 꺼져 있으면(배포 전) 지난 날짜와 같은 안내 — 할 일만 추가된다.
  const pastOrigin = !ROUTINE_OCCURRENCE_SKIP_ENABLED || origin < todayIso();

  return (
    <BottomSheet
      visible={item !== null}
      onClose={onClose}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <SheetHandle />
      <Text style={[Typography.h3, styles.sheetTitle, { color: t.text }]} numberOfLines={1}>
        {tr('routineTodo.dateEdit.title')}
      </Text>
      {item?.kind !== 'todo' ? (
        <Text style={[Typography.supporting, styles.sheetNote, { color: t.textMuted }]}>
          {pastOrigin
            ? `${tr('routineTodo.dateEdit.pastNote')}\n${
                ROUTINE_OCCURRENCE_SKIP_ENABLED
                  ? tr('routineTodo.dateEdit.pastNoteSkipOn')
                  : tr('routineTodo.dateEdit.pastNoteSkipOff')
              }`
            : tr('routineTodo.dateEdit.moveNote')}
        </Text>
      ) : null}
      <Calendar value={draft} onSelect={setDraft} />
      <View style={styles.dialogBtns}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('common.cancel')}
          style={[styles.dialogBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[Typography.label, { color: t.text }]}>{tr('common.cancel')}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const r = item;
            onClose();
            if (!r) return;
            if (r.kind === 'todo') onUpdateTodoDueDate?.(r.id, draft);
            else onMoveRoutineOccurrence?.(r.id, draft, origin);
          }}
          accessibilityRole="button"
          accessibilityLabel={tr('common.confirm')}
          style={[styles.dialogBtn, { backgroundColor: t.primary }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>{tr('common.confirm')}</Text>
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
