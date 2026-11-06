import { fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { __resetSheetSerializer } from '@/components/ui/bottom-sheet';

import { fetchMyMarketOrders } from '@/api/market';
import { NavMenuPopover } from '@/components/app/nav-menu-popover';
import { backTargetFor, TAB_FOR_SCREEN } from '@/components/app/navigation';
import { useMarketPages } from '@/components/app/use-market-pages';
import { FurnitureStudioScreen } from '@/components/screens/furniture-studio-screen';
import { fetchShopListings } from '@/api/market-shop';
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

jest.mock('@/api/market-shop', () => ({
  fetchShopListings: jest.fn(async () => ({ items: [], hasNext: false })),
  fetchShopListing: jest.fn(async () => null),
  sellShopListing: jest.fn(),
  purchaseShopListing: jest.fn(),
  updateShopListing: jest.fn(),
}));

describe('거래소 내비게이션 (#1427 → #1502 독립 화면)', () => {
  it('목록·상세·내 주문은 하단 탭 없는 서브화면 — 상세·내 주문의 뒤로는 거래소, 거래소의 뒤로는 방', () => {
    for (const screen of ['market', 'marketAsset', 'marketOrders'] as const) {
      expect(TAB_FOR_SCREEN[screen]).toBeNull();
    }
    expect(backTargetFor('market', 'myRoom', false)).toBe('myRoom');
    expect(backTargetFor('marketAsset', 'myRoom', false)).toBe('market');
    expect(backTargetFor('marketOrders', 'myRoom', false)).toBe('market');
  });

  it('새 거래소는 고정가 목록을 조회하고 주문 대기 목록은 조회하지 않는다', async () => {
    const setScreen = jest.fn();
    const { result } = await renderHook(
      () =>
        useMarketPages({
          nav: { screen: 'market', setScreen, goBack: jest.fn() },
          coinBalance: 0,
          diamondBalance: 0,
        }),
      { wrapper: queryWrapper() },
    );
    result.current.openMarket?.();
    expect(setScreen).toHaveBeenCalledWith('market');
    await waitFor(() => expect(fetchShopListings).toHaveBeenCalledWith(0, false));
    expect(fetchMyMarketOrders).not.toHaveBeenCalled();
    expect(result.current.onIssue).toBeDefined();
  });

  it('전체 메뉴에서 "가구 거래소"는 관리 항목보다 위이고, 누르면 메뉴를 닫고 연다', async () => {
    const onClose = jest.fn();
    const onOpenMarket = jest.fn();
    const ui = await render(
      <NavMenuPopover
        visible
        top={0}
        onClose={onClose}
        onOpenMarket={onOpenMarket}
        onOpenCategoryManager={jest.fn()}
        onManageRoutines={jest.fn()}
      />,
    );
    const labels = ui.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    // 꾸미기는 오른쪽 버튼 열에만 남았다(2026-11-04) — 거래소가 메뉴 첫 방 작업.
    expect(labels.indexOf('가구 거래소')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('가구 거래소')).toBeLessThan(labels.indexOf('카테고리 관리'));
    await fireEvent.press(ui.getByLabelText('가구 거래소'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenMarket).toHaveBeenCalled();
  });
});

describe('스튜디오 "판매 준비하기" (#1427)', () => {
  afterEach(() => __resetSheetSerializer());
  const jobs = [
    {
      id: 'job-1',
      status: 'SUCCEEDED' as const,
      assetKey: 'items/photo-furniture/furniture/a.png',
      userItemId: 77,
      failureCode: null,
    },
  ];

  it('onIssue를 넘기면 완성된 가구에 버튼 → 가격 입력 → 판매', async () => {
    const onIssue = jest.fn(async () => true);
    const ui = await render(
      <FurnitureStudioScreen
        balance={{ available: 0, reserved: 0 }}
        jobs={jobs}
        photo={null}
        onIssue={onIssue}
      />,
    );
    // 내 가구 탭 → 타일 → 상세 시트의 판매하기 (#1666). 판매 시트는 상세 시트가 닫힌 뒤 뜬다.
    await fireEvent.press(ui.getByRole('tab', { name: /^내 가구/ }));
    await fireEvent.press(ui.getAllByLabelText(/^내가 만든 가구 \d+/)[0]);
    await fireEvent.press(ui.getByLabelText('판매하기'));
    await waitFor(() => expect(ui.getByText(/원본은 계속 보관하고/)).toBeTruthy());
    await fireEvent.changeText(ui.getByLabelText('개당 가격 (코인)'), '30');
    await fireEvent.press(ui.getByLabelText('30코인에 판매하기'));
    await waitFor(() => expect(onIssue).toHaveBeenCalledWith(77, 30));
  });

  it('onIssue가 없으면 버튼이 없다', async () => {
    const ui = await render(
      <FurnitureStudioScreen balance={{ available: 0, reserved: 0 }} jobs={jobs} photo={null} />,
    );
    await fireEvent.press(ui.getByRole('tab', { name: /^내 가구/ }));
    await fireEvent.press(ui.getAllByLabelText(/^내가 만든 가구 \d+/)[0]);
    expect(ui.getByLabelText('방에 배치하기')).toBeTruthy();
    expect(ui.queryByLabelText('판매하기')).toBeNull();
  });

  it.each(['market', 'marketOrders', 'marketAsset'] as const)(
    '%s의 뒤로 버튼은 셸의 goBack을 부른다 — 뒤로 맵을 다시 적지 않는다 (장부 6번)',
    async (screen) => {
      const goBack = jest.fn();
      const setScreen = jest.fn();
      const { result } = await renderHook(
        () =>
          useMarketPages({
            nav: { screen, setScreen, goBack },
            coinBalance: 0,
            diamondBalance: 0,
          }),
        { wrapper: queryWrapper() },
      );
      const ui = await render(<>{result.current.subScreen}</>, { wrapper: queryWrapper() });
      await fireEvent.press(await ui.findByLabelText('뒤로 가기'));
      expect(goBack).toHaveBeenCalledTimes(1);
      expect(setScreen).not.toHaveBeenCalled();
    },
  );
});
