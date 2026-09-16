import { fireEvent, render } from '@testing-library/react-native';
import { BackHandler, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  bubbleHorizontal,
  CoachMarkOverlay,
  type CoachStep,
  CoachTarget,
  CoachTargetProvider,
  toOverlayRect,
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

  it('창 좌표 대상을 오버레이 원점만큼 빼서 그린다 — 웹 2단 프레임 여백만큼 밀리던 것', () => {
    // 선물 버튼이 창 x=616, 앱 프레임이 창 x=200에서 시작(1600px 창, 2026-09-16 실측).
    expect(toOverlayRect({ x: 616, y: 649, w: 44, h: 44 }, { x: 200, y: 0 })).toEqual({
      x: 416,
      y: 649,
      w: 44,
      h: 44,
    });
  });

  it('넓은 프레임에선 말풍선을 최대 폭으로 줄여 구멍 가운데에 두고, 좁은 화면은 꽉 채운다', () => {
    const wide = bubbleHorizontal(1200, 438);
    expect(wide.width).toBe(420);
    expect(wide.left).toBe(228);
    // 가장자리 대상이면 프레임 안으로 클램프.
    expect(bubbleHorizontal(1200, 20).left).toBe(24);
    // 폰 폭: 종전과 같은 좌우 24 여백으로 꽉.
    expect(bubbleHorizontal(360, 300)).toEqual({ left: 24, width: 312 });
  });

  it('떠 있는 동안에만 대상 좌표 재측정 타이머를 돌리고, 사라지면 멈춘다', async () => {
    const setSpy = jest.spyOn(global, 'setInterval');
    const clearSpy = jest.spyOn(global, 'clearInterval');
    try {
      const tree = (steps: CoachStep[]) => (
        <CoachTargetProvider>
          <CoachTarget id="a">
            <View />
          </CoachTarget>
          <CoachMarkOverlay
            hardLock
            steps={steps}
            index={0}
            targets={{}}
            frame={{ w: 360, h: 800 }}
          />
        </CoachTargetProvider>
      );
      const { rerender } = await render(tree([{ target: 'a', title: '제목', body: '' }]));
      const started = setSpy.mock.calls.filter(([, ms]) => ms === 250);
      expect(started).toHaveLength(1);
      const id = setSpy.mock.results[setSpy.mock.calls.findIndex(([, ms]) => ms === 250)].value;
      await rerender(tree([]));
      expect(clearSpy).toHaveBeenCalledWith(id);
    } finally {
      setSpy.mockRestore();
      clearSpy.mockRestore();
    }
  });
});
