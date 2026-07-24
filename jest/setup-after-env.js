// safe-area-context 공식 목 — useSafeAreaInsets()가 provider 없이도 기본 인셋(0)을
// 돌려줘 테스트에서 던지지 않게 한다 (#456: BottomNav가 hook으로 전환됨).
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
