// @sentry/react-native 모킹 (#801) — SDK가 ESM+네이티브라 jest가 파싱하지
// 못한다. 네이티브 모듈 계열(파이어베이스·카카오 등)과 같은 처리.
module.exports = {
  init: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  lastEventId: jest.fn(() => undefined),
  wrap: (component) => component,
  // 성능 추적 (#1376) — 통합 객체는 초기화 인자로만 쓰인다.
  reactNavigationIntegration: jest.fn(() => ({
    name: 'ReactNavigation',
    registerNavigationContainer: jest.fn(),
  })),
  reactNativeTracingIntegration: jest.fn(() => ({ name: 'ReactNativeTracing' })),
  // 실제 @sentry/react ErrorBoundary와 같은 계약: 자식 렌더 에러 시 fallback({ error, resetError }).
  ErrorBoundary: (() => {
    const React = require('react');
    return class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
        this.resetError = () => this.setState({ error: null });
      }
      static getDerivedStateFromError(error) {
        return { error };
      }
      componentDidCatch(error) {
        this.props.onError?.(error);
      }
      render() {
        if (this.state.error) {
          const { fallback } = this.props;
          return typeof fallback === 'function'
            ? fallback({ error: this.state.error, resetError: this.resetError })
            : (fallback ?? null);
        }
        return this.props.children;
      }
    };
  })(),
};
