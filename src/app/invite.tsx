import { Redirect, useLocalSearchParams } from 'expo-router';

import { setPendingFriendInviteCode } from '@/lib/pending-invite';

/**
 * 친구 초대 딥링크 수신 (#667) — `rougether://invite?code=…`. 코드는
 * pending-invite의 친구 채널로 핸드오프하고 즉시 루트로 넘긴다. 셸(로그인 뒤
 * 마운트)이 구독해 설정 → 친구 초대의 코드 입력 프리필로 이어간다.
 */
export default function FriendInviteDeepLink() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const single = Array.isArray(code) ? code[0] : code;
  if (single) setPendingFriendInviteCode(single);
  return <Redirect href="/" />;
}
