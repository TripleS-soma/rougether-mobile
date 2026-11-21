import { MyRoomWidget, roomNextLine, TodayListWidget } from '@/widgets/rougether-widgets';
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
  // 시안 C(#1633)부터 방 캡처가 껍데기를 채우고 판이 위에 겹친다 — 캡처가 칸 비율과 안 맞아
  // 생기는 레터박스는 겹침 껍데기의 배경이 보이므로, 그 배경이 surface여야 검게 안 보인다.
  const shell = (tree: unknown) => (tree as Node).props?.style;

  it('방 이미지 레터박스가 surface — 검게 보이지 않게', () => {
    const tree = MyRoomWidget({ summary, roomImage: 'data:image/jpeg;base64,AAAA', dark: false });
    expect(shell(tree)?.backgroundColor).toBe(Themes.cozy.surface);
  });

  it('다크에서도 같은 규칙 — 껍데기 surface를 따른다', () => {
    const tree = MyRoomWidget({ summary, roomImage: 'data:image/jpeg;base64,AAAA', dark: true });
    expect(shell(tree)?.backgroundColor).toBe(DarkThemes.cozy.surface);
  });
});

describe('MyRoomWidget 방 창문 판 (#1633)', () => {
  const textsOf = (tree: unknown) => {
    const out: string[] = [];
    walk(tree, (n) => {
      const text = (n.props as { text?: string } | undefined)?.text;
      if (typeof text === 'string') out.push(text);
      return false;
    });
    return out;
  };

  it('판에 진행·연속·다음 할 일이 방 그림 위에 겹친다', () => {
    const tree = MyRoomWidget({
      summary: { done: 2, total: 5, streak: 12, remaining: ['물 한 잔 마시기', '스트레칭'] },
      roomImage: 'data:image/jpeg;base64,AAAA',
      dark: false,
    });
    expect(textsOf(tree)).toEqual(
      expect.arrayContaining([' 2/5', '🔥 12일', '다음 · 물 한 잔 마시기']),
    );
    const panel = walk(tree, (n) =>
      String(n.props?.style?.backgroundColor ?? '').startsWith('rgba('),
    );
    expect(panel?.props?.style?.borderRadius).toBe(14);
  });

  it('다음 할 일 한 줄: 미접속·다 함 문구가 우선, 저녁 걱정엔 목록 첫 항목', () => {
    const base = { done: 2, total: 5, streak: 0, remaining: ['A', 'B'] };
    expect(roomNextLine(base, { face: 'worried', message: '아직 3개 남았어요' })).toBe('다음 · A');
    expect(roomNextLine(base, { face: 'sad', message: '3일째 못 봤어요' })).toBe('3일째 못 봤어요');
    expect(roomNextLine({ ...base, remaining: [] }, { face: 'happy', message: '다 했어요' })).toBe(
      '다 했어요',
    );
    expect(roomNextLine({ ...base, total: 0, remaining: [] }, { face: 'neutral' })).toBe(
      '오늘 예정된 루틴이 없어요',
    );
    expect(roomNextLine({ ...base, lang: 'en' }, { face: 'neutral' })).toBe('Next · A');
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

  // 위젯 고정 문구 (#893) — 요약 lang으로 고른다. 앱 언어(i18n 인스턴스)는 건드리지 않는다.
  it('요약 lang이 en이면 빈 날·완료·더보기·방 폴백·스트릭 문구가 영어', () => {
    const empty = TodayListWidget({
      summary: { done: 0, total: 0, streak: 0, remaining: [], lang: 'en' },
      dark: false,
    });
    expect(texts(empty)).toContain('No routines scheduled today');
    const allDone = TodayListWidget({
      summary: { done: 2, total: 2, streak: 0, remaining: [], lang: 'en' },
      dark: false,
    });
    expect(texts(allDone)).toContain('All done! 🎉');
    const more = TodayListWidget({
      summary: { done: 0, total: 5, streak: 0, remaining: ['A', 'B', 'C'], lang: 'en' },
      dark: false,
    });
    expect(texts(more)).toContain('+2 more');
    const room = MyRoomWidget({
      summary: { done: 1, total: 2, streak: 4, remaining: ['A'], lang: 'en' },
      roomImage: null,
      dark: false,
    });
    expect(texts(room)).toEqual(
      expect.arrayContaining(['Open the app to hang your room here', '🔥 4d']),
    );
    // 같은 트리를 lang 없이(구버전 요약) 그리면 한국어 그대로.
    const koRoom = MyRoomWidget({
      summary: { done: 1, total: 2, streak: 4, remaining: ['A'] },
      roomImage: null,
      dark: false,
    });
    expect(texts(koRoom)).toEqual(
      expect.arrayContaining(['앱을 열면 내 방이 여기 걸려요', '🔥 4일']),
    );
  });
});
