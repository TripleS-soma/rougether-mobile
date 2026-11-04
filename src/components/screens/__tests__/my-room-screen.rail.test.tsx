import { fireEvent, render, within } from '@testing-library/react-native';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { ToastProvider } from '@/components/ui/toast';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  ...jest.requireActual('@/lib/analytics'),
  track: (...args: unknown[]) => mockTrack(...args),
}));

const handlers = () => ({
  onOpenNotifications: jest.fn(),
  onEdit: jest.fn(),
  onOpenFurnitureStudio: jest.fn(),
  onOpenMinigames: jest.fn(),
  onOpenGacha: jest.fn(),
});

beforeEach(() => mockTrack.mockClear());

describe('방 화면 오른쪽 버튼 열 (2026-11-04 재배치)', () => {
  it('위는 메뉴·알림, 아래는 미니게임·꾸미기·AI 스튜디오·뽑기 순', async () => {
    const ui = await render(
      <ToastProvider>
        <MyRoomScreen routines={[]} {...handlers()} />
      </ToastProvider>,
    );
    const labels = within(ui.getByTestId('room-actions'))
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual([
      '메뉴',
      '알림',
      '미니게임',
      '방 꾸미기',
      'AI 가구 만들기',
      '뽑기 상점',
    ]);
  });

  it('버튼을 누르면 room_action_tap을 남기고 원래 동작을 한다', async () => {
    const h = handlers();
    const ui = await render(
      <ToastProvider>
        <MyRoomScreen routines={[]} {...h} />
      </ToastProvider>,
    );
    await fireEvent.press(ui.getByLabelText('미니게임'));
    expect(h.onOpenMinigames).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenLastCalledWith('room_action_tap', { action: 'minigames' });
    await fireEvent.press(ui.getByLabelText('뽑기 상점'));
    expect(h.onOpenGacha).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenLastCalledWith('room_action_tap', { action: 'gacha' });
  });

  it('메뉴 항목도 menu_ 접두로 남긴다', async () => {
    const onManageRoutines = jest.fn();
    const ui = await render(
      <ToastProvider>
        <MyRoomScreen routines={[]} onManageRoutines={onManageRoutines} />
      </ToastProvider>,
    );
    await fireEvent.press(ui.getByLabelText('메뉴'));
    expect(mockTrack).toHaveBeenLastCalledWith('room_action_tap', { action: 'menu' });
    await fireEvent.press(ui.getByText('루틴 관리'));
    expect(onManageRoutines).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenLastCalledWith('room_action_tap', { action: 'menu_routines' });
  });
});
