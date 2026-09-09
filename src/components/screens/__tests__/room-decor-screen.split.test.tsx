import { render } from '@testing-library/react-native';

import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import type { AppFrame } from '@/hooks/use-app-frame';

// 웹 데스크톱 2단 (#1230 후속) — 프레임 판정만 바꿔 가며 배치를 본다.
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

describe('RoomDecorScreen 2단 레이아웃', () => {
  afterEach(() => {
    mockFrame = { ...mockFrame, split: false, framed: false, width: 390 };
  });

  it('폰·좁은 창은 한 스크롤 — 2단 래퍼 없음', async () => {
    const ui = await render(<RoomDecorScreen />);
    expect(ui.queryByTestId('decor-split')).toBeNull();
    expect(ui.getByTestId('decor-canvas')).toBeTruthy();
    expect(ui.getByText('적용하기')).toBeTruthy();
  });

  it('2단이면 왼쪽 캔버스와 오른쪽 카탈로그가 함께 그려지고 적용하기는 블록 폭에 맞춘다', async () => {
    mockFrame = { width: 1200, height: 900, scale: 2, fontScale: 1, framed: true, split: true };
    const ui = await render(<RoomDecorScreen />);
    expect(ui.getByTestId('decor-split')).toBeTruthy();
    expect(ui.getByTestId('decor-canvas')).toBeTruthy();
    expect(ui.getByText('가구')).toBeTruthy();
    expect(ui.getByLabelText('적용하기')).toBeTruthy();
  });
});
