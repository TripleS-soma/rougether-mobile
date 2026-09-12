import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { MinigameRunnerScreen } from '@/components/screens/minigame-runner-screen';
import { PLAYABLE_MINIGAMES } from '@/constants/minigames';

it.each(PLAYABLE_MINIGAMES)(
  'shows $name instructions and ready copy for the selected game',
  async (game) => {
    const ui = await render(
      <MinigameRunnerScreen
        gameName={game.name}
        instructions={game.instructions}
        readyTitle={game.readyTitle}
        characterPose={game.pose}
      />,
    );
    expect(ui.getByText(game.name)).toBeTruthy();
    expect(ui.getByText(game.instructions)).toBeTruthy();
    expect(ui.getByText(game.readyTitle)).toBeTruthy();
    for (const other of PLAYABLE_MINIGAMES.filter(
      (candidate) => candidate.gameCode !== game.gameCode,
    )) {
      expect(ui.queryByText(other.name)).toBeNull();
      expect(ui.queryByText(other.instructions)).toBeNull();
      expect(ui.queryByText(other.readyTitle)).toBeNull();
    }
  },
);

it('shows a server result only after confirmation and blocks duplicate actions during save', async () => {
  const start = jest.fn();
  const ui = await render(
    <MinigameRunnerScreen game={<Text>게임</Text>} finished pending onStart={start} />,
  );
  expect(ui.getByLabelText('기록 저장 중')).toBeTruthy();
  expect(ui.queryByText('기록을 저장했어요')).toBeNull();
  await fireEvent.press(ui.getByLabelText('다시 랭킹 도전'));
  expect(start).not.toHaveBeenCalled();
  await ui.rerender(
    <MinigameRunnerScreen
      game={<Text>게임</Text>}
      finished
      result={{ runId: 'run', score: 180, bestScore: 300, personalBest: false, rank: 9 }}
    />,
  );
  expect(ui.getByText('기록을 저장했어요')).toBeTruthy();
  expect(ui.getByText('최고 300점 · 전체 9위')).toBeTruthy();
});

it('offers a same-record retry after failed submission without claiming a ranking', async () => {
  const retry = jest.fn();
  const ui = await render(
    <MinigameRunnerScreen game={<Text>게임</Text>} finished submitError onRetrySubmit={retry} />,
  );
  expect(ui.getByText('기록을 저장하지 못했어요')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('기록 저장 다시 시도'));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(ui.queryByText('기록을 저장했어요')).toBeNull();
});

it('labels practice and provides a fresh practice attempt after game over', async () => {
  const practice = jest.fn();
  const ui = await render(
    <MinigameRunnerScreen practice finished game={<Text>게임</Text>} onPractice={practice} />,
  );
  expect(ui.getByText('연습 모드 · 랭킹에 기록되지 않아요')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('다시 연습하기'));
  expect(practice).toHaveBeenCalledTimes(1);
  expect(ui.queryByText('다시 랭킹 도전')).toBeNull();
});

it('shows one recovery banner and retains the old score retry if a new start also failed', async () => {
  const retry = jest.fn();
  const ui = await render(
    <MinigameRunnerScreen finished startError submitError onRetrySubmit={retry} />,
  );
  expect(ui.getByText('랭킹 게임을 준비하지 못했어요')).toBeTruthy();
  expect(ui.getByText('이전 게임 기록은 다시 저장할 수 있어요.')).toBeTruthy();
  expect(ui.queryByText('기록을 저장하지 못했어요')).toBeNull();
  await fireEvent.press(ui.getByLabelText('기록 저장 다시 시도'));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(ui.getByLabelText('저장 재시도를 그만하고 연습')).toBeTruthy();
});
