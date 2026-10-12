import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

/**
 * 초대 딥링크 라우트 공용 (`/join`·`/invite`) — 코드를 맡기고 앱 셸로 돌아간다.
 *
 * - 맡기기는 **이펙트에서** (#896 — 렌더 중이면 셸의 setState가 버려질 수 있다).
 * - **앱이 이미 떠 있으면(웜 스타트) 이 화면은 기존 셸 위에 쌓여 있다 → `back()`으로 그 셸로
 *   돌아간다.** 예전엔 `<Redirect href="/">`라 새 루트(셸)가 하나 더 생겼고, 코드는 뒤에 가려진
 *   옛 셸이 받아 집 탐색으로 갔다가 '처리 완료'로 지워져 — 사용자 눈엔 새 셸의 방 화면만 보이고
 *   신청도 안 되는 것처럼 보였다(2026-10-12 제보, 에뮬레이터 로그로 셸 두 번 마운트 확인).
 * - 뒤가 없으면(콜드 스타트) 루트로 교체.
 */
export function useDeepLinkHandoff(handoff: (code: string) => void) {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const single = Array.isArray(code) ? code[0] : code;
  const router = useRouter();
  useEffect(() => {
    if (single) handoff(single);
    if (router.canGoBack()) router.back();
    else router.replace('/');
    // 한 번만 — 라우트는 맡기고 곧바로 사라진다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
