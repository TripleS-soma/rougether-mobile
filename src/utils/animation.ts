import { Platform } from 'react-native';

/**
 * `Animated`의 네이티브 드라이버 플래그 — 웹에는 네이티브 애니메이션 모듈이 없어
 * 네이티브 드라이버를 켜면 매번 경고를 찍고 JS로 떨어진다. 값은 같으니 플래그만
 * 플랫폼에 맞춘다(네이티브 켬, 웹 끔).
 */
export const NATIVE_DRIVER = Platform.OS !== 'web';
