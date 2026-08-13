/**
 * iOS 홈 위젯 익스텐션 타깃 (#606) — prebuild 때 @bacons/apple-targets가
 * SwiftUI 위젯 타깃을 생성한다. 데이터는 앱이 App Group UserDefaults에 쓴다
 * (src/widgets/widget-data.ts의 mirrorToIosWidgets와 키 계약).
 */
/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'RougetherWidgets',
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.triples.rougether'],
  },
};
