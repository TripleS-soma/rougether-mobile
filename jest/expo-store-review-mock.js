// Jest mock for expo-store-review — the system review sheet never shows in tests.
module.exports = {
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  hasAction: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
  storeUrl: jest.fn(() => null),
};
