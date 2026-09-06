/**
 * #539 2단계 검증 — memo 경계와 AppShell prop 참조 안정성.
 *
 * MyRoomScreen을 "받은 props를 렌더마다 기록하는" 프로브로 교체해, 셸의
 * 무관한 상태 변화(탭 전환 → 복귀) 후에도 함수/객체 prop의 참조가 유지되는지
 * 단언한다 — 참조가 흔들리면 memo 경계가 무효가 되는 회귀를 잡는다.
 * (프로브 mock이 실제 화면 렌더를 대체하므로 기존 app-shell.test.tsx와 분리.)
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Pressable } from 'react-native';

import { AppShell } from '@/components/app/app-shell';
import { Room } from '@/components/room/room';
import { AuthProvider } from '@/hooks/use-auth';
import { BrandThemeProvider, useBrandTheme } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import { QueryProvider } from '@/test-utils/query-wrapper';

// 렌더마다 받은 props를 기록하는 MyRoomScreen 프로브.
const mockMyRoomRenders: Record<string, unknown>[] = [];
jest.mock('@/components/screens/my-room-screen', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    MyRoomScreen: (props: Record<string, unknown>) => {
      mockMyRoomRenders.push(props);
      return React.createElement(Text, null, 'my-room-probe');
    },
  };
});

// HouseScreen도 동일한 프로브 — 집 탭은 이탈 시 언마운트되지만, 셸의
// useCallback prop은 리마운트를 넘어 같은 참조여야 한다.
const mockHouseRenders: Record<string, unknown>[] = [];
jest.mock('@/components/screens/house-screen', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    HouseScreen: (props: Record<string, unknown>) => {
      mockHouseRenders.push(props);
      return React.createElement(Text, null, 'house-probe');
    },
  };
});

// MyPageScreen 프로브 (#563 후속 → #1088) — 탭 페이저로 상주하므로 memo가
// 없으면 셸의 모든 상태 변화에 함께 리렌더된다.
const mockSettingsRenders: Record<string, unknown>[] = [];
jest.mock('@/components/screens/my-page-screen', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    MyPageScreen: (props: Record<string, unknown>) => {
      mockSettingsRenders.push(props);
      return React.createElement(Text, null, 'my-page-probe');
    },
  };
});

// AppShell은 마운트 시 API를 부른다 — 결정적 응답으로 고정한다. 집이 하나는
// 있어야 집 탭이 HouseScreen을 렌더한다(집 없으면 탐색 직행, #571).
const stableRes = (url: string) => {
  const body = url.endsWith('/today')
    ? { categories: [], summary: {}, streak: {} }
    : url.endsWith('/me/houses')
      ? { items: [{ houseId: 2, name: 'TripleS' }] }
      : url.includes('/houses/2/missions') || url.includes('/houses/2/members')
        ? { items: [] }
        : url.includes('/houses/2')
          ? { houseId: 2, name: 'TripleS', myRole: 'OWNER' }
          : { items: [] };
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
};
const realFetch = global.fetch;

function PrefetchModeControl() {
  const { setMode } = useBrandTheme();
  return <Pressable accessibilityLabel="prefetch-dark-mode" onPress={() => setMode('dark')} />;
}

it('집 목록이 그대로여도 다크모드 전환 시 새 배경을 미리 받는다', async () => {
  await AsyncStorage.clear();
  const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  try {
    const ui = await render(
      <QueryProvider>
        <AuthProvider>
          <BrandThemeProvider>
            <PrefetchModeControl />
            <AppShell />
          </BrandThemeProvider>
        </AuthProvider>
      </QueryProvider>,
    );
    const light = assetSource(
      'house/cloud-balloon/backgrounds/house-cloud-balloon-background-v1.webp',
    ).uri;
    const dark = assetSource(
      'house/cloud-balloon/backgrounds/house-cloud-balloon-background-dark-v1.webp',
    ).uri;
    await waitFor(() =>
      expect(prefetch).toHaveBeenCalledWith(expect.arrayContaining([light]), {
        cachePolicy: 'memory-disk',
      }),
    );
    prefetch.mockClear();
    await fireEvent.press(ui.getByLabelText('prefetch-dark-mode'));
    await waitFor(() =>
      expect(prefetch).toHaveBeenCalledWith(expect.arrayContaining([dark]), {
        cachePolicy: 'memory-disk',
      }),
    );
  } finally {
    prefetch.mockRestore();
    await AsyncStorage.clear();
  }
});

beforeEach(() => {
  mockMyRoomRenders.length = 0;
  mockHouseRenders.length = 0;
  mockSettingsRenders.length = 0;
  global.fetch = jest.fn(async (url: string) => stableRes(url)) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('memo 경계 (#539)', () => {
  const MEMO_TYPE = Symbol.for('react.memo');

  it('Room · MyRoomScreen · HouseScreen은 React.memo 컴포넌트다', () => {
    expect((Room as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
    // 두 화면은 이 파일에서 프로브로 mock돼 있어 실제 모듈로 확인한다.
    const myRoom = jest.requireActual('@/components/screens/my-room-screen') as {
      MyRoomScreen: { $$typeof: symbol };
    };
    expect(myRoom.MyRoomScreen.$$typeof).toBe(MEMO_TYPE);
    const house = jest.requireActual('@/components/screens/house-screen') as {
      HouseScreen: { $$typeof: symbol };
    };
    expect(house.HouseScreen.$$typeof).toBe(MEMO_TYPE);
    const settings = jest.requireActual('@/components/screens/settings-screen') as {
      SettingsScreen: { $$typeof: symbol };
    };
    expect(settings.SettingsScreen.$$typeof).toBe(MEMO_TYPE);
  });
});

/**
 * 전 prop 참조 비교 (#678) — 명시 목록 대신 기록된 모든 prop을 비교한다.
 * 원시값은 값 비교로 자연 통과하고, 함수·배열·객체는 참조가 바뀌는 순간
 * prop 이름이 실패 메시지에 그대로 뜬다. allow는 정당하게 바뀌는 prop.
 */
