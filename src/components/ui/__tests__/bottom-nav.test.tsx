import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { BottomNav } from '@/components/ui/bottom-nav';
import { Themes } from '@/constants/theme';
import { scrubTarget } from '@/components/ui/use-bottom-nav-scrub';

// 4탭 (#1138): 나의 방 · 달력 · 집 · 마이페이지 — 중심 53 · 136 · 212 · 298.
const FRAMES = [
  { x: 8, width: 90 },
  { x: 106, width: 60 },
  { x: 174, width: 76 },
  { x: 258, width: 80 },
];
// scrubTarget 단위 테스트용 3탭 프레임(#1080 당시 기하).
const FRAMES3 = FRAMES.slice(0, 3);

async function measureNav(ui: Awaited<ReturnType<typeof render>>) {
  await act(async () => {
    fireEvent(ui.getByTestId('bottom-nav-track'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 346, height: 64 } },
    });
    ['myRoom', 'calendar', 'house', 'myPage'].forEach((key, i) => {
      fireEvent(ui.getByTestId(`bottom-nav-tab-${key}`), 'layout', {
        nativeEvent: { layout: { ...FRAMES[i], y: 8, height: 48 } },
      });
    });
  });
}

async function scrub(x: number, y = 30, end: (typeof State)[keyof typeof State] = State.END) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('bottom-nav-scrub'), [
      { state: State.BEGAN, x: 50, y: 30 },
      { state: State.ACTIVE, x: 65, y: 30 },
      { state: State.ACTIVE, x, y },
      { state: end, x, y },
    ]);
  });
}

afterEach(() => {
  jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
});

