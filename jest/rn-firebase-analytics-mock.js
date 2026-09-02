/**
 * @react-native-firebase/analytics mock (#438) — 네이티브 모듈 없이 modular
 * API 표면만 흉내낸다. 호출 검증은 jest.fn으로.
 *
 * RNFB 26(#1031)부터 앱은 `logEvent`를 인스턴스 메서드로 부른다(모듈러
 * 함수가 Promise를 `void`로 버려 `.catch`를 달 수 없어서). 인스턴스 호출을
 * 모듈 `logEvent`로 흘려, 기존 테스트의 `(analytics, name, params)` 호출
 * 모양 단언이 그대로 성립하게 한다.
 */
const logEvent = jest.fn(() => Promise.resolve());
const instance = {
  logEvent: (name, params) => logEvent(instance, name, params),
};

module.exports = {
  getAnalytics: jest.fn(() => instance),
  logEvent,
  logScreenView: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(() => Promise.resolve()),
  // 개발 빌드 수집 차단 (#954).
  setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
};
