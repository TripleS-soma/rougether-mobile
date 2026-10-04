import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useMissionLinks } from '@/components/app/use-mission-links';
import type { House, HouseMission } from '@/components/screens/house-screen';
import type { Routine, RoutineCategoryMeta } from '@/constants/routines';

const mockToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({ useToast: () => ({ show: mockToast }) }));
jest.mock('@/api/auth', () => ({
  ...jest.requireActual('@/api/auth'),
  getSessionUserId: () => 7,
}));

const mission = (id: number, status: HouseMission['status'], achieved = false): HouseMission => ({
  id,
  title: `미션 ${id}`,
  desc: '',
  icon: 'paw',
  current: 0,
  target: 10,
  status,
  achieved,
});

const CATEGORY: RoutineCategoryMeta = {
  id: 'c-house',
  name: 'TripleS',
  color: '#7FA87F',
  icon: 'house',
  visibility: 'private',
  houseId: 6,
};

const routine = (id: string, linkedMissionId?: number): Routine =>
  ({ id, title: `루틴 ${id}`, kind: 'routine', category: 'c-house', linkedMissionId }) as Routine;

/** 정리 이펙트만 보는 최소 하니스 — 나머지 콜백은 호출되지 않아야 정상. */
const setup = (opts: { missions: HouseMission[]; routines: Routine[] }) => {
  const deleteRoutine = jest.fn(async () => true);
  const houses: House[] = [{ houseId: 6, name: 'TripleS', missions: opts.missions } as House];
  const view = renderHook(() =>
    useMissionLinks({
      houses,
      currentHouse: houses[0],
      routines: opts.routines,
      completions: {},
      categories: [CATEGORY],
      myRoomLoading: false,
      housesLoading: false,
      contributedMissionIds: new Set<number>(),
      ensureCategory: jest.fn(),
      addRoutineWithMission: jest.fn(),
      linkCategoryHouse: jest.fn(),
      linkRoutineMission: jest.fn(),
      deleteRoutine,
      deleteCategoryCascade: jest.fn(),
      toggleCompletion: jest.fn(),
      leaveHouse: jest.fn(),
      deleteMission: jest.fn(),
      applyMissionContribution: jest.fn(),
    } as unknown as Parameters<typeof useMissionLinks>[0]),
  );
  return { deleteRoutine, view };
};