describe('BottomNav', () => {
  it('commits only the release target, skipping intermediate tabs', async () => {
    const onChange = jest.fn();
    const ui = await render(<BottomNav active="myRoom" onChange={onChange} />);
    await measureNav(ui);
    await scrub(210);
    expect(onChange.mock.calls).toEqual([['house']]);
  });

  it('can scrub back and uses the latest callback without replacing the gesture', async () => {
    const previous = jest.fn();
    const current = jest.fn();
    const ui = await render(<BottomNav active="myRoom" onChange={previous} />);
    await measureNav(ui);
    const gesture = getByGestureTestId('bottom-nav-scrub');
    await ui.rerender(<BottomNav active="myPage" onChange={current} />);
    expect(getByGestureTestId('bottom-nav-scrub')).toBe(gesture);
    await scrub(30);
    expect(current.mock.calls).toEqual([['myRoom']]);
    expect(previous).not.toHaveBeenCalled();
  });

  it('does not navigate on cancellation, vertical escape, or release on the active tab', async () => {
    const onChange = jest.fn();
    const ui = await render(<BottomNav active="house" onChange={onChange} />);
    await measureNav(ui);
    await scrub(212, 30, State.CANCELLED);
    await scrub(212, -60);
    await scrub(212, 140);
    await scrub(212);
    expect(onChange).not.toHaveBeenCalled();
    expect(ui.getByRole('button', { name: '집' }).props.accessibilityState.selected).toBe(true);
  });

  it('clamps horizontal overshoot and ignores gestures before measurement', async () => {
    const onChange = jest.fn();
    const ui = await render(<BottomNav active="house" onChange={onChange} />);
    await scrub(300);
    expect(onChange).not.toHaveBeenCalled();
    await measureNav(ui);
    await scrub(600);
    await scrub(-300);
    expect(onChange.mock.calls).toEqual([['myPage'], ['myRoom']]);
  });

  it('leaves a failed vertical gesture to scrolling and preserves normal taps', async () => {
    const onChange = jest.fn();
    const ui = await render(<BottomNav active="myRoom" onChange={onChange} />);
    await measureNav(ui);
    await act(async () => {
      fireGestureHandler(getByGestureTestId('bottom-nav-scrub'), [
        { state: State.BEGAN, x: 136, y: 30 },
        { state: State.FAILED, x: 136, y: 80 },
      ]);
    });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(ui.getByRole('button', { name: '집' }));
    expect(onChange.mock.calls).toEqual([['house']]);
  });
  it('renders the tabs and fires onChange with the selected tab', async () => {
    const onChange = jest.fn();
    const { getByText } = await render(<BottomNav active="myRoom" onChange={onChange} />);
    expect(getByText('나의 방')).toBeTruthy();
    expect(getByText('달력')).toBeTruthy(); // #1138
    expect(getByText('집')).toBeTruthy();
    expect(getByText('마이페이지')).toBeTruthy();

    fireEvent.press(getByText('집'));
    expect(onChange).toHaveBeenCalledWith('house');
  });

  it('아이콘 색이 테마 토큰을 따른다 — 활성 primary/비활성 icon (#529)', async () => {
    const ui = await render(<BottomNav active="house" onChange={() => {}} />);
    // SVG는 jest 목('SvgMock' 호스트 요소)이 props를 보존한다 — color 배선 검증.
    type Node = { type?: string; props?: { color?: string }; children?: Node[] | null };
    const colors: (string | undefined)[] = [];
    const walk = (n: Node | string | null) => {
      if (!n || typeof n === 'string') return;
      if (n.type === 'SvgMock') colors.push(n.props?.color);
      (n.children ?? []).forEach(walk);
    };
    const tree = ui.toJSON();
    (Array.isArray(tree) ? tree : [tree]).forEach((n) => walk(n as Node));
    expect(colors).toHaveLength(4);
    expect(colors.filter((c) => c === Themes.cozy.primary)).toHaveLength(1); // 활성 탭
    expect(colors.filter((c) => c === Themes.cozy.icon)).toHaveLength(3); // 비활성 탭
  });

  it('badges — 해당 탭 아이콘에 점, 없으면 안 그린다 (#1089)', async () => {
    const ui = await render(<BottomNav active="myRoom" onChange={() => {}} />);
    expect(ui.queryByTestId('bottom-nav-badge')).toBeNull();
    await ui.rerender(<BottomNav active="myRoom" onChange={() => {}} badges={{ myPage: true }} />);
    expect(ui.getAllByTestId('bottom-nav-badge')).toHaveLength(1);
    expect(ui.getByLabelText('마이페이지').props.accessibilityHint).toBe('오늘 미출석');
  });

  describe('떠 있는 알약 (#1049 → #1074 전 플랫폼)', () => {
    it('글래스가 불가해도 알약 오버레이다 — 레이아웃 높이 없이 바닥에 뜬다', async () => {
      const { getByTestId, getByText } = await render(
        <BottomNav active="myRoom" onChange={() => {}} />,
      );
      const flat = Object.assign(
        {},
        ...[getByTestId('bottom-nav-pill').props.style].flat(Infinity),
      );
      expect(flat.position).toBe('absolute');
      expect(flat.bottom).toBeGreaterThan(0);
      expect(getByText('마이페이지')).toBeTruthy();
    });

    it('글래스가 가능해도 같은 알약 — 탭 전환은 그대로 동작한다', async () => {
      jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
      const onChange = jest.fn();
      const { getByTestId, getByText } = await render(
        <BottomNav active="myRoom" onChange={onChange} />,
      );
      expect(getByTestId('bottom-nav-pill')).toBeTruthy();
      fireEvent.press(getByText('집'));
      expect(onChange).toHaveBeenCalledWith('house');
    });

    it('투명도 줄이기가 켜져 있어도 알약은 남고 면만 불투명이 된다', async () => {
      jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
      const spy = jest
        .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
        .mockResolvedValue(true);
      const { getByTestId } = await render(<BottomNav active="myRoom" onChange={() => {}} />);
      await waitFor(() => expect(getByTestId('bottom-nav-pill')).toBeTruthy());
      spy.mockRestore();
    });
  });
});

describe('scrubTarget', () => {
  it('uses measured centers, including gaps and horizontal overshoot', () => {
    expect([-30, 90, 100, 150, 175, 900].map((x) => scrubTarget(x, FRAMES3, 3))).toEqual([
      0, 0, 1, 1, 2, 2,
    ]);
    // 4탭 (#1138): 마지막 경계 255 — 그 너머는 마이페이지.
    expect([230, 260, 900].map((x) => scrubTarget(x, FRAMES, 4))).toEqual([2, 3, 3]);
  });
  it('rejects missing measurements and invalid coordinates', () => {
    expect(scrubTarget(50, [], 3)).toBe(-1);
    expect(scrubTarget(50, [{ x: 0, width: 0 }, ...FRAMES3.slice(1)], 3)).toBe(-1);
    expect(scrubTarget(Number.NaN, FRAMES3, 3)).toBe(-1);
    // 탭 수와 프레임 수가 다르면(측정 미완료) -1.
    expect(scrubTarget(50, FRAMES3, 4)).toBe(-1);
  });
});
