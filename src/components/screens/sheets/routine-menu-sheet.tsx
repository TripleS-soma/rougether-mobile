import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SheetHandle } from '@/components/ui/sheet-handle';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import type { Routine } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type RoutineMenuSheetProps = {
  /** 메뉴를 연 행의 루틴/투두 — null이면 시트가 닫힌다. */
  item: Routine | null;
  /** 메뉴를 연 날짜 기준 완료 여부 — 완료하기/완료 취소 라벨과 토글 방향. */
  done: boolean;
  onClose: () => void;
  /** 이름 변경 — 이름만 바꾸는 다이얼로그 열기. */
  onRename: (item: Routine) => void;
  /** 루틴 수정 — 전체 편집 화면(AddRoutineScreen edit 모드) 열기 (#465). 투두엔 안 보임. */
  onEdit: (item: Routine) => void;
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
  onEdit,
  onDelete,
  onToggleComplete,
  onEditTime,
  onChangeDate,
}: RoutineMenuSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  // 시간이 없는 루틴/투두는 '시간 추가', 있으면 '시간 수정' (#325).
  const timeLabel = item?.alarmEnabled && item?.time ? '시간 수정' : '시간 추가';
  // 전체 편집은 반복 루틴 전용 — 투두는 필드가 달라(마감일 등) 이름/날짜만 (#465).
  const canFullEdit = item != null && item.kind !== 'todo';

  return (
    <BottomSheet
      visible={item !== null}
      onClose={onClose}
      // 세로 스크롤 자식이 없는 메뉴 시트 — 본문 어디서든 끌어내려 닫기 (#657).
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <SheetHandle />
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
          accessibilityLabel={`${item?.title ?? ''} 이름 변경`}
          style={[styles.sheetAction, { backgroundColor: t.surface }]}>
          <Icon name="edit" size={22} color={t.text} />
          <Text style={[Typography.label, { color: t.text }]}>이름 변경</Text>
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

      {/* 루틴 수정 — 전체 편집 화면으로. 이름 변경(위)과 별개로 카테고리·반복·
          알람 설정까지 바꾼다 (#465). 투두는 숨김. */}
      {canFullEdit ? (
        <Pressable
          onPress={() => {
            const r = item;
            onClose();
            if (r) onEdit(r);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${item?.title ?? ''} 루틴 수정`}
          style={styles.sheetItem}>
          <View style={[styles.sheetItemIcon, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="settings" size={18} color={t.text} />
          </View>
          <Text style={[Typography.body, { color: t.text }]}>루틴 수정</Text>
        </Pressable>
      ) : null}

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
        <Text style={[Typography.body, { color: t.text }]}>{done ? '완료 취소' : '완료하기'}</Text>
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
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
