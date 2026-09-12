import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { INTRO_SLIDES, IntroScreen } from '@/components/screens/intro-screen';

const fling = (translationX: number) =>
  act(async () =>
    fireGestureHandler(getByGestureTestId('onboarding-slide-fling'), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END, translationX, translationY: 0 },
    ]),
  );

describe('IntroScreen (#1282)', () => {
  it('첫 장은 환영 문구로 시작한다', async () => {
    const { getByText } = await render(<IntroScreen />);
    expect(getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
  });

  it('walks all five intro slides with the updated copy (#412)', async () => {
    const onDone = jest.fn();
    const { getByText, getByLabelText } = await render(<IntroScreen onDone={onDone} />);
    // 5장 도트 — 마지막 장까지 존재.
    expect(getByLabelText('5번째 슬라이드로 이동')).toBeTruthy();
    await fireEvent.press(getByText('다음'));
    expect(getByText(/곰 체크로 완료해요/)).toBeTruthy();
    await fireEvent.press(getByText('다음'));
    expect(getByText(/내 방을 꾸며요/)).toBeTruthy();
    await fireEvent.press(getByText('다음'));
    expect(getByText(/한 집에서/)).toBeTruthy();
    await fireEvent.press(getByText('다음'));
    expect(getByText(/기록은 달력으로/)).toBeTruthy();
    // 마지막 장 CTA — 로그인 전에는 '시작하기'가 로그인 화면으로 이어진다.
    await fireEvent.press(getByText('시작하기'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('마지막 장 CTA 라벨을 바꿀 수 있다 (다시 보기는 목표 선택으로)', async () => {
    const { getByText, getByLabelText } = await render(<IntroScreen doneLabel="목표 선택하기" />);
    await fireEvent.press(getByLabelText('5번째 슬라이드로 이동'));
    expect(getByText('목표 선택하기')).toBeTruthy();
  });

  describe("'이미 계정이 있어요'는 첫 장에만", () => {
    it('첫 장에서 누르면 onHaveAccount를 부르고 onDone은 부르지 않는다', async () => {
      const onHaveAccount = jest.fn();
      const onDone = jest.fn();
      const { getByText } = await render(
        <IntroScreen onHaveAccount={onHaveAccount} onDone={onDone} />,
      );
      await fireEvent.press(getByText('이미 계정이 있어요'));
      expect(onHaveAccount).toHaveBeenCalledTimes(1);
      expect(onDone).not.toHaveBeenCalled();
    });

    it('둘째 장부터는 없다 — 소개를 넘기기 시작한 사람에게는 끝까지 보여 준다', async () => {
      const { getByText, queryByText } = await render(<IntroScreen onHaveAccount={jest.fn()} />);
      await fireEvent.press(getByText('다음'));
      expect(queryByText('이미 계정이 있어요')).toBeNull();
    });

    it('콜백을 넘기지 않으면 버튼도 없다 (다시 보기)', async () => {
      const { queryByText } = await render(<IntroScreen />);
      expect(queryByText('이미 계정이 있어요')).toBeNull();
    });
  });

  describe('건너뛰기 (#1023)', () => {
    it('onSkip이 없으면 건너뛰기도 없다', async () => {
      const { queryByText } = await render(<IntroScreen />);
      expect(queryByText('건너뛰기')).toBeNull();
    });

    it('onSkip이 있으면 보이고, 마지막 장에서는 CTA가 그 자리를 대신한다', async () => {
      const onSkip = jest.fn();
      const { getByText, getByLabelText, queryByText } = await render(
        <IntroScreen onSkip={onSkip} />,
      );
      await fireEvent.press(getByText('건너뛰기'));
      expect(onSkip).toHaveBeenCalledTimes(1);
      await fireEvent.press(getByLabelText('5번째 슬라이드로 이동'));
      expect(queryByText('건너뛰기')).toBeNull();
    });
  });

  // 인트로 슬라이드 좌우 스와이프 (#825) — 예전 PanResponder는 RNGH와 섞여
  // 실기기에서 잡히지 않았다. 다른 화면과 같은 horizontalFlingGesture로 통일.
  it('좌우 스와이프로 인트로 슬라이드를 넘긴다 (#825)', async () => {
    const ui = await render(<IntroScreen />);
    // 왼쪽으로 밀면 다음 장.
    await fling(-60);
    expect(ui.getByText(/곰 체크로 완료해요/)).toBeTruthy();
    // 오른쪽으로 밀면 이전 장.
    await fling(60);
    expect(ui.getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
    // 첫 장에서 더 뒤로는 안 간다.
    await fling(60);
    expect(ui.getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
    // 임계 미달(±40)은 무시.
    await fling(-30);
    expect(ui.getByText('루게더에 오신 걸 환영해요')).toBeTruthy();
  });

  it('마지막 장에서 왼쪽 스와이프하면 onDone (#825)', async () => {
    const onDone = jest.fn();
    const ui = await render(<IntroScreen onDone={onDone} />);
    for (let i = 0; i < 4; i += 1) await fireEvent.press(ui.getByText('다음'));
    expect(ui.getByText(/기록은 달력으로/)).toBeTruthy();
    await fling(-60);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('장에 들어갈 때마다 onSlideView — 같은 장에서 다시 렌더돼도 한 번', async () => {
    const onSlideView = jest.fn();
    const ui = await render(<IntroScreen onSlideView={onSlideView} />);
    expect(onSlideView).toHaveBeenLastCalledWith('my-room', 0);
    // 부모가 새 콜백으로 다시 그려도 같은 장 노출을 또 쏘지 않는다.
    const next = jest.fn();
    await ui.rerender(<IntroScreen onSlideView={next} />);
    expect(next).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByText('다음'));
    expect(next).toHaveBeenLastCalledWith('routines', 1);
    // 뒤로 돌아온 장도 노출로 센다.
    await fling(60);
    expect(next).toHaveBeenLastCalledWith('my-room', 0);
    expect(onSlideView).toHaveBeenCalledTimes(1);
  });

  it('슬라이드 id는 계측 이름이라 겹치지 않는다', () => {
    const ids = INTRO_SLIDES.map((s) => s.id);
    expect(ids).toEqual(['my-room', 'routines', 'decor', 'house', 'calendar']);
  });
});
