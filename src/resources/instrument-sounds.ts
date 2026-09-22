/** Exact catalog keys: renamed items and different inventory IDs keep their sound. */
export const INSTRUMENT_SOUNDS = [
  {
    assetKey: 'items/cozy-band-room/furniture/electric-guitar-v1.png',
    source: require('@/assets/audio/instruments/electric-guitar-tap-v1.wav') as number,
  },
  {
    assetKey: 'items/cozy-band-room/furniture/drum-kit-v1.png',
    source: require('@/assets/audio/instruments/drum-kit-tap-v1.wav') as number,
  },
  {
    assetKey: 'items/cozy-band-room/furniture/bass-guitar-v1.png',
    source: require('@/assets/audio/instruments/bass-guitar-tap-v1.wav') as number,
  },
  {
    assetKey: 'items/cozy-band-room/furniture/keyboard-v1.png',
    source: require('@/assets/audio/instruments/keyboard-tap-v1.wav') as number,
  },
] as const;

export const INSTRUMENT_VOLUME = 0.55;
export const INSTRUMENT_COOLDOWN_MS = 140;

export function getInstrumentSound(assetKey?: string | null) {
  return INSTRUMENT_SOUNDS.find((sound) => sound.assetKey === assetKey);
}
