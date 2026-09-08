/**
 * 앱 프레임 폭 계산 — 웹 데스크톱에서만 폭을 480으로 가두고, 그 외엔 창 그대로.
 */
import { APP_FRAME_MAX_WIDTH, resolveAppFrame } from '@/hooks/use-app-frame';

const win = (width: number) => ({ width, height: 900, scale: 2, fontScale: 1 });

test('네이티브는 창 폭을 그대로 쓰고 framed가 아니다', () => {
  expect(resolveAppFrame('ios', win(1440))).toEqual({ ...win(1440), framed: false });
  expect(resolveAppFrame('android', win(360))).toEqual({ ...win(360), framed: false });
});

test('웹 넓은 창은 폭만 프레임 폭으로 바뀌고 나머지(높이·fontScale)는 유지', () => {
  expect(resolveAppFrame('web', win(1440))).toEqual({
    ...win(1440),
    width: APP_FRAME_MAX_WIDTH,
    framed: true,
  });
});

test('웹 좁은 창(모바일 브라우저)은 창 폭 그대로', () => {
  expect(resolveAppFrame('web', win(390))).toEqual({ ...win(390), framed: false });
  expect(resolveAppFrame('web', win(APP_FRAME_MAX_WIDTH))).toEqual({
    ...win(APP_FRAME_MAX_WIDTH),
    framed: false,
  });
});
