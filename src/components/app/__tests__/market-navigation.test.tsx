import { fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';

import { fetchMarketAssets, fetchMyMarketOrders } from '@/api/market';
import { NavMenuPopover } from '@/components/app/nav-menu-popover';
import { backTargetFor, TAB_FOR_SCREEN } from '@/components/app/navigation';
import { useMarketPages } from '@/components/app/use-market-pages';
import { FurnitureStudioScreen } from '@/components/screens/furniture-studio-screen';
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

describe('거래소 내비게이션 (#1427 → #1502 독립 화면)', () => {
  it('목록·상세·내 주문은 하단 탭 없는 서브화면 — 상세·내 주문의 뒤로는 거래소, 거래소의 뒤로는 방', () => {
    for (const screen of ['market', 'marketAsset', 'marketOrders'] as const) {
      expect(TAB_FOR_SCREEN[screen]).toBeNull();
    }
    expect(backTargetFor('market', 'myRoom', false)).toBe('myRoom');
    expect(backTargetFor('marketAsset', 'myRoom', false)).toBe('market');
    expect(backTargetFor('marketOrders', 'myRoom', false)).toBe('market');
  });

  it('켜져 있으면 메뉴 진입·스튜디오 발행이 배선되고, 거래소 화면에 판매 중 수가 뜬다', async () => {
    jest.mocked(fetchMyMarketOrders).mockResolvedValue({
      items: DEMO_MARKET_ORDERS,
      hasNext: false,
    });
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
    expect(result.current.onIssue).toBeDefined();
    result.current.openMarket?.();
    expect(setScreen).toHaveBeenCalledWith('market');
    await waitFor(() => expect(fetchMarketAssets).toHaveBeenCalled());
    expect(fetchMyMarketOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN' }));
    // 판매 중 = 대기 중 판매(INVENTORY) 주문 — 구매 주문은 세지 않는다.
    const ui = await render(<>{result.current.subScreen}</>, { wrapper: queryWrapper() });
    expect(await ui.findByText('판매 중인 가구 1개')).toBeTruthy();
  });

  it('전체 메뉴에서 "가구 거래소"는 방 꾸미기 바로 아래이고, 누르면 메뉴를 닫고 연다', async () => {
    const onClose = jest.fn();
    const onOpenMarket = jest.fn();
    const ui = await render(
      <NavMenuPopover
        visible
        top={0}
        onClose={onClose}
        onEditRoom={jest.fn()}
        onOpenMarket={onOpenMarket}
        onOpenCategoryManager={jest.fn()}
        onManageRoutines={jest.fn()}
      />,
    );
    const labels = ui.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels.indexOf('가구 거래소')).toBe(labels.indexOf('방 꾸미기') + 1);
    await fireEvent.press(ui.getByLabelText('가구 거래소'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenMarket).toHaveBeenCalled();
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
