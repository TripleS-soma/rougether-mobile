import type { Screen } from '@/components/app/navigation';

/**
 * 알림 카드를 눌렀을 때의 목적지 (2026-10-08) — 서버 알림의 `type`·`refId`(spec notification
 * api.md)로 고른다. 집 관련 알림의 refId는 미션·멤버십·신청 id라 어느 집인지 모르므로 지금
 * 보고 있는 집 기준으로 연다. 모르는 종류는 null(이동 없음).
 */
export type NotificationDestination =
  | { kind: 'screen'; screen: Screen }
  /** 피드 댓글 — refId = 게시물 id (spec feed api.md). */
  | { kind: 'feedPost'; postId: number }
  /** 주간 회고 — 연 곳(알림함)으로 돌아오게 셸의 openWeeklyReport로. */
  | { kind: 'weeklyReport' }
  /** 집 구성원 — 방장이면 입주 신청 목록을 새로 받는 셸 경로로. */
  | { kind: 'houseMembers' };

export function notificationDestination(
  type: string | undefined,
  refId?: number,
): NotificationDestination | null {
  switch (type) {
    case 'FEED_COMMENT':
      return refId ? { kind: 'feedPost', postId: refId } : { kind: 'screen', screen: 'feed' };
    case 'ROUTINE_REMINDER':
    case 'TODO_REMINDER':
    case 'FRIEND_CHEER':
    case 'ROOM_COBWEB_CLEANED':
    case 'ROOM_COBWEB_APPEARED':
    case 'APP_INACTIVITY_REMINDER':
      return { kind: 'screen', screen: 'myRoom' };
    case 'HOUSE_MISSION_ACHIEVED':
      return { kind: 'screen', screen: 'houseMissions' };
    case 'HOUSE_JOIN_REQUEST_CREATED':
    case 'HOUSE_MEMBER_JOINED':
    case 'HOUSE_MEMBER_LEFT':
      return { kind: 'houseMembers' };
    case 'HOUSE_JOIN_REQUEST_ACCEPTED':
    case 'HOUSE_KICK':
      return { kind: 'screen', screen: 'house' };
    case 'HOUSE_JOIN_REQUEST_REJECTED':
      return { kind: 'screen', screen: 'houseSearch' };
    case 'WEEKLY_REPORT':
      return { kind: 'weeklyReport' };
    case 'BUG_REPORT_REPLY':
      return { kind: 'screen', screen: 'bugReport' };
    default:
      return null;
  }
}
