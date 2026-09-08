/**
 * 공동미션 — 생성·삭제·기여·보상 수령과 "오늘 내가 기여한 미션" 추적.
 * useHouses가 합성해 같은 키로 돌려준다.
 *
 * 미션 변경은 그 집 하나만 재동기화한다(#534) — `reloadHouse`를 밖에서
 * 받는 이유. `houses`는 완료 응답의 자동 기여(#578)가 어느 집을 다시 받을지
 * 찾는 데만 쓴다.
 *
 * 콜백은 전부 useCallback, 반환 객체는 useMemo — memo 경계(#539) 보존.
 */
import { useCallback, useMemo, useState } from 'react';

import {
  ApiError,
  ErrorCode,
  claimHouseMission,
  contributeHouseMission,
  createHouseMission,
  deleteHouseMission,
} from '@/api';
import type { HouseMissionContributeResponse } from '@/api/types';
import { useToast } from '@/components/ui/toast';
import type { House, NewHouseMission } from '@/components/screens/house/types';

export function useHouseMissions({
  houses,
  reloadHouse,
}: {
  houses: House[];
  /** 영향받은 집 하나만 다시 받아 목록에 끼워넣는다 (#534). */
  reloadHouse: (houseId: number) => Promise<void>;
}) {
  // Mission ids I contributed to today (session-scoped — the list API doesn't
  // expose per-member daily contribution, so this seeds from contribute calls).
  const [contributedMissionIds, setContributedMissionIds] = useState<Set<number>>(new Set());
  const { show: toast } = useToast();

  const contributeMission = useCallback(
    async (houseId: number, missionId: number) => {
      try {
        const res = await contributeHouseMission(houseId, missionId);
        setContributedMissionIds((prev) => new Set(prev).add(missionId));
        toast(res.achieved ? '기여 완료! 목표를 달성했어요' : '기여했어요 (+1)', 'success');
        await reloadHouse(houseId);
      } catch (err) {
        // The server caps contributions at one per day per member.
        const already =
          err instanceof ApiError && err.code === ErrorCode.HOUSE_MISSION_ALREADY_CONTRIBUTED;
        // Already-today still means "contributed" — the card shows 기여됨.
        if (already) setContributedMissionIds((prev) => new Set(prev).add(missionId));
        toast(already ? '오늘은 이미 기여했어요. 내일 또 만나요!' : '기여에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  /**
   * 완료 응답에 실려온 서버 자동 기여 결과 반영 (#578) — contributeMission 성공
   * 처리와 동일하게 기여 마킹 + 해당 집만 재동기화(미션 currentValue 갱신).
   */
  const applyMissionContribution = useCallback(
    (res: HouseMissionContributeResponse) => {
      const missionId = res.missionId;
      if (missionId == null) return;
      setContributedMissionIds((prev) => new Set(prev).add(missionId));
      toast(res.achieved ? '기여 완료! 목표를 달성했어요' : '기여했어요 (+1)', 'success');
      const house = houses.find((h) => h.missions?.some((m) => m.id === missionId));
      if (house?.houseId != null) void reloadHouse(house.houseId);
    },
    [houses, toast, reloadHouse],
  );

  const claimMission = useCallback(
    async (houseId: number, missionId: number) => {
      try {
        const res = await claimHouseMission(houseId, missionId);
        toast(`보상 수령! 집 성장 포인트 +${res.grantedGrowthPoints ?? 0}`, 'success');
        await reloadHouse(houseId);
      } catch (err) {
        const notAchieved =
          err instanceof ApiError && err.code === ErrorCode.HOUSE_MISSION_NOT_ACHIEVED;
        toast(notAchieved ? '아직 목표를 달성하지 못했어요' : '보상 받기에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  const createMission = useCallback(
    async (houseId: number, input: NewHouseMission) => {
      try {
        await createHouseMission(houseId, input);
        toast('새 미션을 만들었어요!', 'success');
        await reloadHouse(houseId);
      } catch (err) {
        // The server restricts mission creation to the OWNER (403).
        const notOwner = err instanceof ApiError && err.code === ErrorCode.HOUSE_NOT_OWNER;
        toast(notOwner ? '방장만 미션을 만들 수 있어요' : '미션 만들기에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  /** 미션 삭제 — 성공 여부 반환 (연동 루틴 정리 판단, #338). */
  const deleteMission = useCallback(
    async (houseId: number, missionId: number): Promise<boolean> => {
      try {
        await deleteHouseMission(houseId, missionId);
        toast('미션을 삭제했어요', 'success');
        await reloadHouse(houseId);
        return true;
      } catch (err) {
        // The server keeps COMPLETED missions (growth points already granted).
        const claimed =
          err instanceof ApiError && err.code === ErrorCode.HOUSE_MISSION_ALREADY_CLAIMED;
        const notOwner = err instanceof ApiError && err.code === ErrorCode.HOUSE_NOT_OWNER;
        toast(
          claimed
            ? '보상을 받은 미션은 삭제할 수 없어요'
            : notOwner
              ? '방장만 미션을 삭제할 수 있어요'
              : '미션 삭제에 실패했어요',
          'error',
        );
        return false;
      }
    },
    [toast, reloadHouse],
  );

  return useMemo(
    () => ({
      contributedMissionIds,
      contributeMission,
      applyMissionContribution,
      claimMission,
      createMission,
      deleteMission,
    }),
    [
      contributedMissionIds,
      contributeMission,
      applyMissionContribution,
      claimMission,
      createMission,
      deleteMission,
    ],
  );
}
