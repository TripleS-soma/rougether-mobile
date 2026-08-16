import { memberRoomScene, type RoomCatalogProps } from '@/components/room/room';

const CATALOGS: RoomCatalogProps = { furniture: [], wallpapers: [], floors: [], backgrounds: [] };

describe('memberRoomScene (#691)', () => {
  it('room 없음 → 캐릭터 없는 빈 방 (빈 자유배치)', () => {
    const scene = memberRoomScene(undefined, CATALOGS);
    expect(scene.characterId).toBeNull();
    expect(scene.placedFurnitureIds).toEqual([]);
    expect(scene.placements).toEqual([]);
    expect(scene.wallpaperId).toBeUndefined();
  });

  it('room 있음 + placements 없음 → null (슬롯 렌더 폴백)', () => {
    const scene = memberRoomScene(
      { placedFurnitureIds: ['bed-1'], wallpaperId: 'w1', characterId: 'otter' },
      CATALOGS,
    );
    expect(scene.placements).toBeNull();
    expect(scene.placedFurnitureIds).toEqual(['bed-1']);
    expect(scene.characterId).toBe('otter');
    expect(scene.wallpaperId).toBe('w1');
  });

  it('room 있음 + characterId 미지정 → null (빈 방; 기본 캐릭터가 필요한 호출부는 명시 오버라이드)', () => {
    const scene = memberRoomScene({ placedFurnitureIds: [] }, CATALOGS);
    expect(scene.characterId).toBeNull();
  });

  it('카탈로그는 그대로 통과한다', () => {
    const scene = memberRoomScene(undefined, CATALOGS);
    expect(scene.furniture).toBe(CATALOGS.furniture);
    expect(scene.wallpapers).toBe(CATALOGS.wallpapers);
  });

  // 거미줄은 집 좌석 타일에도 그대로 실려야 한다 (#829).
  it('preview의 거미줄을 씬으로 옮긴다 — 없으면 null', () => {
    const withWeb = memberRoomScene(
      { placedFurnitureIds: [], cobweb: { assetKey: 'items/cobweb.png' } },
      CATALOGS,
    );
    expect(withWeb.cobweb).toEqual({ assetKey: 'items/cobweb.png' });
    expect(memberRoomScene({ placedFurnitureIds: [] }, CATALOGS).cobweb).toBeNull();
    expect(memberRoomScene(undefined, CATALOGS).cobweb).toBeNull();
  });
});
