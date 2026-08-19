import {
  clearPendingFriendInviteCode,
  clearPendingInviteCode,
  setPendingFriendInviteCode,
  setPendingInviteCode,
  subscribePendingFriendInviteCode,
  subscribePendingInviteCode,
} from '@/lib/pending-invite';

afterEach(() => {
  clearPendingInviteCode();
  clearPendingFriendInviteCode();
});

describe('pending-invite (#624 — 초대 링크 핸드오프)', () => {
  it('구독 전에 맡긴 코드는 구독 시점에 즉시 전달된다 (콜드 스타트)', () => {
    setPendingInviteCode(' vlg7k2x ');
    const onCode = jest.fn();
    subscribePendingInviteCode(onCode)();
    expect(onCode).toHaveBeenCalledWith('VLG7K2X');
  });

  it('구독 중 도착한 코드는 리스너로 바로 흐른다 (웜 스타트)', () => {
    const onCode = jest.fn();
    const unsub = subscribePendingInviteCode(onCode);
    setPendingInviteCode('abc123');
    expect(onCode).toHaveBeenCalledWith('ABC123');
    unsub();
  });

  it('빈 코드는 무시한다', () => {
    const onCode = jest.fn();
    const unsub = subscribePendingInviteCode(onCode);
    setPendingInviteCode('   ');
    expect(onCode).not.toHaveBeenCalled();
    unsub();
  });
});

/**
 * 웜 스타트 유실 (#896) — 예전엔 리스너가 있으면 **전달만 하고 보관하지
 * 않았다.** 그 전달이 유실되면(셸 리마운트, 렌더 중 setState 등) 복구할 길이
 * 없었다. 콜드 스타트는 되고 웜만 안 되던 원인이다.
 *
 * 지금 계약: **항상 보관하고, 목적지가 소비를 알려올 때만 비운다.**
 */
describe('pending-invite — 소비 전까지 살아남는다 (#896)', () => {
  it('리스너에게 전달했어도 보관분은 남는다 — 재구독에 다시 온다', () => {
    const first = jest.fn();
    const unsub = subscribePendingInviteCode(first);
    setPendingInviteCode('keepme');
    expect(first).toHaveBeenCalledWith('KEEPME');
    unsub();

    // 셸이 리마운트돼 다시 구독하는 상황.
    const second = jest.fn();
    subscribePendingInviteCode(second)();
    expect(second).toHaveBeenCalledWith('KEEPME');
  });

  it('소비를 알리면 그때 비워진다', () => {
    setPendingInviteCode('gone');
    clearPendingInviteCode();
    const onCode = jest.fn();
    subscribePendingInviteCode(onCode)();
    expect(onCode).not.toHaveBeenCalled();
  });

  it('집·친구 채널은 서로 섞이지 않는다', () => {
    setPendingInviteCode('house1');
    setPendingFriendInviteCode('friend1');
    const h = jest.fn();
    const f = jest.fn();
    subscribePendingInviteCode(h)();
    subscribePendingFriendInviteCode(f)();
    expect(h).toHaveBeenCalledWith('HOUSE1');
    expect(f).toHaveBeenCalledWith('FRIEND1');

    clearPendingInviteCode();
    const f2 = jest.fn();
    subscribePendingFriendInviteCode(f2)();
    expect(f2).toHaveBeenCalledWith('FRIEND1');
  });
});
