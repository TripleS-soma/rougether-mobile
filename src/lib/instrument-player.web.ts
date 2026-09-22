import { Asset } from 'expo-asset';
import type { InstrumentPlayerFactory } from '@/lib/instrument-player.types';
import { INSTRUMENT_VOLUME } from '@/resources/instrument-sounds';

export const createInstrumentPlayer: InstrumentPlayerFactory = (source, onError) => {
  const audio = new Audio(Asset.fromModule(source).uri);
  audio.preload = 'auto';
  audio.volume = INSTRUMENT_VOLUME;
  audio.loop = false;
  let disposed = false;
  let operation = 0;
  const fail = () => {
    if (!disposed) onError();
  };
  audio.addEventListener('error', fail);
  return {
    async replay() {
      if (disposed) return;
      const current = ++operation;
      audio.pause();
      audio.currentTime = 0;
      try {
        // Invoke play synchronously inside the user gesture (including Safari).
        await audio.play();
      } catch (error) {
        if (!disposed && current === operation) throw error;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++operation;
      audio.removeEventListener('error', fail);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
  };
};
