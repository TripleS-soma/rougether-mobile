import { useDeepLinkHandoff } from '@/components/app/use-deep-link-handoff';
import { setPendingFriendInviteCode } from '@/lib/pending-invite';

/**
 * 친구 초대 딥링크 수신 (#667) — `rougether://invite?code=…`. 코드는 pending-invite의 친구 채널로
 * 핸드오프하고 앱 셸로 돌아간다. 셸이 구독해 설정 → 친구 초대의 코드 입력 프리필로 잇는다.
 */
export default function FriendInviteDeepLink() {
  useDeepLinkHandoff(setPendingFriendInviteCode);
  return null;
}
