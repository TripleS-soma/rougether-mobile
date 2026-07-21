import { fireEvent, render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import {
  CoachMarkOverlay,
  type CoachStep,
  CoachTarget,
  CoachTargetProvider,
} from '@/components/ui/coach-mark';

const STEPS: CoachStep[] = [
  { target: 'a', title: '첫 단계', body: '여기를 보세요' },
  { title: '마지막 단계', body: '측정 없는 중앙 폴백' },
];

describe('CoachMarkOverlay (#351)', () => {
  it('renders the step bubble with counter, next and skip', async () => {
    const onNext = jest.fn();
    const onSkip = jest.fn();
    const { getByText, getByLabelText } = await render(
      <CoachMarkOverlay
        steps={STEPS}
        index={0}
        targets={{ a: { x: 10, y: 10, w: 50, h: 20 } }}
        frame={{ w: 360, h: 800 }}
        onNext={onNext}
        onSkip={onSkip}
      />,
    );
    expect(getByText('첫 단계')).toBeTruthy();
    expect(getByText('1 / 2')).toBeTruthy();
    await fireEvent.press(getByLabelText('다음 단계'));
    expect(onNext).toHaveBeenCalled();
    await fireEvent.press(getByLabelText('튜토리얼 건너뛰기'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('falls back to a centered bubble without a target and ends with 시작하기', async () => {
    const { getByText, getByLabelText } = await render(
      <CoachMarkOverlay
        steps={STEPS}
        index={1}
        targets={{}}
        frame={{ w: 0, h: 0 }}
        onNext={jest.fn()}
        onSkip={jest.fn()}
      />,
    );
    expect(getByText('마지막 단계')).toBeTruthy();
    expect(getByLabelText('튜토리얼 마치기')).toBeTruthy();
    expect(getByText('시작하기')).toBeTruthy();
  });

  it('CoachTarget renders children inside the provider', async () => {
    const { getByText } = await render(
      <CoachTargetProvider>
        <CoachTarget id="x">
          <View>
            <Text>대상</Text>
          </View>
        </CoachTarget>
      </CoachTargetProvider>,
    );
    expect(getByText('대상')).toBeTruthy();
  });
});
