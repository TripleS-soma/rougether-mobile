import { fireEvent, render } from '@testing-library/react-native';

import {
  GiftOpeningStage,
  PaintedGiftIcon,
  StorybookBackdrop,
} from '@/components/screens/gacha/storybook-draw';

jest.mock('@/utils/haptics', () => ({ hapticImpact: jest.fn(), hapticSelection: jest.fn() }));
// expo-image는 jest에서 onError를 발화할 수 없다 — testID·onError만 살린 View로 대체.
jest.mock('expo-image', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    Image: (props: { testID?: string; onError?: () => void }) =>
      React.createElement(View, { testID: props.testID, onError: props.onError }),
  };
});

// 무대 장식은 aria-hidden(보조기기에서 숨김)이라 RNTL 기본 쿼리에서 빠진다.
const H = { includeHiddenElements: true };

// 숲속 개봉 무대 — 뚜껑·몸통 두 층으로 그린 선물상자. 탭은 "이미 뽑은 선물을 여는"
// 상호작용일 뿐이라 준비(ready) 단계에서만 눌리고, 아트가 실패하면 머신 아트로 떨어진다.
describe('GiftOpeningStage', () => {
  it('충전 중에는 눌리지 않고, 준비되면 탭이 onOpen을 부른다', async () => {
    const onOpen = jest.fn();
    const ui = await render(<GiftOpeningStage phase="charging" onOpen={onOpen} />);
    const stage = ui.getByLabelText('선물상자 열기');
    expect(stage.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(stage);
    expect(onOpen).not.toHaveBeenCalled();

    await ui.rerender(<GiftOpeningStage phase="ready" onOpen={onOpen} />);
    await fireEvent.press(ui.getByLabelText('선물상자 열기'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('뚜껑과 몸통을 따로 그리고, 이미지 실패 시 폴백으로 바꾼다', async () => {
    const ui = await render(<GiftOpeningStage phase="ready" />);
    expect(ui.getByTestId('gacha-painted-lid', H)).toBeTruthy();
    expect(ui.getByTestId('gacha-painted-base', H)).toBeTruthy();
    expect(ui.queryByTestId('gacha-art-fallback', H)).toBeNull();
    await fireEvent(ui.getByTestId('gacha-painted-lid-image', H), 'error');
    expect(ui.getByTestId('gacha-art-fallback', H)).toBeTruthy();
  });

  it('동작 줄이기에서는 반짝임을 그리지 않는다', async () => {
    const full = await render(<GiftOpeningStage phase="ready" />);
    const reduced = await render(<GiftOpeningStage phase="ready" reducedMotion />);
    expect(full.getAllByTestId('gacha-stage-star', H)).toHaveLength(9);
    expect(reduced.queryAllByTestId('gacha-stage-star', H)).toHaveLength(0);
  });

  it('배경과 카드 뒷면 아이콘도 같은 생성 아트를 쓴다', async () => {
    const ui = await render(
      <>
        <StorybookBackdrop />
        <PaintedGiftIcon size={48} />
      </>,
    );
    expect(ui.getByTestId('gacha-storybook-backdrop', H)).toBeTruthy();
    expect(ui.getAllByTestId('gacha-painted-lid', H)).toHaveLength(1);
  });
});
