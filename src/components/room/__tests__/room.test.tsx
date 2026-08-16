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

  it('renders default furniture and the character', async () => {
    const { getByLabelText } = await render(<Room />);
    expect(getByLabelText('포근한 침대')).toBeTruthy();
    expect(getByLabelText('햇살 창문')).toBeTruthy();
    expect(getByLabelText('고양이')).toBeTruthy(); // default character (cat), pose 0
  });

  it('renders only the placed furniture and the chosen character', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <Room placedFurnitureIds={['hanok-bed']} characterId="tiger" />,
    );
    expect(getByLabelText('한옥 자개 침대')).toBeTruthy();
    expect(queryByLabelText('포근한 침대')).toBeNull();
    expect(getByLabelText('호랑이')).toBeTruthy();
  });

  it('renders an unoccupied room without any character when characterId is null', async () => {
    const { queryByLabelText } = await render(<Room placedFurnitureIds={[]} characterId={null} />);
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
      <Room
        placedFurnitureIds={[]}
        wallpaperId="w1"
        wallpapers={wallpapers}
        backgroundId="b1"
        backgrounds={backgrounds}
      />,
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
