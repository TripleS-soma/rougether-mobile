const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

// The icon asset plugin creates the alternate aliases. MainActivity always remains
// enabled so OAuth/deep links work even after several icon changes or a cold launch.
module.exports = (config) =>
  withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    main['intent-filter'] = (main['intent-filter'] ?? []).filter(
      (filter) =>
        !filter.category?.some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER'),
    );
    main.$['android:enabled'] = 'true';
    const aliases = (app['activity-alias'] ?? []).filter(
      (alias) => alias.$['android:name'] !== '.MainActivityDefault',
    );
    // Only the real activity handles VIEW intents; aliases are launcher entries.
    for (const alias of aliases) {
      if (alias.$['android:targetActivity'] === '.MainActivity') {
        alias['intent-filter'] = (alias['intent-filter'] ?? []).filter((filter) =>
          filter.category?.some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER'),
        );
      }
    }
    aliases.push({
      $: {
        'android:name': '.MainActivityDefault',
        'android:targetActivity': '.MainActivity',
        'android:enabled': 'true',
        'android:exported': 'true',
        'android:icon': '@mipmap/ic_launcher',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
        },
      ],
    });
    app['activity-alias'] = aliases;
    return mod;
  });
