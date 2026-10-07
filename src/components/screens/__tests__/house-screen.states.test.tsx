import { fireEvent, render } from '@testing-library/react-native';
import { HouseScreen } from '@/components/screens/house-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MISSION_HOUSE } from '@/test-utils/house-screen-fixtures';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn(() => 'light') }));
beforeEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

describe('HouseScreen — 빈 상태·에러·승인 대기', () => {
  it('shows the guided empty state when there are no houses', async () => {
    const onOpenSearch = jest.fn();
    const { getByText, getByLabelText } = await render(
      <HouseScreen houses={[]} onOpenSearch={onOpenSearch} />,
    );
    expect(getByText('아직 함께하는 집이 없어요')).toBeTruthy();
    await fireEvent.press(getByLabelText('집 탐색'));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  // 로드 실패는 '집 없음' 가입 유도로 위장하지 않는다 (#549).
  it('로드 실패 시 빈 상태 대신 에러 + 다시 시도를 보여준다 (#549)', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <HouseScreen houses={[]} loadError onRetry={onRetry} />,
    );

    expect(getByText('집 정보를 불러오지 못했어요')).toBeTruthy();
    expect(queryByText('아직 함께하는 집이 없어요')).toBeNull();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 승인 대기 집 카드 (#648) — 스위처 마지막 페이지의 잠금형 카드 + 신청 취소.
  it('대기 페이지로 넘어가면 잠금 카드가 보이고, 확인 후 신청을 취소한다 (#648)', async () => {
    const onCancel = jest.fn();
    const { getByLabelText, getByText, getByTestId } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        pendingHouses={[
          { requestId: 42, name: '대기 중인 집', requestedAt: '2026-08-01T09:00:00Z' },
        ]}
        onCancelJoinRequest={onCancel}
      />,
    );

    // 집 1 + 대기 1 = 2페이지 — 화살표가 생기고, 다음으로 가면 잠금 카드.
    await fireEvent.press(getByLabelText('다음 집'));
    expect(getByTestId('pending-house-page')).toBeTruthy();
    expect(getByText('대기 중인 집')).toBeTruthy();
    expect(getByText('방장 승인을 기다리고 있어요')).toBeTruthy();
    expect(getByText('2026.08.01 신청')).toBeTruthy();

    // 신청 취소 — 확인 다이얼로그를 통과해야만 콜백.
    await fireEvent.press(getByLabelText('입주 신청 취소'));
    expect(getByText('입주 신청을 취소할까요?')).toBeTruthy();
    await fireEvent.press(getByLabelText('신청 취소 확인'));
    expect(onCancel).toHaveBeenCalledWith(42);
  });

  it('집이 없어도 대기 신청이 있으면 빈 상태 대신 잠금 카드를 보여준다 (#648)', async () => {
    const { getByTestId, queryByText } = await render(
      <HouseScreen houses={[]} pendingHouses={[{ requestId: 7, name: '첫 집' }]} />,
    );
    expect(getByTestId('pending-house-page')).toBeTruthy();
    expect(queryByText('아직 함께하는 집이 없어요')).toBeNull();
  });
});
