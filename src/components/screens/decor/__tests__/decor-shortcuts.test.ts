import {
  decorShortcutFor,
  isTypingTarget,
  NUDGE_STEP,
  NUDGE_STEP_LARGE,
} from '@/components/screens/decor/decor-shortcuts';
import {
  DECOR_COALESCE_MS,
  type DecorDoc,
  type DecorHistory,
  decorHistoryReducer,
} from '@/components/screens/decor/decor-history';

describe('decorShortcutFor (#1642)', () => {
  it('⌘·Ctrl 조합 — 실행 취소·다시 실행·맨 앞/맨 뒤', () => {
    expect(decorShortcutFor({ key: 'z', metaKey: true })).toEqual({ kind: 'undo' });
    expect(decorShortcutFor({ key: 'z', ctrlKey: true })).toEqual({ kind: 'undo' });
    // Shift를 누르면 key가 대문자로 온다.
    expect(decorShortcutFor({ key: 'Z', metaKey: true, shiftKey: true })).toEqual({ kind: 'redo' });
    expect(decorShortcutFor({ key: 'y', ctrlKey: true })).toEqual({ kind: 'redo' });
    expect(decorShortcutFor({ key: ']', metaKey: true })).toEqual({ kind: 'front' });
    expect(decorShortcutFor({ key: '[', metaKey: true })).toEqual({ kind: 'back' });
    expect(decorShortcutFor({ key: 'c', metaKey: true })).toBeNull();
  });

  it('단독 키 — 빼기·선택 해제·방향키 이동(Shift는 크게)', () => {
    expect(decorShortcutFor({ key: 'Delete' })).toEqual({ kind: 'remove' });
    expect(decorShortcutFor({ key: 'Backspace' })).toEqual({ kind: 'remove' });
    expect(decorShortcutFor({ key: 'Escape' })).toEqual({ kind: 'deselect' });
    expect(decorShortcutFor({ key: 'ArrowLeft' })).toEqual({
      kind: 'nudge',
      dx: -NUDGE_STEP,
      dy: 0,
    });
    expect(decorShortcutFor({ key: 'ArrowDown', shiftKey: true })).toEqual({
      kind: 'nudge',
      dx: 0,
      dy: NUDGE_STEP_LARGE,
    });
    expect(decorShortcutFor({ key: 'a' })).toBeNull();
    // Alt 조합은 OS·브라우저 단축키라 건드리지 않는다.
    expect(decorShortcutFor({ key: 'ArrowLeft', altKey: true })).toBeNull();
  });

  it('입력창에서 치는 중이면 단축키가 아니다', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('연속 입력 묶음 (#1642)', () => {
  const doc: DecorDoc = {
    items: [{ furnitureId: 'bed', x: 0.5, y: 0.6, z: 1 }],
    wallpaperId: 'wp',
    floorId: null,
    backgroundId: null,
  };
  const nudge = (dx: number) => (d: DecorDoc) => ({
    ...d,
    items: d.items.map((p) => ({ ...p, x: p.x + dx })),
  });

  it('같은 키로 연이어 들어온 커밋은 한 단계 — 실행 취소 한 번에 연타 전체가 되돌아간다', () => {
    let s: DecorHistory = { past: [], present: doc, future: [] };
    for (let i = 0; i < 5; i++) {
      s = decorHistoryReducer(s, {
        type: 'commit',
        update: nudge(0.01),
        group: { key: 'nudge:bed', at: 1000 + i * 100 },
      });
    }
    expect(s.past).toHaveLength(1);
    expect(s.present.items[0].x).toBeCloseTo(0.55);
    s = decorHistoryReducer(s, { type: 'undo' });
    expect(s.present.items[0].x).toBe(0.5);
  });

  it('간격이 길거나 다른 키·다른 동작이 끼면 새 단계', () => {
    let s: DecorHistory = { past: [], present: doc, future: [] };
    const g = (key: string, at: number) => ({ key, at });
    s = decorHistoryReducer(s, { type: 'commit', update: nudge(0.01), group: g('nudge:bed', 0) });
    s = decorHistoryReducer(s, {
      type: 'commit',
      update: nudge(0.01),
      group: g('nudge:bed', DECOR_COALESCE_MS + 1),
    });
    expect(s.past).toHaveLength(2);
    s = decorHistoryReducer(s, {
      type: 'commit',
      update: nudge(0.01),
      group: g('nudge:rug', DECOR_COALESCE_MS + 2),
    });
    expect(s.past).toHaveLength(3);
    s = decorHistoryReducer(s, { type: 'commit', update: nudge(0.01) });
    s = decorHistoryReducer(s, {
      type: 'commit',
      update: nudge(0.01),
      group: g('nudge:bed', DECOR_COALESCE_MS + 3),
    });
    expect(s.past).toHaveLength(5);
  });
});
