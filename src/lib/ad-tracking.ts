import * as Notifications from 'expo-notifications';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import { Settings } from 'react-native-fbsdk-next';

import { reportError } from '@/lib/error-reporting';

/**
 * iOS 앱 추적 투명성(ATT) 요청 (#1616) — Meta 설치 광고 측정용.
 *
 * - **언제**: 메인 화면에 들어온 뒤(온보딩·첫 루틴·집 선택을 다 지난 다음). 신규
 *   사용자는 온보딩 직후, 기존 사용자는 업데이트 뒤 첫 진입에 한 번 본다.
 * - **푸시 권한과 겹치지 않게**: 푸시는 로그인 때 요청한다. 그 결정이 아직이면
 *   (팝업이 떠 있을 수 있음) 이번엔 건너뛴다 — 시스템 팝업이 떠 있는 동안 ATT를
 *   요청하면 iOS가 팝업 없이 `undetermined`를 돌려줘 기회를 날린다. 다음 진입에 다시 본다.
 * - **허용했을 때만** Meta SDK에 광고 추적을 켠다. 거부해도 앱 동작은 같고 Meta는
 *   집계 측정(AEM)만 한다. 방침 약속: 사용자 식별 정보·앱 안 내용은 보내지 않는다.
 *
 * Android는 팝업이 없다 — SDK가 광고 ID를 읽고, 사용자는 기기 설정에서 끈다.
 */
export async function requestAdTrackingOnce(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const push = await Notifications.getPermissionsAsync();
    if (push.status === 'undetermined') return;

    let { status, canAskAgain } = await getTrackingPermissionsAsync();
    if (status === 'undetermined' && canAskAgain) {
      ({ status } = await requestTrackingPermissionsAsync());
    }
    if (status === 'granted') await Settings.setAdvertiserTrackingEnabled(true);
  } catch (e) {
    reportError(e, { area: 'ad-tracking' });
  }
}
