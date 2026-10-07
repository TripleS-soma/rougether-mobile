import { render, renderHook } from '@testing-library/react-native';

import { fetchMarketAssets, fetchMyMarketOrders } from '@/api/market';
import { useMarketPages } from '@/components/app/use-market-pages';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { queryWrapper } from '@/test-utils/query-wrapper';

// MARKET_ENABLED가 꺼져 있으면 거래소는 사용자에게 전혀 보이지 않는다 (#1427 — 신고 API 연결
// 전까지 App Store 1.2). 켠 상태는 market-navigation.test.tsx.
jest.mock('@/constants/market', () => ({
  ...jest.requireActual('@/constants/market'),
  MARKET_ENABLED: false,
}));

jest.mock('@/api/market', () => ({
  ...jest.requireActual('@/api/market'),
  fetchMarketAssets: jest.fn(),
  fetchMyMarketOrders: jest.fn(),
  fetchMarketAsset: jest.fn(),
}));

describe('MARKET_ENABLED=false (#1427)', () => {
  it('꾸미기 탭·판매 중 줄·스튜디오 발행·서브화면이 없고, 요청도 없다', async () => {
    const setScreen = jest.fn();
    for (const screen of ['decor', 'marketAsset', 'marketOrders'] as const) {
      const { result } = await renderHook(
        () => useMarketPages({ nav: { screen, setScreen, goBack: jest.fn() }, coinBalance: 0 }),
        { wrapper: queryWrapper() },
      );
      expect(result.current.renderMarket).toBeUndefined();
      expect(result.current.onIssue).toBeUndefined();
      expect(result.current.onOpenSelling).toBeUndefined();
      expect(result.current.sellingCount).toBe(0);
      expect(result.current.subScreen).toBeNull();
    }
    expect(fetchMarketAssets).not.toHaveBeenCalled();
    expect(fetchMyMarketOrders).not.toHaveBeenCalled();
  });

  it('셸이 넘기는 값 그대로면 꾸미기에 거래소 탭이 없다', async () => {
    const ui = await render(<RoomDecorScreen renderMarket={undefined} sellingCount={0} />);
    expect(ui.getByLabelText('가구 탭')).toBeTruthy();
    expect(ui.queryByLabelText('거래소 탭')).toBeNull();
    expect(ui.queryByText(/판매 중인 가구/)).toBeNull();
  });
});
