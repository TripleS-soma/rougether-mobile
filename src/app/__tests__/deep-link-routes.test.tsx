import { render } from '@testing-library/react-native';

import FriendInviteDeepLink from '@/app/invite';
import JoinDeepLink from '@/app/join';

/**
 * 초대 딥링크 라우트 (#624·#667·#896, 2026-10-12 웜 스타트 수정).
 *
 * - 코드는 **렌더 중이 아니라 이펙트에서** 넘긴다(#896 — 렌더 중이면 셸 setState가 버려질 수 있다).
 * - **앱이 떠 있으면(뒤 화면이 있으면) `back()`으로 기존 셸로 돌아간다.** 예전엔 `<Redirect href="/">`라
 *   새 셸이 하나 더 생겨, 코드는 가려진 옛 셸이 소비하고 사용자에겐 새 셸의 방 화면만 보였다.
 * - 뒤가 없으면(콜드 스타트) 루트로 교체.
 */
const mockOrder: string[] = [];
const mockSetHouse = jest.fn();
const mockSetFriend = jest.fn();
let mockParams: Record<string, unknown> = {};
let mockCanGoBack = true;
const mockBack = jest.fn(() => mockOrder.push('back'));
const mockReplace = jest.fn((href: string) => mockOrder.push(`replace:${href}`));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    canGoBack: () => mockCanGoBack,
    back: mockBack,
    replace: mockReplace,
  }),
}));

jest.mock('@/lib/pending-invite', () => ({
  setPendingInviteCode: (c: string) => {
    mockOrder.push('handoff');
    mockSetHouse(c);
  },
  setPendingFriendInviteCode: (c: string) => {
    mockOrder.push('handoff');
    mockSetFriend(c);
  },
}));

beforeEach(() => {
  mockOrder.length = 0;
  mockCanGoBack = true;
  jest.clearAllMocks();
});

describe('초대 딥링크 라우트', () => {
  it('앱이 떠 있으면 코드를 넘긴 뒤 기존 셸로 돌아간다(새 루트를 만들지 않는다)', async () => {
    mockParams = { code: 'abc123' };
    await render(<JoinDeepLink />);
    expect(mockSetHouse).toHaveBeenCalledWith('abc123');
    expect(mockOrder).toEqual(['handoff', 'back']);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('콜드 스타트(뒤가 없음)면 루트로 교체한다', async () => {
    mockParams = { code: 'abc123' };
    mockCanGoBack = false;
    await render(<JoinDeepLink />);
    expect(mockOrder).toEqual(['handoff', 'replace:/']);
  });

  it('친구 초대도 같은 계약', async () => {
    mockParams = { code: 'friend9' };
    await render(<FriendInviteDeepLink />);
    expect(mockSetFriend).toHaveBeenCalledWith('friend9');
    expect(mockOrder).toEqual(['handoff', 'back']);
  });

  it('배열로 오는 쿼리도 첫 값을 쓴다', async () => {
    mockParams = { code: ['first', 'second'] };
    await render(<JoinDeepLink />);
    expect(mockSetHouse).toHaveBeenCalledWith('first');
  });

  it('코드가 없으면 넘기지 않고 돌아가기만 한다', async () => {
    mockParams = {};
    await render(<JoinDeepLink />);
    expect(mockSetHouse).not.toHaveBeenCalled();
    expect(mockOrder).toEqual(['back']);
  });
});
