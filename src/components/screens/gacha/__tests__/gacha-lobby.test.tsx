import { fireEvent, render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

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
  beforeEach(() => jest.clearAllMocks());

  it('keeps category selection controlled and passes the original server machine to its owner', async () => {
    const onSelect = jest.fn();
    const props = lobbyProps({ onSelect });
    const screen = await render(<GachaLobby {...props} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      '벽지 뽑기',
      '바닥 뽑기',
      '가구 뽑기',
    ]);
    expect(screen.getByRole('tab', { name: '가구 뽑기' })).toBeSelected();

    await fireEvent.press(screen.getByRole('tab', { name: '바닥 뽑기' }));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe(floor);
    expect(hapticSelection).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tab', { name: '가구 뽑기' })).toBeSelected();

    await screen.rerender(<GachaLobby {...props} selected={floor} />);
    expect(screen.getByRole('tab', { name: '바닥 뽑기' })).toBeSelected();
    expect(screen.getByText('포근함을 깔아볼까요')).toBeTruthy();
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
