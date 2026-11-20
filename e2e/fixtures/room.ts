import type { RoomWithLayout } from '../../src/api/rooms';
import type { ItemResponse, MyItemSummary } from '../../src/api/types';
import { E2E_USER_ID, type List, NOW_ISO } from './common';

const furniture = [
  { id: 101, name: '원목 책상', slot: 'topLeft', x: 0.3, y: 0.45 },
  { id: 102, name: '초록 스탠드', slot: 'topRight', x: 0.7, y: 0.4 },
  { id: 103, name: '둥근 러그', slot: 'bottomCenter', x: 0.5, y: 0.75 },
] as const;

const items = furniture.map(
  (f) =>
    ({
      id: f.id,
      name: f.name,
      assetKey: `items/e2e/furniture-${f.id}.png`,
      placementType: 'positioned',
      defaultSlot: f.slot,
      defaultScale: 1,
      defaultPositionX: null,
      defaultPositionY: null,
      categoryCode: 'furniture',
      purchaseCurrencyType: 'COIN',
      priceAmount: 100,
      isLimited: false,
      owned: true,
    }) satisfies ItemResponse,
);

const myItems = furniture.map(
  (f) =>
    ({
      userItemId: f.id + 1000,
      itemId: f.id,
      name: f.name,
      assetKey: `items/e2e/furniture-${f.id}.png`,
      categoryCode: 'furniture',
      placementType: 'positioned',
      defaultSlot: f.slot,
      defaultScale: 1,
      defaultPositionX: null,
      defaultPositionY: null,
      acquiredAt: NOW_ISO,
    }) satisfies MyItemSummary,
);

const room = {
  roomUserId: E2E_USER_ID,
  ownerBio: null,
  growthLevel: 2,
  growthPoints: 40,
  pointsToNextLevel: 60,
  characterUnlocked: true,
  characterUnlockLevel: 1,
  characterScale: 1,
  layoutFormat: 'FREE_V1',
  layoutRevision: 3,
  character: { characterId: 1, code: 'cat', name: '고양이', assetKey: 'characters/cat.png' },
  slots: [],
  placements: furniture.map((f, i) => ({
    userItemId: f.id + 1000,
    assetKey: `items/e2e/furniture-${f.id}.png`,
    positionX: f.x,
    positionY: f.y,
    zIndex: i + 1,
    scale: 1,
  })),
  streak: { currentCount: 3, longestCount: 5 },
  updatedAt: NOW_ISO,
} satisfies RoomWithLayout;

/** 방 — 가구 3개를 놓은 자유 배치 방. */
export const ROOM_FIXTURES = {
  'GET /rooms/me': room,
  'GET /items': { items } satisfies List<ItemResponse>,
  'GET /me/items': { items: myItems } satisfies List<MyItemSummary>,
};

/** 집 구성원의 방도 같은 모양 — 가구 배치를 그대로 쓴다. */
export const MEMBER_ROOM = room;
