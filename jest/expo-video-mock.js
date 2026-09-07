/* global jest */
const React = require('react');
const { View } = require('react-native');

let lastPlayer = null;

function VideoView(props) {
  return React.createElement(View, {
    ...props,
    testID: props.testID ?? 'mock-video-view',
  });
}

function useVideoPlayer(source, setup) {
  const player = React.useMemo(() => {
    const listeners = new Map();
    let released = false;
    let accessesAfterRelease = 0;
    const lifecycle = [];
    const assertAlive = (operation) => {
      if (released) {
        accessesAfterRelease += 1;
        throw new Error(`Native SharedObject is released: ${operation}`);
      }
    };
    const state = { muted: true, volume: 0, currentTime: 0, status: 'readyToPlay' };
    const instance = {
      source,
      loop: false,
      timeUpdateEventInterval: 0,
      play: jest.fn(() => assertAlive('play')),
      pause: jest.fn(() => {
        assertAlive('pause');
        lifecycle.push('pause');
      }),
      replay: jest.fn(),
      replace: jest.fn(),
      addListener: jest.fn((name, handler) => {
        assertAlive('addListener');
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(handler);
        return {
          remove: () => {
            assertAlive('removeListener');
            lifecycle.push(`remove:${name}`);
            listeners.get(name)?.delete(handler);
          },
        };
      }),
      __emit(name, payload) {
        // Test harness can deliver already queued events without touching a dead native object.
        if (!released && name === 'timeUpdate') state.currentTime = payload.currentTime;
        if (!released && name === 'statusChange') state.status = payload.status;
        listeners.get(name)?.forEach((handler) => handler(payload));
      },
      __listenerCount() {
        return [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
      },
      __release() {
        lifecycle.push('release');
        released = true;
      },
      __snapshot: () => ({ ...state, released, accessesAfterRelease, lifecycle: [...lifecycle] }),
    };
    for (const key of Object.keys(state)) {
      Object.defineProperty(instance, key, {
        enumerable: true,
        get: () => {
          assertAlive(`get:${key}`);
          return state[key];
        },
        set: (value) => {
          assertAlive(`set:${key}`);
          state[key] = value;
        },
      });
    }
    setup?.(instance);
    return instance;
    // Match Expo: setup only runs when the source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);
  // Native useVideoPlayer registers this passive cleanup before caller effects.
  React.useEffect(() => () => player.__release(), [player]);
  lastPlayer = player;
  return player;
}

module.exports = {
  VideoView,
  useVideoPlayer,
  __getLastVideoPlayer: () => lastPlayer,
  __emitVideoEvent: (event, payload) => lastPlayer?.__emit(event, payload),
  __resetVideoPlayerMock: () => {
    lastPlayer = null;
  },
};
