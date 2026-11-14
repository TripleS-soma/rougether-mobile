import { notificationDestination } from '@/components/app/notification-destination';

// 집 피드 목적지는 피드가 켜진 설치본에서만 열린다.
jest.mock('@/constants/feed', () => ({
  ...jest.requireActual('@/constants/feed'),
  FEED_ENABLED: true,
}));

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

  // 거래소 알림 (서버 #432) — 체결의 refId는 주문 id라 내 주문으로, 구매 대기의 refId는 종목 id.
  it('거래소 체결은 내 주문, 구매 대기는 그 종목 상세로', () => {
    expect(notificationDestination('MARKET_SELL_FILLED', 55)).toEqual({ kind: 'marketOrders' });
    expect(notificationDestination('MARKET_BUY_FILLED', 56)).toEqual({ kind: 'marketOrders' });
    expect(notificationDestination('MARKET_BID_PLACED', 9)).toEqual({
      kind: 'marketAsset',
      assetId: 9,
    });
    expect(notificationDestination('MARKET_BID_PLACED')).toEqual({
      kind: 'screen',
      screen: 'market',
    });
  });

  // 집 채팅 새 메시지 (서버 #435, 푸시 전용) — data의 houseId로 그 집 채팅방.
  it('채팅 푸시는 그 집 채팅방으로', () => {
    expect(notificationDestination('CHAT_MESSAGE', undefined, 3)).toEqual({
      kind: 'houseChat',
      houseId: 3,
    });
  });

  // 집 피드 새 글 (푸시 전용) — data의 houseId·postId로 그 집의 글 상세.
  it('집 피드 새 글 푸시는 그 집의 글 상세로, 글 id가 없으면 그 집 피드로', () => {
    expect(notificationDestination('HOUSE_FEED_POST', 42, 3)).toEqual({
      kind: 'houseFeedPost',
      houseId: 3,
      postId: 42,
    });
    expect(notificationDestination('HOUSE_FEED_POST', undefined, 3)).toEqual({
      kind: 'houseFeedPost',
      houseId: 3,
      postId: undefined,
    });
  });

  it('모르는 종류는 이동하지 않는다', () => {
    expect(notificationDestination('SOMETHING_NEW', 1)).toBeNull();
    expect(notificationDestination(undefined)).toBeNull();
  });
});
