// Meta SDK (#1616) — 네이티브 모듈이라 jest에서는 이벤트 이미터 생성부터 죽는다.
module.exports = {
  Settings: {
    initializeSDK: jest.fn(),
    setAdvertiserTrackingEnabled: jest.fn(() => Promise.resolve(true)),
  },
  AppEventsLogger: { logEvent: jest.fn(), flush: jest.fn() },
};
