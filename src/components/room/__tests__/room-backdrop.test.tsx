/**
 * 방 양옆 채움 — 넓고 짧은 화면에서 방을 가운데 좁게 그릴 때, 양옆을 같은 벽지·바닥 그림으로
 * 흐리게 이어 잘린 것처럼 안 보이게 한다. 띠 높이는 방 계약의 벽(위 2/3)·바닥(아래 1/3)과 같다.
 */
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { RoomBackdrop } from '@/components/room/room';
import type { Wallpaper } from '@/resources/furniture';

const CDN_WALL: Wallpaper = {
  id: 'w-cdn',
  name: '네온 벽지',
  price: 0,
  assetKey: 'items/neon/wallpaper/neon-wallpaper.webp',
  color: '#AAAAAA',
};
const CDN_FLOOR: Wallpaper = {
  id: 'f-cdn',
  name: '보라 바닥',
  price: 0,
  assetKey: 'items/neon/floor/neon-floor.webp',
  color: '#553388',
};
const PLAIN_WALL: Wallpaper = {
  id: 'w-plain',
  name: '심플',
  price: 0,
  assetKey: 'wallpaper/simple',
  color: '#F3E9D6',
};

test('CDN 벽지·바닥은 같은 그림을 흐리게 깔고, 띠 높이는 방 계약과 같다', async () => {
  const ui = await render(
    <RoomBackdrop
      wallpapers={[CDN_WALL]}
      wallpaperId="w-cdn"
      floors={[CDN_FLOOR]}
      floorId="f-cdn"
    />,
  );
  expect(ui.getByTestId('room-backdrop').props.pointerEvents).toBe('none');
  const images = [ui.getByTestId('room-backdrop-wall'), ui.getByTestId('room-backdrop-floor')];
  for (const image of images) expect(image.props.blurRadius).toBeGreaterThan(0);
  const [wall, floor] = images.map((i) => StyleSheet.flatten(i.props.style));
  expect(wall).toMatchObject({ top: '0%', height: '66.67%' });
  expect(floor).toMatchObject({ top: '66.67%', height: '33.33%' });
});

test('그림이 없는 벽지는 색으로, 바닥이 없으면 벽 색이 아래까지 이어진다', async () => {
  const ui = await render(<RoomBackdrop wallpapers={[PLAIN_WALL]} wallpaperId="w-plain" />);
  expect(ui.getByTestId('room-backdrop-wall').props.blurRadius).toBeUndefined();
  expect(ui.queryByTestId('room-backdrop-floor')).toBeNull();
  expect(StyleSheet.flatten(ui.getByTestId('room-backdrop').props.style).backgroundColor).toBe(
    '#F3E9D6',
  );
});
