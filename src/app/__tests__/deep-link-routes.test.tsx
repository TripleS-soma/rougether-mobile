import { render } from '@testing-library/react-native';

import FriendInviteDeepLink from '@/app/invite';
import JoinDeepLink from '@/app/join';

/**
 * 딥링크 라우트가 **렌더 중이 아니라 이펙트에서** 코드를 넘기는지 (#896).
 *
 * 렌더 중에 넘기면 셸의 setState를 다른 컴포넌트를 그리는 도중에 부르게 되고,
 * React가 그 갱신을 버릴 수 있다 — 앱이 이미 떠 있는 웜 스타트에서 초대 코드가
 * 사라지던 원인이다. 이 테스트는 "렌더가 끝난 뒤에 호출된다"를 고정한다.
 */
const mockSetHouse = jest.fn();
const mockSetFriend = jest.fn();
let mockParams: Record<string, unknown> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  // Redirect가 실제 네비게이션을 하지 않도록 — 렌더 시점 관찰만 한다.
  Redirect: () => {
    mockRenderOrder.push('render');
    return null;
  },
}));
const mockRenderOrder: string[] = [];

jest.mock('@/lib/pending-invite', () => ({
  setPendingInviteCode: (c: string) => {
    mockRenderOrder.push('handoff');
    mockSetHouse(c);
  },
  setPendingFriendInviteCode: (c: string) => {
    mockRenderOrder.push('handoff');
    mockSetFriend(c);
  },
}));

beforeEach(() => {
  mockRenderOrder.length = 0;
  jest.clearAllMocks();
});

describe('딥링크 라우트 (#896)', () => {
  it('집 초대 코드를 렌더가 끝난 뒤에 넘긴다', async () => {
    mockParams = { code: 'abc123' };
    await render(<JoinDeepLink />);
    expect(mockSetHouse).toHaveBeenCalledWith('abc123');
    // 렌더(Redirect)가 먼저, 핸드오프가 나중 — 렌더 중 호출이 아니다.
    expect(mockRenderOrder).toEqual(['render', 'handoff']);
  });

  it('친구 초대도 같은 계약', async () => {
    mockParams = { code: 'friend9' };
    await render(<FriendInviteDeepLink />);
    expect(mockSetFriend).toHaveBeenCalledWith('friend9');
    expect(mockRenderOrder).toEqual(['render', 'handoff']);
  });

  it('배열로 오는 쿼리도 첫 값을 쓴다', async () => {
    mockParams = { code: ['first', 'second'] };
    await render(<JoinDeepLink />);
    expect(mockSetHouse).toHaveBeenCalledWith('first');
  });

  it('코드가 없으면 아무것도 넘기지 않는다', async () => {
    mockParams = {};
    await render(<JoinDeepLink />);
    expect(mockSetHouse).not.toHaveBeenCalled();
  });
});
