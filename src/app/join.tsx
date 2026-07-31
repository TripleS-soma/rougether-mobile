import { Redirect, useLocalSearchParams } from 'expo-router';

import { setPendingInviteCode } from '@/lib/pending-invite';

/**
 * 초대 링크 딥링크 수신 (#624) — `rougether://join?code=…`. 코드는
 * pending-invite로 핸드오프하고 즉시 루트로 넘긴다. 셸(로그인 뒤 마운트)이
 * 구독해 집 탐색의 코드 미리보기→참여 플로우를 이어간다.
 */
export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const single = Array.isArray(code) ? code[0] : code;
  if (single) setPendingInviteCode(single);
  return <Redirect href="/" />;
}
