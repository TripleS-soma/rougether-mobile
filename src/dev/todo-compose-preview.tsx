import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RoutineTodoComposeSheet } from '@/components/screens/sheets/routine-todo-compose-sheet';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { ROUTINE_CATEGORIES, SAMPLE_ROUTINES } from '@/constants/routines';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { todayIso } from '@/utils/datetime';

export function TodoComposePreview() {
  const [visible, setVisible] = useState(true);
  const [saved, setSaved] = useState('');
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={{ padding: Spacing.four, gap: Spacing.four }}>
      <Pressable accessibilityRole="button" onPress={() => setVisible(true)}>
        <Text style={[Typography.label, { color: t.primaryText }]}>할 일 추가</Text>
      </Pressable>
      <Text style={[Typography.body, { color: t.text }]}>{saved}</Text>
      <RoutineTodoComposeSheet
        visible={visible}
        initialDate={todayIso()}
        today={todayIso()}
        categories={ROUTINE_CATEGORIES}
        onSubmit={(draft) => {
          setSaved(
            `${draft.date} · ${draft.kind === 'routine' ? draft.routine.title : draft.title}`,
          );
          return true;
        }}
        onClose={() => setVisible(false)}
      />
    </View>
  );
}

export function RoomQuickTodoPreview() {
  const [routines, setRoutines] = useState(SAMPLE_ROUTINES);
  return (
    <MyRoomScreen
      routines={routines}
      view="room"
      growthLevel={2}
      growthPoints={50}
      pointsToNextLevel={16}
      onCreateRoutine={(routine) => {
        setRoutines((previous) => [
          ...previous,
          { ...routine, id: `r-${Date.now()}`, kind: 'routine' },
        ]);
        return true;
      }}
      onQuickAddRoutine={(category, title, dueDate) => {
        setRoutines((previous) => [
          ...previous,
          { id: `t-${Date.now()}`, kind: 'todo', category: category || undefined, title, dueDate },
        ]);
        return true;
      }}
    />
  );
}
