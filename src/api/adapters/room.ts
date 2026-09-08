/** Room placement adapters (배치 저장) — slots, free placements, character code. */
import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';
import { type PlacedFurniture } from '@/resources/furniture';
import { type RoomPlacementSave, type RoomPlacementWire } from '@/api/rooms';
import type { ShopCatalogue } from '@/api/adapters/shop-gacha';
import type { MyItemSummary, RoomSlotResponse } from '@/api/types';

// --- room placement (배치 저장) --------------------------------------------------

/** Inventory → itemId(string) → userItemId map (placement saves need userItemId). */
export function toUserItemMap(items: MyItemSummary[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const it of items)
    if (it.itemId != null && it.userItemId != null) map.set(String(it.itemId), it.userItemId);
  return map;
}

/**
 * 내 방 슬롯 → 표면(벽지·바닥·배경) (#925).
 *
 * 가구는 더 이상 슬롯에서 읽지 않는다 — 정본은 placements다. 표면은 서버가
 * 계속 `room_surface_slots`에 저장하고 이 배열로 돌려주므로(서버 #162) 이
 * 경로는 남는다. 소유하지 않은 항목은 건너뛴다.
 */
export function fromRoomSlots(
  slots: RoomSlotResponse[],
  cat: ShopCatalogue,
  userItemMap: Map<string, number>,
): {
  wallpaperId: string | null;
  floorId: string | null;
  backgroundId: string | null;
} {
  const itemByUserItem = new Map<number, string>();
  for (const [itemId, uid] of userItemMap) itemByUserItem.set(uid, itemId);
  let wallpaperId: string | null = null;
  let floorId: string | null = null;
  let backgroundId: string | null = null;
  for (const s of slots) {
    if (s.userItemId == null || !s.slotType) continue;
    const itemId = itemByUserItem.get(s.userItemId);
    if (!itemId) continue;
    if (s.slotType === 'wallpaper') {
      if (cat.wallpapers.some((w) => w.id === itemId)) wallpaperId = itemId;
    } else if (s.slotType === 'floor') {
      if (cat.floors.some((f) => f.id === itemId)) floorId = itemId;
    } else if (s.slotType === 'background') {
      if (cat.backgrounds.some((b) => b.id === itemId)) backgroundId = itemId;
    }
  }
  return { wallpaperId, floorId, backgroundId };
}

/**
 * FREE_V1 방 조회의 placements → 자유 배치 모델 (#327). 내 방은 userItemMap으로,
 * 남의 방은 assetKey로 카탈로그 아이템을 찾는다(둘 다 시도). z 미지정은 배열
 * 순서를 따른다. 카탈로그에 없는 항목은 건너뛴다.
 */
export function fromRoomPlacements(
  placements: RoomPlacementWire[],
  cat: ShopCatalogue,
  userItemMap?: Map<string, number>,
): PlacedFurniture[] {
  const itemByUserItem = new Map<number, string>();
  if (userItemMap) for (const [itemId, uid] of userItemMap) itemByUserItem.set(uid, itemId);
  const out: PlacedFurniture[] = [];
  for (const [i, p] of placements.entries()) {
    const byUid = p.userItemId != null ? itemByUserItem.get(p.userItemId) : undefined;
    const byAsset = p.assetKey
      ? cat.furniture.find((f) => f.assetKey === p.assetKey)?.id
      : undefined;
    const furnitureId = byUid ?? byAsset;
    if (!furnitureId || !cat.furniture.some((f) => f.id === furnitureId)) continue;
    out.push({
      furnitureId,
      x: p.positionX ?? 0.5,
      y: p.positionY ?? 0.5,
      z: p.zIndex ?? i + 1,
      scale: p.scale,
      rotationDeg: p.rotationDeg,
      flipped: p.flipped,
    });
  }
  return out;
}

/** 자유 배치 모델 → PUT /rooms/me/layout placements (내 인벤토리의 userItemId 필요). */
export function toLayoutPlacements(
  items: PlacedFurniture[],
  userItemMap: Map<string, number>,
): RoomPlacementSave[] {
  const saves: RoomPlacementSave[] = [];
  for (const p of items) {
    const uid = userItemMap.get(p.furnitureId);
    if (uid == null) continue;
    saves.push({
      userItemId: uid,
      // 서버는 소수 좌표를 그대로 저장 — 전송 전 0..1로 클램프만 해준다.
      positionX: Math.min(1, Math.max(0, p.x)),
      positionY: Math.min(1, Math.max(0, p.y)),
      zIndex: p.z,
      scale: p.scale,
      rotationDeg: p.rotationDeg,
      flipped: p.flipped,
    });
  }
  return saves;
}

/**
 * A friend's room slots → app placement. Their userItemIds mean nothing to us
 * (we only hold our own inventory), so items resolve by assetKey against the
 * shared catalogue instead. Entries without a catalogue match are skipped.
 */
export function fromFriendRoomSlots(
  slots: RoomSlotResponse[],
  cat: ShopCatalogue,
): {
  wallpaperId: string | null;
  floorId: string | null;
  backgroundId: string | null;
} {
  const byAsset = (list: { id: string; assetKey?: string }[], key: string) =>
    list.find((i) => i.assetKey && i.assetKey === key)?.id ?? null;
  let wallpaperId: string | null = null;
  let floorId: string | null = null;
  let backgroundId: string | null = null;
  for (const s of slots) {
    if (!s.assetKey || !s.slotType) continue;
    if (s.slotType === 'wallpaper') {
      wallpaperId = byAsset(cat.wallpapers, s.assetKey) ?? wallpaperId;
    } else if (s.slotType === 'floor') {
      floorId = byAsset(cat.floors, s.assetKey) ?? floorId;
    } else if (s.slotType === 'background') {
      backgroundId = byAsset(cat.backgrounds, s.assetKey) ?? backgroundId;
    }
  }
  return { wallpaperId, floorId, backgroundId };
}

/** Room character code (e.g. "cat") → app CharacterId, when the code exists app-side. */
export function characterIdFromCode(code?: string): CharacterId | undefined {
  return CHARACTER_OPTIONS.find((o) => o.id === code)?.id;
}
