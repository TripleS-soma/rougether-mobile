import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Room, type MemberRoomPreview } from '@/components/room/room';
import type { CharacterId } from '@/constants/characters';
import type { FurnitureItem } from '@/resources/furniture';
import { dioramaRoomBox } from '@/resources/house-diorama';

type Props = {
  preview?: MemberRoomPreview;
  furniture?: FurnitureItem[];
  characterId: CharacterId;
  sharp?: boolean;
};

const ROOM_BOX = dioramaRoomBox();
const NO_PLACEMENTS: NonNullable<MemberRoomPreview['placements']> = [];

/**
 * 리디자인 집 칸 하나 (#1685) — 그 사람의 방 배치를 같은 비율로 통째로 축소해 얹는다.
 *
 * 예전(#1617)엔 가구 2개만 골라 칸마다 정해 둔 자리에 넣어, 내가 둔 순서·위치·크기와
 * 달라 보였다. 이제 방과 같은 `Room` 렌더러를 `bare`로 써서 벽지·바닥만 빼고 가구 전부와
 * 캐릭터를 방 좌표 그대로 그린다. 벽·바닥은 집 그림이 대신한다.
 */
export const HouseDioramaMember = memo(function HouseDioramaMember({
  preview,
  furniture,
  characterId,
  sharp = false,
}: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="diorama-member">
      <View
        testID="diorama-room"
        style={[
          styles.room,
          { left: `${ROOM_BOX.left * 100}%`, width: `${ROOM_BOX.width * 100}%` },
        ]}>
        <Room
          bare
          fill
          placements={preview?.placements ?? NO_PLACEMENTS}
          furniture={furniture}
          characterId={characterId}
          sharp={sharp}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  room: { position: 'absolute', top: 0, height: '100%' },
});
