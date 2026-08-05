import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { House } from '@/components/screens/house-screen';
import { useToast } from '@/components/ui/toast';
import { CATEGORY_COLORS, type Routine, type RoutineCategoryMeta } from '@/constants/routines';
import type { CompletionToggleResult } from '@/hooks/use-my-room-data';
import type { HouseMissionContributeResponse } from '@/api/types';
import { todayIso } from '@/utils/datetime';

/**
 * 공동미션 ↔ 내 루틴 연동 클러스터 (#272 → #578, #692 3단계) — 나의 방
 * (루틴·카테고리)과 집(미션) 양 도메인을 접착하는 셸 로직의 단일 거처.
 * 연동은 서버 링크 id가 진실: 카테고리.houseId == 집 id,
 * 루틴.linkedMissionId == 미션 id (이름 매칭 폐지). 반환 콜백·파생값은 전부
 * 참조 고정 — memo 화면(MyRoomScreen·HouseScreen)의 prop으로 흘러간다 (#539).
 */
export function useMissionLinks({
  houses,
  currentHouse,
  routines,
  completions,
  categories,
  myRoomLoading,
  housesLoading,
  contributedMissionIds,
  ensureCategory,
  addRoutineWithMission,
  linkCategoryHouse,
  linkRoutineMission,
  deleteRoutine,
  deleteCategoryCascade,
  toggleCompletion,
  leaveHouse,
  deleteMission,
  applyMissionContribution,
}: {
  houses: House[];
  currentHouse: House | undefined;
  routines: Routine[];
  completions: Record<string, string[]>;
  categories: RoutineCategoryMeta[];
  myRoomLoading: boolean;
  housesLoading: boolean;
  contributedMissionIds: ReadonlySet<number>;
  ensureCategory: (cat: RoutineCategoryMeta) => Promise<RoutineCategoryMeta | null>;
  /** 루틴 등록(성공 시 온보딩 미션 1 완료 포함) — 셸의 addRoutineWithMission. */
  addRoutineWithMission: (n: {
    title: string;
    category: string;
    repeat: 'daily';
    days: number[];
    startDate: string;
    alarmEnabled: boolean;
    time: string;
    photoVerify: boolean;
    linkedMissionId: number;
  }) => Promise<boolean>;
  linkCategoryHouse: (categoryId: string, houseId: number) => Promise<unknown>;
  linkRoutineMission: (routineId: string, missionId: number) => Promise<unknown>;
  deleteRoutine: (id: string) => Promise<unknown>;
  deleteCategoryCascade: (categoryId: string) => Promise<unknown>;
  toggleCompletion: (id: string, date: string) => Promise<CompletionToggleResult | null>;
  leaveHouse: (houseId: number) => Promise<boolean>;
  deleteMission: (houseId: number, missionId: number) => Promise<boolean>;
  applyMissionContribution: (res: HouseMissionContributeResponse) => void;
}) {
  const { show: toast } = useToast();

  /** 미션의 + → 집 연동 카테고리(없으면 생성) 아래 연동 매일 루틴 생성. */
  const addingMissionRef = useRef(false);
  const addMissionRoutineInner = useCallback(
    async (houseId: number, mission: { id: number; title: string }) => {
      const house = houses.find((h) => h.houseId === houseId);
      if (!house) return;
      // Server-fresh find-or-create — stale local state must not duplicate it.
      const category = await ensureCategory({
        id: '',
        name: house.name,
        icon: 'house',
        color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
        // 집 구성원과 공유하는 맥락이므로 이웃 공개(HOUSE).
        visibility: 'neighbor',
        houseId,
      });
      if (!category) return;
      await addRoutineWithMission({
        title: mission.title,
        category: category.id,
        repeat: 'daily',
        days: [],
        startDate: todayIso(),
        alarmEnabled: false,
        time: '',
        photoVerify: false,
        linkedMissionId: mission.id,
      });
    },
    [houses, categories.length, ensureCategory, addRoutineWithMission],
  );
  const addMissionRoutine = useCallback(
    async (houseId: number, mission: { id: number; title: string }) => {
      // A double-fired press must not create the category twice.
      if (addingMissionRef.current) return;
      addingMissionRef.current = true;
      try {
        await addMissionRoutineInner(houseId, mission);
      } finally {
        addingMissionRef.current = false;
      }
    },
    [addMissionRoutineInner],
  );

  // 집에 연동된(houseId 매칭) 카테고리들 — 나의 방 quick-add를 막는다.
  const houseCategoryIds = useMemo(
    () =>
      categories
        .filter((c) => c.houseId != null && houses.some((h) => h.houseId === c.houseId))
        .map((c) => c.id),
    [categories, houses],
  );

  // 현재 집 미션에 연동된 내 루틴 (미션 카드의 연동/기여함 라벨 판정 —
  // 오늘 완료 여부가 곧 '기여함'이라 앱 재시작 후에도 라벨이 유지된다).
  const houseLinkedRoutines = useMemo(() => {
    const missionIds = new Set((currentHouse?.missions ?? []).map((m) => m.id));
    const today = todayIso();
    return routines
      .filter(
        (r) =>
          r.kind === 'routine' && r.linkedMissionId != null && missionIds.has(r.linkedMissionId),
      )
      .map((r) => ({
        missionId: r.linkedMissionId!,
        completedToday: (completions[r.id] ?? []).includes(today),
      }));
  }, [currentHouse, routines, completions]);

  // HouseScreen은 배열 prop을 받는다 — Set에서 파생한 배열의 참조를 고정.
  const contributedMissionIdList = useMemo(
    () => [...contributedMissionIds],
    [contributedMissionIds],
  );

  /** 주어진 미션 id들에 연동된 내 루틴 (#578) — id 매칭만 쓴다. */
  const linkedRoutinesFor = useCallback(
    (missionIds: number[]) =>
      routines.filter(
        (r) =>
          r.kind === 'routine' &&
          r.linkedMissionId != null &&
          missionIds.includes(r.linkedMissionId),
      ),
    [routines],
  );

  /** 미션 삭제 성공 시 내 연동 루틴도 함께 삭제 — 고아 연동물 방지 (#338). */
  const deleteMissionWithLinked = useCallback(
    async (houseId: number, missionId: number) => {
      const linked = linkedRoutinesFor([missionId]);
      if (!(await deleteMission(houseId, missionId))) return;
      for (const r of linked) await deleteRoutine(r.id);
      if (linked.length > 0) toast('연동된 루틴도 함께 삭제했어요');
    },
    [linkedRoutinesFor, deleteMission, deleteRoutine, toast],
  );

  /** 집 나가기/삭제 성공 시 연동 카테고리를 루틴째 통삭제 (#338). */
  const leaveHouseWithLinked = useCallback(
    async (houseId: number) => {
      const cat = categories.find((c) => c.houseId === houseId);
      if (!(await leaveHouse(houseId))) return;
      if (!cat) return;
      await deleteCategoryCascade(cat.id);
      toast('연동된 카테고리와 루틴도 함께 삭제했어요');
    },
    [categories, leaveHouse, deleteCategoryCascade, toast],
  );

  // 이름 매칭 연동분 1회성 승격 (#578) — 서버 백필이 없어, 이름이 일치하는데
  // 링크 id가 없는 카테고리·루틴에 id를 심는다. 조건 기반(대상 없으면 no-op)
  // 이라 기기 플래그가 필요 없고, 실패분은 다음 부팅에 다시 잡힌다.
  const promotedRef = useRef(false);
  useEffect(() => {
    if (promotedRef.current || myRoomLoading || housesLoading) return;
    if (houses.length === 0) return;
    promotedRef.current = true;
    void (async () => {
      for (const house of houses) {
        if (house.houseId == null) continue;
        let cat = categories.find((c) => c.houseId === house.houseId);
        const nameMatched = categories.find((c) => c.name === house.name);
        if (!cat && nameMatched && nameMatched.houseId == null) {
          await linkCategoryHouse(nameMatched.id, house.houseId);
          cat = nameMatched;
        }
        if (!cat) continue;
        const catId = cat.id;
        for (const mission of house.missions ?? []) {
          if (mission.status !== 'ACTIVE') continue;
          const routine = routines.find(
            (r) =>
              r.kind === 'routine' &&
              r.linkedMissionId == null &&
              r.category === catId &&
              r.title === mission.title,
          );
          if (routine) await linkRoutineMission(routine.id, mission.id);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRoomLoading, housesLoading, houses, routines, categories]);

  // 미션이 사라진 연동 루틴 자동 정리 (#338) — 방장이 미션을 지웠거나 과거
  // 삭제분이 남아 미션 목록과 어긋난 경우, 데이터가 다 실린 뒤 한 번 맞춘다.
  // 링크 id 기준: 연동 카테고리의 집 미션 목록에 없는 linkedMissionId만 고아로
  // 본다. 미션 목록이 비면(조회 실패와 구분 불가) 건드리지 않는다.
  const sweptRef = useRef(false);
  useEffect(() => {
    if (sweptRef.current || myRoomLoading || housesLoading) return;
    if (houses.length === 0 || routines.length === 0) return;
    sweptRef.current = true;
    const orphans = routines.filter((r) => {
      if (r.kind !== 'routine' || r.linkedMissionId == null) return false;
      const cat = r.category ? categories.find((c) => c.id === r.category) : undefined;
      const house =
        cat?.houseId != null ? houses.find((h) => h.houseId === cat.houseId) : undefined;
      const missions = house?.missions ?? [];
      if (missions.length === 0) return false;
      return !missions.some((m) => m.id === r.linkedMissionId);
    });
    if (orphans.length === 0) return;
    void (async () => {
      for (const r of orphans) await deleteRoutine(r.id);
      toast('사라진 미션의 연동 루틴을 정리했어요');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRoomLoading, housesLoading, houses, routines, categories]);

  /**
   * 연동 루틴의 완료 취소를 막고(미션 기여는 회수되지 않는다), 완료 응답에
   * 실려온 서버 자동 기여 결과를 집 상태에 반영한다 (#578) — 클라가 따로
   * contribute를 쏘지 않는다(이중 기여는 서버가 스킵하지만 왕복 낭비).
   */
  const toggleWithMissionGuard = useCallback(
    async (id: string, date: string) => {
      const item = routines.find((r) => r.id === id);
      const done = (completions[id] ?? []).includes(date);
      if (item && done && item.linkedMissionId != null) {
        const linked = houses.some((h) =>
          (h.missions ?? []).some((m) => m.status === 'ACTIVE' && m.id === item.linkedMissionId),
        );
        if (linked) {
          toast('미션에 기여된 루틴은 완료를 취소할 수 없어요', 'error');
          return null;
        }
      }
      const result = await toggleCompletion(id, date);
      if (result?.houseMissionContribution) applyMissionContribution(result.houseMissionContribution); // prettier-ignore
      return result;
    },
    [routines, completions, houses, toast, toggleCompletion, applyMissionContribution],
  );

  return {
    addMissionRoutine,
    houseCategoryIds,
    houseLinkedRoutines,
    contributedMissionIdList,
    deleteMissionWithLinked,
    leaveHouseWithLinked,
    toggleWithMissionGuard,
  };
}
