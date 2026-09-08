/**
 * 앱 프레임 폭 계산 — 웹 데스크톱에서만 폭을 480으로 가두고, 그 외엔 창 그대로.
 */
import {
  APP_FRAME_MAX_WIDTH,
  resolveAppFrame,
  SPLIT_FRAME_MAX_WIDTH,
  SPLIT_MIN_WINDOW_WIDTH,
} from '@/hooks/use-app-frame';

const win = (width: number) => ({ width, height: 900, scale: 2, fontScale: 1 });

test('네이티브는 창 폭을 그대로 쓰고 framed가 아니다', () => {
  expect(resolveAppFrame('ios', win(1440))).toEqual({ ...win(1440), framed: false, split: false });
  expect(resolveAppFrame('android', win(360))).toEqual({
    ...win(360),
    framed: false,
    split: false,
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
