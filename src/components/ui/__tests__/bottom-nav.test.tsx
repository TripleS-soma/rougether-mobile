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

  describe('리퀴드 글래스 (#1049)', () => {
    it('글래스가 불가하면 종전 불투명 바 — 알약 오버레이가 없다', async () => {
      const { queryByTestId, getByText } = await render(
        <BottomNav active="myRoom" onChange={() => {}} />,
      );
      expect(queryByTestId('bottom-nav-glass')).toBeNull();
      expect(getByText('설정')).toBeTruthy();
    });

    it('글래스가 가능하면 떠 있는 알약으로 그리고 탭 전환은 그대로 동작한다', async () => {
      jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
      const onChange = jest.fn();
      const { getByTestId, getByText } = await render(
        <BottomNav active="myRoom" onChange={onChange} />,
      );
      const wrap = getByTestId('bottom-nav-glass');
      // 오버레이 — 레이아웃 높이를 차지하지 않고 바닥에 붙는다.
      const flat = Object.assign({}, ...[wrap.props.style].flat(Infinity));
      expect(flat.position).toBe('absolute');
      expect(flat.bottom).toBeGreaterThan(0);
      fireEvent.press(getByText('집'));
      expect(onChange).toHaveBeenCalledWith('house');
    });

    it('투명도 줄이기가 켜져 있으면 글래스가 가능해도 불투명 바로 돌아간다', async () => {
      jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
      const spy = jest
        .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
        .mockResolvedValue(true);
      const { queryByTestId } = await render(<BottomNav active="myRoom" onChange={() => {}} />);
      await waitFor(() => expect(queryByTestId('bottom-nav-glass')).toBeNull());
      spy.mockRestore();
    });
  });
});
