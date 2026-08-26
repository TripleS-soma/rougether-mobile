import { renderHook, waitFor } from '@testing-library/react-native';

import { useMissionLinks } from '@/components/app/use-mission-links';
import type { House, HouseMission } from '@/components/screens/house-screen';
import type { Routine, RoutineCategoryMeta } from '@/constants/routines';

const mockToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({ useToast: () => ({ show: mockToast }) }));

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

beforeEach(() => jest.clearAllMocks());

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
