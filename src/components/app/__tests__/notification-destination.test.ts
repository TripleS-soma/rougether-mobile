import { notificationDestination } from '@/components/app/notification-destination';

describe('notificationDestination (2026-10-08)', () => {
  it.each([
    ['ROUTINE_REMINDER', { kind: 'screen', screen: 'myRoom' }],
    ['FRIEND_CHEER', { kind: 'screen', screen: 'myRoom' }],
    ['HOUSE_MISSION_ACHIEVED', { kind: 'screen', screen: 'houseMissions' }],
    ['HOUSE_JOIN_REQUEST_CREATED', { kind: 'houseMembers' }],
    ['HOUSE_JOIN_REQUEST_ACCEPTED', { kind: 'screen', screen: 'house' }],
    ['HOUSE_JOIN_REQUEST_REJECTED', { kind: 'screen', screen: 'houseSearch' }],
    ['WEEKLY_REPORT', { kind: 'weeklyReport' }],
    ['BUG_REPORT_REPLY', { kind: 'screen', screen: 'bugReport' }],
  ] as const)('%s', (type, expected) => {
    expect(notificationDestination(type, 9)).toEqual(expected);
  });

  it('피드 댓글은 refId(게시물 id)의 상세로, 없으면 피드로', () => {
    expect(notificationDestination('FEED_COMMENT', 42)).toEqual({ kind: 'feedPost', postId: 42 });
    expect(notificationDestination('FEED_COMMENT')).toEqual({ kind: 'screen', screen: 'feed' });
  });

  it('모르는 종류는 이동하지 않는다', () => {
    expect(notificationDestination('SOMETHING_NEW', 1)).toBeNull();
    expect(notificationDestination(undefined)).toBeNull();
  });
});
