import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { type PanGesture, PointerType, State } from 'react-native-gesture-handler';
import { cameraClaimsMove, HouseScreen } from '@/components/screens/house-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveHouseFrame } from '@/resources/house-frame';
import { Spacing } from '@/constants/theme';
import { CAM_PAN_SLOP } from '@/components/screens/house/camera';
import { SWIPE_CLAIM_DX } from '@/utils/gesture';
import { MISSION_HOUSE } from '@/test-utils/house-screen-fixtures';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn(() => 'light') }));
beforeEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

describe('HouseScreen — 좌석 프레이밍·카메라', () => {
  it.each([
    [320, 568],
    [393, 852],
    [430, 932],
  ])('keeps all six rooms above navigation in a %s × %s viewport', async (width, height) => {
    const house = { ...MISSION_HOUSE, maxMembers: 6 };
    const ui = await render(<HouseScreen houses={[house]} />);
    const headerBottom = 164;
    await fireEvent(ui.getByTestId('house-scroll'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width, height } },
    });
    await fireEvent(ui.getByTestId('house-header-end'), 'layout', {
      nativeEvent: { layout: { x: 0, y: headerBottom, width, height: 0 } },
    });
    const style = StyleSheet.flatten(ui.getByTestId('house-frame-viewport').props.style);
    const { paddingBottom: navInset } = StyleSheet.flatten(
      ui.getByTestId('house-scroll').props.contentContainerStyle,
    );
    const frame = resolveHouseFrame(undefined, { maxMembers: 6 });
    const frameHeight = style.maxWidth / frame.aspectRatio;
    expect(style.maxWidth).toBeGreaterThan(0);
    expect(style.maxWidth).toBeLessThan(width);
    expect(headerBottom + Spacing.two + frameHeight + Spacing.three + navInset).toBeCloseTo(height);
    // Bottom-floor windows remain inside the frame and preserve portrait geometry.
    const lastRoom = frame.windowRects[5];
    const roomBottom = (parseFloat(lastRoom.top) + parseFloat(lastRoom.height)) / 100;
    expect(headerBottom + Spacing.two + roomBottom * frameHeight).toBeLessThan(height - navInset);

    // Returning to a two/four-seat or legacy house must remove the six-seat width limit.
    for (const next of [
      { ...house, maxMembers: 2 },
      { ...house, maxMembers: 4 },
      { ...house, coverImageKey: 'house/unknown/frame.png' },
    ]) {
      await ui.rerender(<HouseScreen houses={[next]} />);
      expect(
        StyleSheet.flatten(ui.getByTestId('house-frame-viewport').props.style).maxWidth,
      ).toBeUndefined();
    }
  });

  it('remeasures the six-seat framing after resize and header growth', async () => {
    const ui = await render(<HouseScreen houses={[{ ...MISSION_HOUSE, maxMembers: 6 }]} />);
    const layout = (width: number, height: number) =>
      fireEvent(ui.getByTestId('house-scroll'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width, height } },
      });
    const header = (height: number) =>
      fireEvent(ui.getByTestId('house-header-end'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 80, width: 393, height } },
      });
    const fittedWidth = () =>
      StyleSheet.flatten(ui.getByTestId('house-frame-viewport').props.style).maxWidth;
    await layout(393, 852);
    await header(84);
    const originalWidth = fittedWidth();
    await header(120);
    expect(fittedWidth()).toBeLessThan(originalWidth);
    await layout(393, 1100);
    expect(fittedWidth()).toBe(393);
    await layout(852, 393);
    expect(fittedWidth()).toBeUndefined();
  });

  it.each(['pending', 'empty'])(
    'keeps the pager unlocked while zoomed and when the camera is replaced by %s content (#1347)',
    async (destination) => {
      const onPagerLockChange = jest.fn();
      const ui = await render(
        <HouseScreen houses={[MISSION_HOUSE]} onPagerLockChange={onPagerLockChange} />,
      );
      const camera = getByGestureTestId('house-camera-pan') as PanGesture;
      const manager = {
        handlerTag: camera.handlerTag,
        begin: jest.fn(),
        activate: jest.fn(),
        fail: jest.fn(),
        end: jest.fn(),
      };
      const touches = (distance: number) => {
        const allTouches = [100, 100 + distance].map((x, id) => ({
          id,
          x,
          y: 100,
          absoluteX: x,
          absoluteY: 100,
        }));
        return {
          handlerTag: camera.handlerTag,
          state: State.BEGAN,
          eventType: 2 as const,
          numberOfTouches: 2,
          pointerType: PointerType.TOUCH,
          allTouches,
          changedTouches: allTouches,
        };
      };
      await act(async () => {
        camera.handlers.onTouchesDown?.(touches(100), manager);
        camera.handlers.onTouchesMove?.(touches(100), manager);
        camera.handlers.onTouchesMove?.(touches(160), manager);
      });
      // 확대만으로는 탭 페이저를 잠그지 않는다 — 캔버스 위 가로 이동은 카메라가 먼저 가져간다.
      expect(onPagerLockChange).not.toHaveBeenCalledWith(true);
      expect(ui.getByLabelText('확대 종료')).toBeTruthy();
      await ui.rerender(
        <HouseScreen
          houses={destination === 'empty' ? [] : [MISSION_HOUSE]}
          pendingHouses={destination === 'pending' ? [{ requestId: 1, name: '대기 집' }] : []}
          houseIndex={destination === 'pending' ? 1 : 0}
          onPagerLockChange={onPagerLockChange}
        />,
      );
      expect(ui.queryByLabelText('확대 종료')).toBeNull();
      expect(onPagerLockChange).toHaveBeenLastCalledWith(false);
    },
  );

  it('releases the pager lock when leaving during a seat lift', async () => {
    const onPagerLockChange = jest.fn();
    const ui = await render(
      <HouseScreen houses={[MISSION_HOUSE]} onPagerLockChange={onPagerLockChange} />,
    );
    await fireEvent(ui.getByLabelText('친구'), 'longPress');
    expect(onPagerLockChange).toHaveBeenLastCalledWith(true);
    await ui.unmount();
    expect(onPagerLockChange).toHaveBeenLastCalledWith(false);
  });

  it('shows vacant capacity seats as quiet tiles, excluded from member management', async () => {
    const onVisitFriend = jest.fn();
    const house = {
      ...MISSION_HOUSE,
      floors: [
        {
          level: '2층',
          rooms: [
            { name: '빈방', color: 'transparent', vacant: true },
            { name: '빈방', color: 'transparent', vacant: true },
          ],
        },
        ...MISSION_HOUSE.floors,
      ],
    };
    const { getAllByLabelText, queryAllByText, queryAllByTestId } = await render(
      <HouseScreen houses={[house]} onVisitFriend={onVisitFriend} />,
    );
    // 정원 4 / 멤버 2 → 빈 좌석은 캐릭터 없는 빈 방으로, 텍스트 라벨 없이 (#281).
    expect(queryAllByTestId('vacant-room')).toHaveLength(2);
    expect(queryAllByText('빈방')).toHaveLength(0);
    // 접근성 라벨은 유지 — 탭은 불가.
    await fireEvent.press(getAllByLabelText('빈방')[0]);
    expect(onVisitFriend).not.toHaveBeenCalled();
    // (구성원 관리의 빈 좌석 제외는 manageableMembers 파생 — members 테스트에서 단언.)
  });

  it('odd capacity fills the windows and leaves the extra window as a quiet panel', async () => {
    const house = {
      ...MISSION_HOUSE,
      maxMembers: 3,
      floors: [
        { level: '2층', rooms: [{ name: '빈방', color: 'transparent', vacant: true }] },
        ...MISSION_HOUSE.floors,
      ],
    };
    const { getAllByTestId, queryByText } = await render(<HouseScreen houses={[house]} />);
    // 기본 프레임이 항상 켜지므로(커버 없음 → 기본 커버) 정원 3은 창문 3칸을
    // 쓰고, 정원 밖 남는 1칸은 조용한 벽 패널로 남는다.
    expect(getAllByTestId('window-filler')).toHaveLength(1);
    // 빈 좌석은 텍스트 라벨 없이 빈 방 비주얼만.
    expect(queryByText('빈방')).toBeNull();
  });

  it('locks scrolling while a tile is lifted for drag (#278)', async () => {
    const { getByLabelText, getByTestId } = await render(<HouseScreen houses={[MISSION_HOUSE]} />);
    expect(getByTestId('house-scroll').props.scrollEnabled).toBe(true);
    // Long-press lifts the tile: the grid owns the touch, so the scroll locks.
    await fireEvent(getByLabelText('친구'), 'longPress');
    expect(getByTestId('house-scroll').props.scrollEnabled).toBe(false);
  });

  // 확대 중 탭 방문 (#669) — 탭 지터(슬롭 이내)는 카메라가 가져가지 않아야
  // Pressable의 방 탭(방문)이 산다. 실제 팬(슬롭 초과)·핀치는 카메라 몫.
  it('확대 중 캔버스 가로 이동은 카메라가 페이저보다 먼저 잡는다 — 슬롭 순서가 잠금을 대신한다 (#1347)', () => {
    // 확대만으로는 페이저를 잠그지 않으므로, 카메라 슬롭이 페이저 클레임보다 작아야
    // 캔버스 위 드래그가 탭 전환이 아니라 카메라 이동이 된다.
    expect(CAM_PAN_SLOP).toBeLessThan(SWIPE_CLAIM_DX);
    const between = (CAM_PAN_SLOP + SWIPE_CLAIM_DX) / 2;
    expect(cameraClaimsMove(1, true, false, between, 0)).toBe(true);
    // 비확대 한 손가락 가로 이동은 카메라가 안 잡는다 → 그대로 탭 스와이프.
    expect(cameraClaimsMove(1, false, false, SWIPE_CLAIM_DX + 1, 0)).toBe(false);
  });

  it('cameraClaimsMove: 탭 지터는 통과, 실제 팬·핀치만 캡처한다 (#669)', () => {
    expect(cameraClaimsMove(1, true, false, 2, 2)).toBe(false); // 확대 중 탭 지터
    expect(cameraClaimsMove(1, true, false, 0, 20)).toBe(true); // 확대 중 실제 팬
    expect(cameraClaimsMove(1, false, false, 0, 20)).toBe(false); // 원배율 한 손가락
    expect(cameraClaimsMove(2, false, false, 0, 0)).toBe(true); // 핀치는 즉시
    expect(cameraClaimsMove(2, true, true, 0, 20)).toBe(false); // 자리 드래그 중 양보
  });

  /**
   * 확대 = 방 구경 모드 (#665) — 이름/접속 라벨은 카메라 배율에 묶인 페이드를
   * 갖는다. 종전엔 RN Animated가 현재값으로 평탄화돼 `opacity === 1`을 볼 수
   * 있었지만, Reanimated의 jest mock은 `useAnimatedStyle`을 평가하지 않고 빈
   * 객체를 돌려준다 (#776) — **값은 여기서 확인할 수 없다.** 곡선 자체는
   * `house/__tests__/camera.test.ts`의 seatMetaOpacityFor가 단언하고, 여기서는
   * 라벨이 애니메이션 스타일 슬롯을 달고 렌더되는 배선만 지킨다.
   */

  it('자리 라벨이 카메라 페이드 스타일 슬롯을 달고 렌더된다 (#665 → #776)', async () => {
    const { getByTestId } = await render(<HouseScreen houses={[MISSION_HOUSE]} />);
    const style = getByTestId('seat-meta-0').props.style;
    expect(Array.isArray(style)).toBe(true);
    // [정적 roomMeta, preview 오버레이(없으면 null), 애니메이션 스타일]
    expect(style).toHaveLength(3);
    expect(StyleSheet.flatten(style).alignItems).toBe('center');
  });
});
