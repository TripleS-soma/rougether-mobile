import { fireEvent, render } from '@testing-library/react-native';

import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { RECOMMENDED_HOUSES } from '@/mocks/fixtures';

// MSW handles dev runtime; tests mock fetch directly.
const realFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    // The API client parses via res.text() → JSON.parse.
    text: async () => JSON.stringify({ items: RECOMMENDED_HOUSES }),
  })) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('HouseSearchScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<HouseSearchScreen />);
    expect(getByText('집 탐색')).toBeTruthy();
  });

  it('joins by invite code (≥6 chars)', async () => {
    const onJoin = jest.fn();
    const { getByText, getByPlaceholderText } = await render(<HouseSearchScreen onJoin={onJoin} />);

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'vlg7k2x');
    await fireEvent.press(getByText('입주'));

    expect(onJoin).toHaveBeenCalledWith('초대코드 VLG7K2X');
  });

  it('shows an error for a short code', async () => {
    const onJoin = jest.fn();
    const { getByText, getByPlaceholderText } = await render(<HouseSearchScreen onJoin={onJoin} />);

    await fireEvent.changeText(getByPlaceholderText('예: VLG-7K2X'), 'ab');
    await fireEvent.press(getByText('입주'));

    expect(getByText('초대코드는 6자리 이상이에요')).toBeTruthy();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('loads recommended houses from the API and filters them', async () => {
    const { findByText, getByPlaceholderText, queryByText } = await render(<HouseSearchScreen />);

    // fetched from the (mocked) business API
    expect(await findByText('개발자 루틴')).toBeTruthy();

    await fireEvent.changeText(getByPlaceholderText('집 이름, 태그로 검색'), '독서');

    expect(await findByText('독서 1시간')).toBeTruthy();
    expect(queryByText('개발자 루틴')).toBeNull();
  });
});
