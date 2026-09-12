import { fireEvent, render } from '@testing-library/react-native';

import { MinigamesScreen } from '@/components/screens/minigames-screen';
import { MINIGAME_DEFINITIONS, PLAYABLE_MINIGAMES } from '@/constants/minigames';

const GAME = {
  gameCode: 'room-runner',
  name: '루틴 러너',
  description: '탭해서 장애물을 넘어요.',
  rulesVersion: 1,
};

it('renders only the supplied catalog and dispatches the selected game code', async () => {
  const open = jest.fn();
  const ranking = jest.fn();
  const ui = await render(
    <MinigamesScreen games={[GAME]} onSelectGame={open} onLeaderboard={ranking} />,
  );
  expect(ui.getAllByRole('button', { name: / 시작$/ })).toHaveLength(1);
  expect(ui.getByText(MINIGAME_DEFINITIONS['room-runner'].tagline)).toBeTruthy();
  expect(ui.queryByText(GAME.description)).toBeNull();
  expect(ui.queryByText('우리 고양이와 가볍게 한 판.')).toBeNull();
  expect(ui.queryByText('최고 기록과 닉네임이 전체 랭킹에 표시돼요.')).toBeNull();
  expect(ui.queryByText(/랭킹은 게임별 최고 점수로 정해져요/)).toBeNull();
  expect(ui.queryByText('연습 게임 · 랭킹 미기록')).toBeNull();
  await fireEvent.press(ui.getByLabelText('루틴 러너 시작'));
  await fireEvent.press(ui.getByLabelText('루틴 러너 랭킹'));
  expect(open).toHaveBeenCalledWith('room-runner');
  expect(ranking).toHaveBeenCalledWith('room-runner');
});

it('dispatches each of the three supplied games through distinct start and ranking buttons', async () => {
  const open = jest.fn();
  const ranking = jest.fn();
  const ui = await render(
    <MinigamesScreen
      games={PLAYABLE_MINIGAMES}
      practiceGames={PLAYABLE_MINIGAMES}
      onSelectGame={open}
      onLeaderboard={ranking}
      onPractice={jest.fn()}
    />,
  );
  expect(ui.getAllByRole('button', { name: / 시작$/ })).toHaveLength(3);
  expect(ui.getAllByRole('button', { name: / 랭킹$/ })).toHaveLength(3);
  expect(ui.queryByText('최고 기록과 닉네임이 전체 랭킹에 표시돼요.')).toBeNull();
  expect(ui.queryByText('연습 게임 · 랭킹 미기록')).toBeNull();
  for (const game of PLAYABLE_MINIGAMES) {
    expect(ui.getByText(MINIGAME_DEFINITIONS[game.gameCode].tagline)).toBeTruthy();
    expect(ui.queryByText(game.description)).toBeNull();
    await fireEvent.press(ui.getByLabelText(`${game.name} 시작`));
    await fireEvent.press(ui.getByLabelText(`${game.name} 랭킹`));
  }
  const gameCodes = PLAYABLE_MINIGAMES.map((game) => [game.gameCode]);
  expect(open.mock.calls).toEqual(gameCodes);
  expect(ranking.mock.calls).toEqual(gameCodes);
});

it('offers installed games missing from a partial server catalog only in the practice section', async () => {
  const practice = jest.fn();
  const ui = await render(
    <MinigamesScreen games={[GAME]} practiceGames={PLAYABLE_MINIGAMES} onPractice={practice} />,
  );
  expect(ui.getAllByRole('button', { name: / 시작$/ })).toHaveLength(1);
  expect(ui.getByLabelText('루틴 러너 시작')).toBeTruthy();
  expect(ui.queryByLabelText('루틴 러너 연습하기 · 랭킹 미기록')).toBeNull();
  expect(ui.getByRole('header', { name: '연습 게임 · 랭킹 미기록' })).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('고양이 계단 연습하기 · 랭킹 미기록'));
  await fireEvent.press(ui.getByLabelText('고양이 합치기 연습하기 · 랭킹 미기록'));
  expect(practice.mock.calls).toEqual([['cat-stairs'], ['cat-merge']]);
  expect(ui.queryByLabelText('고양이 계단 시작')).toBeNull();
  expect(ui.queryByLabelText('고양이 합치기 시작')).toBeNull();
});

it('hides stale ranked cards after an API error and offers all three games as explicit practice', async () => {
  const retry = jest.fn();
  const practice = jest.fn();
  const ui = await render(
    <MinigamesScreen
      games={PLAYABLE_MINIGAMES}
      practiceGames={PLAYABLE_MINIGAMES}
      error
      onRetry={retry}
      onPractice={practice}
    />,
  );
  expect(ui.queryAllByRole('button', { name: / 시작$/ })).toHaveLength(0);
  expect(ui.queryAllByRole('button', { name: / 랭킹$/ })).toHaveLength(0);
  expect(ui.getByText('게임 목록을 불러오지 못했어요')).toBeTruthy();
  expect(ui.getByRole('header', { name: '연습 게임 · 랭킹 미기록' })).toBeTruthy();
  expect(ui.queryByText('최고 기록과 닉네임이 전체 랭킹에 표시돼요.')).toBeNull();
  await fireEvent.press(ui.getByLabelText('다시 시도'));
  for (const game of PLAYABLE_MINIGAMES) {
    await fireEvent.press(ui.getByLabelText(`${game.name} 연습하기 · 랭킹 미기록`));
  }
  expect(retry).toHaveBeenCalledTimes(1);
  expect(practice.mock.calls).toEqual(PLAYABLE_MINIGAMES.map((game) => [game.gameCode]));
});

it('keeps practice out of loading and offers it alongside a successfully loaded empty catalog', async () => {
  const practice = jest.fn();
  const ui = await render(
    <MinigamesScreen loading practiceGames={PLAYABLE_MINIGAMES} onPractice={practice} />,
  );
  expect(ui.getByLabelText('게임 불러오는 중')).toBeTruthy();
  expect(ui.queryByText('지금은 등록된 게임이 없어요.')).toBeNull();
  expect(ui.queryByText('연습 게임 · 랭킹 미기록')).toBeNull();
  await ui.rerender(<MinigamesScreen practiceGames={PLAYABLE_MINIGAMES} onPractice={practice} />);
  expect(ui.getByText('지금은 등록된 게임이 없어요.')).toBeTruthy();
  expect(ui.getByRole('header', { name: '연습 게임 · 랭킹 미기록' })).toBeTruthy();
  expect(ui.queryAllByRole('button', { name: / 시작$/ })).toHaveLength(0);
  expect(ui.queryByText('최고 기록과 닉네임이 전체 랭킹에 표시돼요.')).toBeNull();
  await fireEvent.press(ui.getByLabelText('고양이 합치기 연습하기 · 랭킹 미기록'));
  expect(practice).toHaveBeenCalledWith('cat-merge');
});
