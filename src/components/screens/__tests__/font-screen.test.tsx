import { fireEvent, render } from '@testing-library/react-native';

import { FontScreen } from '@/components/screens/font-screen';

describe('FontScreen', () => {
  it('renders the title and all five font options', async () => {
    const { getByText } = await render(<FontScreen fontId="nanum" />);
    expect(getByText('폰트')).toBeTruthy();
    for (const name of ['나눔스퀘어라운드', '프리텐다드', '주아 혼합', 'SUIT', '시스템 기본']) {
      expect(getByText(name)).toBeTruthy();
    }
  });

  it('reports the picked font id', async () => {
    const onChangeFont = jest.fn();
    const { getByLabelText } = await render(
      <FontScreen fontId="nanum" onChangeFont={onChangeFont} />,
    );

    await fireEvent.press(getByLabelText('프리텐다드 폰트'));
    expect(onChangeFont).toHaveBeenCalledWith('pretendard');

    await fireEvent.press(getByLabelText('시스템 기본 폰트'));
    expect(onChangeFont).toHaveBeenCalledWith('system');
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
    expect(getByText('준서의 방')).toBeTruthy();
    expect(getByText('오늘 루틴 완료하기')).toBeTruthy();
  });

  it('goes back when the header back button is pressed', async () => {
    const onBack = jest.fn();
    const { getByLabelText } = await render(<FontScreen fontId="nanum" onBack={onBack} />);
    await fireEvent.press(getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalled();
  });
});
