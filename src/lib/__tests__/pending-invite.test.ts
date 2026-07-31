import { setPendingInviteCode, subscribePendingInviteCode } from '@/lib/pending-invite';

describe('pending-invite (#624 — 초대 링크 핸드오프)', () => {
  it('구독 전에 맡긴 코드는 구독 시점에 즉시 전달된다 (콜드 스타트)', () => {
    setPendingInviteCode(' vlg7k2x ');
    const onCode = jest.fn();
    const unsub = subscribePendingInviteCode(onCode);
    expect(onCode).toHaveBeenCalledWith('VLG7K2X');
    // 보관분은 1회성 — 재구독에 다시 오지 않는다.
    unsub();
    const again = jest.fn();
    subscribePendingInviteCode(again)();
    expect(again).not.toHaveBeenCalled();
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
