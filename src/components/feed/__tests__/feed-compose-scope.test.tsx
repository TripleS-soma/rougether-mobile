import { act, fireEvent, render } from '@testing-library/react-native';

import { FeedComposeScopeRow } from '@/components/feed/feed-compose-scope';

const HOUSES = [
  { houseId: 3, name: '아침을 여는 집' },
  { houseId: 8, name: '밤 산책 모임' },
];

describe('FeedComposeScopeRow (올릴 곳)', () => {
  it('기본은 전체 공개 — 누구에게 보이는지 함께 적는다', async () => {
    const ui = await render(
      <FeedComposeScopeRow scope={{ houseId: null, houses: HOUSES, onChange: jest.fn() }} />,
    );
    expect(ui.getByText('전체 공개')).toBeTruthy();
    expect(ui.getByText('누구나 볼 수 있어요')).toBeTruthy();
    expect(ui.getByLabelText('올릴 곳 바꾸기, 지금은 전체 공개')).toBeTruthy();
  });

  it('줄을 누르면 전체 공개와 내 집들이 나오고, 집을 고르면 그 id로 알린다', async () => {
    const onChange = jest.fn();
    const ui = await render(
      <FeedComposeScopeRow scope={{ houseId: null, houses: HOUSES, onChange }} />,
    );
    await fireEvent.press(ui.getByTestId('feed-scope'));
    expect(await ui.findByText('어디에 올릴까요?')).toBeTruthy();
    expect(ui.getByTestId('feed-scope-option-public').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(ui.getByTestId('feed-scope-option-3')).toBeTruthy();
    await act(async () => {
      fireEvent.press(ui.getByTestId('feed-scope-option-8'));
    });
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('집을 고른 상태는 그 집에만 올라간다고 분명히 적고, 전체 공개로 되돌릴 수 있다', async () => {
    const onChange = jest.fn();
    const ui = await render(
      <FeedComposeScopeRow scope={{ houseId: 3, houses: HOUSES, onChange }} />,
    );
    expect(ui.getByText('아침을 여는 집에만 올려요')).toBeTruthy();
    expect(
      ui.getByText('이 집 구성원만 볼 수 있어요. 전체 피드에는 올라가지 않아요.'),
    ).toBeTruthy();
    await fireEvent.press(ui.getByTestId('feed-scope'));
    await act(async () => {
      fireEvent.press(ui.getByTestId('feed-scope-option-public'));
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('같은 선택지를 다시 고르면 알리지 않는다', async () => {
    const onChange = jest.fn();
    const ui = await render(
      <FeedComposeScopeRow scope={{ houseId: 3, houses: HOUSES, onChange }} />,
    );
    await fireEvent.press(ui.getByTestId('feed-scope'));
    await act(async () => {
      fireEvent.press(ui.getByTestId('feed-scope-option-3'));
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('집 피드에서 연 작성(locked)은 안내만 — 바꾸기가 없고 눌러도 시트가 뜨지 않는다', async () => {
    const ui = await render(
      <FeedComposeScopeRow scope={{ houseId: 3, houses: [HOUSES[0]], locked: true }} />,
    );
    expect(ui.getByText('아침을 여는 집에 올려요')).toBeTruthy();
    expect(ui.queryByText('바꾸기')).toBeNull();
    expect(ui.queryByRole('button')).toBeNull();
    expect(ui.queryByText('어디에 올릴까요?')).toBeNull();
  });

  it('올리는 중에는 바꿀 수 없다', async () => {
    const ui = await render(
      <FeedComposeScopeRow
        scope={{ houseId: null, houses: HOUSES, onChange: jest.fn() }}
        disabled
      />,
    );
    expect(ui.getByTestId('feed-scope').props.accessibilityState).toMatchObject({ disabled: true });
  });
});
