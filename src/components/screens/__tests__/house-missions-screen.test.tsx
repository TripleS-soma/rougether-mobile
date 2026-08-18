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
    { id: 13, title: '지난 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 5, target: 5, status: 'COMPLETED' }, // prettier-ignore
  ],
};

const MEMBER_HOUSE: House = { ...MISSION_HOUSE, myRole: 'MEMBER' };
const EMPTY_MISSION_HOUSE: House = { ...MISSION_HOUSE, missions: [] };

describe('HouseMissionsScreen', () => {
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
    await fireEvent.press(getByLabelText('기상 인증 모으기 보상 받기'));
    expect(onClaimMission).toHaveBeenCalledWith(7, 12);
    expect(getByText('완료')).toBeTruthy();
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
    expect(queryByLabelText('지난 미션 삭제')).toBeNull();
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
        { id: 22, title: '끝난 기간 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 5, target: 5, status: 'COMPLETED' as const, endsOn: '2026-07-01' }, // prettier-ignore
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
