import { Platform } from 'react-native';

/**
 * 스토어 주소 — **원격 설정이 아니라 앱 상수로 둔다** (#1572). `app-version.json`이
 * 주소까지 들고 있으면 그 파일 한 줄로 사용자를 아무 데나 보낼 수 있다. 원격은
 * "어느 버전부터 오래됐나"만 말하고, "어디로 보낼까"는 바이너리가 정한다.
 *
 * **`Linking.canOpenURL`을 쓰지 말 것** — iOS `LSApplicationQueriesSchemes`·Android
 * manifest `<queries>` 선언이 필요해져 `app.json`을 건드리게 되고, 그 순간 네이티브
 * 지문이 바뀌어 이 기능 자체가 기존 설치본에 OTA로 못 간다. `openURL`만 쓰고
 * 실패하면 웹 주소로 떨어뜨린다.
 */
/** App Store Connect 앱 id — `eas.json`의 `ascAppId`와 같다. */
export const IOS_ASC_APP_ID = '6793513720';
/** Play 패키지명 — `app.json`의 `android.package`와 같다. */
export const ANDROID_PACKAGE = 'com.triples.rougether';

/** 스토어 앱을 직접 여는 주소. 핸들러가 없으면 reject되므로 웹 주소로 떨어뜨린다. */
export function storeAppUrl(os: string = Platform.OS): string | undefined {
  if (os === 'ios') return `itms-apps://apps.apple.com/app/id${IOS_ASC_APP_ID}`;
  if (os === 'android') return `market://details?id=${ANDROID_PACKAGE}`;
  return undefined;
}

/** 어디서나 열리는 웹 주소 — `storeAppUrl`이 실패했을 때의 대체. */
export function storeWebUrl(os: string = Platform.OS): string | undefined {
  if (os === 'ios') return `https://apps.apple.com/app/id${IOS_ASC_APP_ID}`;
  if (os === 'android') return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  return undefined;
}
