import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { setPendingInviteCode } from '@/lib/pending-invite';

/**
 * 초대 링크 딥링크 수신 (#624) — `rougether://join?code=…`. 코드는
 * pending-invite로 핸드오프하고 즉시 루트로 넘긴다. 셸(로그인 뒤 마운트)이
 * 구독해 집 탐색의 코드 미리보기→참여 플로우를 이어간다.
 *
 * 핸드오프는 **이펙트에서** 한다 (#896). 렌더 중에 하면 셸의 setState를 다른
 * 컴포넌트를 그리는 도중에 부르게 되고, React가 그 갱신을 버릴 수 있다 —
 * 앱이 이미 떠 있는 웜 스타트에서 코드가 사라지던 원인이다.
 */
export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const single = Array.isArray(code) ? code[0] : code;
  useEffect(() => {
    if (single) setPendingInviteCode(single);
  }, [single]);
  return <Redirect href="/" />;
}
