import {
  centeredCrop,
  CROP_MIN,
  cropForUpload,
  cropLayout,
  croppedAspect,
  dragCrop,
  FULL_CROP,
  isFullCrop,
} from '@/lib/chat-crop';

describe('chat-crop', () => {
  it('전체 영역은 자르기 값을 보내지 않는다', () => {
    expect(isFullCrop(undefined)).toBe(true);
    expect(cropForUpload(FULL_CROP)).toBeUndefined();
    expect(cropForUpload({ x: 0.0004, y: 0, width: 0.9996, height: 1 })).toBeUndefined();
  });

  it('서버에 보낼 값은 다듬고 사진 안에 가둔다', () => {
    expect(cropForUpload({ x: 0.123456, y: 0.2, width: 0.5, height: 0.900001 })).toEqual({
      x: 0.1235,
      y: 0.2,
      width: 0.5,
      height: 0.8,
    });
  });

  it('가운데를 끌면 크기를 유지한 채 사진 안에서만 움직인다', () => {
    const start = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    expect(dragCrop(start, 'move', 0.125, -0.125)).toEqual({
      x: 0.375,
      y: 0.125,
      width: 0.5,
      height: 0.5,
    });
    expect(dragCrop(start, 'move', 1, 1)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
    expect(dragCrop(start, 'move', -1, -1)).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
  });

  it('모서리를 끌면 맞은편 모서리가 고정된다', () => {
    const start = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
    const tl = dragCrop(start, 'tl', 0.1, 0.2);
    expect(tl.x).toBeCloseTo(0.3);
    expect(tl.y).toBeCloseTo(0.4);
    expect(tl.x + tl.width).toBeCloseTo(0.8);
    expect(tl.y + tl.height).toBeCloseTo(0.8);
    const br = dragCrop(start, 'br', 0.5, 0.5);
    expect(br).toEqual({ x: 0.2, y: 0.2, width: 0.8, height: 0.8 });
  });

  it('최소 크기보다 작아지지 않는다', () => {
    const start = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
    const shrunk = dragCrop(start, 'tl', 5, 5);
    expect(shrunk.width).toBeCloseTo(CROP_MIN);
    expect(shrunk.height).toBeCloseTo(CROP_MIN);
    expect(shrunk.x + shrunk.width).toBeCloseTo(0.8);
    const other = dragCrop(start, 'br', -5, -5);
    expect(other.width).toBeCloseTo(CROP_MIN);
    expect(other.x).toBe(0.2);
  });

  it('비율 맞추기는 가운데에서 가장 큰 영역을 잡는다', () => {
    // 가로 2:1 사진을 정사각으로 — 가로 절반, 세로 전체.
    expect(centeredCrop(2, 1)).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 });
    // 세로 1:2 사진을 정사각으로 — 가로 전체, 세로 절반.
    expect(centeredCrop(0.5, 1)).toEqual({ x: 0, y: 0.25, width: 1, height: 0.5 });
    expect(centeredCrop(0, 1)).toEqual(FULL_CROP);
  });

  it('자른 뒤 비율은 원본 비율에 영역 비율을 곱한 값이다', () => {
    expect(croppedAspect(1600, 800)).toBe(2);
    expect(croppedAspect(1600, 800, { x: 0.25, y: 0, width: 0.5, height: 1 })).toBe(1);
    expect(croppedAspect()).toBe(1);
  });

  it('칸에 넣을 때 자른 영역이 칸을 꼭 채운다', () => {
    // 2:1 사진의 가운데 정사각을 100×100 칸에 — 사진은 200×100, 왼쪽으로 50 밀린다.
    const layout = cropLayout({ width: 100, height: 100 }, 2, {
      x: 0.25,
      y: 0,
      width: 0.5,
      height: 1,
    });
    expect(layout).toEqual({ width: 200, height: 100, left: -50, top: 0 });
    // 자르기가 없으면 일반 cover와 같다.
    expect(cropLayout({ width: 100, height: 100 }, 2)).toEqual({
      width: 200,
      height: 100,
      left: -50,
      top: 0,
    });
  });
});
