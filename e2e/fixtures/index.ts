import { EVENT_FIXTURES } from './event';
import { FEED_FIXTURES } from './feed';
import { HOUSE_FIXTURES } from './house';
import { MEMBER_FIXTURES } from './member';
import { ROOM_FIXTURES } from './room';
import { ROUTINE_TODO_FIXTURES } from './routine-todo';

/**
 * 키: '<METHOD> <api/v1 뒤 경로 패턴>' (`:id`는 숫자 한 토막). 값: JSON 응답 본문,
 * Buffer면 PNG 바이트. 2026-11-19 실제 앱에서 수집한 목록.
 */
export const FIXTURES: Record<string, unknown> = {
  ...MEMBER_FIXTURES,
  ...ROUTINE_TODO_FIXTURES,
  ...ROOM_FIXTURES,
  ...HOUSE_FIXTURES,
  ...FEED_FIXTURES,
  ...EVENT_FIXTURES,
};
