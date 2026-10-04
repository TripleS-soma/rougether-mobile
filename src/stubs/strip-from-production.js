/**
 * 프로덕션 번들에서 뺄 모듈 (성능 장부 나 묶음). 개발 번들(dev)은 그대로 둔다.
 * - `@/dev/*` — Dev 갤러리. 라우트가 `__DEV__` 분기 안에서 require해도 Metro는 의존성을
 *   먼저 수집해 프로덕션에 약 107KB가 실렸다(B5).
 * - Android `@expo-google-fonts/material-symbols/*` — expo-router의 NativeTabs 아이콘 변환이
 *   expo-symbols를 거쳐 7개 굵기(6.8MB)를 끌어온다. 앱은 NativeTabs도 SymbolView도 쓰지
 *   않는다(B3). **Android에서 SymbolView를 쓰게 되면 이 줄을 지울 것** — 폰트가 비어
 *   아이콘이 안 그려진다.
 */
function stripFromProduction(context, moduleName, platform) {
  if (context.dev) return false;
  if (moduleName.startsWith('@/dev/')) return true;
  return platform === 'android' && moduleName.startsWith('@expo-google-fonts/material-symbols');
}

module.exports = { stripFromProduction };
