/**
 * #539 2단계 검증 — memo 경계와 AppShell prop 참조 안정성.
 *
 * MyRoomScreen을 "받은 props를 렌더마다 기록하는" 프로브로 교체해, 셸의
 * 무관한 상태 변화(탭 전환 → 복귀) 후에도 함수/객체 prop의 참조가 유지되는지
 * 단언한다 — 참조가 흔들리면 memo 경계가 무효가 되는 회귀를 잡는다.
 * (프로브 mock이 실제 화면 렌더를 대체하므로 기존 app-shell.test.tsx와 분리.)
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppShell } from '@/components/app/app-shell';
import { Room } from '@/components/room/room';
import { HouseScreen } from '@/components/screens/house-screen';
import { AuthProvider } from '@/hooks/use-auth';

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

// AppShell은 마운트 시 API를 부른다 — 빈 응답으로 결정적으로 만든다.
const emptyRes = (url: string) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify(
      url.endsWith('/today') ? { categories: [], summary: {}, streak: {} } : { items: [] },
    ),
});
const realFetch = global.fetch;
beforeEach(() => {
  mockMyRoomRenders.length = 0;
  global.fetch = jest.fn(async (url: string) => emptyRes(url)) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('memo 경계 (#539)', () => {
  const MEMO_TYPE = Symbol.for('react.memo');

  it('Room · MyRoomScreen · HouseScreen은 React.memo 컴포넌트다', () => {
    expect((Room as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
    expect((HouseScreen as unknown as { $$typeof: symbol }).$$typeof).toBe(MEMO_TYPE);
    // 이 파일에서는 my-room-screen이 프로브로 mock돼 있어 실제 모듈로 확인한다.
    const actual = jest.requireActual('@/components/screens/my-room-screen') as {
      MyRoomScreen: { $$typeof: symbol };
    };
    expect(actual.MyRoomScreen.$$typeof).toBe(MEMO_TYPE);
  });
});

describe('AppShell → MyRoomScreen prop 참조 안정성 (#539)', () => {
  it('무관한 상태 변화(집 탭 전환 후 복귀) 전후로 대표 prop의 참조가 같다', async () => {
    const { getByLabelText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
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
    const stableProps = [
      // 콜백 — 하나라도 새 참조면 memo가 매번 뚫린다.
      'onToggleCompletion',
      'onAddRoutine',
      'onSelectDate',
      'onToggleCalendarItem',
      'onEditRoutine',
      'onOpenNotifications',
      'onSelectCharacter',
      'onOpenGacha',
      'onEdit',
      'onManageRoutines',
      'onManageCategories',
      'onRetry',
      'onQuickAddRoutine',
      'onDeleteRoutine',
      // 객체/배열 — 렌더마다 새로 만들면 안 되는 파생 prop.
      'placements',
      'quickAddDisabledCategoryIds',
      'routines',
      'completions',
      'categories',
      'placedFurnitureIds',
      'furniture',
      'wallpapers',
    ] as const;
    // 참조가 바뀐 prop 이름이 그대로 실패 메시지가 되도록 목록으로 단언한다.
    const changed = stableProps.filter((key) => after[key] !== before[key]);
    expect(changed).toEqual([]);
  });
});
