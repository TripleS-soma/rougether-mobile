import { fireEvent, render } from '@testing-library/react-native';

import { HouseEmptyState } from '@/components/screens/house/house-empty-state';

describe('HouseEmptyState', () => {
  it('집이 없으면 집 탐색으로 안내한다', async () => {
    const onOpenSearch = jest.fn();
    const { getByText, getByLabelText } = await render(
      <HouseEmptyState
        screenStyle={{}}
        loading={false}
        loadError={false}
        onOpenSearch={onOpenSearch}
      />,
    );
    expect(getByText('아직 함께하는 집이 없어요')).toBeTruthy();
    await fireEvent.press(getByLabelText('집 탐색'));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('로드 실패는 빈 상태 대신 에러 + 다시 시도를 보여준다 (#549)', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <HouseEmptyState screenStyle={{}} loading={false} loadError onRetry={onRetry} />,
    );
    expect(getByText('집 정보를 불러오지 못했어요')).toBeTruthy();
    expect(queryByText('아직 함께하는 집이 없어요')).toBeNull();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('로딩 중에는 불러오는 중 문구만 보인다', async () => {
    const { getByText, queryByText } = await render(
      <HouseEmptyState screenStyle={{}} loading loadError />,
    );
    expect(getByText('불러오는 중...')).toBeTruthy();
    expect(queryByText('집 정보를 불러오지 못했어요')).toBeNull();
    expect(queryByText('아직 함께하는 집이 없어요')).toBeNull();
  });
});
