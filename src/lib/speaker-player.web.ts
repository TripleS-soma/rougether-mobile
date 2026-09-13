import { Asset } from 'expo-asset';
import type { SpeakerPlayerFactory } from '@/lib/speaker-player.types';

/** Decode once per play session; Web Audio loops PCM without MP3 seek/reload gaps. */
export const createSpeakerPlayer: SpeakerPlayerFactory = (source, volume, onPlaying, onError) => {
  const context = new AudioContext();
  const gain = context.createGain();
  gain.gain.value = volume;
  gain.connect(context.destination);
  let node: AudioBufferSourceNode | null = null;
  let disposed = false;
  const abort = new AbortController();
  context.onstatechange = () => {
    if (!disposed && node) onPlaying(context.state === 'running');
  };
  return {
    async play() {
      // Resume within the tap gesture, before asynchronous fetching/decoding.
      await context.resume();
      const response = await fetch(Asset.fromModule(source).uri, { signal: abort.signal });
      if (!response.ok) throw new Error('Audio asset unavailable');
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      if (disposed) return;
      node = context.createBufferSource();
      node.buffer = decoded;
      node.loop = true;
      node.connect(gain);
      node.onended = () => {
        if (!disposed) onError();
      };
      node.start();
      onPlaying(context.state === 'running');
    },
    stop() {
      node?.stop();
      onPlaying(false);
    },
    setVolume(value) {
      gain.gain.setTargetAtTime(value, context.currentTime, 0.025);
    },
    dispose() {
      disposed = true;
      abort.abort();
      context.onstatechange = null;
      if (node) {
        node.onended = null;
        node.stop();
        node.disconnect();
      }
      gain.disconnect();
      void context.close().catch(() => {});
    },
  };
};
