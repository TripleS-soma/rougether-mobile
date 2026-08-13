import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BearCheck } from '@/components/ui/bear-check';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type QuickAddRowProps = {
  /** 마감일 칩에 보일 문구 ("오늘" 또는 날짜). */
  dateLabel: string;
  /** blur = 커밋 (#323). 부모가 실제 저장 여부를 판단한다(날짜 피커 진입은 건너뜀). */
  onCommit: (title: string) => void;
  /** 날짜 칩 누름 — 부모가 피커를 연다. */
  onOpenDatePicker: () => void;
  /**
   * 날짜 칩 press-in — 입력의 blur보다 먼저 발화해 "이 blur는 피커 때문"임을
   * 부모에 알린다. 이게 없으면 피커를 여는 순간 커밋되어 행이 닫힌다.
   */
  onDatePickerPressIn: () => void;
  inputRef?: React.Ref<TextInput>;
};

/**
 * 퀵애드 입력행 (#323, #769에서 별도 컴포넌트로 분리).
 *
 * **입력 중인 제목을 이 컴포넌트가 소유하는 것이 분리의 목적이다.** 예전에는
 * `newTodo`가 나의 방 화면 루트 상태여서 한 글자 칠 때마다 화면 전체가
 * 리렌더됐고, 그 여파로 모든 루틴 행의 `SwipeDeleteRow`(ReanimatedSwipeable)
 * 트리와 팬 제스처까지 매 타건 재조정됐다. 상태를 여기로 내리면 타이핑은 이
 * 행 안에서 끝난다.
 *
 * 커밋 후 상태를 비우지 않는 이유: 저장에 성공하면 부모가 행을 닫아
 * (`addingCategory=null`) 언마운트되므로 자연히 사라지고, 날짜 피커 때문에
 * blur된 경우엔 **입력 중이던 제목이 남아야** 하기 때문이다.
 */
export const QuickAddRow = forwardRef<View, QuickAddRowProps>(function QuickAddRow(
  { dateLabel, onCommit, onOpenDatePicker, onDatePickerPressIn, inputRef },
  ref,
) {
  const t = useTokens();
  const Typography = useTypography();
  const [title, setTitle] = useState('');

  return (
    <View ref={ref} style={[styles.addRow, { backgroundColor: t.surface }]}>
      <BearCheck checked={false} size={22} />
      <TextInput
        ref={inputRef}
        autoFocus
        value={title}
        onChangeText={setTitle}
        // 완료(단일행이라 submit=blur) 또는 다른 곳 탭 — 양쪽 다 저장으로.
        onBlur={() => onCommit(title)}
        placeholder="할 일 입력 후 완료"
        placeholderTextColor={t.textMuted}
        style={[styles.flex, styles.todoInput, { color: t.text }]}
      />
      <Pressable
        onPressIn={onDatePickerPressIn}
        onPress={onOpenDatePicker}
        accessibilityRole="button"
        accessibilityLabel="할 일 날짜 선택"
        style={[styles.dateChip, { backgroundColor: t.surfaceMuted }]}>
        <Icon name="calendar" size={13} color={t.textMuted} />
        <Text style={[Typography.supporting, { color: t.textMuted }]}>{dateLabel}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginTop: Spacing.half,
  },
  todoInput: {
    fontSize: 18,
    paddingVertical: Spacing.three,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
