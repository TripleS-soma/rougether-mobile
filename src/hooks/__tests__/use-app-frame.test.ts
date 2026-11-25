/**
 * 앱 프레임 폭 계산 — 창이 폰보다 넓으면(웹 데스크톱·폴드 펼침·태블릿) 폭을 480으로
 * 가두고, 폰 폭이면 창 그대로. 2단은 마우스 웹 960부터, 터치 기기 640부터.
 */
import {
  APP_FRAME_MAX_WIDTH,
  resolveAppFrame,
  SPLIT_FRAME_MAX_WIDTH,
  NAV_RAIL_MIN_WIDTH,
  SPLIT_MIN_WINDOW_WIDTH,
  TOUCH_SPLIT_MIN_WIDTH,
} from '@/hooks/use-app-frame';

const win = (width: number) => ({ width, height: 900, scale: 2, fontScale: 1 });

test('네이티브 폰 폭은 창 폭 그대로 쓰고 framed가 아니다', () => {
  expect(resolveAppFrame('ios', win(430))).toEqual({ ...win(430), framed: false, split: false });
  expect(resolveAppFrame('android', win(360))).toEqual({
    ...win(360),
    framed: false,
    split: false,
  });
});

// 터치 기기(네이티브, 터치가 주 입력인 모바일 웹)의 넓은 창은 좌우 2단으로 창을 다 쓴다 —
// 펼친 폴더블·태블릿. #1785의 "폰 폭 기둥"은 양옆이 비어 보여 뒤집었다(2026-11-19 결정).
describe('터치 기기의 2단', () => {
  test('칸 하나가 320 이상 나오는 폭(640)부터 2단 — 프레임 폭은 창 폭 전부', () => {
    expect(resolveAppFrame('android', win(750))).toEqual({
      ...win(750),
      framed: true,
      split: true,
      splitFill: true,
    });
    expect(resolveAppFrame('ios', win(TOUCH_SPLIT_MIN_WIDTH))).toMatchObject({
      width: TOUCH_SPLIT_MIN_WIDTH,
      split: true,
      splitFill: true,
    });
  });

  test('태블릿처럼 아주 넓어도 최대 폭 없이 창을 다 쓴다', () => {
    expect(resolveAppFrame('android', win(1366))).toMatchObject({
      width: 1366,
      split: true,
      splitFill: true,
    });
  });

  test('480 초과 640 미만은 폰 컬럼 — 두 칸으로 나누면 칸이 320 아래로 내려간다', () => {
    expect(resolveAppFrame('android', win(TOUCH_SPLIT_MIN_WIDTH - 1))).toEqual({
      ...win(TOUCH_SPLIT_MIN_WIDTH - 1),
      width: APP_FRAME_MAX_WIDTH,
      framed: true,
      split: false,
    });
  });

  test('터치가 주 입력인 웹(폴더블 브라우저)은 네이티브와 같은 기준', () => {
    expect(resolveAppFrame('web', win(867), true, undefined, true)).toMatchObject({
      width: 867,
      split: true,
      splitFill: true,
    });
  });

  test('마우스 웹은 종전 그대로 — 960 미만은 폰 컬럼, 2단은 가운데 블록(splitFill 없음)', () => {
    expect(resolveAppFrame('web', win(867), true, undefined, false).split).toBe(false);
    expect(resolveAppFrame('web', win(1440), true, undefined, false)).not.toHaveProperty(
      'splitFill',
    );
  });

  // 펼친 Duo는 가로 인셋이 없다(2026-11-23 실측: top 82 · right 0 · bottom 34, 창 951×669).
  test('펼친 Duo(951)는 창 폭 전부를 2단으로 쓴다', () => {
    const frame = resolveAppFrame('ios', win(951));
    expect(frame).toMatchObject({ width: 951, framed: true, split: true, splitFill: true });
    expect(frame).not.toHaveProperty('insetRight');
  });

  test('가로 인셋이 있는 넓은 창은 인셋을 뺀 폭 전부를 쓴다', () => {
    expect(resolveAppFrame('ios', win(951), true, { left: 0, right: 84 })).toMatchObject({
      width: 867,
      split: true,
      splitFill: true,
      insetRight: 84,
    });
  });
});

test('웹 넓은 창은 폭만 프레임 폭으로 바뀌고 나머지(높이·fontScale)는 유지', () => {
  expect(resolveAppFrame('web', win(800))).toEqual({
    ...win(800),
    width: APP_FRAME_MAX_WIDTH,
    framed: true,
    split: false,
  });
});

test('웹 좁은 창(모바일 브라우저)은 창 폭 그대로', () => {
  expect(resolveAppFrame('web', win(390))).toEqual({ ...win(390), framed: false, split: false });
  expect(resolveAppFrame('web', win(APP_FRAME_MAX_WIDTH))).toEqual({
    ...win(APP_FRAME_MAX_WIDTH),
    framed: false,
    split: false,
  });
});

