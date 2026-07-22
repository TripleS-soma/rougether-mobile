const { withAndroidManifest } = require('expo/config-plugins');

const CHANNEL_META = 'com.google.firebase.messaging.default_notification_channel_id';

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
    return config;
  });
};
