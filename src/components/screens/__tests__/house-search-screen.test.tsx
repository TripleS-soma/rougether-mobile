import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { ToastProvider } from '@/components/ui/toast';
import { RECOMMENDED_HOUSES } from '@/mocks/fixtures';

describe('HouseSearchScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<HouseSearchScreen />);
    expect(getByText('집 탐색')).toBeTruthy();
  });

  it('renders the server cover on a browse card, pictogram tile otherwise', async () => {
    const houses = [
      { ...RECOMMENDED_HOUSES[0], id: 'c1', coverImageKey: 'house/cloud-balloon/frame.png' },
      { ...RECOMMENDED_HOUSES[1], id: 'c2' }, // no cover → pictogram fallback
    ];
    const { queryAllByTestId } = await render(<HouseSearchScreen houses={houses} />);
    expect(queryAllByTestId('house-cover')).toHaveLength(1);
  });

  it('joins by invite code via the API callback', async () => {
    const onJoinByCode = jest.fn(async () => true);
    const { getByText, getByPlaceholderText } = await render(
      <HouseSearchScreen onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    expect(onJoinByCode).toHaveBeenCalledWith('VLG7K2X');
  });

  it('shows an error when the code join fails (expired/unknown)', async () => {
    const onJoinByCode = jest.fn(async () => false);
    const { getByText, getByPlaceholderText } = await render(
      <HouseSearchScreen onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    await waitFor(() => expect(getByText(/초대코드를 확인해주세요/)).toBeTruthy());
  });

  it('shows an error for a short code without calling the API', async () => {
    const onJoinByCode = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <HouseSearchScreen onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'ab');
    await fireEvent.press(getByText('입주'));

    expect(getByText('초대코드는 6자리 이상이에요')).toBeTruthy();
    expect(onJoinByCode).not.toHaveBeenCalled();
  });

  it('explains an empty invite code with a toast', async () => {
    const onJoinByCode = jest.fn();
    const { getByText } = await render(
      <ToastProvider>
        <HouseSearchScreen onJoinByCode={onJoinByCode} />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('입주'));

    expect(getByText('초대 코드를 입력해주세요')).toBeTruthy();
    expect(onJoinByCode).not.toHaveBeenCalled();
  });

  it('previews the house behind a code before joining', async () => {
    const onPreviewCode = jest.fn(async () => ({
      name: '아침 루틴 하우스',
      members: 3,
      capacity: 4,
    }));
    const onJoinByCode = jest.fn(async () => true);
    const { getByText, getByLabelText, getByPlaceholderText } = await render(
      <HouseSearchScreen onPreviewCode={onPreviewCode} onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    // The lookup runs first — join waits for explicit confirmation.
    await waitFor(() => expect(getByText('아침 루틴 하우스')).toBeTruthy());
    expect(onPreviewCode).toHaveBeenCalledWith('VLG7K2X');
    expect(onJoinByCode).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('이 집에 입주'));
    await waitFor(() => expect(onJoinByCode).toHaveBeenCalledWith('VLG7K2X'));
  });

  it('rejects an expired code at the preview step', async () => {
    const onPreviewCode = jest.fn(async () => ({ name: '옛집', members: 2, expired: true }));
    const onJoinByCode = jest.fn();
    const { getByText, getByPlaceholderText, queryByText } = await render(
      <HouseSearchScreen onPreviewCode={onPreviewCode} onJoinByCode={onJoinByCode} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    await waitFor(() => expect(getByText(/만료된 초대코드예요/)).toBeTruthy());
    expect(queryByText('옛집')).toBeNull();
    expect(onJoinByCode).not.toHaveBeenCalled();
  });

  it('lists browsable houses and joins one by id', async () => {
    const onJoinHouse = jest.fn();
    const { getByText, getAllByText } = await render(
      <HouseSearchScreen houses={RECOMMENDED_HOUSES} onJoinHouse={onJoinHouse} />,
    );

    expect(getByText('아침형 인간 모임')).toBeTruthy();
    await fireEvent.press(getAllByText('입주 신청')[0]);
    expect(onJoinHouse).toHaveBeenCalledWith('h1');
  });

  it('filters the list by query', async () => {
    const { getByPlaceholderText, queryByText } = await render(
      <HouseSearchScreen houses={RECOMMENDED_HOUSES} />,
    );

    await fireEvent.changeText(getByPlaceholderText('집 이름, 태그로 검색'), '개발자');
    expect(queryByText('개발자 루틴')).toBeTruthy();
    expect(queryByText('아침형 인간 모임')).toBeNull();
  });

  it('shows the level on the meta line and skips the missing description (#234)', async () => {
    // API houses carry a level and no intro text — the old boilerplate
    // description only ever truncated.
    const houses = [
      {
        id: '9',
        name: '연동 검증 하우스',
        members: 1,
        capacity: 4,
        tag: '건강/운동',
        icon: 'sprout' as const,
        bg: '#EEF5E7',
        border: '#CFE0C3',
        level: 2,
      },
    ];
    const { getByText, queryByText } = await render(<HouseSearchScreen houses={houses} />);

    expect(getByText('연동 검증 하우스')).toBeTruthy();
    expect(getByText(/Lv\.2 · 멤버 1 \/ 4/)).toBeTruthy();
    expect(queryByText(/함께 루틴을 키워요/)).toBeNull();

    // Demo fixtures still carry a real description — it renders as its own line.
    const withDesc = await render(<HouseSearchScreen houses={RECOMMENDED_HOUSES.slice(0, 1)} />);
    expect(withDesc.getByText('오전 7시 전 기상 인증을 함께 해요')).toBeTruthy();
  });
});
