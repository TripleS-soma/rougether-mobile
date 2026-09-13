import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioStatus } from 'expo-audio';
import type { SpeakerPlayerFactory } from '@/lib/speaker-player.types';

const CROSSFADE_SECONDS = 2;
/** Two preloaded players overlap before EOF; no pause/seek at the audible boundary. */
export const createSpeakerPlayer: SpeakerPlayerFactory = (
  source,
  initialVolume,
  onPlaying,
  onError,
) => {
  const players = [
    createAudioPlayer(source, { updateInterval: 100 }),
    createAudioPlayer(source, { updateInterval: 100 }),
  ];
  const statuses: (AudioStatus | null)[] = [null, null];
  let volume = initialVolume;
  let active = 0;
  let disposed = false;
  let operation = 0;
  let wanted = false;
  let fading: { progress: number } | null = null;
  const applyVolume = () => {
    const progress = fading?.progress ?? 0;
    players[active].volume = volume * (1 - progress);
    players[1 - active].volume = volume * progress;
  };
  const subscriptions = players.map((player, index) =>
    player.addListener('playbackStatusUpdate', (status) => {
      if (disposed) return;
      statuses[index] = status;
      if (status.playbackState === 'error') {
        onError();
        return;
      }
      if (!wanted) return;
      onPlaying(statuses.some((s) => s?.playing && !s.isBuffering));
      if (fading) return;
      if (
        index === active &&
        status.playing &&
        status.duration > CROSSFADE_SECONDS * 2 &&
        status.duration - status.currentTime <= CROSSFADE_SECONDS &&
        statuses[1 - active]?.isLoaded
      ) {
        fading = { progress: 0 };
        players[1 - active].play();
      }
    }),
  );
  applyVolume();
  const timer = setInterval(() => {
    if (!wanted || !fading || disposed) return;
    const next = statuses[1 - active];
    if (!next?.playing || next.isBuffering) return;
    // Fade follows the incoming player's audio position, not JS wall-clock drift.
    fading.progress = Math.min(1, next.currentTime / CROSSFADE_SECONDS);
    applyVolume();
    if (fading.progress < 1) return;
    const previous = players[active];
    active = 1 - active;
    fading = null;
    applyVolume();
    previous.pause();
    void previous.seekTo(0).catch(() => {
      if (!disposed) onError();
    });
  }, 50);
  return {
    async play() {
      const current = ++operation;
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });
      if (!disposed && current === operation) {
        wanted = true;
        players[active].play();
      }
    },
    stop() {
      ++operation;
      wanted = false;
      players.forEach((player) => player.pause());
    },
    setVolume(value) {
      volume = value;
      applyVolume();
    },
    dispose() {
      disposed = true;
      wanted = false;
      ++operation;
      clearInterval(timer);
      subscriptions.forEach((subscription) => subscription.remove());
      players.forEach((player) => {
        player.pause();
        player.remove();
      });
    },
  };
};
