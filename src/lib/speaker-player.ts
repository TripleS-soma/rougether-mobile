import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { SpeakerPlayerFactory } from '@/lib/speaker-player.types';
import { i18n } from '@/i18n';

// Android ExoPlayer repeats a prejoined PCM file natively, even with JS suspended.
export const createSpeakerPlayer: SpeakerPlayerFactory = (
  source,
  volume,
  onPlaying,
  onError,
  title = i18n.t('roomShop.speaker.nowPlayingTitle'),
) => {
  const player = createAudioPlayer(source, { updateInterval: 250 });
  player.loop = true;
  player.volume = volume;
  let disposed = false;
  let operation = 0;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (disposed) return;
    if (status.playbackState === 'error') onError();
    else onPlaying(status.playing && !status.isBuffering);
  });
  return {
    async play() {
      const current = ++operation;
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      if (disposed || current !== operation) return;
      player.setActiveForLockScreen(
        true,
        { title, artist: i18n.t('roomShop.speaker.nowPlayingArtist') },
        { showSeekBackward: false, showSeekForward: false },
      );
      player.play();
    },
    stop() {
      ++operation;
      player.pause();
    },
    setVolume(value) {
      player.volume = value;
    },
    dispose() {
      disposed = true;
      ++operation;
      subscription.remove();
      player.setActiveForLockScreen(false);
      player.pause();
      player.remove();
    },
  };
};
