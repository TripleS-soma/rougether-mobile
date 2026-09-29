import { fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { fetchMyMarketOrders } from '@/api/market';
import { backTargetFor, TAB_FOR_SCREEN } from '@/components/app/navigation';
import { useMarketPages } from '@/components/app/use-market-pages';
import { FurnitureStudioScreen } from '@/components/screens/furniture-studio-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { DEMO_MARKET_ORDERS } from '@/mocks/fixtures';
import { queryWrapper } from '@/test-utils/query-wrapper';

// 가구 거래소 (#1427) — 이 파일은 MARKET_ENABLED를 켠 상태를 본다. 꺼진 상태는 market-flag-off.test.tsx.
jest.mock('@/constants/market', () => ({
  ...jest.requireActual('@/constants/market'),
  MARKET_ENABLED: true,
}));

jest.mock('@/api/market', () => ({
  ...jest.requireActual('@/api/market'),
  fetchMarketAssets: jest.fn(async () => ({ items: [], hasNext: false })),
  fetchMyMarketOrders: jest.fn(async () => ({ items: [], hasNext: false })),
}));

describe('거래소 내비게이션 (#1427)', () => {
  it('상세·내 주문은 하단 탭 없는 서브화면, 뒤로는 꾸미기(상점)', () => {
    expect(TAB_FOR_SCREEN.marketAsset).toBeNull();
    expect(TAB_FOR_SCREEN.marketOrders).toBeNull();
    expect(backTargetFor('marketAsset', 'myRoom', false)).toBe('decor');
    expect(backTargetFor('marketOrders', 'myRoom', false)).toBe('decor');
  });

  it('켜져 있으면 꾸미기 탭·판매 중 수·스튜디오 발행이 배선된다', async () => {
    jest.mocked(fetchMyMarketOrders).mockResolvedValue({
      items: DEMO_MARKET_ORDERS,
      hasNext: false,
    });
    const setScreen = jest.fn();
    const { result } = await renderHook(
      () => useMarketPages({ nav: { screen: 'decor', setScreen }, coinBalance: 0 }),
      { wrapper: queryWrapper() },
    );
    expect(result.current.renderMarket).toBeDefined();
    expect(result.current.onIssue).toBeDefined();
    // 판매 중 = 대기 중 판매(INVENTORY) 주문 — 구매 주문은 세지 않는다.
    await waitFor(() => expect(result.current.sellingCount).toBe(1));
    expect(fetchMyMarketOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN' }));
  });
});

describe('꾸미기의 거래소 탭 (#1427)', () => {
  it('renderMarket을 넘기면 "거래소" 탭이 생기고, 누르면 내용이 뜬다', async () => {
    const renderMarket = jest.fn((leave: (go: () => void) => void) => (
      <Text onPress={() => leave(() => {})}>거래소 내용</Text>
    ));
    const ui = await render(<RoomDecorScreen renderMarket={renderMarket} />);
    await fireEvent.press(ui.getByLabelText('거래소 탭'));
    expect(ui.getByText('거래소 내용')).toBeTruthy();
    // 거래소 탭에서는 보유중 필터가 의미 없어 숨긴다.
    expect(ui.queryByText('보유중만 보기')).toBeNull();
  });

  it('씨앗 탭이 market이면 거래소 탭으로 열린다', async () => {
    const ui = await render(
      <RoomDecorScreen initialTab="market" renderMarket={() => <Text>거래소 내용</Text>} />,
    );
    expect(ui.getByText('거래소 내용')).toBeTruthy();
  });

  it('판매 중인 가구가 있으면 가구 탭 위에 안내 줄 + 내 주문 보기', async () => {
    const onOpenSelling = jest.fn();
    const ui = await render(<RoomDecorScreen sellingCount={2} onOpenSelling={onOpenSelling} />);
    expect(ui.getByText('판매 중인 가구 2개')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('내 주문 보기'));
    expect(onOpenSelling).toHaveBeenCalled();
  });
});

describe('스튜디오 "거래소에 올리기" (#1427)', () => {
  const jobs = [
    {
      id: 'job-1',
      status: 'SUCCEEDED' as const,
      assetKey: 'items/photo-furniture/furniture/a.png',
      userItemId: 77,
      failureCode: null,
    },
  ];

  it('onIssue를 넘기면 완성된 가구에 버튼 → 수량 선택 → 발행', async () => {
    const onIssue = jest.fn(async () => true);
    const ui = await render(
      <FurnitureStudioScreen
        balance={{ available: 0, reserved: 0 }}
        jobs={jobs}
        photo={null}
        onIssue={onIssue}
      />,
    );
    await fireEvent.press(ui.getByLabelText('거래소에 올리기'));
    expect(ui.getByText(/한 번 올리면 추가 발행할 수 없고/)).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('3개'));
    await fireEvent.press(ui.getByLabelText('3개 발행하기'));
    await waitFor(() => expect(onIssue).toHaveBeenCalledWith(77, 3));
  });

  it('onIssue가 없으면 버튼이 없다', async () => {
    const ui = await render(
      <FurnitureStudioScreen balance={{ available: 0, reserved: 0 }} jobs={jobs} photo={null} />,
    );
    expect(ui.queryByLabelText('거래소에 올리기')).toBeNull();
  });
});