describe('연동 루틴 자동 정리 (#338 → #979)', () => {
  it('끝난 미션의 연동 루틴을 지운다', async () => {
    const { deleteRoutine } = setup({
      missions: [mission(1, 'ACTIVE'), mission(2, 'COMPLETED')],
      routines: [routine('r-active', 1), routine('r-ended', 2)],
    });
    await waitFor(() => expect(deleteRoutine).toHaveBeenCalledWith('r-ended'));
    // 진행 중 미션의 루틴은 건드리지 않는다.
    expect(deleteRoutine).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith('끝난 미션의 연동 루틴을 정리했어요');
  });

  it('EXPIRED도 같이 정리한다', async () => {
    const { deleteRoutine } = setup({
      missions: [mission(3, 'EXPIRED')],
      routines: [routine('r-expired', 3)],
    });
    await waitFor(() => expect(deleteRoutine).toHaveBeenCalledWith('r-expired'));
  });

  it('사라진 미션만 있으면 그 사유만 말한다 (#338 원래 경로)', async () => {
    // "끝나거나 사라진"이라고 하면 일어나지 않은 일까지 말하는 셈이다.
    const { deleteRoutine } = setup({
      missions: [mission(1, 'ACTIVE')],
      routines: [routine('r-gone', 99)], // 목록에 없는 미션 id
    });
    await waitFor(() => expect(deleteRoutine).toHaveBeenCalledWith('r-gone'));
    expect(mockToast).toHaveBeenCalledWith('사라진 미션의 연동 루틴을 정리했어요');
  });

  it('사유가 섞이면 두 말을 겹쳐 쓴다', async () => {
    const { deleteRoutine } = setup({
      missions: [mission(1, 'ACTIVE'), mission(2, 'COMPLETED')],
      routines: [routine('r-gone', 99), routine('r-ended', 2)],
    });
    await waitFor(() => expect(deleteRoutine).toHaveBeenCalledTimes(2));
    expect(mockToast).toHaveBeenCalledWith('끝나거나 사라진 미션의 연동 루틴을 정리했어요');
  });

  it('목표를 채웠어도 ACTIVE면 남긴다 — 보상에 닿을 길이 있어야 한다', async () => {
    const { deleteRoutine } = setup({
      missions: [mission(4, 'ACTIVE', true)],
      routines: [routine('r-claimable', 4)],
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(deleteRoutine).not.toHaveBeenCalled();
  });

  it('미션 목록이 비면 아무것도 안 지운다 — 조회 실패와 구분할 수 없다', async () => {
    // 이 가드가 없으면 네트워크 한 번 실패에 루틴이 날아간다.
    const { deleteRoutine } = setup({ missions: [], routines: [routine('r-x', 9)] });
    await new Promise((r) => setTimeout(r, 30));
    expect(deleteRoutine).not.toHaveBeenCalled();
  });

  it('연동이 없는 루틴은 대상이 아니다', async () => {
    const { deleteRoutine } = setup({
      missions: [mission(1, 'COMPLETED')],
      routines: [routine('r-plain')],
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(deleteRoutine).not.toHaveBeenCalled();
  });
});

describe('houseLinkedRoutines 참조 유지 (성능 장부 R7)', () => {
  const base = (completions: Record<string, string[]>, routines: Routine[]) =>
    ({
      houses: [{ houseId: 6, name: 'TripleS', missions: [mission(1, 'ACTIVE')] } as House],
      currentHouse: { houseId: 6, name: 'TripleS', missions: [mission(1, 'ACTIVE')] } as House,
      routines,
      completions,
      categories: [CATEGORY],
      myRoomLoading: false,
      housesLoading: false,
      contributedMissionIds: new Set<number>(),
      ensureCategory: jest.fn(),
      addRoutineWithMission: jest.fn(),
      linkCategoryHouse: jest.fn(),
      linkRoutineMission: jest.fn(),
      deleteRoutine: jest.fn(async () => true),
      deleteCategoryCascade: jest.fn(),
      toggleCompletion: jest.fn(),
      leaveHouse: jest.fn(),
      deleteMission: jest.fn(),
      applyMissionContribution: jest.fn(),
    }) as unknown as Parameters<typeof useMissionLinks>[0];

  it('연동과 무관한 완료가 바뀌면 같은 배열, 연동 루틴의 오늘 완료가 바뀌면 새 배열', async () => {
    const routines = [routine('linked', 1), routine('plain')];
    const view = await renderHook(
      (props: Parameters<typeof useMissionLinks>[0]) => useMissionLinks(props),
      {
        initialProps: base({}, routines),
      },
    );
    const first = view.result.current.houseLinkedRoutines;
    expect(first).toEqual([{ missionId: 1, completedToday: false }]);

    await view.rerender(base({ plain: ['2000-01-01'] }, routines));
    expect(view.result.current.houseLinkedRoutines).toBe(first);

    const today = view.result.current.houseLinkedRoutines;
    const { todayIso } = jest.requireActual('@/utils/datetime') as { todayIso: () => string };
    await view.rerender(base({ linked: [todayIso()] }, routines));
    expect(view.result.current.houseLinkedRoutines).not.toBe(today);
    expect(view.result.current.houseLinkedRoutines).toEqual([
      { missionId: 1, completedToday: true },
    ]);
  });
});

describe('연동 해제 (루틴↔미션, 카테고리↔집)', () => {
  const OPT_OUT_KEY = 'rougether.link-opt-outs.v1.7';
  type Args = Parameters<typeof useMissionLinks>[0];

  const harness = async (over: Partial<Args> & { missions: HouseMission[] }) => {
    const unlinkRoutineMission = jest.fn(async () => true);
    const unlinkCategoryHouse = jest.fn(async () => true);
    const linkRoutineMission = jest.fn(async () => undefined);
    const linkCategoryHouse = jest.fn(async () => undefined);
    const houses: House[] = [{ houseId: 6, name: 'TripleS', missions: over.missions } as House];
    const { missions: _m, ...rest } = over;
    const view = await renderHook(() =>
      useMissionLinks({
        houses,
        currentHouse: houses[0],
        routines: [],
        completions: {},
        categories: [CATEGORY],
        myRoomLoading: false,
        housesLoading: false,
        contributedMissionIds: new Set<number>(),
        ensureCategory: jest.fn(),
        addRoutineWithMission: jest.fn(),
        linkCategoryHouse,
        linkRoutineMission,
        unlinkRoutineMission,
        unlinkCategoryHouse,
        deleteRoutine: jest.fn(async () => true),
        deleteCategoryCascade: jest.fn(),
        toggleCompletion: jest.fn(),
        leaveHouse: jest.fn(),
        deleteMission: jest.fn(),
        applyMissionContribution: jest.fn(),
        ...rest,
      } as unknown as Args),
    );
    return {
      view,
      unlinkRoutineMission,
      unlinkCategoryHouse,
      linkRoutineMission,
      linkCategoryHouse,
    };
  };

  it('미션의 내 연동 루틴을 지우지 않고 연동만 해제하고, 해제한 미션을 기록한다', async () => {
    const deleteRoutine = jest.fn(async () => true);
    const h = await harness({
      missions: [mission(1, 'ACTIVE')],
      routines: [routine('r1', 1), routine('r2')],
      deleteRoutine,
    });
    await act(async () => {
      await h.view.result.current.unlinkMissionRoutine(1);
    });
    expect(h.unlinkRoutineMission).toHaveBeenCalledWith('r1');
    expect(h.unlinkRoutineMission).toHaveBeenCalledTimes(1);
    expect(deleteRoutine).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('미션 연동을 해제했어요. 루틴은 그대로 남아요');
    expect(JSON.parse((await AsyncStorage.getItem(OPT_OUT_KEY))!)).toMatchObject({
      missionIds: [1],
    });
  });

  it('해제가 실패하면 기록도 성공 토스트도 없다 (실패 토스트는 데이터 훅 몫)', async () => {
    const h = await harness({ missions: [mission(1, 'ACTIVE')], routines: [routine('r1', 1)] });
    h.unlinkRoutineMission.mockResolvedValueOnce(false);
    await act(async () => {
      await h.view.result.current.unlinkMissionRoutine(1);
    });
    expect(mockToast).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(OPT_OUT_KEY)).toBeNull();
  });

  it('카테고리의 집 연동을 해제하고 해제한 집을 기록한다', async () => {
    const h = await harness({ missions: [mission(1, 'ACTIVE')] });
    await act(async () => {
      await h.view.result.current.unlinkHouseCategory('c-house');
    });
    expect(h.unlinkCategoryHouse).toHaveBeenCalledWith('c-house');
    expect(mockToast).toHaveBeenCalledWith('집 연동을 해제했어요. 카테고리와 루틴은 그대로 남아요');
    expect(JSON.parse((await AsyncStorage.getItem(OPT_OUT_KEY))!)).toMatchObject({
      houseIds: [6],
    });
    expect(h.view.result.current.houseNameById).toEqual({ 6: 'TripleS' });
  });

  /**
   * 부팅 때의 이름 매칭 승격(#578)은 "이름이 같은데 링크가 없는" 항목에 링크를 심는다.
   * 사용자가 해제한 직후가 바로 그 상태라, 기록을 안 보면 다음 실행에 연동이 되살아난다.
   */
  it('승격은 사용자가 해제한 집·미션을 다시 걸지 않는다', async () => {
    await AsyncStorage.setItem(OPT_OUT_KEY, JSON.stringify({ houseIds: [6], missionIds: [1] }));
    const unlinkedCat = { ...CATEGORY, houseId: undefined };
    const h = await harness({
      missions: [mission(1, 'ACTIVE')],
      categories: [unlinkedCat],
      routines: [{ ...routine('r1'), title: '미션 1' } as Routine],
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(h.linkCategoryHouse).not.toHaveBeenCalled();
    expect(h.linkRoutineMission).not.toHaveBeenCalled();
  });

  it('기록이 없으면 승격은 예전대로 이름으로 연동한다', async () => {
    const unlinkedCat = { ...CATEGORY, houseId: undefined };
    const h = await harness({
      missions: [mission(1, 'ACTIVE')],
      categories: [unlinkedCat],
      routines: [{ ...routine('r1'), title: '미션 1' } as Routine],
    });
    await waitFor(() => expect(h.linkCategoryHouse).toHaveBeenCalledWith('c-house', 6));
    await waitFor(() => expect(h.linkRoutineMission).toHaveBeenCalledWith('r1', 1));
  });
});
