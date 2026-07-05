import { fireEvent, render } from '@testing-library/react-native';

import { OnboardingScreen } from '@/components/screens/onboarding-screen';

describe('OnboardingScreen', () => {
  it('renders the first welcome slide', async () => {
    const { getByText } = await render(<OnboardingScreen />);
    expect(getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
  });

  it('skips straight to the goal survey', async () => {
    const { getByText } = await render(<OnboardingScreen />);

    await fireEvent.press(getByText('건너뛰기'));

    expect(getByText('관심 있는 목표를 골라주세요')).toBeTruthy();
  });

  it('completes the flow and reports goals + character', async () => {
    const onDone = jest.fn();
    const { getByText } = await render(<OnboardingScreen onDone={onDone} />);

    await fireEvent.press(getByText('건너뛰기'));
    await fireEvent.press(getByText('운동'));
    await fireEvent.press(getByText('시작하기'));
    await fireEvent.press(getByText('캐릭터 선택하기'));

    expect(onDone).toHaveBeenCalledWith(['exercise'], 'cat');
  });

  it('uses server goal options when provided', async () => {
    const onDone = jest.fn();
    const goals = [
      { id: '10', label: '갓생 살기' },
      { id: '11', label: '아침형 인간' },
    ];
    const { getByText, queryByText } = await render(
      <OnboardingScreen onDone={onDone} goals={goals} />,
    );

    await fireEvent.press(getByText('건너뛰기'));
    expect(queryByText('운동')).toBeNull(); // local list replaced
    await fireEvent.press(getByText('갓생 살기'));
    await fireEvent.press(getByText('시작하기'));
    await fireEvent.press(getByText('캐릭터 선택하기'));

    expect(onDone).toHaveBeenCalledWith(['10'], 'cat');
  });
});
