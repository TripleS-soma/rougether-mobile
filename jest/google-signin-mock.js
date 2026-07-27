/** @react-native-google-signin/google-signin mock — 네이티브 모듈 없이 테스트. */
module.exports = {
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'success', data: { idToken: 'test-id-token' } })),
    signOut: jest.fn(async () => {}),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
};
