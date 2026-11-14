import { MENU_GAP, MENU_MARGIN, placeMenu } from '@/components/chat/chat-menu-placement';

const window = { width: 390, height: 844 };
const insets = { top: 47, bottom: 34 };
const menu = { width: 260, height: 200 };

describe('길게 누르기 메뉴 자리', () => {
  it('남의 말풍선은 바로 아래, 왼쪽 끝을 맞춘다', () => {
    const anchor = { x: 60, y: 300, width: 120, height: 40 };
    expect(placeMenu(anchor, menu, window, insets, false)).toEqual({
      left: 60,
      top: 300 + 40 + MENU_GAP,
    });
  });

  it('내 말풍선은 오른쪽 끝을 맞춘다', () => {
    const anchor = { x: 250, y: 300, width: 128, height: 40 };
    expect(placeMenu(anchor, menu, window, insets, true)).toEqual({
      left: 250 + 128 - 260,
      top: 348,
    });
  });

  it('아래가 모자라면 말풍선 위로 올린다', () => {
    const anchor = { x: 60, y: 700, width: 120, height: 40 };
    expect(placeMenu(anchor, menu, window, insets, false).top).toBe(700 - MENU_GAP - 200);
  });

  it('위아래 모두 모자라면 화면 안 가장 아래 자리에 둔다', () => {
    const tall = { x: 60, y: 60, width: 200, height: 760 };
    expect(placeMenu(tall, menu, window, insets, false).top).toBe(844 - 34 - MENU_MARGIN - 200);
  });

  it('가로로 화면 밖에 나가지 않는다', () => {
    const wide = { x: 300, y: 300, width: 80, height: 40 };
    expect(placeMenu(wide, menu, window, insets, false).left).toBe(390 - MENU_MARGIN - 260);
    const narrowMine = { x: 20, y: 300, width: 100, height: 40 };
    expect(placeMenu(narrowMine, menu, window, insets, true).left).toBe(MENU_MARGIN);
  });

  it('말풍선 자리를 모르면 화면 가운데', () => {
    expect(placeMenu(undefined, menu, window, insets, false)).toEqual({ left: 65, top: 322 });
  });
});
