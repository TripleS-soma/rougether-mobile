import { render, fireEvent, screen } from '@testing-library/react-native';
import { RhythmPracticeScreen } from '@/components/screens/rhythm-practice-screen';

jest.mock('@/components/minigame/rhythm-game', () => ({ RhythmGame: () => null }));
test('practice is reachable with a back action and does not start a ranked run', async () => {
  const back = jest.fn();
  await render(<RhythmPracticeScreen onBack={back} />);
  expect(screen.getByText('루틴 리듬')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('뒤로 가기'));
  expect(back).toHaveBeenCalledTimes(1);
});