const changedRefs = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  allow: string[] = [],
) => Object.keys(after).filter((k) => !allow.includes(k) && after[k] !== before[k]);

describe('AppShell → MyRoomScreen prop 참조 안정성 (#539)', () => {
  it('무관한 상태 변화(집 탭 전환 후 복귀) 전후로 대표 prop의 참조가 같다', async () => {
    const { getByLabelText } = await render(
      <QueryProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </QueryProvider>,
    );

    // 초기 로드(루틴·집·상점·캐릭터 등)가 전부 정착할 때까지 기다린다 —
    // 데이터가 갈리는 중의 참조 변화는 정당한 리렌더라 비교 대상이 아니다.
    await waitFor(() => expect(mockMyRoomRenders.at(-1)?.loading).toBe(false));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const before = mockMyRoomRenders.at(-1)!;
    const renderCount = mockMyRoomRenders.length;

    // 무관한 셸 상태 변화: 집 탭으로 갔다가 나의 방으로 복귀 (screen 상태 2회
    // 변경 + 화면 전환 Animated 트랜지션 발화).
    await fireEvent.press(getByLabelText('집'));
    await fireEvent.press(getByLabelText('나의 방'));
    await waitFor(() => expect(mockMyRoomRenders.length).toBeGreaterThan(renderCount));

    const after = mockMyRoomRenders.at(-1)!;
    const changed = changedRefs(before, after);
    expect(changed).toEqual([]);
  });
});

describe('AppShell → HouseScreen prop 참조 안정성 (#539, 리뷰 반영)', () => {
  it('탭 이탈로 언마운트됐다 재진입해도 셸의 핸들러·파생 prop 참조가 같다', async () => {
    const { getByLabelText } = await render(
      <QueryProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </QueryProvider>,
    );
    await waitFor(() => expect(mockMyRoomRenders.at(-1)?.loading).toBe(false));

    // 첫 방문 — 집 탭 데이터가 정착할 때까지 기다린 스냅샷.
    await fireEvent.press(getByLabelText('집'));
    await waitFor(() => expect(mockHouseRenders.at(-1)?.loading).toBe(false));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const before = mockHouseRenders.at(-1)!;

    // 이탈(언마운트) 후 재진입 — 리마운트를 넘어 참조가 유지돼야 한다.
    await fireEvent.press(getByLabelText('나의 방'));
    await fireEvent.press(getByLabelText('집'));
    await waitFor(() => expect(mockHouseRenders.at(-1)).not.toBe(before));

    const after = mockHouseRenders.at(-1)!;
    const changed = changedRefs(before, after);
    expect(changed).toEqual([]);
  });
});

describe('AppShell → MyPageScreen prop 참조 안정성 (#563 후속)', () => {
  it('무관한 상태 변화(집 탭 왕복) 전후로 셸 콜백 prop의 참조가 같다', async () => {
    const { getByLabelText } = await render(
      <QueryProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </QueryProvider>,
    );
    await waitFor(() => expect(mockMyRoomRenders.at(-1)?.loading).toBe(false));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const before = mockSettingsRenders.at(-1)!;
    await fireEvent.press(getByLabelText('집'));
    await fireEvent.press(getByLabelText('나의 방'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const after = mockSettingsRenders.at(-1)!;
    const changed = changedRefs(before, after);
    expect(changed).toEqual([]);
  });
});

/**
 * 탭 스크롤 기억 (#763) — 서브화면으로 가면 페이저가 언마운트되므로 위치는
 * 셸이 들고 있어야 살아남는다. 여기선 셸이 내려주는 게터/보고 쌍의 계약을
 * 단언한다(복원 동작 자체는 use-scroll-restore 단위 테스트가 덮는다).
 */
describe('탭 스크롤 위치 보존 (#763)', () => {
  it('탭별로 위치를 기억하고, 게터·보고 콜백은 참조가 고정이다', async () => {
    const { getByLabelText } = await render(
      <QueryProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </QueryProvider>,
    );
    // 세 탭 화면은 페이저에 함께 마운트된다 — 두 프로브 모두 기록이 있다.
    await waitFor(() => expect(mockSettingsRenders.length).toBeGreaterThan(0));
    const settings = mockSettingsRenders[mockSettingsRenders.length - 1];
    const myRoom = mockMyRoomRenders[mockMyRoomRenders.length - 1];
    const readSettings = settings.getInitialScrollY as () => number;

    // 처음엔 맨 위. 보고하면 셸이 들고 있다가 게터로 돌려준다.
    expect(readSettings()).toBe(0);
    act(() => (settings.onScrollY as (y: number) => void)(420));
    expect(readSettings()).toBe(420);

    // 탭끼리 섞이지 않는다.
    expect((myRoom.getInitialScrollY as () => number)()).toBe(0);
    act(() => (myRoom.onScrollY as (y: number) => void)(80));
    expect(readSettings()).toBe(420);

    // 탭 왕복(=셸 리렌더) 후에도 참조가 같다 — memo 화면(#539)을 깨지 않는다.
    await fireEvent.press(getByLabelText('집'));
    await fireEvent.press(getByLabelText('마이페이지'));
    const after = mockSettingsRenders[mockSettingsRenders.length - 1];
    expect(after.getInitialScrollY).toBe(settings.getInitialScrollY);
    expect(after.onScrollY).toBe(settings.onScrollY);
    // 기억한 위치도 그대로.
    expect((after.getInitialScrollY as () => number)()).toBe(420);
  });
});
