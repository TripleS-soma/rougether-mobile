import { View } from 'react-native';

import { Room } from '@/components/room/room';
import { ROOM_RENDER_CONTRACT } from '@/components/room/room-render-contract';
import type { FurnitureItem, PlacedFurniture, Wallpaper } from '@/resources/furniture';

const fixture = ROOM_RENDER_CONTRACT.referenceFixture;

const furniture: FurnitureItem = {
  ...fixture.furniture,
  category: '장식',
  price: 0,
};

const surface = (kind: 'background' | 'wallpaper' | 'floor'): Wallpaper => ({
  ...fixture.surfaces[kind],
  price: 0,
  color: '#F3E9D6',
});

const placement: PlacedFurniture = {
  furnitureId: furniture.id,
  ...ROOM_RENDER_CONTRACT.furniture.previewCenter,
  z: 1,
  scale: furniture.defaultScale,
};

/**
 * 관리자 가구 크기 스튜디오와 같은 JSON 계약·CDN fixture를 사용하는 RN 기준 화면.
 * 새 route는 만들지 않고 기존 개발 갤러리에서만 렌더한다.
 */
export function RoomRenderReference() {
  const background = surface('background');
  const wallpaper = surface('wallpaper');
  const floor = surface('floor');

  return (
    <View
      accessibilityLabel={`Room renderer contract v${ROOM_RENDER_CONTRACT.version} 기준 화면`}
      testID="room-render-reference"
      style={{ width: 320, alignSelf: 'center' }}>
      <Room
        backgroundId={background.id}
        wallpaperId={wallpaper.id}
        floorId={floor.id}
        backgrounds={[background]}
        wallpapers={[wallpaper]}
        floors={[floor]}
        furniture={[furniture]}
        placements={[placement]}
        characterId={fixture.character.id}
        characterAnimations={fixture.character.animations}
      />
    </View>
  );
}
