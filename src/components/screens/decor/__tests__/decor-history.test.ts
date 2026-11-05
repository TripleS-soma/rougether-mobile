import {
  DECOR_HISTORY_LIMIT,
  type DecorDoc,
  type DecorHistory,
  decorHistoryReducer,
  sameDoc,
} from '@/components/screens/decor/decor-history';

const doc = (x = 0.5): DecorDoc => ({
  items: [{ furnitureId: 'bed', x, y: 0.6, z: 1 }],
  wallpaperId: 'wp-1',
  floorId: null,
  backgroundId: null,
});
const start = (d = doc()): DecorHistory => ({ past: [], present: d, future: [] });
const moveTo = (x: number) => (d: DecorDoc) => ({
  ...d,
  items: d.items.map((p) => ({ ...p, x })),
});

describe('decorHistoryReducer (#1640)', () => {
  it('commit → undo → redo가 문서를 그대로 오간다', () => {
    let s = decorHistoryReducer(start(), { type: 'commit', update: moveTo(0.2) });
    s = decorHistoryReducer(s, { type: 'commit', update: moveTo(0.8) });
    expect(s.present.items[0].x).toBe(0.8);

    s = decorHistoryReducer(s, { type: 'undo' });
    expect(s.present.items[0].x).toBe(0.2);
    s = decorHistoryReducer(s, { type: 'undo' });
    expect(s.present.items[0].x).toBe(0.5);
    // 더 되돌릴 게 없으면 상태 그대로(같은 참조) — 리렌더도 없다.
    expect(decorHistoryReducer(s, { type: 'undo' })).toBe(s);

    s = decorHistoryReducer(s, { type: 'redo' });
    expect(s.present.items[0].x).toBe(0.2);
  });

  it('되돌린 뒤 새로 편집하면 다시 실행 기록은 버린다', () => {
    let s = decorHistoryReducer(start(), { type: 'commit', update: moveTo(0.2) });
    s = decorHistoryReducer(s, { type: 'undo' });
    s = decorHistoryReducer(s, { type: 'commit', update: moveTo(0.9) });
    expect(s.future).toEqual([]);
    expect(decorHistoryReducer(s, { type: 'redo' })).toBe(s);
  });

  it('바뀐 게 없는 커밋은 단계로 쌓지 않는다 — 새 배열이어도 내용이 같으면 같은 문서', () => {
    const s0 = start();
    const s1 = decorHistoryReducer(s0, {
      type: 'commit',
      update: (d) => ({ ...d, items: [...d.items] }),
    });
    expect(s1).toBe(s0);
    const s2 = decorHistoryReducer(s0, {
      type: 'commit',
      update: (d) => ({ ...d, wallpaperId: 'wp-1' }),
    });
    expect(s2).toBe(s0);
  });

  it(`최대 ${DECOR_HISTORY_LIMIT}단계까지만 되돌린다`, () => {
    let s = start();
    for (let i = 1; i <= DECOR_HISTORY_LIMIT + 10; i++) {
      s = decorHistoryReducer(s, { type: 'commit', update: moveTo(i / 1000) });
    }
    expect(s.past).toHaveLength(DECOR_HISTORY_LIMIT);
    for (let i = 0; i < DECOR_HISTORY_LIMIT; i++) s = decorHistoryReducer(s, { type: 'undo' });
    // 가장 오래된 10단계는 버려졌다.
    expect(s.present.items[0].x).toBe(10 / 1000);
  });

  it('reset은 히스토리를 비운다 (409 재로드 등)', () => {
    let s = decorHistoryReducer(start(), { type: 'commit', update: moveTo(0.2) });
    s = decorHistoryReducer(s, { type: 'reset', doc: doc(0.7) });
    expect(s).toEqual({ past: [], present: doc(0.7), future: [] });
  });

  it('바뀌지 않은 가구는 스냅샷 사이에서 같은 객체를 공유한다(구조 공유)', () => {
    const base: DecorDoc = {
      ...doc(),
      items: [...doc().items, { furnitureId: 'rug', x: 0.3, y: 0.8, z: 2 }],
    };
    const s = decorHistoryReducer(start(base), {
      type: 'commit',
      update: (d) => ({
        ...d,
        items: d.items.map((p) => (p.furnitureId === 'bed' ? { ...p, x: 0.1 } : p)),
      }),
    });
    expect(s.present.items[1]).toBe(s.past[0].items[1]);
  });
});

describe('sameDoc', () => {
  it('회전·반전·크기·z 차이도 다른 문서로 본다', () => {
    const a = doc();
    for (const patch of [{ rotationDeg: 15 }, { flipped: true }, { scale: 1.2 }, { z: 2 }]) {
      expect(sameDoc(a, { ...a, items: [{ ...a.items[0], ...patch }] })).toBe(false);
    }
    expect(sameDoc(a, { ...a, floorId: 'fl-1' })).toBe(false);
    expect(sameDoc(a, { ...a, items: [{ ...a.items[0] }] })).toBe(true);
  });
});
