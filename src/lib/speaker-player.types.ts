export type SpeakerPlayer = {
  play: () => Promise<void>;
  stop: () => void;
  setVolume: (volume: number) => void;
  dispose: () => void;
};
export type SpeakerPlayerFactory = (
  source: number,
  volume: number,
  onPlaying: (playing: boolean) => void,
  onError: () => void,
) => SpeakerPlayer;
