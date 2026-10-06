import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { SpeakerPlayerFactory } from '@/lib/speaker-player.types';

// Android ExoPlayer repeats a prejoined PCM file natively, even with JS suspended.
export const createSpeakerPlayer: SpeakerPlayerFactory = (source, volume, onPlaying, onError) => {
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
      // 1.5.4부터 백그라운드 재생을 뺐다 — 스피커는 스타터 뽑기(서버 미배포)로만 얻는데, Android
      // 포그라운드 서비스(MEDIA_PLAYBACK) 권한은 Play 선언·시연 영상을 요구한다(2026-10-06 결정).
      // app.json `enableBackgroundPlayback: false`라 재생 서비스가 매니페스트에 없으니 잠금화면
      // 세션(setActiveForLockScreen)도 켜지 않는다 — 켜면 없는 서비스를 띄우려 한다.
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });
      if (disposed || current !== operation) return;
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
      player.pause();
      player.remove();
    },
  };
};
