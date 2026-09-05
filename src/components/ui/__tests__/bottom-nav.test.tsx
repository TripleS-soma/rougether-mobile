import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { BottomNav } from '@/components/ui/bottom-nav';
import { Themes } from '@/constants/theme';
import { scrubTarget } from '@/components/ui/use-bottom-nav-scrub';

const FRAMES = [
  { x: 8, width: 90 },
  { x: 106, width: 60 },
  { x: 174, width: 76 },
];

async function measureNav(ui: Awaited<ReturnType<typeof render>>) {
  await act(async () => {
    fireEvent(ui.getByTestId('bottom-nav-track'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 258, height: 64 } },
    });
    ['myRoom', 'house', 'settings'].forEach((key, i) => {
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
    expect(onChange.mock.calls).toEqual([['settings']]);
  });

  it('can scrub back and uses the latest callback without replacing the gesture', async () => {
    const previous = jest.fn();
    const current = jest.fn();
    const ui = await render(<BottomNav active="myRoom" onChange={previous} />);
    await measureNav(ui);
    const gesture = getByGestureTestId('bottom-nav-scrub');
    await ui.rerender(<BottomNav active="settings" onChange={current} />);
    expect(getByGestureTestId('bottom-nav-scrub')).toBe(gesture);
    await scrub(30);
    expect(current.mock.calls).toEqual([['myRoom']]);
    expect(previous).not.toHaveBeenCalled();
  });

  it('does not navigate on cancellation, vertical escape, or release on the active tab', async () => {
    const onChange = jest.fn();
    const ui = await render(<BottomNav active="house" onChange={onChange} />);
    await measureNav(ui);
    await scrub(210, 30, State.CANCELLED);
    await scrub(210, -60);
    await scrub(210, 140);
    await scrub(136);
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
    expect(onChange.mock.calls).toEqual([['settings'], ['myRoom']]);
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
    expect(getByText('집')).toBeTruthy();
    expect(getByText('설정')).toBeTruthy();

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
    expect(colors).toHaveLength(3);
    expect(colors.filter((c) => c === Themes.cozy.primary)).toHaveLength(1); // 활성 탭
    expect(colors.filter((c) => c === Themes.cozy.icon)).toHaveLength(2); // 비활성 탭
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
      expect(getByText('설정')).toBeTruthy();
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
    expect([-30, 90, 100, 150, 175, 900].map((x) => scrubTarget(x, FRAMES))).toEqual([
      0, 0, 1, 1, 2, 2,
    ]);
  });
  it('rejects missing measurements and invalid coordinates', () => {
    expect(scrubTarget(50, [])).toBe(-1);
    expect(scrubTarget(50, [{ x: 0, width: 0 }, ...FRAMES.slice(1)])).toBe(-1);
    expect(scrubTarget(Number.NaN, FRAMES)).toBe(-1);
  });
});
