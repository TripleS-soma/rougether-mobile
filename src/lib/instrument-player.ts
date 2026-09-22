import { createAudioPlayer } from 'expo-audio';
import type { InstrumentPlayerFactory } from '@/lib/instrument-player.types';
import { INSTRUMENT_VOLUME } from '@/resources/instrument-sounds';

export const createInstrumentPlayer: InstrumentPlayerFactory = (source, onError) => {
  // A one-shot must not deactivate the session used by the native iOS speaker.
  // Leave the app's audio mode and lock-screen controls to the existing speaker.
  const player = createAudioPlayer(source, { keepAudioSessionActive: true });
  player.volume = INSTRUMENT_VOLUME;
  player.loop = false;
  let disposed = false;
  let operation = 0;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (!disposed && status.playbackState === 'error') onError();
  });
  return {
    async replay() {
      if (disposed) return;
      const current = ++operation;
      try {
        player.pause();
        await player.seekTo(0);
        if (!disposed && current === operation) player.play();
      } catch (error) {
        if (!disposed && current === operation) throw error;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++operation;
      subscription.remove();
      player.pause();
      player.remove();
    },
  };
};
