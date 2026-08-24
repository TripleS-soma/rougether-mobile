import { render } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { CharacterAvatar } from '@/components/room/character-avatar';

/** 서버 poses[] 순서 그대로 (#735). */
const FRAMES = [
  'characters/panda/poses/idle.webp',
  'characters/panda/poses/wiggle.webp',
  'characters/panda/animations/wave.gif',
];

describe('CharacterAvatar', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders the CDN frame for the pose, skipping non-CDN keys', async () => {
    const first = await render(<CharacterAvatar characterId="panda" frames={FRAMES} />);
    expect(first.getByTestId('cdn-animation').props.source[0].uri).toContain('idle.webp');

    // 두 번째 키가 CDN 키가 아니면 순환은 [idle, wave] — pose 1은 wave.
    const mixed = await render(
      <CharacterAvatar
        characterId="panda"
        frames={[FRAMES[0], 'legacy/pose.webp', FRAMES[2]]}
        pose={1}
      />,
    );
    expect(mixed.getByTestId('cdn-animation').props.source[0].uri).toContain('wave.gif');
  });

  it('falls back to the bundled sprite without valid CDN keys', async () => {
    const none = await render(<CharacterAvatar characterId="panda" />);
    expect(none.queryByTestId('cdn-animation')).toBeNull();
    expect(none.getByLabelText('판다')).toBeTruthy();

    const invalid = await render(
      <CharacterAvatar characterId="panda" frames={['legacy/panda.webp']} />,
    );
    expect(invalid.queryByTestId('cdn-animation')).toBeNull();
  });

  it('prefetchFrames를 켜면 나머지 프레임을 미리 받는다 (단일 프레임은 제외)', async () => {
    const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);

    await render(<CharacterAvatar characterId="panda" frames={FRAMES} prefetchFrames />);
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch.mock.calls[0][0]).toHaveLength(3);
    expect(String(prefetch.mock.calls[0][0])).toContain('idle.webp');

    prefetch.mockClear();
    // One frame has nothing to warm besides what <Image> already loads.
    await render(<CharacterAvatar characterId="panda" frames={[FRAMES[0]]} prefetchFrames />);
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('기본값에서는 프리페치하지 않는다 — 포즈를 못 넘기는 화면 (#970)', async () => {
    // 친구 방·온보딩 캐러셀은 첫 장만 보여줄 수 있는데도 전부 받고 있었다
    // (고양이 기준 친구 방 1회 방문에 1.8MB).
    const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    await render(<CharacterAvatar characterId="panda" frames={FRAMES} />);
    expect(prefetch).not.toHaveBeenCalled();
  });
});
