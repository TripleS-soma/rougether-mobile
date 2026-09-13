/* global jest, beforeEach */
// reanimated의 워클릿 전역 (#560) — 공식 mock은 _WORKLET을 정의하지 않아
// ReanimatedSwipeable.close() 같은 'worklet' 함수가 JS 스레드 분기에서 던진다.
// jest는 항상 JS 스레드이므로 false로 고정한다.
globalThis._WORKLET = false;

// Reanimated 4.2's official mock omits this synchronous accessibility hook.
require('react-native-reanimated').useReducedMotion = jest.fn(() => false);

// safe-area-context 공식 목 — useSafeAreaInsets()가 provider 없이도 기본 인셋(0)을
// 돌려줘 테스트에서 던지지 않게 한다 (#456: BottomNav가 hook으로 전환됨).
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// 테스트 간 AsyncStorage 격리 — 전에는 파일마다 beforeEach(AsyncStorage.clear())를
// 손으로 붙였고(15개 파일), 안 붙인 파일은 앞 테스트의 저장값을 물려받았다.
// 각 테스트를 빈 저장소에서 시작시킨다. 테스트 중간의 의도적 clear는 그대로 둔다.
beforeEach(() => require('@react-native-async-storage/async-storage').clear());

// WebView-backed minigames import from AppShell; unit tests have no native binary.
// Runner bridge tests override this mock to inspect the imperative lifecycle.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
    return React.createElement(View, props);
  });
  WebView.displayName = 'MockWebView';
  return { WebView, default: WebView };
});
