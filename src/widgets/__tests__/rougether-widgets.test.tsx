import { MyRoomWidget } from '@/widgets/rougether-widgets';
import { DarkThemes, Themes } from '@/constants/theme';

type Node = {
  props?: { style?: Record<string, unknown>; image?: string };
  children?: Node[] | Node | null;
};

const summary = { done: 5, total: 5, streak: 1, remaining: [] };

/** 위젯 트리는 React 렌더러 없이 평가되므로 엘리먼트를 직접 훑는다. */
const walk = (node: unknown, hit: (n: Node) => boolean): Node | null => {
  if (!node || typeof node !== 'object') return null;
  const n = node as Node & { props?: { children?: unknown } };
  if (n.props && hit(n)) return n;
  const kids = (n.props as { children?: unknown } | undefined)?.children;
  for (const c of Array.isArray(kids) ? kids : [kids]) {
    const found = walk(c, hit);
    if (found) return found;
  }
  return null;
};

describe('MyRoomWidget 색 (#778)', () => {
  it('방 이미지 칸 배경이 하단 바와 같은 surface — 레터박스가 검게 보이지 않게', () => {
    const tree = MyRoomWidget({ summary, roomImage: 'data:image/jpeg;base64,AAAA', dark: false });
    const imageBox = walk(tree, (n) => !!n.props?.style?.flex && !!n.props?.style?.borderRadius);
    expect(imageBox?.props?.style?.backgroundColor).toBe(Themes.cozy.surface);
  });

  it('다크에서도 같은 규칙 — 껍데기 surface를 따른다', () => {
    const tree = MyRoomWidget({ summary, roomImage: 'data:image/jpeg;base64,AAAA', dark: true });
    const imageBox = walk(tree, (n) => !!n.props?.style?.flex && !!n.props?.style?.borderRadius);
    expect(imageBox?.props?.style?.backgroundColor).toBe(DarkThemes.cozy.surface);
  });
});
