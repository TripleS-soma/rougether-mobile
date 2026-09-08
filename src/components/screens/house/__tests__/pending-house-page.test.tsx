import { fireEvent, render } from '@testing-library/react-native';

import {
  PendingHousePage,
  type PendingHousePageProps,
} from '@/components/screens/house/pending-house-page';

const PENDING = { requestId: 42, name: '대기 중인 집', requestedAt: '2026-08-01T09:00:00Z' };

async function renderPage(over: Partial<PendingHousePageProps> = {}) {
  const props: PendingHousePageProps = {
    pendingHouse: PENDING,
    screenStyle: {},
    totalPages: 2,
    onPrev: jest.fn(),
    onNext: jest.fn(),
    orderableHouses: [{ houseId: 7, name: '실집' }],
    pendingCount: 1,
    houseIndex: 1,
    ...over,
  };
  const ui = await render(<PendingHousePage {...props} />);
  return { ...ui, props };
}

describe('PendingHousePage (#648)', () => {
  it('잠금 카드에 집 이름·안내·신청일을 보여준다', async () => {
    const { getByTestId, getByText } = await renderPage();
    expect(getByTestId('pending-house-page')).toBeTruthy();
    expect(getByText('대기 중인 집')).toBeTruthy();
    expect(getByText('방장 승인을 기다리고 있어요')).toBeTruthy();
    expect(getByText('2026.08.01 신청')).toBeTruthy();
  });

  it('신청일이 없으면 날짜 줄을 생략한다', async () => {
    const { queryByText } = await renderPage({ pendingHouse: { requestId: 1, name: '첫 집' } });
    expect(queryByText(/신청$/)).toBeNull();
  });

  it('페이지가 둘 이상이면 이전/다음 집 화살표가 콜백을 부른다', async () => {
    const { getByLabelText, props } = await renderPage();
    await fireEvent.press(getByLabelText('이전 집'));
    await fireEvent.press(getByLabelText('다음 집'));
    expect(props.onPrev).toHaveBeenCalledTimes(1);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it('페이지가 하나면 화살표를 그리지 않는다', async () => {
    const { queryByLabelText } = await renderPage({ totalPages: 1, orderableHouses: [] });
    expect(queryByLabelText('이전 집')).toBeNull();
    expect(queryByLabelText('다음 집')).toBeNull();
  });

  it('신청 취소는 확인 다이얼로그를 통과해야만 콜백을 부른다', async () => {
    const onCancel = jest.fn();
    const { getByLabelText, getByText, queryByText } = await renderPage({
      onCancelJoinRequest: onCancel,
    });
    await fireEvent.press(getByLabelText('입주 신청 취소'));
    expect(getByText('입주 신청을 취소할까요?')).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('신청 취소 확인'));
    expect(onCancel).toHaveBeenCalledWith(42);
    expect(queryByText('입주 신청을 취소할까요?')).toBeNull();
  });

  it('onCancelJoinRequest가 없으면 취소 버튼을 그리지 않는다', async () => {
    const { queryByLabelText } = await renderPage();
    expect(queryByLabelText('입주 신청 취소')).toBeNull();
  });
});
