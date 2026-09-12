import { fireEvent, render } from '@testing-library/react-native';
import { MinigameLeaderboardScreen } from '@/components/screens/minigame-leaderboard-screen';

it('uses server ranks for ties and shows my entry outside the top list', async () => {
  const ui = await render(
    <MinigameLeaderboardScreen
      leaderboard={{
        items: [
          { rank: 1, userId: 1, nickname: '고양이', score: 400 },
          { rank: 1, userId: 2, nickname: '친구', score: 400 },
        ],
        myEntry: { rank: 87, userId: 3, nickname: '나의 고양이', score: 100 },
        totalPlayers: 102,
      }}
    />,
  );
  expect(ui.getAllByText('1위')).toHaveLength(2);
  expect(ui.getByText('87위')).toBeTruthy();
  expect(ui.getByText('나의 고양이 · 나')).toBeTruthy();
  expect(ui.getByText('총 102명 참여')).toBeTruthy();
});

it('does not invent an entry for users without a record', async () => {
  const ui = await render(
    <MinigameLeaderboardScreen leaderboard={{ items: [], myEntry: null, totalPlayers: 0 }} />,
  );
  expect(ui.getByText('아직 기록이 없어요. 첫 도전을 시작해보세요.')).toBeTruthy();
  expect(ui.getByText('아직 등록된 기록이 없어요.')).toBeTruthy();
  expect(ui.queryByText('0점')).toBeNull();
});

it('lets the user retry a failed leaderboard load', async () => {
  const retry = jest.fn();
  const ui = await render(<MinigameLeaderboardScreen error onRetry={retry} />);
  await fireEvent.press(ui.getByLabelText('다시 시도'));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(ui.queryByText('총 0명 참여')).toBeNull();
});
