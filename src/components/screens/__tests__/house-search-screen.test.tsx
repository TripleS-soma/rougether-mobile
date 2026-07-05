import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { RECOMMENDED_HOUSES } from '@/mocks/fixtures';

describe('HouseSearchScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<HouseSearchScreen />);
    expect(getByText('집 탐색')).toBeTruthy();
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
});
