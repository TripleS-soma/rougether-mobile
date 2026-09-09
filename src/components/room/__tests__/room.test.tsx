import { Image } from 'expo-image';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Room } from '@/components/room/room';

describe('Room', () => {
  it('cycles every animated cat pose on taps and keeps friend stills separate', async () => {
    const screen = await render(
      <Room characterId="cat" interactiveCharacter animateCharacter={false} />,
    );
    const names = ['idle', 'blink', 'wink', 'seated', 'wave', 'stretch', 'sleep', 'groom', 'idle'];
    for (const name of names) {
      const avatar = screen.getByTestId('approved-character');
      expect(avatar.props.autoplay).toBe(true);
      expect(avatar.props.source[0].testUri).toContain(`cat-approved-${name}`);
      await fireEvent.press(screen.getByRole('button', { name: '고양이, 눌러서 포즈 바꾸기' }));
    }
    await screen.rerender(<Room characterId="cat" animateCharacter={false} />);
    expect(screen.queryByRole('button', { name: '고양이, 눌러서 포즈 바꾸기' })).toBeNull();
    const still = screen.getByTestId('approved-character-still');
    expect(still.props.source[0].testUri).toContain('cat-approved-still');
    expect(still.props.autoplay).toBe(false);
  });

  it.each([
    { fill: false, frames: undefined },
    { fill: true, frames: undefined },
    { fill: false, frames: ['characters/cat/animations/idle.webp'] },
    { fill: true, frames: ['characters/cat/animations/idle.webp'] },
  ])(
    'keeps static and interactive characters aligned (fill=$fill, frames=$frames)',
    async ({ fill, frames }) => {
      const { getByLabelText, rerender } = await render(
        <Room fill={fill} characterFrames={frames} />,
      );
      // Check the rendered image, where the avatar's default 96px height used to
      // survive and center small house characters above their floor position.
      const staticImage = StyleSheet.flatten(getByLabelText('고양이').props.style);
      expect(staticImage).toMatchObject({ width: '100%', height: '100%' });
      const staticFrame = StyleSheet.flatten(getByLabelText('고양이').parent?.props.style);
      expect(staticFrame).toMatchObject({ width: '42%', aspectRatio: 1, bottom: '16%' });
      expect(staticFrame.height).toBeUndefined();

      await rerender(<Room fill={fill} characterFrames={frames} interactiveCharacter />);
      expect(StyleSheet.flatten(getByLabelText('고양이, 눌러서 포즈 바꾸기').props.style)).toEqual(
        staticFrame,
      );
      expect(StyleSheet.flatten(getByLabelText('고양이').props.style)).toEqual(staticImage);
    },
  );

  it('adds vertical space while keeping a saved center and width-sized sprites', async () => {
    const placement = {
      furnitureId: 'plant',
      x: 0.3,
      y: 0.7,
      z: 2,
      scale: 1.5,
      rotationDeg: 15,
      flipped: true,
    };
    const { getByTestId, getByLabelText } = await render(
      <Room placements={[placement]} interactiveCharacter />,
    );
    const canvas = StyleSheet.flatten(getByTestId('room-canvas').props.style);
    expect(360 / canvas.aspectRatio).toBeCloseTo(432);
    const item = StyleSheet.flatten(getByTestId('room-furniture-plant').props.style);
    const width = (parseFloat(item.width) * 360) / 100;
    expect(width).toBeCloseTo(100.8);
    expect((parseFloat(item.left) * 360) / 100 + width / 2).toBeCloseTo(108);
    expect((parseFloat(item.top) * 432) / 100 + width / 2).toBeCloseTo(302.4);
    expect(item.transform).toEqual([{ scale: 1.5 }, { rotate: '15deg' }, { scaleX: -1 }]);
    const character = StyleSheet.flatten(getByLabelText('고양이, 눌러서 포즈 바꾸기').props.style);
    expect(character).toMatchObject({ width: '42%', aspectRatio: 1 });
    expect(character.height).toBeUndefined();
    expect(placement).toEqual({
      furnitureId: 'plant',
      x: 0.3,
      y: 0.7,
      z: 2,
      scale: 1.5,
      rotationDeg: 15,
      flipped: true,
    });
  });

  // 장기 미접속 거미줄 (#829, 서버 #277) — 방 응답의 nullable cobweb.
  it('CDN 키가 있으면 거미줄을 그린다', async () => {
    const { getByLabelText } = await render(
      <Room cobweb={{ assetKey: 'items/cobweb.png', cleanable: true }} />,
    );
    expect(getByLabelText('거미줄이 꼈어요')).toBeTruthy();
  });

  it('거미줄이 없거나 CDN 키가 아니면 그리지 않는다', async () => {
    const clean = await render(<Room />);
    expect(clean.queryByLabelText('거미줄이 꼈어요')).toBeNull();

    // 로컬 카탈로그 키는 CDN에 아트가 없다 — 구버전 서버·목 데이터 대비.
    const legacy = await render(<Room cobweb={{ assetKey: 'furniture/bed' }} />);
    expect(legacy.queryByLabelText('거미줄이 꼈어요')).toBeNull();
  });

  it('placements에 실린 가구와 캐릭터를 그린다', async () => {
    const { getByLabelText } = await render(
      <Room
        placements={[
          { furnitureId: 'bed', x: 0.3, y: 0.7, z: 1 },
          { furnitureId: 'window', x: 0.7, y: 0.3, z: 2 },
        ]}
      />,
    );
    expect(getByLabelText('포근한 침대')).toBeTruthy();
    expect(getByLabelText('햇살 창문')).toBeTruthy();
    expect(getByLabelText('고양이')).toBeTruthy(); // default character (cat), pose 0
  });

  it('placements에 없는 가구는 그리지 않는다', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <Room
        placements={[{ furnitureId: 'hanok-bed', x: 0.5, y: 0.5, z: 1 }]}
        characterId="tiger"
      />,
    );
    expect(getByLabelText('한옥 자개 침대')).toBeTruthy();
    expect(queryByLabelText('포근한 침대')).toBeNull();
    expect(getByLabelText('호랑이')).toBeTruthy();
  });

  it('placements가 없으면 가구 없는 방이다 — 슬롯으로 되돌아가지 않는다 (#925)', async () => {
    // 예전엔 placedFurnitureIds가 기본 가구를 슬롯에 그렸다(prop 자체가 사라졌다).
    // 이제 가구는 placements가 정본이라, 안 주면 아무것도 안 나온다.
    const { queryByLabelText, getByLabelText } = await render(<Room />);
    expect(queryByLabelText('포근한 침대')).toBeNull();
    expect(queryByLabelText('햇살 창문')).toBeNull();
    expect(getByLabelText('고양이')).toBeTruthy(); // 캐릭터는 그대로.
  });

  it('renders an unoccupied room without any character when characterId is null', async () => {
    const { queryByLabelText } = await render(<Room characterId={null} />);
    // 빈방 타일(#281): 방만 있고 캐릭터·가구가 없다.
    expect(queryByLabelText('고양이')).toBeNull();
    expect(queryByLabelText('포근한 침대')).toBeNull();
  });

  it('renders CDN wallpaper art even when a background covers the room', async () => {
    const wallpapers = [
      {
        id: 'w1',
        name: '나뭇잎 벽지',
        price: 100,
        assetKey: 'items/a/wallpaper.png',
        color: '#EEE',
      },
    ];
    const backgrounds = [
      { id: 'b1', name: '해변 배경', price: 100, assetKey: 'items/a/bg.png', color: '#DDD' },
    ];
    const { getByLabelText } = await render(
      <Room wallpaperId="w1" wallpapers={wallpapers} backgroundId="b1" backgrounds={backgrounds} />,
    );
    // The wall band renders above the full-bleed background, so an applied
    // wallpaper is always visible.
    expect(getByLabelText('나뭇잎 벽지')).toBeTruthy();
    expect(getByLabelText('해변 배경')).toBeTruthy();
  });

  it('exposes a tappable character that cycles poses when interactive', async () => {
    const { getByLabelText } = await render(<Room interactiveCharacter />);
    const character = getByLabelText('고양이, 눌러서 포즈 바꾸기');
    expect(character).toBeTruthy();
    // Tapping cycles the pose without unmounting the character.
    fireEvent.press(character);
    expect(getByLabelText('고양이, 눌러서 포즈 바꾸기')).toBeTruthy();
  });

  // 서버 등록 포즈 프레임 — 순서 그대로 순환한다 (#735).
  const PANDA_FRAMES = [
    'characters/panda/animations/idle.webp',
    'characters/panda/animations/pose-cycle.webp',
    'characters/panda/animations/wave.webp',
  ];

  it('renders the first CDN frame when the server sent pose keys', async () => {
    const { getByTestId } = await render(
      <Room characterId="panda" characterFrames={PANDA_FRAMES} />,
    );
    expect(getByTestId('cdn-animation').props.source[0].uri).toContain(
      'characters/panda/animations/idle.webp',
    );
  });

  it('cycles the CDN frames in registration order on tap, wrapping around', async () => {
    const { getByLabelText, getByTestId } = await render(
      <Room characterId="panda" characterFrames={PANDA_FRAMES} interactiveCharacter />,
    );
    const character = getByLabelText('판다, 눌러서 포즈 바꾸기');
    await fireEvent.press(character);
    expect(getByTestId('cdn-animation').props.source[0].uri).toContain('pose-cycle.webp');
    await fireEvent.press(character);
    expect(getByTestId('cdn-animation').props.source[0].uri).toContain('wave.webp');
    await fireEvent.press(character);
    expect(getByTestId('cdn-animation').props.source[0].uri).toContain('idle.webp');
  });

  it('falls back to the bundled sprite when the frame keys are not CDN keys', async () => {
    const { queryByTestId, getByLabelText } = await render(
      <Room characterId="panda" characterFrames={['legacy/panda.webp']} />,
    );
    expect(queryByTestId('cdn-animation')).toBeNull();
    expect(getByLabelText('판다')).toBeTruthy();
  });

  // 포즈를 넘길 수 있는 화면에서만 다음 장을 미리 받는다 (#970).
  describe('포즈 프레임 프리페치', () => {
    const FRAMES = [
      'characters/panda/a.webp',
      'characters/panda/b.webp',
      'characters/panda/c.webp',
    ];

    it('interactiveCharacter면 나머지 프레임을 미리 받는다', async () => {
      const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
      await render(<Room characterId="panda" characterFrames={FRAMES} interactiveCharacter />);
      expect(prefetch).toHaveBeenCalledTimes(1);
      prefetch.mockRestore();
    });

    it('아니면 받지 않는다 — 친구 방은 첫 장만 보여줄 수 있다', async () => {
      const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
      await render(<Room characterId="panda" characterFrames={FRAMES} />);
      expect(prefetch).not.toHaveBeenCalled();
      prefetch.mockRestore();
    });
  });

  it('비인터랙티브 캐릭터도 자리 박스를 꽉 채운다 — 기본 96px 높이가 남지 않는다 (#1194)', async () => {
    const { getByLabelText } = await render(<Room characterId="cat" />);
    const avatar = StyleSheet.flatten(getByLabelText('고양이').props.style);
    expect(avatar.width).toBe('100%');
    expect(avatar.height).toBe('100%');
    // 자리 박스(부모)는 계약 좌표 — 폭 42%, 정사각, 바닥에서 16%.
    const slot = StyleSheet.flatten(getByLabelText('고양이').parent?.props.style);
    expect(slot.width).toBe('42%');
    expect(slot.bottom).toBe('16%');
    expect(slot.aspectRatio).toBe(1);
  });
});
