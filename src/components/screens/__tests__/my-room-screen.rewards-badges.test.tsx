import { act, fireEvent, render } from '@testing-library/react-native';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { TODAY } from '@/test-utils/my-room-screen-fixtures';

describe('MyRoomScreen', () => {
  it('renders today progress without a room title — 스트릭·잔액은 상시 표시하지 않는다 (#1055)', async () => {
    // Completion is per date: mark 3 of the 5 routines done today.
    const completions = { '1': [TODAY], '2': [TODAY], '3': [TODAY] };
    const { getByText, queryByText } = await render(
      <MyRoomScreen
        userName="준서"
        streakDays={7}
        routines={SAMPLE_ROUTINES}
        completions={completions}
        coinBalance={1200}
        diamondBalance={34}
      />,
    );
    expect(queryByText('준서의 방')).toBeNull();
    // 3 of 5 routines completed today.
    expect(getByText('3 / 5')).toBeTruthy();
    // 헤더바가 사라지며(#1055) 스트릭·코인·다이아는 보상 순간에만 알약으로 뜬다.
    expect(queryByText('7일')).toBeNull();
    expect(queryByText('1,200')).toBeNull();
    expect(queryByText('34')).toBeNull();
  });

  it('완료 보상이 확인되면 스트릭·코인 증분 알약이 떴다가 사라진다 (#1055)', async () => {
    jest.useFakeTimers();
    try {
      const onToggleCompletion = jest.fn(() => Promise.resolve({ rewardAmount: 10 }));
      const { getByLabelText, queryByText, findByText } = await render(
        <MyRoomScreen
          streakDays={7}
          routines={SAMPLE_ROUTINES}
          onToggleCompletion={onToggleCompletion}
        />,
      );
      expect(queryByText('+10')).toBeNull();
      await fireEvent.press(getByLabelText('하루 회고'));
      expect(await findByText('+10')).toBeTruthy();
      expect(queryByText('7일')).toBeTruthy();
      // 표시 중 또 오면 합산.
      await fireEvent.press(getByLabelText('아침 7시 기상'));
      expect(await findByText('+20')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(2500);
      });
      expect(queryByText('+20')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides the streak badge when the streak is 0', async () => {
    const { queryByText } = await render(<MyRoomScreen streakDays={0} routines={[]} />);
    expect(queryByText('0일')).toBeNull();
  });
});
