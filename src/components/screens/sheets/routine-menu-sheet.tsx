import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import type { Routine } from '@/constants/routines';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type RoutineMenuSheetProps = {
  /** 메뉴를 연 행의 루틴/투두 — null이면 시트가 닫힌다. */
  item: Routine | null;
  /** 메뉴를 연 날짜 기준 완료 여부 — 완료하기/완료 취소 라벨과 토글 방향. */
  done: boolean;
  onClose: () => void;
  /** 수정하기 — 이름 변경 다이얼로그 열기. */
  onRename: (item: Routine) => void;
  /** 삭제하기. */
  onDelete: (item: Routine) => void;
  /** 완료하기/완료 취소 — 날짜 규칙(오늘/과거/미래)은 부모가 판정 (#323). */
  onToggleComplete: (item: Routine) => void;
  /** 시간 추가/수정 — TimePickerSheet 열기 (#325). */
  onEditTime: (item: Routine) => void;
  /** 날짜 바꾸기 — 달력 시트 열기. */
  onChangeDate: (item: Routine) => void;
};

/**
 * 루틴/투두 행 메뉴 바텀시트 — 수정/삭제/완료/시간/날짜 액션. Extracted from
 * my-room-screen (pure move, no behavior change); every action closes the
 * sheet first, then hands the captured item back to the parent.
 */
export function RoutineMenuSheet({
  item,
  done,
  onClose,
  onRename,
  onDelete,
  onToggleComplete,
  onEditTime,
  onChangeDate,
}: RoutineMenuSheetProps) {
  const t = useTokens();
  // 시간이 없는 루틴/투두는 '시간 추가', 있으면 '시간 수정' (#325).
  const timeLabel = item?.alarmEnabled && item?.time ? '시간 수정' : '시간 추가';

  return (
    <Modal transparent visible={item !== null} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: t.screen }]}>
          <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
          <Text style={[Typography.h3, styles.sheetTitle, { color: t.text }]} numberOfLines={1}>
            {item?.title}
          </Text>

          <View style={styles.sheetActions}>
            <Pressable
              onPress={() => {
                const r = item;
                onClose();
                if (r) onRename(r);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item?.title ?? ''} 수정`}
              style={[styles.sheetAction, { backgroundColor: t.surface }]}>
              <Icon name="edit" size={22} color={t.text} />
              <Text style={[Typography.label, { color: t.text }]}>수정하기</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const r = item;
                onClose();
                if (r) onDelete(r);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item?.title ?? ''} 삭제`}
              style={[styles.sheetAction, { backgroundColor: t.surface }]}>
              <Icon name="trash" size={22} color={t.danger} />
              <Text style={[Typography.label, { color: t.danger }]}>삭제하기</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              const r = item;
              onClose();
              if (r) onToggleComplete(r);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${item?.title ?? ''} ${done ? '완료 취소' : '완료'}`}
            style={styles.sheetItem}>
            <View style={[styles.sheetItemIcon, { backgroundColor: t.primary }]}>
              <Icon name={done ? 'checkbox-off' : 'check'} size={18} color={t.onPrimary} />
            </View>
            <Text style={[Typography.body, { color: t.text }]}>
              {done ? '완료 취소' : '완료하기'}
            </Text>
          </Pressable>

          {/* 루틴은 알림 시간, 투두는 마감 시각(dueTime) — 같은 항목으로 다룬다 (#325). */}
          <Pressable
            onPress={() => {
              const r = item;
              onClose();
              if (r) onEditTime(r);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${item?.title ?? ''} ${timeLabel}`}
            style={styles.sheetItem}>
            <View style={[styles.sheetItemIcon, { backgroundColor: t.warning }]}>
              <Icon name="bell" size={18} color={t.onPrimary} />
            </View>
            <Text style={[Typography.body, { color: t.text }]}>{timeLabel}</Text>
          </Pressable>

          {/* Todos move their dueDate; a routine moves that day's occurrence
              only — the repeat stays (the calendar sheet explains). */}
          <Pressable
            onPress={() => {
              const r = item;
              onClose();
              if (r) onChangeDate(r);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${item?.title ?? ''} 날짜 바꾸기`}
            style={styles.sheetItem}>
            <View style={[styles.sheetItemIcon, { backgroundColor: t.success }]}>
              <Icon name="calendar" size={18} color={t.onPrimary} />
            </View>
            <Text style={[Typography.body, { color: t.text }]}>날짜 바꾸기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.one,
  },
  sheetTitle: {
    textAlign: 'center',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  sheetAction: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sheetItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
