/**
 * 방 꾸미기 웹 키보드 단축키 (#1642) — 키 입력 → 편집 동작 매핑만 담은 순수 모듈.
 * 화면이 `keydown`을 받아 이 결과대로 히스토리(#1640)에 커밋한다. macOS는 ⌘, 그 밖은 Ctrl —
 * 둘 다 받는다(웹 앱이 OS를 정확히 알 필요가 없게).
 */
export type DecorShortcut =
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'remove' }
  | { kind: 'deselect' }
  | { kind: 'front' }
  | { kind: 'back' }
  | { kind: 'nudge'; dx: number; dy: number };

/** 방향키 한 번의 이동량 — 정규화 좌표(방 폭·높이 대비). Shift는 크게. */
export const NUDGE_STEP = 0.005;
export const NUDGE_STEP_LARGE = 0.03;

export type KeyInput = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function decorShortcutFor(e: KeyInput): DecorShortcut | null {
  if (e.altKey) return null;
  const mod = !!(e.metaKey || e.ctrlKey);
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod) {
    if (key === 'z') return e.shiftKey ? { kind: 'redo' } : { kind: 'undo' };
    if (key === 'y') return { kind: 'redo' };
    if (key === ']') return { kind: 'front' };
    if (key === '[') return { kind: 'back' };
    return null;
  }
  if (key === 'Delete' || key === 'Backspace') return { kind: 'remove' };
  if (key === 'Escape') return { kind: 'deselect' };
  const arrow = ARROWS[key];
  if (arrow) {
    const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
    return { kind: 'nudge', dx: arrow[0] * step, dy: arrow[1] * step };
  }
  return null;
}

/** 글자를 치는 중이면 단축키를 쓰지 않는다 — 입력창의 Backspace가 가구를 빼면 안 된다. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = (el.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
}
