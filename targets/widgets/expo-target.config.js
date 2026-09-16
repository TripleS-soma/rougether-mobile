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
  // 캐릭터 얼굴 (#1122) — 안드 위젯과 같은 6장(src/widgets/widget-mood.ts WIDGET_FACE_IMAGES).
  // prebuild가 이 타깃 폴더의 Assets.xcassets/<이름>.imageset로 복사한다(생성물, .gitignore).
  // Swift에서는 Image("faceNeutral")처럼 이름으로 쓴다(index.swift WidgetFace.imageName).
  images: {
    faceNeutral: '../../assets/images/widget-faces/neutral.png',
    faceHappy: '../../assets/images/widget-faces/happy.png',
    faceCrown: '../../assets/images/widget-faces/crown.png',
    faceWorried: '../../assets/images/widget-faces/worried.png',
    faceSad: '../../assets/images/widget-faces/sad.png',
    faceCrying: '../../assets/images/widget-faces/crying.png',
  },
};
