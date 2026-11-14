import { fireEvent, render } from '@testing-library/react-native';

import { FontScreen } from '@/components/screens/font-screen';

describe('FontScreen', () => {
  it('renders the title and all five font options', async () => {
    const { getByText } = await render(<FontScreen fontId="nanum" />);
    expect(getByText('글씨')).toBeTruthy();
    for (const name of ['나눔스퀘어라운드', '프리텐다드', '주아 혼합', 'SUIT', '시스템 기본']) {
      expect(getByText(name)).toBeTruthy();
    }
  });

  it('고르면 선택만 바뀌고, 적용하기를 눌러야 콜백 (#1096)', async () => {
    const onApplyFont = jest.fn();
    const { getByLabelText } = await render(
      <FontScreen fontId="nanum" onApplyFont={onApplyFont} />,
    );
    expect(getByLabelText('적용하기').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(getByLabelText('프리텐다드 폰트'));
    await fireEvent.press(getByLabelText('시스템 기본 폰트'));
    expect(onApplyFont).not.toHaveBeenCalled();
    expect(getByLabelText('시스템 기본 폰트').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(getByLabelText('적용하기'));
    expect(onApplyFont).toHaveBeenCalledWith('system');
  });

  it('글자 크기는 고르기만 해서는 안 바뀌고, 적용하기를 눌러야 콜백', async () => {
    const onApplyFont = jest.fn();
    const onApplyFontSize = jest.fn();
    const { getByLabelText } = await render(
      <FontScreen
        fontId="nanum"
        fontSizeId="medium"
        onApplyFont={onApplyFont}
        onApplyFontSize={onApplyFontSize}
      />,
    );
    expect(getByLabelText('글자 크기 보통').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(getByLabelText('글자 크기 크게'));
    expect(onApplyFontSize).not.toHaveBeenCalled();
    expect(getByLabelText('글자 크기 크게').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(getByLabelText('적용하기'));
    expect(onApplyFontSize).toHaveBeenCalledWith('large');
    // 폰트는 그대로라 폰트 콜백은 부르지 않는다.
    expect(onApplyFont).not.toHaveBeenCalled();
  });

  it('크기를 골랐다가 원래 값으로 돌리면 적용하기가 다시 잠긴다', async () => {
    const { getByLabelText } = await render(<FontScreen fontId="nanum" fontSizeId="medium" />);
    await fireEvent.press(getByLabelText('글자 크기 작게'));
    expect(getByLabelText('적용하기').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(getByLabelText('글자 크기 보통'));
    expect(getByLabelText('적용하기').props.accessibilityState.disabled).toBe(true);
  });

  it('marks the active font as selected', async () => {
    const { getByLabelText } = await render(<FontScreen fontId="suit" />);
    expect(getByLabelText('SUIT 폰트').props.accessibilityState).toMatchObject({ selected: true });
    expect(getByLabelText('나눔스퀘어라운드 폰트').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('미리보기 카드가 활성 토큰·타입 스케일로 함께 렌더된다', async () => {
    const { getByText } = await render(<FontScreen fontId="nanum" />);
    // 테마 화면과 공유하는 AppearancePreview — 폰트를 바꾸면 이 글자들이 바뀐다.
    expect(getByText('내 방')).toBeTruthy();
    expect(getByText('오늘 루틴 완료하기')).toBeTruthy();
  });

  it('goes back when the header back button is pressed', async () => {
    const onBack = jest.fn();
    const { getByLabelText } = await render(<FontScreen fontId="nanum" onBack={onBack} />);
    await fireEvent.press(getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalled();
  });

  it('미리보기 카드에 내 닉네임·캐릭터를 넘긴다 (#899)', async () => {
    const { getByText, getByLabelText } = await render(
      <FontScreen userName="루티" characterId="otter" />,
    );
    expect(getByText('루티의 방')).toBeTruthy();
    expect(getByLabelText('수달')).toBeTruthy();
  });
});
