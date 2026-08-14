// @sentry/react-native 모킹 (#801) — SDK가 ESM+네이티브라 jest가 파싱하지
// 못한다. 네이티브 모듈 계열(파이어베이스·카카오 등)과 같은 처리.
module.exports = {
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  wrap: (component) => component,
};
