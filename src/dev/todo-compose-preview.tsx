import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TodoComposeSheet } from '@/components/screens/sheets/todo-compose-sheet';
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
      <TodoComposeSheet
        visible={visible}
        initialDate={todayIso()}
        today={todayIso()}
        categories={ROUTINE_CATEGORIES}
        onSubmit={(category, title, date) => {
          setSaved(`${date} · ${category || '미분류'} · ${title}`);
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
