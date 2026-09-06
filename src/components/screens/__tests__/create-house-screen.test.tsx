import { fireEvent, render } from '@testing-library/react-native';

import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { ToastProvider } from '@/components/ui/toast';

describe('CreateHouseScreen', () => {
  it('renders the title and the server-issued invite-code notice', async () => {
    const { getByText } = await render(<CreateHouseScreen />);
    expect(getByText('새 집 만들기')).toBeTruthy();
    // The invite code is issued by the API on creation — no local generator.
    expect(getByText(/초대코드가 자동으로 발급돼요/)).toBeTruthy();
  });

  it('정원 선택은 선택 상태를 accessibilityState로 전달한다 (#550)', async () => {
    const { getByRole } = await render(<CreateHouseScreen />);
    await fireEvent.press(getByRole('button', { name: '3' }));
    expect(getByRole('button', { name: '3' }).props.accessibilityState?.selected).toBe(true);
    expect(getByRole('button', { name: '2' }).props.accessibilityState?.selected).toBe(false);
  });

  it('정원 선택지는 6명까지 제공하고 기본값은 4명을 유지한다 (#1108)', async () => {
    const { getByRole, queryByRole } = await render(<CreateHouseScreen />);
    for (const n of ['2', '3', '4', '5', '6'])
      expect(getByRole('button', { name: n })).toBeTruthy();
    for (const n of ['7', '8', '10']) expect(queryByRole('button', { name: n })).toBeNull();
    expect(getByRole('button', { name: '4' }).props.accessibilityState?.selected).toBe(true);
  });

  it('선택한 정원 6명을 생성 요청에 전달한다', async () => {
    const onCreate = jest.fn();
    const ui = await render(<CreateHouseScreen onCreate={onCreate} />);
    await fireEvent.changeText(ui.getByPlaceholderText('우리 집 이름을 정해주세요'), '여섯 친구');
    await fireEvent.press(ui.getByRole('button', { name: '6' }));
    await fireEvent.press(ui.getByText('집 만들기'));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ maxMembers: 6 }));
  });

  it('creates a house with name/description/capacity', async () => {
    const onCreate = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <CreateHouseScreen onCreate={onCreate} />,
    );

    await fireEvent.changeText(getByPlaceholderText('우리 집 이름을 정해주세요'), '우리집');
    await fireEvent.press(getByText('집 만들기'));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: '우리집', maxMembers: expect.any(Number) }),
    );
  });

  it('sends the picked cover key and hides the section without a catalog', async () => {
    const covers = [
      { code: 'cloud_balloon', name: '구름 풍선 집', coverImageKey: 'house/cloud-balloon/f.png' },
    ];
    const onCreate = jest.fn();
    const { getByText, getByLabelText, getByPlaceholderText } = await render(
      <CreateHouseScreen covers={covers} onCreate={onCreate} />,
    );
    expect(getByText('집 테마')).toBeTruthy(); // #1112 후속

    await fireEvent.changeText(getByPlaceholderText('우리 집 이름을 정해주세요'), '우리집');
    await fireEvent.press(getByLabelText('구름 풍선 집 커버'));
    await fireEvent.press(getByText('집 만들기'));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ coverImageKey: 'house/cloud-balloon/f.png' }),
    );

    // No catalog (load failed / server empty) → the section stays hidden.
    const bare = await render(<CreateHouseScreen />);
    expect(bare.queryByText('집 테마')).toBeNull();
  });

  it('explains a too-short name with a toast instead of creating', async () => {
    const onCreate = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <ToastProvider>
        <CreateHouseScreen onCreate={onCreate} />
      </ToastProvider>,
    );

    await fireEvent.changeText(getByPlaceholderText('우리 집 이름을 정해주세요'), 'a');
    await fireEvent.press(getByText('집 만들기'));

    expect(getByText('집 이름을 2자 이상 입력해주세요')).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
