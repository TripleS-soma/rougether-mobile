// expo-release-guard(ios-alternate-icons·android-launcher-aliases)가 아직 보지 않는 루게더 전용
// 산출물 규칙 두 가지만 남긴 것 — 옛 scripts/check-app-icons.mjs의 나머지는 CLI로 옮겼다.
//  1. Android 메인 액티비티가 VIEW intent-filter(딥링크)를 유지한다 — 아이콘 별칭으로 런처를
//     옮기면서 딥링크 진입까지 지우면 초대·알림 링크가 앱을 못 연다.
//  2. iOS UIBackgroundModes에 processing이 없다 — Android 전용 작업이 iOS 백그라운드 권한을
//     끌어오면 심사에서 사유를 요구받는다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import plist from '@expo/plist';

const manifestPath = process.argv[2] ?? 'android/app/src/main/AndroidManifest.xml';
let checked = false;
if (fs.existsSync(manifestPath)) {
  const xml = fs.readFileSync(manifestPath, 'utf8');
  const main =
    /<activity[\s][^>]*android:name="[^"]*\.MainActivity"[^>]*>([\s\S]*?)<\/activity>/.exec(xml);
  assert(main, 'MainActivity not found');
  assert(
    main[1].includes('android.intent.action.VIEW'),
    'MainActivity lost its VIEW (deep link) intent-filter',
  );
  console.log('Android: MainActivity keeps its deep-link intent-filter.');
  checked = true;
}
if (fs.existsSync('ios/Rougether/Info.plist')) {
  const info = plist.default.parse(fs.readFileSync('ios/Rougether/Info.plist', 'utf8'));
  assert(
    !info.UIBackgroundModes?.includes('processing'),
    'Android tasks must not add iOS background permissions',
  );
  console.log('iOS: no processing background mode.');
  checked = true;
}
assert(checked, 'Run Expo prebuild first.');
