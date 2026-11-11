import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { HouseDioramaMember } from '@/components/room/house-diorama-member';
import { Room } from '@/components/room/room';
import type { FurnitureItem, PlacedFurniture } from '@/resources/furniture';
import { dioramaRoomBox } from '@/resources/house-diorama';

const item = (id: string): FurnitureItem => ({
  id,
  name: id,
  assetKey: `items/test/furniture/${id}.png`,
  category: '가구',
  price: 0,
  slot: 'bottomLeft',
});
const furniture = [item('bed'), item('desk'), item('window'), item('plant')];

// #1685: 리디자인 집 칸은 방 배치를 고르거나 옮기지 않고 그대로 축소한다.
const placements: PlacedFurniture[] = [
  { furnitureId: 'window', x: 0.3, y: 0.22, z: 0 },
  { furnitureId: 'desk', x: 0.22, y: 0.74, z: 1, scale: 1.4 },
  { furnitureId: 'bed', x: 0.7, y: 0.8, z: 2, flipped: true },
  { furnitureId: 'plant', x: 0.92, y: 0.7, z: 3, scale: 0.6, rotationDeg: 10 },
];

describe('HouseDioramaMember', () => {
  it('방에 둔 가구를 하나도 빼지 않고 그린다', async () => {
    await render(
      <HouseDioramaMember characterId="cat" furniture={furniture} preview={{ placements }} />,
    );
    for (const p of placements) {
      expect(screen.getByTestId(`room-furniture-${p.furnitureId}`)).toBeTruthy();
    }
  });

  it('가구마다 내 방과 같은 좌표·크기·뒤집기·회전을 쓴다', async () => {
    const own = await render(<Room placements={placements} furniture={furniture} fill />);
    const expected = Object.fromEntries(
      placements.map((p) => [
        p.furnitureId,
        StyleSheet.flatten(own.getByTestId(`room-furniture-${p.furnitureId}`).props.style),
      ]),
    );

    const house = await render(
      <HouseDioramaMember characterId="cat" furniture={furniture} preview={{ placements }} />,
    );
    for (const p of placements) {
      expect(
        StyleSheet.flatten(house.getByTestId(`room-furniture-${p.furnitureId}`).props.style),
      ).toEqual(expected[p.furnitureId]);
    }
  });

  it('빈 방은 캐릭터만 그리고 가구를 지어내지 않는다', async () => {
    await render(
      <HouseDioramaMember characterId="cat" furniture={furniture} preview={{ placements: [] }} />,
    );
    expect(screen.getByLabelText('루양이')).toBeTruthy();
    expect(screen.queryByTestId(/^room-furniture-/)).toBeNull();
  });

  it('벽지·바닥·거미줄은 그리지 않는다 — 집 그림이 벽과 바닥이 된다', async () => {
    await render(
      <HouseDioramaMember
        characterId="cat"
        furniture={furniture}
        preview={{
          placements,
          wallpaperId: 'w1',
          floorId: 'f1',
          cobweb: { assetKey: 'items/cobweb.png', cleanable: false },
        }}
      />,
    );
    expect(screen.queryByLabelText('거미줄이 꼈어요')).toBeNull();
    const canvas = StyleSheet.flatten(screen.getByTestId('room-canvas').props.style);
    expect(canvas.backgroundColor).toBe('transparent');
  });

  it('방(5:6)을 칸 높이에 맞춰 가운데 둔다', async () => {
    await render(<HouseDioramaMember characterId="cat" furniture={furniture} />);
    const box = dioramaRoomBox();
    const style = StyleSheet.flatten(screen.getByTestId('diorama-room').props.style);
    expect(style).toMatchObject({
      top: 0,
      height: '100%',
      left: `${box.left * 100}%`,
      width: `${box.width * 100}%`,
    });
  });
});
