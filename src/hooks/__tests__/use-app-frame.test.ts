/**
 * 앱 프레임 폭 계산 — 창이 폰보다 넓으면(웹 데스크톱·폴드 펼침·태블릿) 폭을 480으로
 * 가두고, 폰 폭이면 창 그대로. 2단은 웹만.
 */
import {
  APP_FRAME_MAX_WIDTH,
  resolveAppFrame,
  SPLIT_FRAME_MAX_WIDTH,
  SPLIT_MIN_WINDOW_WIDTH,
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

test('네이티브 넓은 창(폴드 펼침 750·태블릿)은 폰 컬럼 480 — 방 캔버스가 창 폭만큼 커지지 않게', () => {
  expect(resolveAppFrame('android', win(750))).toEqual({
    ...win(750),
    width: APP_FRAME_MAX_WIDTH,
    framed: true,
    split: false,
  });
});

test('네이티브는 2단을 쓰지 않는다 — 가로 태블릿(1280)도 폰 컬럼', () => {
  expect(resolveAppFrame('android', win(1280))).toEqual({
    ...win(1280),
    width: APP_FRAME_MAX_WIDTH,
    framed: true,
    split: false,
  });
  expect(resolveAppFrame('ios', win(SPLIT_MIN_WINDOW_WIDTH)).split).toBe(false);
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

// 가로 안전 영역 인셋 — 아이폰 Duo는 접힘·펼침 모두 오른쪽 84pt가 시스템 표시 영역이다
// (iOS 27.2 시뮬레이터 실측: window.safeAreaInsets right 84). 배치에 쓸 폭은 그만큼 좁다.
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

  test('펼친 Duo(951)는 인셋을 뺀 867을 기준으로 프레임을 정한다', () => {
    const frame = resolveAppFrame('ios', win(951), true, DUO);
    expect(frame).toMatchObject({ framed: true, width: APP_FRAME_MAX_WIDTH, insetRight: 84 });
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
