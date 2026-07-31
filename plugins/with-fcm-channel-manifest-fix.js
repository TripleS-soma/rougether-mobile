const { withAndroidManifest } = require('expo/config-plugins');

const CHANNEL_META = 'com.google.firebase.messaging.default_notification_channel_id';
// 백그라운드 FCM(notification 페이로드) 자동 표시는 expo-notifications의
// meta-data가 아니라 Firebase 쪽 기본 아이콘/색 meta-data를 읽는다 (#663) —
// expo-notifications 플러그인이 생성하는 리소스를 그대로 가리킨다.
const ICON_META = 'com.google.firebase.messaging.default_notification_icon';
const COLOR_META = 'com.google.firebase.messaging.default_notification_color';

/**
 * expo-notifications(defaultChannel: "default")와 @react-native-firebase/messaging이
 * 같은 meta-data를 서로 다른 값으로 선언해 매니페스트 병합이 깨진다
 * (processReleaseMainManifest 실패, EAS build 112236bb). 병합 규칙
 * tools:replace로 앱 쪽 값("default")이 이기게 한다.
 */
module.exports = function withFcmChannelManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ ?? {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const app = manifest.application?.[0];
    if (!app) return config;
    app['meta-data'] = app['meta-data'] ?? [];
    let meta = app['meta-data'].find((m) => m.$?.['android:name'] === CHANNEL_META);
    if (!meta) {
      meta = { $: { 'android:name': CHANNEL_META, 'android:value': 'default' } };
      app['meta-data'].push(meta);
    }
    meta.$['tools:replace'] = 'android:value';

    for (const [name, attr, value] of [
      [ICON_META, 'android:resource', '@drawable/notification_icon'],
      [COLOR_META, 'android:resource', '@color/notification_icon_color'],
    ]) {
      let m = app['meta-data'].find((x) => x.$?.['android:name'] === name);
      if (!m) {
        m = { $: { 'android:name': name } };
        app['meta-data'].push(m);
      }
      m.$[attr] = value;
    }
    return config;
  });
};
