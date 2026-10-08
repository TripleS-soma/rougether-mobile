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

/** 웹에 없는 네이티브 기능 — 웹에서 행·버튼을 숨기고, 라이브러리 호출은 하지 않는다. */
const isNative = () => Platform.OS !== 'web';

/** 기기 캘린더 읽기(일정 가져오기) — expo-calendar 네이티브 모듈. */
export const supportsDeviceCalendar = isNative;
/** 방 이미지를 기기 앨범에 저장 — view-shot·media-library 네이티브 모듈. */
export const supportsRoomImageSave = isNative;
/** 푸시 알림(토큰 등록·표시·탭 처리)과 그 설정 화면 — 웹은 토글이 되는 척만 하게 된다. */
export const supportsPushNotifications = isNative;
