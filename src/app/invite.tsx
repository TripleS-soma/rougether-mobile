import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { setPendingFriendInviteCode } from '@/lib/pending-invite';

/**
 * 친구 초대 딥링크 수신 (#667) — `rougether://invite?code=…`. 코드는
 * pending-invite의 친구 채널로 핸드오프하고 즉시 루트로 넘긴다. 셸(로그인 뒤
 * 마운트)이 구독해 설정 → 친구 초대의 코드 입력 프리필로 이어간다.
 *
 * 핸드오프는 **이펙트에서** 한다 (#896). 렌더 중에 하면 셸의 setState를 다른
 * 컴포넌트를 그리는 도중에 부르게 되고, React가 그 갱신을 버릴 수 있다 —
 * 앱이 이미 떠 있는 웜 스타트에서 코드가 사라지던 원인이다.
 */
export default function FriendInviteDeepLink() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const single = Array.isArray(code) ? code[0] : code;
  useEffect(() => {
    if (single) setPendingFriendInviteCode(single);
  }, [single]);
  return <Redirect href="/" />;
}
