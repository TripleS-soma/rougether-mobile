import {
  flingDirection,
  horizontalFlingGesture,
  SWIPE_CLAIM_DX,
  SWIPE_FAIL_DY,
  SWIPE_FLING_DX,
} from '@/utils/gesture';

describe('flingDirection (release judgment, #561/#562)', () => {
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

describe('horizontalFlingGesture (RNGH pan 빌더)', () => {
  it('가로 활성/세로 실패 임계가 공용 상수로 설정된다', () => {
    const g = horizontalFlingGesture('test-fling', jest.fn());
    // 가로 우세만 활성: ±24px 가로 이동에 활성, 그 전에 세로 ±36px면 실패
    // (세로 스크롤 몫). 탭은 활성 임계 미달이라 pan이 잡지 않는다.
    expect(g.config.activeOffsetXStart).toBe(-SWIPE_CLAIM_DX);
    expect(g.config.activeOffsetXEnd).toBe(SWIPE_CLAIM_DX);
    expect(g.config.failOffsetYStart).toBe(-SWIPE_FAIL_DY);
    expect(g.config.failOffsetYEnd).toBe(SWIPE_FAIL_DY);
    // React 상태를 만지는 콜백 — JS 스레드 고정.
    expect(g.config.runOnJS).toBe(true);
  });

  it('놓을 때 이동량으로 플링 방향을 보고한다', () => {
    const onFling = jest.fn();
    const g = horizontalFlingGesture('test-fling', onFling);
    const end = (translationX: number) => g.handlers.onEnd?.({ translationX } as never, true);

    end(-60);
    expect(onFling).toHaveBeenLastCalledWith('left');
    end(60);
    expect(onFling).toHaveBeenLastCalledWith('right');

    // 임계 미달 릴리즈는 무시.
    onFling.mockClear();
    end(30);
    expect(onFling).not.toHaveBeenCalled();
  });
});
