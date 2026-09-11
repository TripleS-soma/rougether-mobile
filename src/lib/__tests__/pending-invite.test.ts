import {
  clearPendingFriendInviteCode,
  clearPendingInviteCode,
  setPendingFriendInviteCode,
  setPendingInviteCode,
  subscribePendingFriendInviteCode,
  subscribePendingInviteCode,
} from '@/lib/pending-invite';

const mockDeviceStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = {
    getItem: async (key: string) => mockDeviceStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockDeviceStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockDeviceStore.delete(key);
    },
    // 전역 jest 설정이 매 테스트 앞에서 `require(...).clear()`를 부른다.
    clear: async () => {
      mockDeviceStore.clear();
    },
  };
  return { __esModule: true, ...storage, default: storage };
});

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

/**
 * 기기 보관 (#1007) — 설치 → 로그인 → 온보딩 사이에 앱을 껐다 켜도 코드가 남아야
 * 한다. 모듈 상태(이번 실행)는 테스트마다 새로 불러와 "다음 실행"을 흉내 내고,
 * 기기 저장소는 실행을 건너 공유되도록 파일 안의 한 저장소로 흉내 낸다(격리된
 * 모듈 레지스트리마다 AsyncStorage 목이 새로 생기면 "다음 실행"이 빈 기기를 본다).
 */
describe('pending-invite — 기기에 남아 다음 실행에서 되살아난다 (#1007)', () => {
  type Mod = typeof import('@/lib/pending-invite');
  const freshModule = (): Mod => {
    let mod: Mod | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('@/lib/pending-invite') as Mod;
    });
    return mod!;
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    mockDeviceStore.clear();
  });

  it('맡긴 코드는 기기에 적히고, 다음 실행의 복원에서 구독자에게 흐른다', async () => {
    freshModule().setPendingFriendInviteCode('abcd2345');
    await flush();
    expect(mockDeviceStore.get('rougether.pending-invite.friend.v1')).toBe('ABCD2345');

    const next = freshModule();
    const onCode = jest.fn();
    const unsub = next.subscribePendingFriendInviteCode(onCode);
    expect(onCode).not.toHaveBeenCalled();
    await next.hydratePendingInvites();
    expect(onCode).toHaveBeenCalledWith('ABCD2345');
    expect(next.peekPendingFriendInviteCode()).toBe('ABCD2345');
    unsub();
  });

  it('소비를 알리면 기기에서도 지워진다', async () => {
    const run = freshModule();
    run.setPendingInviteCode('house1');
    run.clearPendingInviteCode();
    await flush();
    expect(mockDeviceStore.has('rougether.pending-invite.house.v1')).toBe(false);

    const next = freshModule();
    await next.hydratePendingInvites();
    expect(next.peekPendingInviteCode()).toBeNull();
  });

  it('복원이 늦게 끝나도 이번 실행에서 새로 맡긴 코드를 덮지 않는다', async () => {
    freshModule().setPendingFriendInviteCode('old1');
    await flush();

    const next = freshModule();
    const hydrating = next.hydratePendingInvites();
    next.setPendingFriendInviteCode('new1');
    await hydrating;
    expect(next.peekPendingFriendInviteCode()).toBe('NEW1');
  });
});
