import { fireEvent, render } from '@testing-library/react-native';

import { flattenStyle } from '@/test-utils/style';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { calendarHeading, TODAY } from '@/test-utils/my-room-screen-fixtures';
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
    mockFrame = { ...mockFrame, split: false, framed: false, width: 390 };
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
});
