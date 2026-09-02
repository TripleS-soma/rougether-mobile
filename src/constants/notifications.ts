/**
 * 알림 종류 → 표시 규칙 (#902). 알림함 행과 인앱 배너가 **같은 아이콘**을
 * 써야 같은 알림으로 읽히므로, 알림함에 있던 매핑을 여기로 올려 공유한다.
 */
import type { IconName } from '@/components/ui/icon';

/** Row/banner icon by server notification type. */
export const NOTIFICATION_TYPE_ICONS: Record<string, IconName> = {
  ROUTINE_REMINDER: 'bell',
  TODO_REMINDER: 'bell',
  HOUSE_KICK: 'house',
  // 친구 응원 알림 (#330 응원 보내기의 수신측) — 스웨거 enum 추가분.
  FRIEND_CHEER: 'heart',
  HOUSE_MISSION_ACHIEVED: 'flame',
  HOUSE_MEMBER_JOINED: 'members',
  HOUSE_MEMBER_LEFT: 'leave',
  // 입주 신청 결과 (#595, 서버 #241) — 수락은 집, 거절도 같은 맥락의 집 알림.
  HOUSE_JOIN_REQUEST_ACCEPTED: 'house',
  HOUSE_JOIN_REQUEST_REJECTED: 'house',
  // 남이 내 방 거미줄을 치워줬을 때 (#831, 서버 #277) — 방으로 돌아오라는 신호.
  ROOM_COBWEB_CLEANED: 'house',
  // 새 주간회고 (#1056) — 서버 타입은 아직 없고(#1057) 앱이 감지해 띄우는 인앱 배너 전용.
  WEEKLY_REPORT: 'list',
};

/**
 * 모르는 종류(서버가 enum을 늘렸는데 앱이 아직 모를 때)는 종을 쓴다 —
 * 아이콘이 없다고 알림을 안 보여주는 것보다 낫다.
 */
export const DEFAULT_NOTIFICATION_ICON: IconName = 'bell';

export function notificationIcon(type?: string): IconName {
  return (type && NOTIFICATION_TYPE_ICONS[type]) || DEFAULT_NOTIFICATION_ICON;
}
