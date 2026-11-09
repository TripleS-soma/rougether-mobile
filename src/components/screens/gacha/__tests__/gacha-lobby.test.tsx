import { fireEvent, render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

import type { GachaMachine } from '@/api/adapters';
import { GachaLobby } from '@/components/screens/gacha/gacha-lobby';
import { hapticSelection } from '@/utils/haptics';

jest.mock('@/utils/haptics', () => ({ hapticSelection: jest.fn() }));

const furniture: GachaMachine = {
  id: 740,
  code: 'furniture_gacha',
  category: 'FURNITURE',
  name: '가구 뽑기',
  costCurrencyType: 'COIN',
  costAmount: 37,
  drawCount: 1,
  kind: 'furniture',
  icon: 'gift',
  accent: 'transparent',
};
const floor: GachaMachine = {
  ...furniture,
  id: 95,
  code: 'floor_gacha',
  category: 'FLOOR',
  name: '바닥 뽑기',
};
const wallpaper: GachaMachine = {
  ...furniture,
  id: 381,
  code: 'wallpaper_gacha',
  category: 'WALLPAPER',
  name: '벽지 뽑기',
};

function lobbyProps(overrides: Partial<ComponentProps<typeof GachaLobby>> = {}) {
  return {
    machines: [furniture, floor, wallpaper],
    selected: furniture,
    onSelect: jest.fn(),
    onDraw: jest.fn(),
    canAfford: () => true,
    busy: false,
    error: '',
    ...overrides,
  };
}

describe('GachaLobby', () => {
  it('shows the placement bonus and exclusions only for the Christmas machine', async () => {
    const christmas: GachaMachine = {
      ...furniture,
      id: 2026,
      code: 'christmas_2026',
      category: undefined,
      name: '크리스마스',
    };
    const props = lobbyProps({
      selected: christmas,
      onRewards: jest.fn(),
      seasonalGacha: {
        machine: christmas,
        title: '크리스마스',
        endsLabel: '12.25까지',
        hero: null,
      },
    });
    const screen = await render(<GachaLobby {...props} />);
    expect(screen.getByText('배치한 크리스마스 가구 종류마다 코인 +10%')).toBeTruthy();
    expect(screen.queryByText('루틴·할 일 완료 보상 · 중복·벽지·바닥 제외')).toBeNull();
    expect(screen.getByLabelText(/같은 종류의 중복 배치와 벽지, 바닥은 제외/)).toBeTruthy();
    expect(screen.getByText('나올 수 있는 보상')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: '크리스마스' }));
    expect(props.onSelect).toHaveBeenCalledWith(christmas);
    expect(screen.getByLabelText('1회 뽑기, 37 코인')).toBeTruthy();

    await screen.rerender(<GachaLobby {...props} selected={floor} />);
    expect(screen.queryByText('배치한 크리스마스 가구 종류마다 코인 +10%')).toBeNull();
    expect(screen.queryByLabelText(/같은 종류의 중복 배치와 벽지, 바닥은 제외/)).toBeNull();
    expect(screen.getByText('바닥 1개가 나와요.')).toBeTruthy();
    expect(screen.getByText('나올 수 있는 보상')).toBeTruthy();
    expect(props.onDraw).not.toHaveBeenCalled();
  });

  it('omits the extra footer copy while retaining explicit draw counts and prices', async () => {
    const screen = await render(<GachaLobby {...lobbyProps()} />);
    expect(screen.queryByText(/5회 가격으로 6개/)).toBeNull();
    expect(screen.queryByText(/중복 아이템은 다이아로/)).toBeNull();
    expect(screen.getByLabelText('5+1회 뽑기, 185 코인')).toBeTruthy();
  });

  /**
   * 갤럭시 S25(832dp) 실측: 버튼에 flex 1을 주면 세로 래퍼 안에서 높이 기준이 0이 돼 Android
   * (Yoga)가 버튼 줄을 18dp로 잡고 72dp 버튼 아래가 화면 밖으로 잘렸다. 폭은 래퍼가 나눈다.
   * jest는 레이아웃을 계산하지 않으므로 원인이 된 스타일을 직접 잠근다.
   */
  it('draw buttons carry no flex of their own — the wrapper splits the width', async () => {
    const screen = await render(<GachaLobby {...lobbyProps()} />);
    for (const label of ['1회 뽑기, 37 코인', '5+1회 뽑기, 185 코인']) {
      const style = StyleSheet.flatten(screen.getByLabelText(label).props.style);
      expect(style.flex).toBeUndefined();
      expect(style.minHeight).toBeGreaterThan(0);
    }
  });

  it('keeps category selection controlled and passes the original server machine to its owner', async () => {
    const onSelect = jest.fn();
    const props = lobbyProps({ onSelect });
    const screen = await render(<GachaLobby {...props} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      '벽지 뽑기',
      '바닥 뽑기',
      '가구 뽑기',
      '캐릭터 뽑기',
    ]);
    expect(screen.getByRole('tab', { name: '가구 뽑기' })).toBeSelected();

    await fireEvent.press(screen.getByRole('tab', { name: '바닥 뽑기' }));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe(floor);
    expect(hapticSelection).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tab', { name: '가구 뽑기' })).toBeSelected();

    await screen.rerender(<GachaLobby {...props} selected={floor} />);
    expect(screen.getByRole('tab', { name: '바닥 뽑기' })).toBeSelected();
    expect(screen.getByText('바닥 1개가 나와요.')).toBeTruthy();
  });

  it.each([
    ['COIN', '코인'],
    ['DIAMOND', '다이아'],
  ] as const)(
    'uses the server price and %s currency for single and five-plus-one actions',
    async (currency, label) => {
      const onDraw = jest.fn();
      const props = lobbyProps({
        selected: { ...furniture, costCurrencyType: currency },
        onDraw,
      });
      const screen = await render(<GachaLobby {...props} />);
      await fireEvent.press(screen.getByRole('button', { name: `1회 뽑기, 37 ${label}` }));
      await fireEvent.press(screen.getByRole('button', { name: `5+1회 뽑기, 185 ${label}` }));
      expect(onDraw.mock.calls).toEqual([[1], [6]]);
    },
  );

  it('disables both draw actions and every category while busy', async () => {
    const props = lobbyProps({ busy: true });
    const screen = await render(<GachaLobby {...props} />);
    for (const control of [...screen.getAllByRole('tab'), ...screen.getAllByRole('button')]) {
      expect(control).toBeDisabled();
      await fireEvent.press(control);
    }
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onDraw).not.toHaveBeenCalled();
    expect(hapticSelection).not.toHaveBeenCalled();
  });

  it('leaves missing categories visible but prevents selecting an invented machine', async () => {
    const props = lobbyProps({ machines: [furniture] });
    const screen = await render(<GachaLobby {...props} />);
    for (const name of ['벽지 뽑기', '바닥 뽑기']) {
      const tab = screen.getByRole('tab', { name });
      expect(tab).toBeDisabled();
      await fireEvent.press(tab);
    }
    expect(screen.getByRole('tab', { name: '가구 뽑기' })).not.toBeDisabled();
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('keeps unaffordable actions tappable for the owner to explain the balance and exposes its error', async () => {
    const props = lobbyProps({ canAfford: () => false, error: '잔액을 다시 확인해 주세요' });
    const screen = await render(<GachaLobby {...props} />);
    const action = screen.getByRole('button', { name: '1회 뽑기, 37 코인' });
    expect(action).not.toBeDisabled();
    await fireEvent.press(action);
    expect(props.onDraw).toHaveBeenCalledWith(1);
    expect(screen.getByRole('alert')).toHaveTextContent('잔액을 다시 확인해 주세요');
  });

  it('exposes the reward preview only when a callback is supplied', async () => {
    const props = lobbyProps();
    const screen = await render(<GachaLobby {...props} />);
    expect(screen.queryByRole('button', { name: '나올 수 있는 보상 보기' })).toBeNull();
    const onRewards = jest.fn();
    await screen.rerender(<GachaLobby {...props} onRewards={onRewards} />);
    await fireEvent.press(screen.getByRole('button', { name: '나올 수 있는 보상 보기' }));
    expect(onRewards).toHaveBeenCalledTimes(1);
    expect(props.onDraw).not.toHaveBeenCalled();
  });
});

it('감성 문구 없이 무엇이 나오는지만 말한다 (2026-11-09)', async () => {
  const screen = await render(<GachaLobby {...lobbyProps({ onRewards: jest.fn() })} />);
  for (const gone of ['오늘의 작은 설렘', '내 방에 도착한 선물', '어떤 선물이 기다릴까요?']) {
    expect(screen.queryByText(gone)).toBeNull();
  }
  expect(screen.queryByText(/상자$/)).toBeNull();
  expect(screen.getByText('나올 수 있는 보상')).toBeTruthy();
});

it('첫 뽑기는 무료라는 것과 스피커가 나온다는 것만 알린다 (2026-11-09)', async () => {
  const screen = await render(<GachaLobby {...lobbyProps({ starterDrawState: 'PENDING' })} />);
  expect(screen.getByText('첫 뽑기는 무료예요')).toBeTruthy();
  expect(screen.getByText('스피커가 나와요. 받은 뒤 원하는 곳에 놓을 수 있어요.')).toBeTruthy();
});
