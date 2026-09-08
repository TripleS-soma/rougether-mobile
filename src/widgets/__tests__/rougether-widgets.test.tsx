import { MyRoomWidget, TodayListWidget } from '@/widgets/rougether-widgets';
import { DarkThemes, Themes } from '@/constants/theme';

type Node = {
  props?: { style?: Record<string, unknown>; image?: string };
  children?: Node[] | Node | null;
};

const summary = { done: 5, total: 5, streak: 1, remaining: [] };

/** 위젯 트리는 React 렌더러 없이 평가되므로 엘리먼트를 직접 훑는다. */
const walk = (node: unknown, hit: (n: Node) => boolean): Node | null => {
  if (!node || typeof node !== 'object') return null;
  // `.map()` 결과는 children 안에 배열로 중첩된다 — 배열이면 원소를 순서대로 훑는다.
  if (Array.isArray(node)) {
    for (const c of node) {
      const found = walk(c, hit);
      if (found) return found;
    }
    return null;
  }
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

// 표정 문구 (#1122) — 렌더 분기: 평소엔 없음, 걱정·미접속은 목록 위 한 줄, 다 한 날은 목록 대신.
describe('TodayListWidget 표정 문구', () => {
  const texts = (tree: unknown) => {
    const out: string[] = [];
    walk(tree, (n) => {
      const text = (n.props as { text?: string } | undefined)?.text;
      if (typeof text === 'string') out.push(text);
      return false;
    });
    return out;
  };
  const colorOf = (tree: unknown, text: string) =>
    walk(tree, (n) => (n.props as { text?: string } | undefined)?.text === text)?.props?.style
      ?.color;

  it('평소 얼굴이면 문구 없이 남은 루틴만', () => {
    const tree = TodayListWidget({
      summary: { done: 1, total: 3, streak: 0, remaining: ['물', '독서'] },
      dark: false,
      mood: { face: 'neutral' },
    });
    expect(texts(tree)).toEqual(expect.arrayContaining(['물', '독서']));
    expect(texts(tree).some((s) => s.includes('남았어요'))).toBe(false);
  });

  it('걱정은 목록 위에 경고색 한 줄', () => {
    const tree = TodayListWidget({
      summary: { done: 1, total: 3, streak: 0, remaining: ['물', '독서'] },
      dark: false,
      mood: { face: 'worried', message: '아직 2개 남았어요' },
    });
    expect(colorOf(tree, '아직 2개 남았어요')).toBe(Themes.cozy.warningText);
    expect(texts(tree)).toEqual(expect.arrayContaining(['물']));
  });

  it('다 한 날은 축하 문구가 목록을 대신하고, 미접속이 우선이면 그 문구가 경고색으로 온다', () => {
    const done = { done: 3, total: 3, streak: 2, remaining: [] };
    const happy = TodayListWidget({
      summary: done,
      dark: false,
      mood: { face: 'happy', message: '오늘도 다 해냈어요!' },
    });
    expect(colorOf(happy, '오늘도 다 해냈어요!')).toBe(Themes.cozy.primaryText);
    const sad = TodayListWidget({
      summary: done,
      dark: false,
      mood: { face: 'sad', message: '2일째 못 봤어요, 보고 싶어요' },
    });
    expect(colorOf(sad, '2일째 못 봤어요, 보고 싶어요')).toBe(Themes.cozy.warningText);
    // 문구는 한 번만 — 위 줄과 목록 자리에 중복으로 찍히지 않는다.
    expect(texts(sad).filter((s) => s.includes('못 봤어요'))).toHaveLength(1);
  });
});
