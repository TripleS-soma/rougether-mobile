import { render } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { CharacterAvatar } from '@/components/room/character-avatar';

jest.mock('@/hooks/use-reduced-motion', () => ({ useReducedMotion: jest.fn(() => false) }));

/** 서버 poses[] 순서 그대로 (#735). */
const FRAMES = [
  'characters/panda/poses/idle.webp',
  'characters/panda/poses/wiggle.webp',
  'characters/panda/animations/wave.gif',
];

describe('CharacterAvatar', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders every animation including lying with its own accessible name', async () => {
    const motions = ['idle', 'wave', 'pose-cycle', 'lying'];
    const frames = motions.map((motion) => `characters/dog/animations/${motion}.webp`);
    const view = await render(<CharacterAvatar characterId="dog" frames={frames} />);
    for (let pose = 0; pose < motions.length; pose++) {
      await view.rerender(<CharacterAvatar characterId="dog" frames={frames} pose={pose} />);
      expect(view.getByLabelText('강아지').props.source[0].uri).toContain(frames[pose]);
      expect(view.getByTestId('cdn-animation').props.contentFit).toBe('contain');
    }
  });

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

const FOX_FRAMES = ['idle', 'pose-cycle', 'wave'].map(
  (name) => `characters/fox/animations/${name}.webp`,
);
it('plays only the opted-in fox and uses three bundled poses for a still or reduced-motion view', async () => {
  const view = await render(<CharacterAvatar characterId="fox" frames={FOX_FRAMES} animate />);
  expect(view.getByLabelText('여우').props.autoplay).toBe(true);
  expect(view.getByLabelText('여우').props.useAppleWebpCodec).toBe(false);
  expect(view.getByTestId('cdn-animation').props.source[0].uri).toContain(
    'fox/animations/idle.webp',
  );
  await view.rerender(<CharacterAvatar characterId="fox" frames={FOX_FRAMES} />);
  expect(view.queryByTestId('cdn-animation')).toBeNull();
  const first = view.getByLabelText('여우').props.source;
  await view.rerender(<CharacterAvatar characterId="fox" pose={1} />);
  expect(view.getByLabelText('여우').props.source).not.toEqual(first);
  await view.rerender(<CharacterAvatar characterId="fox" pose={3} />);
  expect(view.getByLabelText('여우').props.source).toEqual(first);
  jest.mocked(useReducedMotion).mockReturnValue(true);
  await view.rerender(<CharacterAvatar characterId="fox" frames={FOX_FRAMES} animate />);
  expect(view.queryByTestId('cdn-animation')).toBeNull();
  expect(view.getByLabelText('여우').props.autoplay).toBe(false);
  expect(view.getByLabelText('여우').props.source).toEqual(first);
  jest.mocked(useReducedMotion).mockReturnValue(false);
  await view.rerender(
    <CharacterAvatar characterId="dog" frames={['characters/dog/animations/idle.webp']} animate />,
  );
  expect(view.getByLabelText('강아지').props.autoplay).toBe(false);
});
