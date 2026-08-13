/**
 * @react-native-firebase/analytics mock (#438) — 네이티브 모듈 없이 modular
 * API 표면만 흉내낸다. 호출 검증은 jest.fn으로.
 */
module.exports = {
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(() => Promise.resolve()),
  logScreenView: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(() => Promise.resolve()),
};
