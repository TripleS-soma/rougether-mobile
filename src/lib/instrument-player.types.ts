export type InstrumentPlayer = {
  replay: () => Promise<void>;
  dispose: () => void;
};

export type InstrumentPlayerFactory = (source: number, onError: () => void) => InstrumentPlayer;
