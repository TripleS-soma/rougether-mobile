import { useDeepLinkHandoff } from '@/components/app/use-deep-link-handoff';
import { setPendingInviteCode } from '@/lib/pending-invite';

/**
 * 초대 링크 딥링크 수신 (#624) — `rougether://join?code=…`. 코드는 pending-invite로 핸드오프하고
 * 앱 셸로 돌아간다. 셸(로그인 뒤 마운트)이 구독해 집 탐색의 코드 미리보기→참여 플로우를 잇는다.
 * 돌아가는 방식(웜 스타트는 back, 콜드는 replace)은 `useDeepLinkHandoff`.
 */
export default function JoinDeepLink() {
  useDeepLinkHandoff(setPendingInviteCode);
  return null;
}
