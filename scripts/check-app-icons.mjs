import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import plist from '@expo/plist';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { AndroidConfig } = require('@expo/config-plugins');
const names = ['MissingYou', 'Teary', 'Sobbing', 'DailySuccess', 'StreakChampion'];
const manifestPath = process.argv[2] ?? 'android/app/src/main/AndroidManifest.xml';
let checked = false;
if (fs.existsSync(manifestPath)) {
  const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const main = app.activity.find((a) => a.$['android:name'].endsWith('.MainActivity'));
  const launcher = (filter) =>
    filter.category?.some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER');
  assert.equal(main.$['android:enabled'], 'true');
  assert(!main['intent-filter'].some(launcher));
  assert(
    main['intent-filter'].some((f) =>
      f.action?.some((a) => a.$['android:name'] === 'android.intent.action.VIEW'),
    ),
  );
  for (const name of ['Default', ...names]) {
    const alias = app['activity-alias'].find((a) =>
      a.$['android:name'].endsWith(`.MainActivity${name}`),
    );
    assert(alias, `missing launcher ${name}`);
    assert.equal(alias.$['android:enabled'], name === 'Default' ? 'true' : 'false');
    assert(alias['intent-filter'].every(launcher));
  }
  assert.equal(app['activity-alias'].filter((a) => a.$['android:enabled'] === 'true').length, 1);
  console.log('Android: six launchers and enabled deep-link activity verified.');
  checked = true;
}
if (fs.existsSync('ios/Rougether/Info.plist')) {
  const info = plist.default.parse(fs.readFileSync('ios/Rougether/Info.plist', 'utf8'));
  const project = fs.readFileSync('ios/Rougether.xcodeproj/project.pbxproj', 'utf8');
  for (const name of names) {
    assert(
      project.includes(`ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = "${names.join(' ')}"`),
    );
    const dir = `ios/Rougether/Images.xcassets/${name}.appiconset`;
    const catalog = JSON.parse(fs.readFileSync(`${dir}/Contents.json`, 'utf8'));
    assert(
      catalog.images.some(
        (image) => image.filename && fs.existsSync(path.join(dir, image.filename)),
      ),
      `missing iOS image ${name}`,
    );
  }
  assert(
    !info.UIBackgroundModes?.includes('processing'),
    'Android tasks must not add iOS background permissions',
  );
  console.log('iOS: five alternate asset catalogs and build registration verified.');
  checked = true;
}
assert(checked, 'Run Expo prebuild first.');
