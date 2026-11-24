import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { flattenStyle } from '@/test-utils/style';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { Spacing } from '@/constants/theme';
import { calendarHeading, NEIGHBOR_DAY, TODAY } from '@/test-utils/my-room-screen-fixtures';
import type { AppFrame } from '@/hooks/use-app-frame';

// 웹 데스크톱 2단 (#1230) — 프레임 판정만 바꿔 가며 배치를 본다.
let mockFrame: AppFrame = {
  width: 390,
  height: 844,
  scale: 2,
  fontScale: 1,
  framed: false,
  split: false,
};
// 화면이 앱 프레임에 등록하는 띠 배경을 붙잡아 따로 그려 본다.
let mockBackdrop: ReactNode = null;
jest.mock('@/components/app/frame-backdrop', () => ({
  useFrameBackdrop: (node: ReactNode) => {
    mockBackdrop = node;
  },
}));
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => mockFrame,
}));

const SPLIT: AppFrame = {
  width: 1200,
  height: 900,
  scale: 2,
  fontScale: 1,
  framed: true,
  split: true,
};

describe('MyRoomScreen 2단 레이아웃 (#1230)', () => {
  afterEach(() => {
    mockFrame = {
      ...mockFrame,
      split: false,
      splitFill: false,
      framed: false,
      width: 390,
      height: 844,
    };
  });

  it('폰·좁은 창은 한 스크롤에 방과 목록이 위아래로 — 2단 래퍼 없음', async () => {
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />);
    expect(ui.queryByTestId('my-room-split')).toBeNull();
    expect(ui.getByLabelText('메뉴')).toBeTruthy();
    // 폰은 종전대로 방 위 오버레이 세로 열.
    expect(flattenStyle(ui.getByTestId('room-actions').props.style).position).toBe('absolute');
    expect(ui.getByText('오늘의 할 일')).toBeTruthy();
  });

  it('2단이면 방 캔버스(메뉴 버튼 포함)와 할 일 목록이 좌우 칸에 함께 그려진다', async () => {
    mockFrame = SPLIT;
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />);
    expect(ui.getByTestId('my-room-split')).toBeTruthy();
    expect(ui.getByLabelText('메뉴')).toBeTruthy();
    expect(ui.getByLabelText('뽑기 상점')).toBeTruthy();
    expect(ui.getByText('오늘의 할 일')).toBeTruthy();
    // 왼쪽 칸은 세로 가운데 고정 — 목록이 길어도 방은 제자리.
    const heroContent = flattenStyle(
      ui.getByTestId('my-room-split-hero').props.contentContainerStyle,
    );
    expect(heroContent.justifyContent).toBe('center');
    expect(heroContent.flexGrow).toBe(1);
    // 버튼은 방 위 오버레이가 아니라 방 아래 한 줄.
    const actions = flattenStyle(ui.getByTestId('room-actions').props.style);
    expect(actions.flexDirection).toBe('row');
    expect(actions.position).toBeUndefined();
    expect(ui.getByText(SAMPLE_ROUTINES[0].title)).toBeTruthy();
  });

  it('2단 달력 탭은 왼쪽 달력, 오른쪽 그 날의 할 일', async () => {
    mockFrame = SPLIT;
    const ui = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} view="calendar" onSelectDate={jest.fn()} />,
    );
    expect(ui.getByTestId('my-room-split')).toBeTruthy();
    expect(ui.getByTestId('calendar-grid')).toBeTruthy();
    expect(ui.getByRole('header', { name: calendarHeading(TODAY) })).toBeTruthy();
  });

  // 터치 기기의 2단(펼친 폴더블·태블릿)은 두 칸이 1:1로 창을 다 쓴다 — 가운데 블록·틈 없음.
  it.each(['room', 'calendar'] as const)(
    '창을 다 쓰는 2단(%s)은 두 칸이 같은 비율로 나란히, 틈·고정 폭 없이',
    async (view) => {
      mockFrame = { ...SPLIT, width: 867, height: 669, splitFill: true };
      const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view={view} />);
      const row = flattenStyle(ui.getByTestId('my-room-split').props.style);
      expect(row.flexDirection).toBe('row');
      expect(row.gap).toBe(0);
      for (const id of ['my-room-split-hero', 'my-room-split-list']) {
        const pane = flattenStyle(ui.getByTestId(id).props.style);
        expect(pane.flex).toBe(1);
        expect(pane.width).toBeUndefined();
      }
    },
  );

  // 펼친 아이폰 Duo(951×669, 안전 영역 위 82): 시스템 표시는 오른쪽 위 모서리에만 있다. 왼쪽 칸은
  // 그 밑이 아니라 위 인셋을 비우지 않고, 방은 칸 높이(탭 바 위)에 버튼 줄까지 들어가게 맞춘다.
  it('창을 다 쓰는 2단의 왼쪽 칸은 위 안전 영역을 비우지 않고, 방을 칸 높이에 맞춘다', async () => {
    mockFrame = { ...SPLIT, width: 951, height: 669, splitFill: true };
    const insets = { top: 82, right: 0, bottom: 34, left: 0 };
    const ui = await render(
      <SafeAreaInsetsContext.Provider value={insets}>
        <MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />
      </SafeAreaInsetsContext.Provider>,
    );
    const hero = flattenStyle(ui.getByTestId('my-room-split-hero').props.contentContainerStyle);
    expect(hero.paddingTop).toBe(Spacing.four);
    // 방 높이 + 버튼 줄(44 + 16)이 위 여백과 아래(여백 + 탭 바) 사이에 들어가는 폭.
    const wrap = flattenStyle(ui.getByTestId('my-room-hero-wrap').props.style);
    const available = 669 - Spacing.four - Number(hero.paddingBottom) - (44 + Spacing.three);
    expect(wrap.maxWidth).toBeCloseTo(available * (5 / 6), 3);
    expect(wrap.alignSelf).toBe('center');
    // 오른쪽 칸(목록)은 모서리의 시스템 표시 밑이라 위 인셋을 지킨다.
    const list = flattenStyle(ui.getByTestId('my-room-scroll').props.contentContainerStyle);
    expect(list.paddingTop).toBe(82 + Spacing.four);
  });

  // 좁은 2단(세로로 펼친 폴드 704×932 — 칸 폭 352): 버튼 6개가 한 줄(376)에 안 들어가 양끝이
  // 잘렸다(안드로이드 에뮬레이터 실측). 칸이 좁으면 폰처럼 방 위에 세로 열로 얹는다.
  it('칸이 좁아 버튼 한 줄이 안 들어가면 폰처럼 방 위 세로 열로 둔다', async () => {
    mockFrame = { ...SPLIT, width: 704, height: 932, splitFill: true };
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />);
    const actions = flattenStyle(ui.getByTestId('room-actions').props.style);
    expect(actions.position).toBe('absolute');
    expect(actions.flexDirection).toBeUndefined();
    // 버튼 줄 자리를 따로 떼지 않는다 — 방이 칸 높이를 그만큼 더 쓴다.
    const hero = flattenStyle(ui.getByTestId('my-room-split-hero').props.contentContainerStyle);
    const wrap = flattenStyle(ui.getByTestId('my-room-hero-wrap').props.style);
    expect(wrap.maxWidth).toBeCloseTo(
      (932 - Spacing.four - Number(hero.paddingBottom)) * (5 / 6),
      3,
    );
  });

  it('칸이 넉넉하면(펼친 아이폰 Duo, 세로 탭 줄 포함) 버튼은 방 아래 한 줄', async () => {
    mockFrame = { ...SPLIT, width: 951, height: 669, splitFill: true, navRail: true };
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />);
    expect(flattenStyle(ui.getByTestId('room-actions').props.style).flexDirection).toBe('row');
  });

  it('마우스 웹의 2단은 방 폭을 높이에 맞추지 않는다(종전)', async () => {
    mockFrame = SPLIT;
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />);
    expect(flattenStyle(ui.getByTestId('my-room-hero-wrap').props.style).maxWidth).toBeUndefined();
  });

  // 앱의 달력 탭은 월 달력만 보이고 날짜를 누르면 주간 보기로 넘어간다(onOpenDay, #1327).
  // 2단에서는 오른쪽 칸이 그날 할 일 자리라, 넘어가지 않고 그 칸에 보여 준다 — 안 그러면 칸이 빈다.
  it('2단 달력은 onOpenDay가 있어도 오른쪽 칸에 그날 할 일을 보이고, 날짜 탭은 선택만 한다', async () => {
    mockFrame = { ...SPLIT, width: 951, height: 669, splitFill: true };
    const onOpenDay = jest.fn();
    const onSelectedDateChange = jest.fn();
    const ui = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        view="calendar"
        onOpenDay={onOpenDay}
        onSelectedDateChange={onSelectedDateChange}
        selectedDate={TODAY}
      />,
    );
    expect(ui.getByRole('header', { name: calendarHeading(TODAY) })).toBeTruthy();
    await fireEvent.press(ui.getByLabelText(new RegExp(`^${NEIGHBOR_DAY}(?:,|$)`)));
    expect(onSelectedDateChange).toHaveBeenLastCalledWith(NEIGHBOR_DAY);
    expect(onOpenDay).not.toHaveBeenCalled();
  });

  it('마우스 웹의 2단은 종전대로 폰 폭 칸 + 목록 칸을 가운데에', async () => {
    mockFrame = SPLIT;
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />);
    expect(flattenStyle(ui.getByTestId('my-room-split').props.style).justifyContent).toBe('center');
    expect(flattenStyle(ui.getByTestId('my-room-split-hero').props.style).width).toBe(480);
  });

  it('2단 방에서도 같은 미니게임 버튼으로 허브를 연다', async () => {
    mockFrame = SPLIT;
    const onOpenMinigames = jest.fn();
    const ui = await render(<MyRoomScreen view="room" onOpenMinigames={onOpenMinigames} />);
    await fireEvent.press(ui.getByRole('button', { name: '미니게임' }));
    expect(onOpenMinigames).toHaveBeenCalledTimes(1);
  });
});

