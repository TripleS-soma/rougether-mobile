import {
  flingDirection,
  horizontalFlingResponderConfig,
  isHorizontalSwipe,
  SWIPE_CLAIM_DX,
  SWIPE_FLING_DX,
} from '@/utils/gesture';

describe('isHorizontalSwipe (responder claim, #561/#562)', () => {
  it.each([
    // [dx, dy, expected] — 가로 우세 + 최소 이동 임계.
    [30, 0, true], // 순수 가로 드래그
    [-30, 0, true], // 반대 방향도 동일
    [30, 15, true], // 가로 우세 (|dx| > 1.5|dy|)
    [30, 25, false], // 대각선 — 가로 우세 미달
    [10, 0, false], // 최소 이동(24px) 미달 — 탭/미세 이동 보호
    [SWIPE_CLAIM_DX, 0, false], // 경계값은 미클레임 (초과여야 함)
    [0, 40, false], // 세로 스크롤
    [-40, -20, true], // 음수 dy에도 절대값 비교
  ])('dx=%d dy=%d → %s', (dx, dy, expected) => {
    expect(isHorizontalSwipe(dx, dy)).toBe(expected);
  });
});

describe('flingDirection (release judgment)', () => {
  it.each([
    [-60, 'left'],
    [60, 'right'],
    [-SWIPE_FLING_DX, 'left'], // 경계값 포함
    [SWIPE_FLING_DX, 'right'],
    [-30, null], // 임계 미달 — 플링 아님
    [30, null],
    [0, null],
  ] as const)('dx=%d → %s', (dx, expected) => {
    expect(flingDirection(dx)).toBe(expected);
  });
});

describe('horizontalFlingResponderConfig', () => {
  it('claims only horizontal-dominant drags and fires onFling per direction', () => {
    const onFling = jest.fn();
    const config = horizontalFlingResponderConfig(onFling);

    expect(config.onMoveShouldSetPanResponder(null, { dx: 30, dy: 5 })).toBe(true);
    expect(config.onMoveShouldSetPanResponder(null, { dx: 10, dy: 5 })).toBe(false);
    expect(config.onMoveShouldSetPanResponder(null, { dx: 30, dy: 30 })).toBe(false);
    // 중첩 스크롤 등이 뺏어가면 양보한다.
    expect(config.onPanResponderTerminationRequest()).toBe(true);

    config.onPanResponderRelease(null, { dx: -60, dy: 0 });
    expect(onFling).toHaveBeenLastCalledWith('left');
    config.onPanResponderRelease(null, { dx: 60, dy: 0 });
    expect(onFling).toHaveBeenLastCalledWith('right');

    // 임계 미달 릴리즈는 무시.
    onFling.mockClear();
    config.onPanResponderRelease(null, { dx: 30, dy: 0 });
    expect(onFling).not.toHaveBeenCalled();
  });
});
