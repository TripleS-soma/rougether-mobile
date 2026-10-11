import { fireEvent, render } from '@testing-library/react-native';

import { LinkifiedText } from '@/components/ui/linkified-text';

describe('LinkifiedText (#1507)', () => {
  it('링크를 누르면 도메인을 보여 주고, 열기를 눌러야 연다', async () => {
    const openLink = jest.fn();
    const ui = await render(
      <LinkifiedText openLink={openLink}>{'영상 https://youtu.be/abc 봐요'}</LinkifiedText>,
    );
    await fireEvent.press(ui.getByLabelText('링크 https://youtu.be/abc'));
    expect(ui.getByText('외부 사이트로 이동할까요?')).toBeTruthy();
    expect(ui.getByText(/youtu\.be\(으\)로 이동해요/)).toBeTruthy();
    expect(openLink).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByText('열기'));
    expect(openLink).toHaveBeenCalledWith('https://youtu.be/abc');
  });

  it('취소하면 열지 않는다', async () => {
    const openLink = jest.fn();
    const ui = await render(<LinkifiedText openLink={openLink}>{'www.a.com'}</LinkifiedText>);
    await fireEvent.press(ui.getByLabelText('링크 www.a.com'));
    await fireEvent.press(ui.getByText('취소'));
    expect(openLink).not.toHaveBeenCalled();
    expect(ui.queryByText('외부 사이트로 이동할까요?')).toBeNull();
  });

  it('링크가 없으면 평범한 글', async () => {
    const ui = await render(<LinkifiedText>{'그냥 글'}</LinkifiedText>);
    expect(ui.getByText('그냥 글')).toBeTruthy();
    expect(ui.queryByRole('link')).toBeNull();
  });
});
