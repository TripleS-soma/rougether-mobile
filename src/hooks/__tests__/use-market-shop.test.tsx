import { act, renderHook } from '@testing-library/react-native';

import { ApiError } from '@/api/http';
import { purchaseShopListing } from '@/api/market-shop';
import { useMarketShop } from '@/hooks/use-market-shop';
import { queryWrapper } from '@/test-utils/query-wrapper';

const mockRefreshWallet = jest.fn(async () => {});
jest.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({ refreshWallet: mockRefreshWallet }),
}));
jest.mock('@/api/market-shop', () => ({ purchaseShopListing: jest.fn() }));

describe('고정가 구매 요청', () => {
  beforeEach(() => jest.mocked(purchaseShopListing).mockReset());
  it('비활성화된 상세 조회를 로딩으로 표시하지 않는다', async () => {
    const { result } = await renderHook(() => useMarketShop(false, false, null), {
      wrapper: queryWrapper(),
    });
    expect(result.current.detailLoading).toBe(false);
  });
  it('응답을 잃고 재시도하면 같은 멱등 키를 사용한다', async () => {
    jest
      .mocked(purchaseShopListing)
      .mockRejectedValueOnce(new ApiError(503, 'POST', '/market/shop/11/purchase'))
      .mockResolvedValue({ purchaseId: 1, assetId: 11, userItemId: 990, price: 30 });
    const { result } = await renderHook(() => useMarketShop(false, false, null), {
      wrapper: queryWrapper(),
    });
    await act(async () => {
      await expect(result.current.buy(11, 30)).rejects.toBeInstanceOf(ApiError);
    });
    await act(async () => {
      await result.current.buy(11, 30);
    });
    const calls = jest.mocked(purchaseShopListing).mock.calls;
    expect(calls[0][2]).toBe(calls[1][2]);
    expect(calls[0].slice(0, 2)).toEqual([11, 30]);
  });
});
