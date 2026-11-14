/** 화면(창) 좌표의 사각형 — 길게 누른 말풍선 자리. */
export type MenuAnchor = { x: number; y: number; width: number; height: number };

type Size = { width: number; height: number };
type Insets = { top: number; bottom: number };

/** 말풍선과 메뉴 사이 틈, 메뉴와 화면 가장자리 사이 최소 여백. */
export const MENU_GAP = 8;
export const MENU_MARGIN = 12;

/**
 * 길게 누른 말풍선 옆에 메뉴를 놓을 자리 (카카오톡식). 말풍선 **바로 아래**에 붙이고, 아래가
 * 모자라면 **위**로 올린다. 위아래 모두 모자라면(화면보다 긴 말풍선) 화면 안에 들어오는 가장
 * 아래 자리에 둔다. 가로는 남의 말풍선이면 왼쪽 끝, 내 말풍선이면 오른쪽 끝을 맞추고 화면
 * 밖으로 나가지 않게 가둔다. 말풍선 자리를 모르면 화면 가운데.
 */
export function placeMenu(
  anchor: MenuAnchor | undefined,
  menu: Size,
  window: Size,
  insets: Insets,
  mine: boolean,
): { left: number; top: number } {
  const minTop = insets.top + MENU_MARGIN;
  const maxTop = Math.max(minTop, window.height - insets.bottom - MENU_MARGIN - menu.height);
  const maxLeft = Math.max(MENU_MARGIN, window.width - MENU_MARGIN - menu.width);
  if (!anchor) {
    return {
      left: Math.min(Math.max((window.width - menu.width) / 2, MENU_MARGIN), maxLeft),
      top: Math.min(Math.max((window.height - menu.height) / 2, minTop), maxTop),
    };
  }
  const below = anchor.y + anchor.height + MENU_GAP;
  const above = anchor.y - MENU_GAP - menu.height;
  const top = below <= maxTop ? below : above >= minTop ? above : maxTop;
  const wanted = mine ? anchor.x + anchor.width - menu.width : anchor.x;
  return { left: Math.min(Math.max(wanted, MENU_MARGIN), maxLeft), top: Math.max(top, minTop) };
}
