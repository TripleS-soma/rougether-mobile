/**
 * react-native-worklets stub for Jest — the native worklets runtime doesn't
 * exist under jest-expo, and reanimated is already mapped to its official
 * mock. Everything degrades to pass-through/no-op (#327 test setup).
 */
const passthrough = (v) => v;
module.exports = new Proxy(
  {
    __esModule: true,
    createSerializable: passthrough,
    serializableMappingCache: { get: () => undefined, set: () => {} },
    isWorkletFunction: () => false,
    // reanimated가 버전 호환성을 검사한다 — 설치 버전(0.7.4)을 흉내낸다.
    version: '0.7.4',
    jsVersion: '0.7.4',
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      return passthrough;
    },
  },
);
