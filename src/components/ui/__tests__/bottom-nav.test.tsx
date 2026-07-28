import { fireEvent, render } from '@testing-library/react-native';

import { BottomNav } from '@/components/ui/bottom-nav';
import { Themes } from '@/constants/theme';

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
});
