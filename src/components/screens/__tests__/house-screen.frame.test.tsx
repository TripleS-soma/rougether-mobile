import { act, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { type PanGesture, PointerType, State } from 'react-native-gesture-handler';
import { cameraClaimsMove, HouseScreen } from '@/components/screens/house-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DEFAULT_HOUSE_COVER_KEY, resolveHouseFrame } from '@/resources/house-frame';
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

// Explicit rollback-renderer coverage. The default shared renderer has its own integration suite.
beforeEach(() => {
  process.env.EXPO_PUBLIC_HOUSE_DIORAMA = '0';
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_HOUSE_DIORAMA;
});

// 넓고 짧은 화면(접힌 아이폰 Duo 382×678): 디오라마 집(2:3)이 폭을 다 쓰면 높이 573으로
// 아래층이 탭 바 뒤로 잘린다. 짧은 화면에서만 집을 머리 아래·탭 바 위 공간에 맞춘다.
describe('HouseScreen — 짧은 화면의 디오라마 집', () => {
  // 이 파일의 다른 테스트는 고전 프레임을 보려고 디오라마를 끈다 — 여기서는 켠다.
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_HOUSE_DIORAMA;
  });
  const DIORAMA_HOUSE = {
    ...MISSION_HOUSE,
    displayMode: 'DIORAMA' as const,
    coverImageKey: DEFAULT_HOUSE_COVER_KEY,
  };
  const layoutHouse = async (
    ui: Awaited<ReturnType<typeof render>>,
    width: number,
    height: number,
  ) => {
    await fireEvent(ui.getByTestId('house-scroll'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width, height } },
    });
    await fireEvent(ui.getByTestId('house-header-end'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 87, width, height: 0 } },
    });
    // 레벨·인원 알약 줄이 끝나는 곳 — 집은 그 아래부터 탭 바 위까지에 들어가야 한다.
    await fireEvent(ui.getByTestId('house-sky-spacer'), 'layout', {
      nativeEvent: { layout: { x: 0, y: PILLS_BOTTOM, width, height: 0 } },
    });
    return StyleSheet.flatten(ui.getByTestId('house-frame-viewport').props.style);
  };
  const PILLS_BOTTOM = 195;
  const NAV_INSET = 90; // 테스트 환경의 useBottomNavInset

  it('짧은 화면이면 집 전체가 머리 아래 남는 높이에 들어가게 폭을 줄인다', async () => {
    const ui = await render(<HouseScreen houses={[DIORAMA_HOUSE]} />);
    const style = await layoutHouse(ui, 382, 678);
    expect(style.maxWidth).toBeGreaterThan(0);
    expect(style.maxWidth).toBeLessThan(382);
    expect(style.alignSelf).toBe('center');
    // 2:3 그림의 높이가 알약 줄 아래·탭 바(+간격) 위에 들어간다.
    expect(style.maxWidth / (2 / 3)).toBeCloseTo(678 - PILLS_BOTTOM - NAV_INSET - Spacing.two, 3);
    // 탭바 밑 땅 띠가 간격만큼 길어져 스크롤이 화면 끝에서 정확히 끝난다.
    expect(StyleSheet.flatten(ui.getByTestId('diorama-ground').props.style).height).toBe(
      NAV_INSET + Spacing.two,
    );
  });

  it('일반 폰의 디오라마 집은 폭을 다 쓴다(종전과 같다)', async () => {
    const ui = await render(<HouseScreen houses={[DIORAMA_HOUSE]} />);
    const style = await layoutHouse(ui, 393, 852);
    expect(style.maxWidth).toBeUndefined();
  });

  // 맞춘 집은 방 한 칸이 87pt쯤이라(폰 145pt) 왕관·접속 점·'(나)'·'· 오래 전'까지 넣으면 이름이
  // 'Kinse…'·'R…'로 사라진다(실기기 확인). 이름표에는 이름만 남기고 나머지는 읽기 라벨로 넘긴다.
  const LABEL_HOUSE = {
    ...DIORAMA_HOUSE,
    floors: [
      {
        level: '1층',
        rooms: [
          { name: '친구', color: '#F5E1D8', membershipId: 42, lastSeenLabel: '오래 전' },
          { name: '나', color: '#E8E0D0', isMine: true, isOwner: true, membershipId: 43 },
        ],
      },
    ],
  };
  const meta = (ui: Awaited<ReturnType<typeof render>>, seat: number) =>
    within(ui.getByTestId(`seat-meta-${seat}`));
  const seatLabel = (ui: Awaited<ReturnType<typeof render>>, name: RegExp) =>
    ui.getByRole('button', { name }).props.accessibilityLabel as string;

  it('짧은 화면의 맞춘 집은 좌석 이름표에 이름만 — (나)·접속 시각은 읽기 라벨에만', async () => {
    const ui = await render(<HouseScreen houses={[LABEL_HOUSE]} userName="Kinsey" />);
    await layoutHouse(ui, 382, 678);
    expect(meta(ui, 0).getByText('친구')).toBeTruthy();
    expect(meta(ui, 0).queryByText(/오래 전/)).toBeNull();
    expect(meta(ui, 1).getByText('Kinsey')).toBeTruthy();
    expect(seatLabel(ui, /^친구/)).toBe('친구, 오래 전 접속');
    expect(seatLabel(ui, /^Kinsey/)).toContain('Kinsey (나)');
  });

  it('일반 폰은 이름표에 (나)·접속 시각을 그대로 둔다', async () => {
    const ui = await render(<HouseScreen houses={[LABEL_HOUSE]} userName="Kinsey" />);
    await layoutHouse(ui, 393, 852);
    expect(meta(ui, 0).getByText('· 오래 전')).toBeTruthy();
    expect(meta(ui, 1).getByText('Kinsey (나)')).toBeTruthy();
  });
});
