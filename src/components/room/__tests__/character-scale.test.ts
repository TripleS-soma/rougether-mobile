import artAnchors from '@/components/room/character-art-anchors.json';
import {
  characterArtOffset,
  characterFrameStyle,
  normalizeCharacterScale,
} from '@/components/room/character-scale';
import { ROOM_RENDER_CONTRACT } from '@/components/room/room-render-contract';

describe('character size anchors', () => {
  it.each([0.7, 0.85, 1, 1.15, 1.3])('keeps horizontal center and feet fixed at %s', (scale) => {
    const frame = characterFrameStyle(scale);
    const left = parseFloat(String(frame.left));
    const width = parseFloat(String(frame.width));
    expect(left + width / 2).toBeCloseTo(ROOM_RENDER_CONTRACT.character.centerX * 100);
    expect(parseFloat(String(frame.bottom))).toBeCloseTo(
      ROOM_RENDER_CONTRACT.character.bottom * 100,
    );
    expect(width).toBeCloseTo(ROOM_RENDER_CONTRACT.character.width * scale * 100);
    expect(frame.aspectRatio).toBe(ROOM_RENDER_CONTRACT.character.aspectRatio);
  });
  it('uses safe defaults and never renders invalid or extreme scales', () => {
    expect(normalizeCharacterScale(undefined)).toBe(1);
    expect(normalizeCharacterScale(NaN)).toBe(1);
    expect(normalizeCharacterScale(Infinity)).toBe(1);
    expect(normalizeCharacterScale(0)).toBe(0.7);
    expect(normalizeCharacterScale(100)).toBe(1.3);
  });
});

// Transparent padding must not move the visible baseline as the frame is resized.
describe('visible character anchors', () => {
  const anchors: Record<string, { centerOffset: number; bottomInset: number }> = artAnchors;
  it.each(Object.keys(anchors))('keeps %s centered and grounded', (key) => {
    const anchor = anchors[key];
    for (const scale of [0.7, 1, 1.3]) {
      const offset = characterArtOffset(key, scale);
      const left = parseFloat(String(offset.left)) / 100;
      const top = parseFloat(String(offset.top)) / 100;
      expect(scale * (anchor.centerOffset + left)).toBeCloseTo(0);
      expect(scale * (-anchor.bottomInset + top)).toBeCloseTo(-anchor.bottomInset);
    }
  });
});
