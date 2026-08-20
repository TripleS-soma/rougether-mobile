import { RESOURCE_BASE, assetSource, isCdnKey } from '@/resources/asset';

describe('assetSource', () => {
  it('resolves an API asset key to a CDN URL', () => {
    const { uri } = assetSource('items/forest-sage/furniture/forest-sage-bed.png');
    expect(uri).toBe(`${RESOURCE_BASE}/items/forest-sage/furniture/forest-sage-bed.png`);
  });

  it('strips a leading slash from the key', () => {
    const { uri } = assetSource('/characters/bear.png');
    expect(uri).toBe(`${RESOURCE_BASE}/characters/bear.png`);
  });

  // 같은 키면 같은 객체를 돌려줘야 <Image source>의 참조가 렌더 간 유지된다.
  // 매번 새 {uri}였을 땐 방 캔버스(집 좌석 12칸 x 이미지 N장)가 커밋마다
  // source prop을 통째로 native에 다시 보냈다.
  it('hands back the same source object for the same key', () => {
    const a = assetSource('items/forest-sage/furniture/forest-sage-bed.png');
    const b = assetSource('items/forest-sage/furniture/forest-sage-bed.png');
    expect(a).toBe(b);
    // 앞의 슬래시 정규화 뒤 같은 경로면 같은 객체.
    expect(assetSource('/characters/bear.png')).toBe(assetSource('characters/bear.png'));
    expect(assetSource('characters/cat.png')).not.toBe(assetSource('characters/bear.png'));
  });
});

describe('isCdnKey', () => {
  it('accepts API item/character/house keys', () => {
    expect(isCdnKey('items/forest-sage/furniture/forest-sage-bed.png')).toBe(true);
    expect(isCdnKey('characters/bear_sitting_figma_ready_v2.png')).toBe(true);
    // House cover catalog keys (GET /houses/cover-images, #261).
    expect(isCdnKey('house/cloud-balloon/house-unified-cloud-balloon-frame.png')).toBe(true);
  });

  it('rejects legacy local catalog keys and empty values', () => {
    expect(isCdnKey('furniture/bed')).toBe(false);
    expect(isCdnKey('')).toBe(false);
    expect(isCdnKey(undefined)).toBe(false);
  });
});
