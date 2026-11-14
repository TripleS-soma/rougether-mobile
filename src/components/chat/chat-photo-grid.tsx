import { StyleSheet, View } from 'react-native';

import type { ChatImageResponse } from '@/api/chat-types';
import { ChatPhoto, CHAT_PHOTO_SIZE } from '@/components/chat/chat-photo';
import { Radius } from '@/constants/theme';
import { croppedAspect } from '@/lib/chat-crop';
import type { ChatPhotoDraft } from '@/lib/pick-chat-photo';

/** 여러 장 묶음의 전체 폭과 칸 사이 틈. */
export const CHAT_GRID_WIDTH = 240;
const GAP = 2;
/** 한 장짜리 사진의 세로/가로 한계 — 너무 길쭉한 사진이 말풍선을 다 먹지 않게. */
const SINGLE_MIN_ASPECT = 3 / 4;
const SINGLE_MAX_ASPECT = 4 / 3;

/**
 * 사진 장수 → 줄마다 놓을 칸 수. 한 줄에 최대 3칸이고, 3으로 나눠떨어지지 않으면 **앞줄**을
 * 2칸으로 둬 빈칸 없이 채운다 (4장 = 2+2, 5장 = 2+3, 7장 = 2+2+3).
 */
export function photoRows(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  const twos = count % 3 === 0 ? 0 : count % 3 === 2 ? 1 : 2;
  const threes = (count - twos * 2) / 3;
  return [...Array<number>(twos).fill(2), ...Array<number>(threes).fill(3)];
}

/** 한 장짜리 사진 크기 — 긴 변을 기본 크기에 맞추고 비율은 3:4 ~ 4:3 사이로 가둔다. */
export function singlePhotoSize(aspect: number): { width: number; height: number } {
  const clamped = Math.min(Math.max(aspect > 0 ? aspect : 1, SINGLE_MIN_ASPECT), SINGLE_MAX_ASPECT);
  return clamped >= 1
    ? { width: CHAT_PHOTO_SIZE, height: Math.round(CHAT_PHOTO_SIZE / clamped) }
    : { width: Math.round(CHAT_PHOTO_SIZE * clamped), height: CHAT_PHOTO_SIZE };
}

type Tile = { key: string; imageId?: number; local?: ChatPhotoDraft; aspect: number };

/**
 * 메시지 하나에 담긴 사진들 — 한 장이면 비율을 살려 크게, 여러 장이면 묶음 격자로 그린다.
 * 칸마다 따로 사진을 받아 오고(권한 확인 포함) 누르면 그 사진을 크게 본다.
 */
export function ChatPhotoGrid({
  images,
  localImages,
  senderName,
  sentLabel,
  onShareToFeed,
  onLongPress,
}: {
  /** 서버에 있는 사진 — 보낸 순서대로. */
  images?: ChatImageResponse[];
  /** 아직 올리는 중인 내 사진. `images`가 있으면 쓰지 않는다. */
  localImages?: ChatPhotoDraft[];
  senderName?: string;
  sentLabel?: string;
  onShareToFeed?: (uri: string) => void;
  onLongPress?: () => void;
}) {
  const tiles: Tile[] = images?.length
    ? images.map((image) => ({
        key: `i${image.imageId}`,
        imageId: image.imageId,
        aspect: croppedAspect(image.width, image.height),
      }))
    : (localImages ?? []).map((local, index) => ({
        key: `l${index}`,
        local,
        aspect: croppedAspect(local.width, local.height, local.crop),
      }));
  if (tiles.length === 0) return null;
  const photo = (tile: Tile, size: { width: number; height: number }, radius: number) => (
    <ChatPhoto
      key={tile.key}
      imageId={tile.imageId}
      local={tile.local}
      senderName={senderName}
      sentLabel={sentLabel}
      onShareToFeed={onShareToFeed}
      onLongPress={onLongPress}
      style={[size, { borderRadius: radius }]}
    />
  );
  if (tiles.length === 1) return photo(tiles[0], singlePhotoSize(tiles[0].aspect), Radius.md);
  const rows = photoRows(tiles.length);
  let offset = 0;
  return (
    <View style={styles.grid} testID="chat-photo-grid">
      {rows.map((columns, rowIndex) => {
        const rowTiles = tiles.slice(offset, offset + columns);
        offset += columns;
        const side = (CHAT_GRID_WIDTH - GAP * (columns - 1)) / columns;
        return (
          <View key={rowIndex} style={styles.row}>
            {rowTiles.map((tile) => photo(tile, { width: side, height: side }, 0))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { width: CHAT_GRID_WIDTH, gap: GAP, borderRadius: Radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: GAP },
});
