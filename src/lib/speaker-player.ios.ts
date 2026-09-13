import { Asset } from 'expo-asset';
import { AppState } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import type { SpeakerPlayerFactory } from '@/lib/speaker-player.types';

type NativeSpeaker = {
  prepare(id: string, uri: string, volume: number, title: string): Promise<void>;
  play(id: string): Promise<void>;
  pause(id: string): Promise<void>;
  setVolume(id: string, volume: number): Promise<void>;
  dispose(id: string): Promise<void>;
  refresh(id: string): Promise<void>;
  addListener(
    event: 'onStatus',
    listener: (status: { id: string; playing: boolean; error: boolean }) => void,
  ): { remove(): void };
};
let sequence = 0;
export const createSpeakerPlayer: SpeakerPlayerFactory = (
  source,
  volume,
  onPlaying,
  onError,
  title = '방에 흐르는 소리',
) => {
  // Resolve lazily: older binaries can still launch and display a playback error.
  const native = requireNativeModule<NativeSpeaker>('RougetherSpeaker');
  const id = `speaker-${Date.now()}-${++sequence}`;
  let disposed = false;
  let operation = 0;
  let currentVolume = volume;
  const subscription = native.addListener('onStatus', (status) => {
    if (disposed || status.id !== id) return;
    if (status.error) onError();
    else onPlaying(status.playing);
  });
  const focus = AppState.addEventListener('change', (state) => {
    // Remote controls execute natively while JS sleeps; refresh UI on return.
    if (state === 'active' && !disposed) void native.refresh(id).catch(onError);
  });
  return {
    async play() {
      const current = ++operation;
      const asset = await Asset.fromModule(source).downloadAsync();
      if (disposed || current !== operation) return;
      if (!asset.localUri) throw new Error('Audio file unavailable');
      await native.prepare(id, asset.localUri, currentVolume, title);
      if (disposed || current !== operation) {
        await native.dispose(id);
        return;
      }
      await native.setVolume(id, currentVolume);
      if (disposed || current !== operation) {
        await native.dispose(id);
        return;
      }
      await native.play(id);
    },
    stop() {
      ++operation;
      void native.pause(id).catch(onError);
    },
    setVolume(value) {
      currentVolume = value;
      void native.setVolume(id, value).catch(onError);
    },
    dispose() {
      disposed = true;
      ++operation;
      focus.remove();
      subscription.remove();
      void native.dispose(id).catch(() => {});
    },
  };
};
