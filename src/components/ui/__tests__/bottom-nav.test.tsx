import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { BottomNav } from '@/components/ui/bottom-nav';
import { Themes } from '@/constants/theme';

afterEach(() => {
  jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
});

describe('BottomNav', () => {
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
