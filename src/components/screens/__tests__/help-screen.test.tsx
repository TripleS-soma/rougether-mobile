import { fireEvent, render } from '@testing-library/react-native';

import { HelpScreen } from '@/components/screens/help-screen';

describe('HelpScreen', () => {
  it('renders the title and version', async () => {
    const { getByText } = await render(<HelpScreen appVersion="1.2.3" />);
    expect(getByText('도움말')).toBeTruthy();
    expect(getByText('버전 1.2.3')).toBeTruthy();
  });

  it('expands a FAQ answer when its question is pressed', async () => {
    const { getByText, queryByText } = await render(<HelpScreen />);
    const answer =
      '나의 방 화면에서 카테고리의 + 버튼을 누르거나, 루틴 관리 화면에서 루틴을 추가할 수 있어요.';

    expect(queryByText(answer)).toBeNull();
    await fireEvent.press(getByText('루틴은 어떻게 추가하나요?'));
    expect(getByText(answer)).toBeTruthy();
  });

  it('앱에 없는 기능은 안내하지 않는다 — 사진 인증 항목 제거 (#797)', async () => {
    // 루틴 만들기에 사진 인증 토글이 없고(생성 경로는 #695에서 제거) 서버 루틴도
    // verificationType이 전부 null인데, FAQ만 "사진 인증을 켜면 돼요"라고 말하고
    // 있었다. 재도입(#158) 전까지 다시 새어 나오면 여기서 잡는다.
    const { queryByText } = await render(<HelpScreen />);
    expect(queryByText('인증 사진형 루틴이 뭔가요?')).toBeNull();
  });

  it('calls onContact when 문의하기 is pressed', async () => {
    const onContact = jest.fn();
    const { getByText } = await render(<HelpScreen onContact={onContact} />);

    await fireEvent.press(getByText('문의하기'));

    expect(onContact).toHaveBeenCalled();
  });
});
