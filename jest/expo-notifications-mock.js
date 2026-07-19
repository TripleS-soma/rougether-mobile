const api = {
  getPermissionsAsync: async () => ({ status: 'granted' }),
  requestPermissionsAsync: async () => ({ status: 'granted' }),
  getDevicePushTokenAsync: async () => ({ data: 'test-token' }),
};
module.exports = { __esModule: true, default: api, ...api };
