import { render } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { CharacterAvatar } from '@/components/character-avatar';

const ANIMATIONS = {
  idle: 'characters/panda/animations/idle.webp',
  poseCycle: 'characters/panda/animations/pose-cycle.webp',
  wave: 'characters/panda/animations/wave.webp',
};

describe('CharacterAvatar', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders the CDN animation for the pose, skipping non-CDN keys', async () => {
    const idle = await render(<CharacterAvatar characterId="panda" animations={ANIMATIONS} />);
    expect(idle.getByTestId('cdn-animation').props.source[0].uri).toContain('idle.webp');

    // poseCycle is not a CDN key → the cycle is [idle, wave]; pose 1 hits wave.
    const mixed = await render(
      <CharacterAvatar
        characterId="panda"
        animations={{ ...ANIMATIONS, poseCycle: 'legacy/pose.webp' }}
        pose={1}
      />,
    );
    expect(mixed.getByTestId('cdn-animation').props.source[0].uri).toContain('wave.webp');
  });

  it('falls back to the bundled sprite without valid CDN keys', async () => {
    const none = await render(<CharacterAvatar characterId="panda" />);
    expect(none.queryByTestId('cdn-animation')).toBeNull();
    expect(none.getByLabelText('판다')).toBeTruthy();

    const invalid = await render(
      <CharacterAvatar characterId="panda" animations={{ idle: 'legacy/panda.webp' }} />,
    );
    expect(invalid.queryByTestId('cdn-animation')).toBeNull();
  });

  it('prefetches every frame once, but not for a single-frame set', async () => {
    const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);

    await render(<CharacterAvatar characterId="panda" animations={ANIMATIONS} />);
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch.mock.calls[0][0]).toHaveLength(3);
    expect(String(prefetch.mock.calls[0][0])).toContain('idle.webp');

    prefetch.mockClear();
    // One frame has nothing to warm besides what <Image> already loads.
    await render(<CharacterAvatar characterId="panda" animations={{ idle: ANIMATIONS.idle }} />);
    expect(prefetch).not.toHaveBeenCalled();
  });
});
