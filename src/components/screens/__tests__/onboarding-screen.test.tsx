import { fireEvent, render } from '@testing-library/react-native';

import { OnboardingScreen } from '@/components/screens/onboarding-screen';
import { ToastProvider } from '@/components/ui/toast';

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

  it('explains a missing goal pick with a toast on 시작하기', async () => {
    const onDone = jest.fn();
    const { getByText } = await render(
      <ToastProvider>
        <OnboardingScreen onDone={onDone} />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('건너뛰기'));
    await fireEvent.press(getByText('시작하기'));

    expect(getByText('목표를 하나 이상 선택해주세요')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
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

  it('starts the goal survey pre-filled with the previous selections (replay = edit)', async () => {
    const onDone = jest.fn();
    const goals = [
      { id: '10', label: '갓생 살기' },
      { id: '11', label: '아침형 인간' },
    ];
    const { getByText } = await render(
      <OnboardingScreen onDone={onDone} goals={goals} initialGoals={['10']} />,
    );

    await fireEvent.press(getByText('건너뛰기'));
    // Edit: add one more goal on top of the previous pick, then finish. The
    // final onDone payload carrying '10' untouched proves it was pre-checked.
    await fireEvent.press(getByText('아침형 인간'));
    await fireEvent.press(getByText('시작하기'));
    await fireEvent.press(getByText('캐릭터 선택하기'));

    expect(onDone).toHaveBeenCalledWith(['10', '11'], 'cat');
  });

  it('drops previous goal ids that no longer exist in the option list', async () => {
    const onDone = jest.fn();
    const goals = [{ id: '10', label: '갓생 살기' }];
    const { getByText } = await render(
      <ToastProvider>
        <OnboardingScreen onDone={onDone} goals={goals} initialGoals={['999']} />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('건너뛰기'));
    // The stale id must not count as a selection: 시작하기 stays blocked.
    await fireEvent.press(getByText('시작하기'));
    expect(getByText('목표를 하나 이상 선택해주세요')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('preselects the previously chosen character', async () => {
    const onDone = jest.fn();
    const { getByText } = await render(
      <OnboardingScreen onDone={onDone} initialGoals={['exercise']} initialCharacterId="bear" />,
    );

    await fireEvent.press(getByText('건너뛰기'));
    await fireEvent.press(getByText('시작하기'));
    await fireEvent.press(getByText('캐릭터 선택하기'));

    expect(onDone).toHaveBeenCalledWith(['exercise'], 'bear');
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