test('웹 창 ≥ 960px은 2단 — 프레임 폭은 창 폭, 최대 1200 (#1230)', () => {
  expect(resolveAppFrame('web', win(SPLIT_MIN_WINDOW_WIDTH))).toEqual({
    ...win(SPLIT_MIN_WINDOW_WIDTH),
    framed: true,
    split: true,
  });
  expect(resolveAppFrame('web', win(1440))).toEqual({
    ...win(1440),
    width: SPLIT_FRAME_MAX_WIDTH,
    framed: true,
    split: true,
  });
  // 경계 바로 아래는 폰 컬럼.
  expect(resolveAppFrame('web', win(SPLIT_MIN_WINDOW_WIDTH - 1)).split).toBe(false);
});

test('hydrated=false(서버 렌더·클라이언트 첫 렌더)면 웹 넓은 창도 프레임 없음 — 마크업 일치용', () => {
  expect(resolveAppFrame('web', win(1440), false)).toEqual({
    ...win(1440),
    framed: false,
    split: false,
  });
});

// 가로 안전 영역 인셋 — 접힌 아이폰 Duo는 오른쪽 84pt가 시스템 표시 영역이다(iOS 27.2
// 시뮬레이터 실측). 배치에 쓸 폭은 그만큼 좁다. 펼친 Duo는 가로 인셋이 없고 위 82다.
describe('가로 안전 영역 인셋', () => {
  const DUO = { left: 0, right: 84 };

  test('접힌 Duo(466)는 인셋을 뺀 382가 폭이고, 480 아래라 framed가 아니다', () => {
    expect(resolveAppFrame('ios', win(466), true, DUO)).toEqual({
      ...win(466),
      width: 382,
      framed: false,
      split: false,
      insetLeft: 0,
      insetRight: 84,
    });
  });

  test('인셋을 뺀 폭이 480 이하면 창이 480보다 넓어도 framed가 아니다', () => {
    expect(resolveAppFrame('ios', win(500), true, { left: 20, right: 20 })).toMatchObject({
      width: 460,
      framed: false,
    });
  });

  test('인셋이 없으면 종전과 같은 값이고 인셋 필드를 싣지 않는다', () => {
    expect(resolveAppFrame('ios', win(430), true, { left: 0, right: 0 })).toEqual(
      resolveAppFrame('ios', win(430)),
    );
    expect(resolveAppFrame('ios', win(430))).not.toHaveProperty('insetRight');
  });

  test('웹 2단 판정도 인셋을 뺀 폭으로 한다', () => {
    expect(resolveAppFrame('web', win(SPLIT_MIN_WINDOW_WIDTH + 50), true, DUO).split).toBe(false);
    expect(resolveAppFrame('web', win(SPLIT_MIN_WINDOW_WIDTH + 84), true, DUO).split).toBe(true);
  });
});

// 왼쪽 세로 탭 줄 — 2단이면서 폭이 840 이상이면 아래 탭 바 대신 왼쪽 줄. 그보다 좁은 2단
// (칸 하나 320~419)은 줄이 칸을 더 좁히므로 아래 탭 바를 유지한다.
describe('왼쪽 세로 탭 줄(navRail)', () => {
  test('터치 2단: 840 이상이면 켜지고 그 아래는 꺼진다', () => {
    expect(resolveAppFrame('ios', win(951))).toMatchObject({ split: true, navRail: true });
    expect(resolveAppFrame('android', win(NAV_RAIL_MIN_WIDTH))).toMatchObject({ navRail: true });
    expect(resolveAppFrame('android', win(NAV_RAIL_MIN_WIDTH - 1))).not.toHaveProperty('navRail');
    expect(resolveAppFrame('android', win(700))).toMatchObject({ split: true });
  });

  test('마우스 웹은 2단이어도 탭 바를 아래에 둔다 — 세로 줄은 터치 기기만', () => {
    const frame = resolveAppFrame('web', win(1280), true, undefined, false);
    expect(frame.split).toBe(true);
    expect(frame).not.toHaveProperty('navRail');
    // 같은 폭이라도 터치 웹(태블릿 브라우저)은 세로 줄.
    expect(resolveAppFrame('web', win(1280), true, undefined, true)).toMatchObject({
      navRail: true,
    });
  });

  test('2단이 아니면 없다 — 폰, 폰 컬럼', () => {
    expect(resolveAppFrame('ios', win(430))).not.toHaveProperty('navRail');
    expect(resolveAppFrame('web', win(900), true, undefined, false)).not.toHaveProperty('navRail');
  });
});