// 넓고 짧은 화면(접힌 아이폰 Duo — 안전 영역을 뺀 382×678): 방이 폭을 다 쓰면 높이 458로
// 화면의 2/3를 먹어 할 일이 첫 화면 밖으로 밀린다. 방 높이를 화면 절반에 맞추고 양옆은
// 같은 벽지·바닥 그림으로 채운다. 일반 폰은 그대로.
describe('MyRoomScreen 짧은 화면', () => {
  afterEach(() => {
    mockFrame = { ...mockFrame, split: false, framed: false, width: 390, height: 844 };
  });

  it('짧은 화면이면 방을 화면 높이 절반에 맞춰 가운데 그리고 양옆을 채운다', async () => {
    mockFrame = { ...mockFrame, width: 382, height: 678 };
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />);
    expect(ui.getByTestId('room-backdrop')).toBeTruthy();
    const box = flattenStyle(ui.getByTestId('my-room-hero-room').props.style);
    expect(box.width).toBeCloseTo(339 * (5 / 6), 3);
    expect(box.alignSelf).toBe('center');
  });

  it('일반 폰은 방이 폭을 다 쓰고 양옆 채움이 없다', async () => {
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />);
    expect(ui.queryByTestId('room-backdrop')).toBeNull();
    expect(flattenStyle(ui.getByTestId('my-room-hero-room').props.style).width).toBeUndefined();
  });

  // 시스템 표시 띠(오른쪽 84pt)의 방 채움은 스크롤 위치만큼 올라가 있어야 방과 높이가 맞는다.
  const stripOffset = () => {
    const { style } = (mockBackdrop as ReactElement<{ style: { transform: unknown[] } }>).props;
    const [{ translateY }] = style.transform as { translateY: { __getValue(): number } }[];
    return translateY.__getValue();
  };

  it('띠의 방 채움은 복원된 스크롤 위치에서 시작하고, 띠가 없던 동안의 스크롤도 따라간다', async () => {
    mockFrame = { ...mockFrame, width: 382, height: 678, insetRight: 84 };
    const ui = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} view="room" getInitialScrollY={() => 120} />,
    );
    expect(stripOffset()).toBe(-120);
    await fireEvent.scroll(ui.getByTestId('my-room-scroll'), {
      nativeEvent: { contentOffset: { x: 0, y: 40 } },
    });
    expect(stripOffset()).toBe(-40);
  });

  it('가로 인셋이 없으면 띠 배경을 등록하지 않는다', async () => {
    mockFrame = { ...mockFrame, width: 382, height: 678, insetRight: 0 };
    await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="room" />);
    expect(mockBackdrop).toBeNull();
  });
});
