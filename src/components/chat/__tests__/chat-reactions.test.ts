import { myReactionOf, withMyReaction } from '@/components/chat/chat-reactions';

describe('채팅 공감 계산', () => {
  it('내 공감은 메시지당 하나 — 다른 유형을 고르면 옮겨 간다', () => {
    const before = [
      { type: 'HEART' as const, userIds: [2, 1] },
      { type: 'SAD' as const, userIds: [3] },
    ];
    expect(myReactionOf(before, 1)).toBe('HEART');
    expect(withMyReaction(before, 1, 'SAD')).toEqual([
      { type: 'HEART', userIds: [2] },
      { type: 'SAD', userIds: [3, 1] },
    ]);
  });

  it('취소하면 내 것만 빠지고, 아무도 안 남은 유형은 사라진다', () => {
    expect(withMyReaction([{ type: 'LIKE', userIds: [1] }], 1, null)).toEqual([]);
    expect(withMyReaction([{ type: 'LIKE', userIds: [1, 2] }], 1, null)).toEqual([
      { type: 'LIKE', userIds: [2] },
    ]);
  });

  it('유형 순서는 누른 순서가 아니라 선언 순서다', () => {
    expect(withMyReaction([{ type: 'SAD', userIds: [2] }], 1, 'HEART')).toEqual([
      { type: 'HEART', userIds: [1] },
      { type: 'SAD', userIds: [2] },
    ]);
  });

  it('공감이 없던 메시지에도 남길 수 있다', () => {
    expect(withMyReaction(undefined, 1, 'CHECK')).toEqual([{ type: 'CHECK', userIds: [1] }]);
    expect(myReactionOf(undefined, 1)).toBeUndefined();
    expect(myReactionOf([{ type: 'CHECK', userIds: [1] }], undefined)).toBeUndefined();
  });
});
