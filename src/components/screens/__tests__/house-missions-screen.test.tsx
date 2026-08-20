import { fireEvent, render } from '@testing-library/react-native';

import { HouseMissionsScreen } from '@/components/screens/house-missions-screen';
import type { House } from '@/components/screens/house-screen';
import { ToastProvider } from '@/components/ui/toast';

/**
 * 공동 미션 화면 (#875) — 예전엔 집 화면 위 모달이었고 이 테스트들도
 * HouseScreen을 렌더해 FAB을 눌러 열었다. 화면으로 승격되면서 대상을
 * 직접 렌더한다.
 */
const MISSION_HOUSE: House = {
  houseId: 7,
  name: '실집',
  myRole: 'OWNER',
  description: '아침 루틴 집',
  maxMembers: 4,
  memberCount: 2,
  floors: [],
  missions: [
    { id: 11, title: '주간 루틴 지키기', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 3, target: 10, status: 'ACTIVE' }, // prettier-ignore
    { id: 12, title: '기상 인증 모으기', desc: '일일 구성원 달성률', icon: 'sun' as const, current: 8, target: 8, status: 'ACTIVE', achieved: true }, // prettier-ignore
    { id: 13, title: '지난 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 5, target: 5, status: 'COMPLETED', achieved: true }, // prettier-ignore
  ],
};

const MEMBER_HOUSE: House = { ...MISSION_HOUSE, myRole: 'MEMBER' };
const EMPTY_MISSION_HOUSE: House = { ...MISSION_HOUSE, missions: [] };

describe('HouseMissionsScreen', () => {
  /**
   * 목표를 못 채운 COMPLETED를 '완료'라고 하면 바로 위의 진짜 달성 카드와
   * 같은 뜻으로 읽힌다 (#888). 실서버에 `0/3% COMPLETED`인 DAILY 미션이 있다.
   */
  it('목표를 못 채운 COMPLETED는 완료가 아니라 종료로 표시한다 (#888)', async () => {
    const mixed: House = {
      ...MISSION_HOUSE,
      missions: [
        { id: 31, title: '루게더 개발', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 10, target: 10, status: 'COMPLETED', achieved: true, unit: '회' }, // prettier-ignore
        { id: 32, title: '8시 기상', desc: '일일 구성원 달성률', icon: 'sun' as const, current: 0, target: 3, status: 'COMPLETED', achieved: false, unit: '%' }, // prettier-ignore
      ],
    };
    const { getByText, getByLabelText } = await render(
      <HouseMissionsScreen house={mixed} missions={mixed.missions ?? []} isOwner={false} />,
    );
    // 둘 다 COMPLETED — 완료/종료 배지는 '지난 미션' 탭에서 구분된다 (#901).
    await fireEvent.press(getByLabelText('지난 미션 탭'));
    expect(getByText('완료')).toBeTruthy();
    expect(getByText('종료')).toBeTruthy();
  });

  /**
   * 미션 삭제는 방장 전용이라, 구성원에겐 자기가 만든 연동 루틴을 되돌릴 길이
   * 이 화면에 없었다 (#890). 방장의 휴지통과 결과가 다르므로 아이콘도 다르다 —
   * 휴지통은 미션이 사라지고, 배지는 내 루틴만 없앤다.
   */
  it('연동 루틴이 있으면 배지를 눌러 내 루틴만 정리한다 (#890)', async () => {
    const onRemoveMissionRoutine = jest.fn();
    const { getByLabelText, getByText } = await render(
      <HouseMissionsScreen
        house={MEMBER_HOUSE}
        missions={MEMBER_HOUSE.missions ?? []}
        isOwner={false}
        linkedRoutines={[{ missionId: 11, completedToday: false }]}
        onRemoveMissionRoutine={onRemoveMissionRoutine}
      />,
    );
    await fireEvent.press(getByLabelText('주간 루틴 지키기 연동 루틴 정리'));
    // 배지는 '연동됨'인데 결과는 삭제 — 문구가 그 차이를 메운다.
    expect(getByText(/루틴을 내 루틴에서 삭제할까요\?/)).toBeTruthy();
    expect(getByText(/미션 자체는 그대로예요/)).toBeTruthy();
    await fireEvent.press(getByLabelText('연동 루틴 삭제 확인'));
    expect(onRemoveMissionRoutine).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));
  });

  /** 연동 루틴이 없으면 정리할 것도 없다 — 배지는 그냥 라벨이다. */
  it('연동 루틴이 없으면 배지가 눌리지 않는다 (#890)', async () => {
    const { queryByLabelText } = await render(
      <HouseMissionsScreen
        house={MEMBER_HOUSE}
        missions={MEMBER_HOUSE.missions ?? []}
        isOwner={false}
        linkedRoutines={[]}
        onRemoveMissionRoutine={jest.fn()}
      />,
    );
    expect(queryByLabelText('주간 루틴 지키기 연동 루틴 정리')).toBeNull();
  });

  /**
   * 다이얼로그가 "연동 루틴은 삭제되지 않아요"라고 해놓고 삭제 후 토스트는
   * "함께 삭제했어요"를 띄우던 자기모순 (#890).
   */
  it('미션 삭제 안내가 내 연동 루틴도 지워진다고 말한다 (#890)', async () => {
    const { getByLabelText, getByText } = await render(
      <HouseMissionsScreen
        house={MISSION_HOUSE}
        missions={MISSION_HOUSE.missions ?? []}
        isOwner
        onDeleteMission={jest.fn()}
      />,
    );
    await fireEvent.press(getByLabelText('주간 루틴 지키기 삭제'));
    expect(getByText(/내 연동 루틴도 함께 삭제되고/)).toBeTruthy();
    expect(getByText(/다른 멤버의 루틴은 연동만 끊겨요/)).toBeTruthy();
  });

  /**
   * 유형마다 숫자의 뜻이 다른데 목록엔 단위가 없었다 (#887) — 만들 때는
   * "1~100%"라고 물어놓고 카드에선 `25/100`으로만 보여줬다.
   */
  it('진행 수치에 유형별 단위를 붙인다 (#887)', async () => {
    const withUnits: House = {
      ...MISSION_HOUSE,
      missions: [
        { id: 21, title: '영양제 먹기', desc: '일일 구성원 달성률', icon: 'sun' as const, current: 25, target: 100, status: 'ACTIVE', unit: '%' }, // prettier-ignore
        { id: 22, title: '루게더 개발', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 10, target: 10, status: 'ACTIVE', unit: '회' }, // prettier-ignore
      ],
    };
    const { getByText } = await render(
      <HouseMissionsScreen house={withUnits} missions={withUnits.missions ?? []} isOwner={false} />,
    );
    expect(getByText('25/100%')).toBeTruthy();
    expect(getByText('10/10회')).toBeTruthy();
  });

  it('adds a mission to my routines through the confirm modal, and claims', async () => {
    const onAddMissionRoutine = jest.fn();
    const onClaimMission = jest.fn();
    const { getByLabelText, getByText } = await render(
      <HouseMissionsScreen
        house={MISSION_HOUSE}
        missions={MISSION_HOUSE.missions ?? []}
        isOwner
        onAddMissionRoutine={onAddMissionRoutine}
        onClaimMission={onClaimMission}
      />,
    );
    // 기여 버튼 대신 + → 확인 모달 → 네 = 집 카테고리 아래 루틴 생성 요청.
    await fireEvent.press(getByLabelText('주간 루틴 지키기 내 루틴에 추가'));
    expect(getByText('내 루틴에 추가하시겠습니까?')).toBeTruthy();
    await fireEvent.press(getByLabelText('루틴 추가 확인'));
    expect(onAddMissionRoutine).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ id: 11, title: '주간 루틴 지키기' }),
    );
    // 목표를 채웠어도 보상 미수령이면 ACTIVE — 보상 받기 CTA는 진행 중 탭에 남는다 (#901).
    await fireEvent.press(getByLabelText('기상 인증 모으기 보상 받기'));
    expect(onClaimMission).toHaveBeenCalledWith(7, 12);
    // 이미 수령한 COMPLETED('지난 미션')의 완료 배지는 지난 미션 탭에 있다.
    await fireEvent.press(getByLabelText('지난 미션 탭'));
    expect(getByText('완료')).toBeTruthy();
  });

  /**
   * 완료 미션은 서버가 삭제를 막아(409) 계속 쌓이는데, "지금 뭘 하고 있는지"
   * 보러 온 화면에서 그게 자리를 차지했다. 삭제로 풀려던 #892를 탭 분리로
   * 대체한 것이 #901.
   */
  describe('진행 중 / 지난 미션 탭 (#901)', () => {
    it('기본은 진행 중 탭 — COMPLETED·EXPIRED는 지난 미션 탭에만 있다', async () => {
      const mixed: House = {
        ...MISSION_HOUSE,
        missions: [
          { id: 41, title: '달리는 중', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 3, target: 10, status: 'ACTIVE' }, // prettier-ignore
          { id: 42, title: '받은 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 5, target: 5, status: 'COMPLETED', achieved: true }, // prettier-ignore
          { id: 43, title: '놓친 미션', desc: '일일 구성원 달성률', icon: 'sun' as const, current: 1, target: 5, status: 'EXPIRED' }, // prettier-ignore
        ],
      };
      const { getByText, queryByText, getByLabelText } = await render(
        <HouseMissionsScreen house={mixed} missions={mixed.missions ?? []} isOwner={false} />,
      );
      expect(getByText('달리는 중')).toBeTruthy();
      expect(queryByText('받은 미션')).toBeNull();
      expect(queryByText('놓친 미션')).toBeNull();

      await fireEvent.press(getByLabelText('지난 미션 탭'));
      // COMPLETED와 EXPIRED가 함께 온다 — 그래서 탭 이름이 '완료'가 아니다.
      expect(getByText('받은 미션')).toBeTruthy();
      expect(getByText('놓친 미션')).toBeTruthy();
      expect(queryByText('달리는 중')).toBeNull();
    });

    it('목표를 채웠어도 보상 미수령(ACTIVE)이면 진행 중에 남는다', async () => {
      // 지난 미션으로 넘기면 보상 받기 CTA에 닿을 길이 없어진다.
      const { getByLabelText, queryByLabelText } = await render(
        <HouseMissionsScreen
          house={MISSION_HOUSE}
          missions={MISSION_HOUSE.missions ?? []}
          isOwner={false}
          onClaimMission={jest.fn()}
        />,
      );
      expect(getByLabelText('기상 인증 모으기 보상 받기')).toBeTruthy();
      await fireEvent.press(getByLabelText('지난 미션 탭'));
      expect(queryByLabelText('기상 인증 모으기 보상 받기')).toBeNull();
    });

    it('요약 줄은 진행 중 탭에서만 — 지난 미션을 보는 중엔 어긋난 말이다', async () => {
      const { getByText, queryByText, getByLabelText } = await render(
        <HouseMissionsScreen
          house={MISSION_HOUSE}
          missions={MISSION_HOUSE.missions ?? []}
          isOwner={false}
        />,
      );
      expect(getByText(/진행 중 2개/)).toBeTruthy();
      await fireEvent.press(getByLabelText('지난 미션 탭'));
      expect(queryByText(/진행 중 2개/)).toBeNull();
    });

    it('기간 만료 미션은 언제 끝났는지도 보여준다 (COMPLETED는 제외)', async () => {
      const ended: House = {
        ...MISSION_HOUSE,
        missions: [
          { id: 61, title: '놓친 미션', desc: '일일 구성원 달성률', icon: 'sun' as const, current: 1, target: 5, status: 'EXPIRED', endsOn: '2026-08-14' }, // prettier-ignore
          { id: 62, title: '받은 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 5, target: 5, status: 'COMPLETED', achieved: true, endsOn: '2026-08-15' }, // prettier-ignore
        ],
      };
      const { getByText, queryByText, getByLabelText } = await render(
        <HouseMissionsScreen house={ended} missions={ended.missions ?? []} isOwner={false} />,
      );
      await fireEvent.press(getByLabelText('지난 미션 탭'));
      expect(getByText('~08.14')).toBeTruthy();
      // 달성해서 받은 미션에 기간 종료일은 뜻이 없다.
      expect(queryByText('~08.15')).toBeNull();
    });

    it('빈 탭은 그 탭에 맞는 문구를 보여준다', async () => {
      const onlyActive: House = {
        ...MISSION_HOUSE,
        missions: [
          { id: 51, title: '달리는 중', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 3, target: 10, status: 'ACTIVE' }, // prettier-ignore
        ],
      };
      const { getByText, getByLabelText } = await render(
        <HouseMissionsScreen
          house={onlyActive}
          missions={onlyActive.missions ?? []}
          isOwner={false}
        />,
      );
      await fireEvent.press(getByLabelText('지난 미션 탭'));
      expect(getByText(/아직 지난 미션이 없어요/)).toBeTruthy();
    });
  });

  it('deletes a mission through the confirm modal (owner, #305)', async () => {
    const onDeleteMission = jest.fn();
    const { getByLabelText, getByText, queryByLabelText, queryByText } = await render(
      <HouseMissionsScreen
        house={MISSION_HOUSE}
        missions={MISSION_HOUSE.missions ?? []}
        isOwner
        onDeleteMission={onDeleteMission}
      />,
    );
    // COMPLETED missions are not deletable on the server (409) — no button.
    // 탭 도입(#901) 후에는 **지난 미션 탭에서** 봐야 이 단언이 뜻을 갖는다 —
    // 진행 중 탭에서는 애초에 렌더되지 않아 버튼이 없는 게 당연하다.
    await fireEvent.press(getByLabelText('지난 미션 탭'));
    expect(queryByLabelText('지난 미션 삭제')).toBeNull();
    await fireEvent.press(getByLabelText('진행 중 탭'));
    // 취소 closes without calling.
    await fireEvent.press(getByLabelText('주간 루틴 지키기 삭제'));
    expect(getByText('미션 삭제')).toBeTruthy();
    await fireEvent.press(getByLabelText('미션 삭제 취소'));
    expect(queryByText('미션 삭제')).toBeNull();
    expect(onDeleteMission).not.toHaveBeenCalled();
    // 삭제 confirms.
    await fireEvent.press(getByLabelText('주간 루틴 지키기 삭제'));
    await fireEvent.press(getByLabelText('미션 삭제 확인'));
    expect(onDeleteMission).toHaveBeenCalledWith(7, 11);
  });

  it('hides mission delete from plain members', async () => {
    const { queryByLabelText } = await render(
      <HouseMissionsScreen
        house={MEMBER_HOUSE}
        missions={MEMBER_HOUSE.missions ?? []}
        isOwner={false}
        onDeleteMission={jest.fn()}
      />,
    );
    expect(queryByLabelText('주간 루틴 지키기 삭제')).toBeNull();
  });

  /** 미션 생성은 서버에서 방장 전용(403 HOUSE_NOT_OWNER) — 버튼도 숨는다. */
  it('일반 구성원에게는 미션 만들기 버튼을 숨긴다', async () => {
    const { queryByLabelText } = await render(
      <HouseMissionsScreen
        house={MEMBER_HOUSE}
        missions={MEMBER_HOUSE.missions ?? []}
        isOwner={false}
        onCreateMission={jest.fn()}
      />,
    );
    expect(queryByLabelText('미션 만들기')).toBeNull();
  });

  it('shows 기여됨/루틴 연동됨 labels instead of + when applicable', async () => {
    const { queryByLabelText, getByText } = await render(
      <HouseMissionsScreen
        house={MISSION_HOUSE}
        missions={MISSION_HOUSE.missions ?? []}
        isOwner
        onAddMissionRoutine={jest.fn()}
        linkedRoutines={[{ missionId: 11 }]}
        contributedMissionIds={[12]}
      />,
    );
    // Linked mission: no + button, 연동 라벨.
    expect(queryByLabelText('주간 루틴 지키기 내 루틴에 추가')).toBeNull();
    expect(getByText('루틴 연동됨')).toBeTruthy();
    // Contributed-today mission (no claim handler → falls through to 기여함).
    expect(getByText('기여함')).toBeTruthy();
  });

  it('derives 기여함 from a linked routine completed today (재시작에도 유지)', async () => {
    const { getByText, queryByText } = await render(
      <HouseMissionsScreen
        house={MISSION_HOUSE}
        missions={MISSION_HOUSE.missions ?? []}
        isOwner
        onAddMissionRoutine={jest.fn()}
        linkedRoutines={[{ missionId: 11, completedToday: true }]}
      />,
    );
    // 세션 추적(contributedMissionIds) 없이도 오늘 완료 = 기여함.
    expect(getByText('기여함')).toBeTruthy();
    expect(queryByText('루틴 연동됨')).toBeNull();
  });

  it('creates a mission through the modal', async () => {
    const onCreateMission = jest.fn();
    const { getByLabelText } = await render(
      <HouseMissionsScreen
        house={MISSION_HOUSE}
        missions={MISSION_HOUSE.missions ?? []}
        isOwner
        onCreateMission={onCreateMission}
      />,
    );
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.changeText(getByLabelText('미션 제목'), '새 미션');
    await fireEvent.changeText(getByLabelText('목표 수치'), '15');
    await fireEvent.press(getByLabelText('미션 만들기 확인'));
    expect(onCreateMission).toHaveBeenCalledWith(7, {
      title: '새 미션',
      missionType: 'WEEKLY_MEMBER_COUNT',
      targetValue: 15,
    });
  });

  /**
   * 목표 수치는 유형마다 뜻과 상한이 다르다 (#872, 서버 계약). 달성률은 %라
   * 1~100이고 넘기면 서버가 400 HOUSE_MISSION_TARGET_INVALID를 준다. 예전엔
   * 클라이언트가 유형 무관 1~1000만 봐서 500%도 통과시켜 400을 맞았다.
   */
  it('일일 달성률 목표가 100을 넘으면 보내지 않고 알려준다 (#872)', async () => {
    const onCreateMission = jest.fn();
    const { getByText, getByLabelText } = await render(
      <ToastProvider>
        <HouseMissionsScreen
          house={MISSION_HOUSE}
          missions={MISSION_HOUSE.missions ?? []}
          isOwner
          onCreateMission={onCreateMission}
        />
      </ToastProvider>,
    );
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.press(getByText('일일 달성률'));
    await fireEvent.changeText(getByLabelText('미션 제목'), '달성률 미션');
    await fireEvent.changeText(getByLabelText('목표 수치'), '500');
    await fireEvent.press(getByLabelText('미션 만들기 확인'));
    expect(onCreateMission).not.toHaveBeenCalled();
    expect(getByText(/1~100% 사이/)).toBeTruthy();
  });

  /** 같은 500이 주간 달성 횟수에서는 유효하다 — 상한이 1000이다. */
  it('주간 달성 횟수는 같은 값도 통과시킨다 — 상한이 다르다 (#872)', async () => {
    const onCreateMission = jest.fn();
    const { getByLabelText } = await render(
      <ToastProvider>
        <HouseMissionsScreen
          house={MISSION_HOUSE}
          missions={MISSION_HOUSE.missions ?? []}
          isOwner
          onCreateMission={onCreateMission}
        />
      </ToastProvider>,
    );
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.changeText(getByLabelText('미션 제목'), '횟수 미션');
    await fireEvent.changeText(getByLabelText('목표 수치'), '500');
    await fireEvent.press(getByLabelText('미션 만들기 확인'));
    expect(onCreateMission).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ missionType: 'WEEKLY_MEMBER_COUNT', targetValue: 500 }),
    );
  });

  /** 값이 %인지 횟수인지 화면에 드러나야 한다 — 예전엔 어디에도 없었다. */
  it('선택한 유형에 따라 단위와 허용 범위를 보여준다 (#872)', async () => {
    const { getByText, getByLabelText } = await render(
      <ToastProvider>
        <HouseMissionsScreen
          house={MISSION_HOUSE}
          missions={MISSION_HOUSE.missions ?? []}
          isOwner
          onCreateMission={jest.fn()}
        />
      </ToastProvider>,
    );
    await fireEvent.press(getByLabelText('미션 만들기'));
    // 기본값은 주간 달성 횟수 — 1~1000회.
    expect(getByText('목표 수치 (1~1000회)')).toBeTruthy();

    await fireEvent.press(getByText('일일 달성률'));
    expect(getByText('목표 수치 (1~100%)')).toBeTruthy();
  });

  it('explains a missing mission title with a toast instead of creating', async () => {
    const onCreateMission = jest.fn();
    const { getByText, getByLabelText } = await render(
      <ToastProvider>
        <HouseMissionsScreen
          house={MISSION_HOUSE}
          missions={MISSION_HOUSE.missions ?? []}
          isOwner
          onCreateMission={onCreateMission}
        />
      </ToastProvider>,
    );
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.press(getByLabelText('미션 만들기 확인'));

    expect(getByText('미션 이름을 입력해주세요')).toBeTruthy();
    expect(onCreateMission).not.toHaveBeenCalled();
  });

  it('shows the empty-mission hint when the house has no missions', async () => {
    const { getByText } = await render(
      <HouseMissionsScreen house={EMPTY_MISSION_HOUSE} missions={[]} isOwner />,
    );
    expect(getByText('아직 미션이 없어요. 첫 미션을 만들어 다 같이 도전해보세요!')).toBeTruthy();
  });

  it('sends the mission period only when the toggle is on (KST day bounds)', async () => {
    const onCreateMission = jest.fn();
    const { getByLabelText } = await render(
      <HouseMissionsScreen
        house={MISSION_HOUSE}
        missions={MISSION_HOUSE.missions ?? []}
        isOwner
        onCreateMission={onCreateMission}
      />,
    );

    // Toggle off (default): no period fields at all.
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.changeText(getByLabelText('미션 제목'), '기간 없는 미션');
    await fireEvent.press(getByLabelText('미션 만들기 확인'));
    expect(onCreateMission).toHaveBeenLastCalledWith(
      7,
      expect.not.objectContaining({ startsAt: expect.anything() }),
    );

    // Toggle on: defaults to 오늘 ~ +7일, sent as KST day bounds.
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.changeText(getByLabelText('미션 제목'), '기간 있는 미션');
    await fireEvent.press(getByLabelText('기간 설정'));
    await fireEvent.press(getByLabelText('미션 만들기 확인'));
    const input = onCreateMission.mock.calls.at(-1)[1];
    expect(input.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\+09:00$/);
    expect(input.endsAt).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\+09:00$/);
    expect(input.endsAt > input.startsAt).toBe(true);
  });

  it('shows the end date on active missions with a period', async () => {
    const house = {
      ...MISSION_HOUSE,
      missions: [
        { id: 21, title: '기간 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 0, target: 5, status: 'ACTIVE' as const, endsOn: '2026-07-23' }, // prettier-ignore
        { id: 22, title: '끝난 기간 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 5, target: 5, status: 'COMPLETED' as const, achieved: true, endsOn: '2026-07-01' }, // prettier-ignore
      ],
    };
    const { getByText, queryByText } = await render(
      <HouseMissionsScreen house={house} missions={house.missions ?? []} isOwner />,
    );
    expect(getByText('~07.23')).toBeTruthy();
    // Finished missions show their status, not a stale end date.
    expect(queryByText('~07.01')).toBeNull();
  });
});
