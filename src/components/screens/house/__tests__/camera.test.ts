import {
  CAM_MAX_SCALE,
  CAM_META_FADE_END,
  camDefault,
  clampCam,
  isCamAway,
  seatMetaOpacityFor,
} from '@/components/screens/house/camera';

const FRAME = { w: 300, h: 268 };

describe('clampCam (#693 분리 — PR #702 리뷰 후속)', () => {
  it('스케일을 1~CAM_MAX_SCALE로 클램프한다', () => {
    expect(clampCam(FRAME, 0.4, 0, 0).scale).toBe(1);
    expect(clampCam(FRAME, 99, 0, 0).scale).toBe(CAM_MAX_SCALE);
    expect(clampCam(FRAME, 2, 0, 0).scale).toBe(2);
  });

  it('팬을 프레임 경계까지로 제한한다 — translate는 스케일 바깥(화면 px) 기준', () => {
    // scale 2에서 최대 이동은 (s-1)*w/2 = 150 / (s-1)*h/2 = 134.
    expect(clampCam(FRAME, 2, 9999, -9999)).toEqual({ scale: 2, tx: 150, ty: -134 });
    expect(clampCam(FRAME, 2, 80, 40)).toEqual({ scale: 2, tx: 80, ty: 40 });
  });

  it('원배율(scale 1)에서는 팬 여지가 0 — 항상 기본 위치로 돌아온다', () => {
    const c = clampCam(FRAME, 1, 50, -30);
    expect(c.scale).toBe(1);
    // 음수 방향 클램프는 -0을 낳는다 — 소비자(transform)에는 0과 동일.
    expect(c.tx === 0).toBe(true);
    expect(c.ty === 0).toBe(true);
  });

  it('레이아웃 전(frame 0×0)에도 NaN 없이 기본 위치로 수렴한다', () => {
    expect(clampCam({ w: 0, h: 0 }, 2, 50, 50)).toEqual({ scale: 2, tx: 0, ty: 0 });
  });
});

describe('isCamAway', () => {
  it('기본 프리셋 근방(스케일·이동 임계 이내)은 이탈로 치지 않는다 — 탭 지터 허용', () => {
    expect(isCamAway(camDefault())).toBe(false);
    // 임계 자체(0.04/6)는 부동소수점상 정확 비교가 불안정해 안쪽 값으로 단언.
    expect(isCamAway({ scale: 1.03, tx: 5, ty: -5 })).toBe(false);
  });

  it('스케일이나 팬 어느 한 축이라도 임계를 넘으면 이탈', () => {
    expect(isCamAway({ scale: 1.05, tx: 0, ty: 0 })).toBe(true);
    expect(isCamAway({ scale: 1, tx: 7, ty: 0 })).toBe(true);
    expect(isCamAway({ scale: 1, tx: 0, ty: -7 })).toBe(true);
  });
});

/**
 * 이름표 페이드 (#665 → #776). 종전엔 화면 안 `camScale.interpolate(...)`라
 * house-screen 테스트가 RN Animated의 평탄화에 기대 `opacity === 1`만 봤고,
 * Reanimated로 옮기면 그 방법이 아예 막힌다(jest mock이 useAnimatedStyle을
 * 평가하지 않는다). 곡선을 여기서 직접 단언한다.
 */
describe('seatMetaOpacityFor', () => {
  it('기본 배율에서는 완전히 보인다', () => {
    expect(seatMetaOpacityFor(1)).toBe(1);
  });

  it('페이드 끝 배율에서 사라진다', () => {
    expect(seatMetaOpacityFor(CAM_META_FADE_END)).toBe(0);
  });

  it('중간 배율은 선형으로 흐려진다', () => {
    expect(seatMetaOpacityFor(1 + (CAM_META_FADE_END - 1) / 2)).toBeCloseTo(0.5);
  });

  it('구간 밖은 잘린다 — 축소도, 최대 확대도 튀지 않는다', () => {
    expect(seatMetaOpacityFor(0.5)).toBe(1);
    expect(seatMetaOpacityFor(CAM_MAX_SCALE)).toBe(0);
  });
});
