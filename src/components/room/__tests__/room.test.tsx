import { fireEvent, render } from '@testing-library/react-native';

import { Room } from '@/components/room/room';

describe('Room', () => {
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
});
