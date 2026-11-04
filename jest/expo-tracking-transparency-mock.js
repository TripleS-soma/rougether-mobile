// ATT (#1616) — 기본은 이미 거부된 상태라 테스트가 팝업 경로를 타지 않는다.
const decided = { status: 'denied', granted: false, canAskAgain: false, expires: 'never' };
module.exports = {
  getTrackingPermissionsAsync: jest.fn(() => Promise.resolve(decided)),
  requestTrackingPermissionsAsync: jest.fn(() => Promise.resolve(decided)),
};
