const api = {
  getPermissionsAsync: async () => ({ status: 'granted' }),
  requestPermissionsAsync: async () => ({ status: 'granted' }),
  getDevicePushTokenAsync: async () => ({ data: 'test-token' }),
  addPushTokenListener: () => ({ remove: () => {} }),
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  // 인앱 푸시 배너 (#902) — 수신 구독. 응답 리스너와 같은 결로 no-op.
  addNotificationReceivedListener: () => ({ remove: () => {} }),
  getLastNotificationResponseAsync: async () => null,
  // 채팅을 열 때 그 집 알림 지우기 (#1746) — 기본은 트레이가 비어 있다.
  getPresentedNotificationsAsync: async () => [],
  dismissNotificationAsync: async () => {},
  setNotificationHandler: () => {},
  setNotificationChannelAsync: async () => ({}),
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
};
module.exports = { __esModule: true, default: api, ...api };
