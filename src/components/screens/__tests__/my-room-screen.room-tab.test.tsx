import { fireEvent, render } from '@testing-library/react-native';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { ToastProvider } from '@/components/ui/toast';
import { SAMPLE_ROUTINES } from '@/constants/routines';

describe('MyRoomScreen', () => {
  it("view='room'이면 달력 알약 없이 방만 — 오늘의 할 일 (#1138)", async () => {
    const ui = await render(<MyRoomScreen routines={[]} view="room" />);
    expect(ui.queryByText('달력')).toBeNull();
    expect(ui.queryByTestId('my-room-chrome')).toBeNull();
    expect(ui.getByText('오늘의 할 일')).toBeTruthy();
  });

  // 거미줄 (#829) — prop이 <Room />까지 실제로 닿는지. 씬 번들이 명시
  // 조립이라 타입만으로는 누락이 안 잡힌다(실제로 한 번 빠뜨렸다).
  it('거미줄 prop이 방 캔버스까지 전달된다 (#829)', async () => {
    const ui = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        cobweb={{ assetKey: 'items/cobweb.png', cleanable: true }}
      />,
    );
    expect(ui.getByLabelText('거미줄이 꼈어요')).toBeTruthy();
  });

  // 거미줄 청소 (#830) — cleanable일 때만 눌리고, 보상이 실제로 지급된
  // 경우에만 코인이 난다.
  it('청소 가능한 거미줄을 누르면 onCleanCobweb을 부른다', async () => {
    const onCleanCobweb = jest.fn().mockResolvedValue(3);
    const ui = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        cobweb={{ assetKey: 'items/cobweb.png', cleanable: true }}
        onCleanCobweb={onCleanCobweb}
      />,
    );
    await fireEvent.press(ui.getByLabelText('거미줄 치우기'));
    expect(onCleanCobweb).toHaveBeenCalled();
  });

  it('cleanable이 아니면 눌리지 않는다 — 표시만', async () => {
    const onCleanCobweb = jest.fn();
    const ui = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        cobweb={{ assetKey: 'items/cobweb.png', cleanable: false }}
        onCleanCobweb={onCleanCobweb}
      />,
    );
    expect(ui.queryByLabelText('거미줄 치우기')).toBeNull();
    expect(ui.getByLabelText('거미줄이 꼈어요')).toBeTruthy();
  });

  // 방↔달력 스와이프 제거 (#825) — 가로 스와이프는 하단 탭 이동 하나로
  // 통일했다. 예전엔 방 캔버스·달력 위 플링이 서브탭을 순환시켜서(#561),
  // 그 아래 루틴 리스트의 같은 손동작(셸 탭 페이저)과 뜻이 갈렸다.
  it('방 캔버스 가로 플링이 더 이상 탭을 바꾸지 않는다 (#825)', async () => {
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} />);
    // 제스처 자체가 사라졌다 — 있으면 아래 단언이 무의미해지므로 먼저 확인.
    expect(() => getByGestureTestId('room-tab-fling')).toThrow();
    // 탭 버튼은 그대로 동작한다.
    expect(ui.getByText('오늘의 할 일')).toBeTruthy();
    await fireEvent.press(ui.getByText('달력'));
    expect(ui.getByText('이 날의 할 일')).toBeTruthy();
    await fireEvent.press(ui.getByText('방'));
    expect(ui.getByText('오늘의 할 일')).toBeTruthy();
  });

  it.each([undefined, 'room'] as const)(
    'omits the personal room name and fallback in view=%s, keeping room actions',
    async (view) => {
      const onOpenNotifications = jest.fn();
      const onEdit = jest.fn();
      const onOpenGacha = jest.fn();
      const props = { view, routines: [], onOpenNotifications, onEdit, onOpenGacha };
      const ui = await render(<MyRoomScreen {...props} userName="김철수베리롱네임" />);
      expect(ui.queryByText(/의 방$/)).toBeNull();
      expect(ui.queryByText('내 방')).toBeNull();
      expect(ui.getByLabelText('메뉴')).toBeTruthy();
      await fireEvent.press(ui.getByLabelText('알림'));
      await fireEvent.press(ui.getByLabelText('방 꾸미기'));
      await fireEvent.press(ui.getByLabelText('뽑기 상점'));
      expect(onOpenNotifications).toHaveBeenCalledTimes(1);
      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onOpenGacha).toHaveBeenCalledTimes(1);

      await ui.rerender(<MyRoomScreen {...props} />);
      expect(ui.queryByText('내 방')).toBeNull();
    },
  );
});

it('메인 AI 아이콘에서 가구 만들기를 연다', async () => {
  const open = jest.fn();
  const ui = await render(
    <ToastProvider>
      <MyRoomScreen view="room" onOpenFurnitureStudio={open} />
    </ToastProvider>,
  );
  await fireEvent.press(ui.getByLabelText('AI 가구 만들기'));
  expect(open).toHaveBeenCalledTimes(1);
});
