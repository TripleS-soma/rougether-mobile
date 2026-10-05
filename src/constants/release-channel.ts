import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/**
 * 내부 테스트 빌드인가 — EAS `internal` 채널(eas.json preview 프로필, dev 브랜치 OTA).
 * 스토어 빌드(`dev`·`production` 채널)·웹·테스트에서는 false라, 이 값으로 켠 기능은
 * 내부 기기에서만 먼저 보인다. 운영 서버를 그대로 쓰니 내부에서도 실제 데이터가 오간다.
 */
export const IS_INTERNAL_CHANNEL = Platform.OS !== 'web' && Updates.channel === 'internal';

/**
 * UGC(피드·거래소)를 **심사 때 꺼진 채 통과한 스토어 바이너리**의 런타임 지문 — 2026-10-05
 * 결정: 공개 기능은 OTA로 켜지 않고 다음 네이티브 버전(1.5.4) 심사 때 켠 상태로 제출한다.
 * 런타임 지문은 바이너리마다 박혀 있고 OTA로 바뀌지 않으니, 이 목록에 있는 설치본은 승격·
 * `eas-release`를 몇 번 해도 계속 꺼진 채다. 새 네이티브 빌드(지문이 달라짐)부터 자동으로 켜진다.
 * - `0ed984cc…`: iOS 1.5.3(빌드 125) · `162a83fa…`: Android 1.5.3(vc12)
 */
const PRE_UGC_RUNTIMES: readonly string[] = [
  '0ed984cc06b576025e715531a8084fb357715377',
  '162a83fa10080142251ab129fd19da4003ce3c29',
];

/**
 * 이 설치본에서 UGC를 보여도 되는가 — 웹은 바로 연다(스토어 심사 대상이 아님). 내부 채널은
 * 늘 켠다. 그 밖의 네이티브는 위 목록의 바이너리가 아닐 때만(개발 빌드는 지문이 없어 켜짐).
 */
export const UGC_AVAILABLE =
  Platform.OS === 'web' ||
  IS_INTERNAL_CHANNEL ||
  !PRE_UGC_RUNTIMES.includes(Updates.runtimeVersion ?? '');
