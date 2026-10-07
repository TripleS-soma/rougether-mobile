import { Platform } from 'react-native';

/**
 * 플랫폼 능력 판정 — `Platform.OS` 비교식이 기능마다 다른 모양으로 흩어지지 않게 한 곳에
 * 모은다(리팩토링 장부 3·4번). 테스트가 `Platform.OS`를 바꿔 가며 부르므로 상수가 아니라
 * 호출할 때 읽는 함수로 둔다.
 */

/** 홈 화면 위젯(iOS WidgetKit·Android 앱 위젯)이 있는 플랫폼인가 — 웹에는 없다. */
export function supportsHomeWidget(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
