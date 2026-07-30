/** expo-apple-authentication mock — 네이티브 모듈 없이 테스트. */
module.exports = {
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(async () => ({
    identityToken: 'test-apple-identity-token',
    authorizationCode: 'test-apple-auth-code',
  })),
};
