/**
 * @react-native-firebase/crashlytics mock (#438) — modular API 표면만.
 */
module.exports = {
  getCrashlytics: jest.fn(() => ({})),
  recordError: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(() => Promise.resolve()),
  log: jest.fn(),
  setCrashlyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
};
