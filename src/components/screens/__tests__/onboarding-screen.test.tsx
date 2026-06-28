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
});
