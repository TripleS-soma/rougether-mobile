import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MarketOrdersScreen } from '@/components/screens/market-orders-screen';
import { MarketList } from '@/components/screens/market/market-list';
import { DEMO_MARKET_ASSETS, DEMO_MARKET_ORDERS } from '@/mocks/fixtures';

const NOW = new Date('2026-09-29T03:00:00Z');

describe('MarketOrdersScreen (#1427)', () => {
  it('행 — 이름·구매/판매·상태·가격·체결 수량·만료까지 남은 시간', async () => {
    const ui = await render(<MarketOrdersScreen orders={DEMO_MARKET_ORDERS} now={NOW} />);
    expect(ui.getByText('고양이 소파')).toBeTruthy();
    expect(ui.getByText('판매 · 대기 중')).toBeTruthy();
    expect(ui.getByText('30코인 · 0/1개 체결')).toBeTruthy();
    expect(ui.getByText('6일 후 만료')).toBeTruthy();
    expect(ui.getByText('5시간 후 만료')).toBeTruthy();
  });

  it('탭 전환은 OPEN/CLOSED로 부른다', async () => {
    const onChangeTab = jest.fn();
    const ui = await render(<MarketOrdersScreen orders={[]} onChangeTab={onChangeTab} />);
    expect(ui.getByText('주문이 없어요')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('완료 주문'));
    expect(onChangeTab).toHaveBeenCalledWith('CLOSED');
  });

  it('대기 중 주문 취소는 확인 다이얼로그를 거친다', async () => {
    const onCancel = jest.fn();
    const ui = await render(
      <MarketOrdersScreen orders={DEMO_MARKET_ORDERS} onCancel={onCancel} now={NOW} />,
    );
    await fireEvent.press(ui.getByLabelText('고양이 소파 주문 취소'));
    expect(onCancel).not.toHaveBeenCalled();
    expect(ui.getByText('주문을 취소할까요?')).toBeTruthy();
    await fireEvent.press(ui.getByText('주문 취소'));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith(5));
  });

  it('완료된 주문에는 취소가 없다', async () => {
    const closed = DEMO_MARKET_ORDERS.map((o) => ({ ...o, status: 'FILLED' as const }));
    const ui = await render(<MarketOrdersScreen orders={closed} onCancel={jest.fn()} now={NOW} />);
    expect(ui.queryByLabelText('고양이 소파 주문 취소')).toBeNull();
    expect(ui.queryByText(/후 만료/)).toBeNull();
  });
});

describe('MarketList (#1427)', () => {
  it('카드 — 최저 판매가 "N코인부터"/"판매 대기 없음", 탈퇴 제작자, 최근 거래', async () => {
    const onOpenAsset = jest.fn();
    const onOpenOrders = jest.fn();
    const ui = await render(
      <MarketList
        assets={DEMO_MARKET_ASSETS}
        onOpenAsset={onOpenAsset}
        onOpenOrders={onOpenOrders}
      />,
    );
    expect(ui.getByText('28코인부터')).toBeTruthy();
    expect(ui.getByText('판매 대기 없음')).toBeTruthy();
    expect(ui.getByText('탈퇴한 회원')).toBeTruthy();
    expect(ui.getByText('최근 거래 30코인')).toBeTruthy();
    expect(ui.getByText('거래 전')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('원목 책상 보기'));
    expect(onOpenAsset).toHaveBeenCalledWith(2);
    await fireEvent.press(ui.getByLabelText('내 주문'));
    expect(onOpenOrders).toHaveBeenCalled();
  });

  it('빈 목록·에러·더 보기', async () => {
    const onRetry = jest.fn();
    const empty = await render(<MarketList assets={[]} />);
    expect(empty.getByText('아직 거래소에 올라온 가구가 없어요')).toBeTruthy();

    const error = await render(<MarketList loadError onRetry={onRetry} />);
    expect(error.getByText('거래소를 불러오지 못했어요.')).toBeTruthy();

    const onLoadMore = jest.fn();
    const more = await render(
      <MarketList assets={DEMO_MARKET_ASSETS} hasNext onLoadMore={onLoadMore} />,
    );
    await fireEvent.press(more.getByLabelText('더 보기'));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
