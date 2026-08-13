/** @react-native-kakao/user mock — 네이티브 모듈 없이 테스트. */
module.exports = {
  login: jest.fn(async () => ({ accessToken: 'test-kakao-access-token' })),
  logout: jest.fn(async () => {}),
};
