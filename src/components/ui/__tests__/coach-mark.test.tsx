import { fireEvent, render } from '@testing-library/react-native';
import { BackHandler, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

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

  it('hardLock은 건너뛰기·다음 없이 대상만 뚫고 안드로이드 뒤로가기를 삼킨다 (#1324)', async () => {
    const back = jest.spyOn(BackHandler, 'addEventListener');
    const { queryByLabelText, getByText, getByTestId, unmount } = await render(
      <CoachMarkOverlay
        hardLock
        caption="미션 1/4"
        steps={[{ target: 'a', title: '루틴을 완료해요', body: '체크를 눌러요' }]}
        index={0}
        targets={{ a: { x: 10, y: 20, w: 100, h: 40 } }}
        frame={{ w: 360, h: 800 }}
      />,
    );
    expect(getByTestId('coach-overlay')).toBeTruthy();
    expect(getByText('미션 1/4')).toBeTruthy();
    expect(queryByLabelText('튜토리얼 건너뛰기')).toBeNull();
    expect(queryByLabelText('다음 단계')).toBeNull();
    expect(back).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    const handler = back.mock.calls[0][1] as () => boolean;
    expect(handler()).toBe(true);
    unmount();
    back.mockRestore();
  });

  it('targets 여러 개면 전부를 감싸는 구멍 하나를 뚫는다 (#1324)', async () => {
    const { getByTestId } = await render(
      <CoachMarkOverlay
        hardLock
        steps={[{ targets: ['grid', 'apply'], title: '가구를 놓고 저장해요', body: '' }]}
        index={0}
        targets={{
          grid: { x: 0, y: 100, w: 300, h: 200 },
          apply: { x: 100, y: 700, w: 100, h: 40 },
        }}
        frame={{ w: 360, h: 800 }}
      />,
    );
    // 위쪽 딤은 합집합 사각형의 y(100) − HOLE_PAD(6)까지만 내려온다.
    const top = getByTestId('coach-overlay').children[0];
    if (typeof top === 'string') throw new Error('expected a view');
    const flat = StyleSheet.flatten(top.props.style as StyleProp<ViewStyle>) as ViewStyle;
    expect(flat.height).toBe(94);
  });
});
