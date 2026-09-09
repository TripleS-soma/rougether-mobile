import { render } from '@testing-library/react-native';

import { flattenStyle } from '@/test-utils/style';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';
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
    expect(ui.getByText('이 날의 할 일')).toBeTruthy();
  });
});
