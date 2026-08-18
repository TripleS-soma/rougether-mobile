import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { HouseMembersScreen, manageableMembers } from '@/components/screens/house-members-screen';
import type { House } from '@/components/screens/house-screen';
import { ToastProvider } from '@/components/ui/toast';

const HOUSE: House = {
  name: '아침 루틴 하우스',
  houseId: 1,
  inviteCode: 'VLG7K2X',
  myRole: 'OWNER',
  maxMembers: 4,
  floors: [{ level: '1F', rooms: [{ name: '나', color: 'transparent', isMine: true }] }],
};

const baseProps = {
  house: HOUSE,
  members: [],
  isOwner: true,
  isKicked: () => false,
  memberCharacterId: () => 'cat' as const,
  onBack: () => {},
  onLocalKick: () => {},
  onLeaveDone: () => {},
};

describe('HouseMembersScreen — 초대코드 복사·링크 공유 (#624)', () => {
  /**
   * 온보딩 미션 '집에 친구 초대하기' 완료 판정 (#841) — 코드를 손에 쥔
   * 순간이다. 실제 가입까지 기다리면 상대의 행동에 걸려 미션이 영영 안
   * 끝난다.
   */
  it('초대코드 복사·링크 공유가 onInviteShared를 부른다 (#841)', async () => {
    const onInviteShared = jest.fn();
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    const { getByLabelText } = await render(
      <ToastProvider>
        <HouseMembersScreen {...baseProps} onInviteShared={onInviteShared} />
      </ToastProvider>,
    );

    await fireEvent.press(getByLabelText('초대코드 복사'));
    await waitFor(() => expect(onInviteShared).toHaveBeenCalledTimes(1));
  });

  it('코드 카드에 복사·링크 공유 버튼이 뜨고, 공유는 랜딩 링크를 싣는다', async () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' } as never);
    const { getByLabelText } = await render(
      <ToastProvider>
        <HouseMembersScreen {...baseProps} />
      </ToastProvider>,
    );

    expect(getByLabelText('초대코드 복사')).toBeTruthy();
    await fireEvent.press(getByLabelText('초대 링크 공유'));
    expect(shareSpy).toHaveBeenCalledTimes(1);
    const message = shareSpy.mock.calls[0][0].message ?? '';
    expect(message).toContain('아침 루틴 하우스');
    expect(message).toContain('https://rougether.com/join.html?code=VLG7K2X');
    shareSpy.mockRestore();
  });

  it('부원은 발급받기로 개인 코드를 받아 복사·공유가 열린다 (#646)', async () => {
    const onReissueInviteCode = jest.fn(async () => 'MYCODE99');
    const { getByLabelText, getByText, queryByLabelText } = await render(
      <ToastProvider>
        <HouseMembersScreen
          {...baseProps}
          isOwner={false}
          house={{ ...HOUSE, inviteCode: undefined, myRole: 'MEMBER' }}
          onReissueInviteCode={onReissueInviteCode}
        />
      </ToastProvider>,
    );
    // 코드가 없으면 공유 버튼 대신 발급 진입점만.
    expect(queryByLabelText('초대 링크 공유')).toBeNull();
    await fireEvent.press(getByLabelText('초대코드 발급받기'));
    expect(onReissueInviteCode).toHaveBeenCalledWith(1);
    await waitFor(() => expect(getByText('MYCODE99')).toBeTruthy());
    expect(getByLabelText('초대 링크 공유')).toBeTruthy();
    expect(getByText(/방장 승인 후 확정/)).toBeTruthy();
  });
});

/** house-screen에서 승격(#753)되며 이전된 구성원 흐름 테스트. */
const MISSION_HOUSE: House = {
  houseId: 7,
  name: '실집',
  myRole: 'OWNER',
  description: '아침 루틴 집',
  maxMembers: 4,
  memberCount: 2,
  floors: [
    {
      level: '1층',
      rooms: [
        { name: '친구', color: '#F5E1D8', membershipId: 42 },
        { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 },
      ],
    },
  ],
};

/** 승격 전 house-screen이 하던 파생 그대로 — house에서 members·isOwner를 만든다. */
const screenFor = (
  house: House,
  extra: Partial<React.ComponentProps<typeof HouseMembersScreen>> = {},
) => (
  <ToastProvider>
    <HouseMembersScreen
      {...baseProps}
      house={house}
      members={manageableMembers(house)}
      isOwner={house.myRole === 'OWNER' && !!house.houseId}
      {...extra}
    />
  </ToastProvider>
);

describe('HouseMembersScreen — 구성원 관리 (구 house-screen 흐름, #753 이전)', () => {
  it('lets the owner edit the house settings', async () => {
    const onUpdateHouse = jest.fn();
    const { getByLabelText } = await render(screenFor(MISSION_HOUSE, { onUpdateHouse }));
    await fireEvent.press(getByLabelText('집 정보 수정'));
    await fireEvent.changeText(getByLabelText('집 이름'), '저녁 루틴 하우스');
    await fireEvent.changeText(getByLabelText('집 소개'), '저녁 루틴으로 바꿨어요');
    // 정원 상한이 4로 내려갔다 (#869) — 6·8·10은 더 이상 선택지에 없다.
    await fireEvent.press(getByLabelText('정원 3명'));
    await fireEvent.press(getByLabelText('집 정보 저장'));
    expect(onUpdateHouse).toHaveBeenCalledWith(7, {
      name: '저녁 루틴 하우스',
      description: '저녁 루틴으로 바꿨어요',
      maxMembers: 3,
    });
  });

  /**
   * 집 이미지가 담는 창문 수가 한계라 정원을 4로 제한했다 (#869). 서버는
   * 1~10을 여전히 허용하므로 막는 건 고를 수 있는 폭뿐이다.
   */
  it('정원 선택지는 4명까지만 보여준다 (#869)', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      screenFor(MISSION_HOUSE, { onUpdateHouse: jest.fn() }),
    );
    await fireEvent.press(getByLabelText('집 정보 수정'));
    for (const n of [2, 3, 4]) expect(getByLabelText(`정원 ${n}명`)).toBeTruthy();
    for (const n of [6, 8, 10]) expect(queryByLabelText(`정원 ${n}명`)).toBeNull();
  });

  /**
   * 상한이 내려가기 전에 만들어진 집은 정원이 4를 넘는다. 그 값을 선택지에서
   * 없애면 **현재 상태가 표현되지 않아** 아무것도 안 고른 것처럼 보인다.
   * 내릴 수는 있고 올릴 수는 없게 남겨둔다.
   */
  it('이미 정원이 4를 넘는 집은 그 값도 함께 보여준다 (#869)', async () => {
    const legacy = { ...MISSION_HOUSE, maxMembers: 8 };
    const { getByLabelText, queryByLabelText } = await render(
      screenFor(legacy, { onUpdateHouse: jest.fn() }),
    );
    await fireEvent.press(getByLabelText('집 정보 수정'));
    expect(getByLabelText('정원 8명')).toBeTruthy();
    // 그 사이 값(6)이 덤으로 열리지는 않는다 — 올리는 길은 없다.
    expect(queryByLabelText('정원 6명')).toBeNull();
    expect(queryByLabelText('정원 10명')).toBeNull();
  });

  it('prefills the current cover, sends the new pick, and hides the section without a catalog', async () => {
    const covers = [
      { code: 'cloud', name: '구름 풍선 집', coverImageKey: 'house/cloud-balloon/f.png' },
      { code: 'coral', name: '산호 수족관 집', coverImageKey: 'house/coral-aquarium/f.png' },
    ];
    const onUpdateHouse = jest.fn();
    const { getByLabelText, getByText } = await render(
      screenFor(
        { ...MISSION_HOUSE, coverImageKey: 'house/cloud-balloon/f.png' },
        { covers, onUpdateHouse },
      ),
    );
    await fireEvent.press(getByLabelText('집 정보 수정'));
    expect(getByText('대표 이미지')).toBeTruthy();
    // The house's current cover arrives pre-selected.
    expect(getByLabelText('구름 풍선 집 커버').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(getByLabelText('산호 수족관 집 커버'));
    await fireEvent.press(getByLabelText('집 정보 저장'));
    expect(onUpdateHouse).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ coverImageKey: 'house/coral-aquarium/f.png' }),
    );

    // No catalog (load failed / server empty) → the section stays hidden.
    const bare = await render(screenFor(MISSION_HOUSE, { covers: [], onUpdateHouse: jest.fn() }));
    await fireEvent.press(bare.getByLabelText('집 정보 수정'));
    expect(bare.queryByText('대표 이미지')).toBeNull();
  });

  it('transfers ownership to a member after confirming', async () => {
    const onTransferOwnership = jest.fn();
    const { getByLabelText, getByText } = await render(
      screenFor(MISSION_HOUSE, { onTransferOwnership }),
    );
    await fireEvent.press(getByLabelText('친구 방장 위임'));
    expect(getByText('방장을 위임할까요?')).toBeTruthy();
    await fireEvent.press(getByLabelText('위임 확인'));
    expect(onTransferOwnership).toHaveBeenCalledWith(7, 42);
  });

  it('reissues the invite code after confirming (owner)', async () => {
    const onReissueInviteCode = jest.fn();
    const { getByText, getByLabelText } = await render(
      screenFor({ ...MISSION_HOUSE, inviteCode: 'ABCD2345' }, { onReissueInviteCode }),
    );
    await fireEvent.press(getByLabelText('초대코드 재발급'));
    expect(getByText('초대코드를 재발급할까요?')).toBeTruthy();
    await fireEvent.press(getByLabelText('재발급 확인'));
    expect(onReissueInviteCode).toHaveBeenCalledWith(7);
  });

  it('부원에게도 재발급이 열린다 — 개인 초대코드 신계약 (#646)', async () => {
    const { getByLabelText } = await render(
      screenFor(
        { ...MISSION_HOUSE, inviteCode: 'ABCD2345', myRole: 'MEMBER' },
        { onReissueInviteCode: jest.fn() },
      ),
    );
    // 서버가 전 구성원 재발급을 허용(소유자=공용, 부원=개인 코드) — 버튼 노출.
    expect(getByLabelText('초대코드 재발급')).toBeTruthy();
  });

  it('leaves the house after confirming (member)', async () => {
    const onLeaveHouse = jest.fn();
    const { getByText, getByLabelText } = await render(
      screenFor({ ...MISSION_HOUSE, myRole: 'MEMBER' }, { onLeaveHouse }),
    );
    await fireEvent.press(getByLabelText('집 나가기'));
    expect(getByText('집에서 나갈까요?')).toBeTruthy();
    await fireEvent.press(getByLabelText('나가기 확인'));
    expect(onLeaveHouse).toHaveBeenCalledWith(7);
  });

  it('guides the owner to transfer ownership instead of leaving', async () => {
    const { getByText, queryByLabelText } = await render(
      screenFor(MISSION_HOUSE, { onLeaveHouse: jest.fn() }),
    );
    expect(queryByLabelText('집 나가기')).toBeNull();
    expect(getByText('방장은 다른 멤버에게 방장을 위임한 뒤 나갈 수 있어요.')).toBeTruthy();
  });

  it('lets a lone owner delete the house through leave (#309)', async () => {
    const onLeaveHouse = jest.fn();
    // 활성 멤버가 나뿐인 집 — 위임 상대가 없다.
    const loneHouse: House = {
      ...MISSION_HOUSE,
      memberCount: 1,
      floors: [
        {
          level: '1층',
          rooms: [
            { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 },
            { name: '빈방', color: 'transparent', vacant: true },
          ],
        },
      ],
    };
    const { getByText, getByLabelText, queryByText } = await render(
      screenFor(loneHouse, { onLeaveHouse }),
    );
    // 위임 안내 대신 집 삭제 버튼. (빈 좌석은 manageableMembers가 걸러 위임 상대로 치지 않는다.)
    expect(queryByText('방장은 다른 멤버에게 방장을 위임한 뒤 나갈 수 있어요.')).toBeNull();
    await fireEvent.press(getByLabelText('집 삭제'));
    // 삭제 경고 문구 — 집이 정리되어 탐색·조회에서 사라진다.
    expect(getByText('집을 삭제할까요?')).toBeTruthy();
    expect(getByText(/삭제되고 탐색·조회에서 사라져요/)).toBeTruthy();
    await fireEvent.press(getByLabelText('집 삭제 확인'));
    expect(onLeaveHouse).toHaveBeenCalledWith(7);
  });

  it('marks the owner in the member management list', async () => {
    const house: House = {
      ...MISSION_HOUSE,
      floors: [
        {
          level: '1층',
          rooms: [
            { name: '친구', color: '#F5E1D8', membershipId: 42, isOwner: true },
            { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 },
          ],
        },
      ],
    };
    const { getByText } = await render(screenFor(house));
    expect(getByText('방장')).toBeTruthy();
  });

  it('kicks via the API callback when the house carries server ids', async () => {
    const onKickMember = jest.fn();
    const { getAllByText } = await render(screenFor(MISSION_HOUSE, { onKickMember }));
    await fireEvent.press(getAllByText('강퇴')[0]);
    const kicks = getAllByText('강퇴');
    await fireEvent.press(kicks[kicks.length - 1]);
    expect(onKickMember).toHaveBeenCalledWith(7, 42);
  });

  it('hides the kick button on my own card and uses a back button header', async () => {
    const onBack = jest.fn();
    const { getByLabelText, queryByLabelText } = await render(
      screenFor(MISSION_HOUSE, { onKickMember: jest.fn(), onBack }),
    );
    // 내 카드엔 강퇴 버튼이 아예 없다 (disabled가 아니라 미노출).
    expect(getByLabelText('친구 강퇴')).toBeTruthy();
    expect(queryByLabelText('나 강퇴')).toBeNull();
    // 헤더는 X 대신 다른 화면과 같은 왼쪽 뒤로가기 — 셸이 집 탭으로 되돌린다 (#753).
    expect(queryByLabelText('닫기')).toBeNull();
    await fireEvent.press(getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('lets the owner accept or reject pending join requests', async () => {
    const onAcceptJoinRequest = jest.fn();
    const onRejectJoinRequest = jest.fn();
    const house: House = {
      ...MISSION_HOUSE,
      name: '신청 받는 집',
      joinRequests: [
        { requestId: 21, nickname: '신청자 A' },
        { requestId: 22, nickname: '신청자 B' },
      ],
      floors: [
        { level: '1층', rooms: [{ name: '나', color: '#E8E0D0', isMine: true, isOwner: true }] },
      ],
    };
    const { getByLabelText, getByText } = await render(
      screenFor(house, { onAcceptJoinRequest, onRejectJoinRequest }),
    );
    expect(getByText('입주 신청 2건')).toBeTruthy();
    await fireEvent.press(getByLabelText('신청자 A 입주 수락'));
    await fireEvent.press(getByLabelText('신청자 B 입주 거절'));
    expect(onAcceptJoinRequest).toHaveBeenCalledWith(7, 21);
    expect(onRejectJoinRequest).toHaveBeenCalledWith(7, 22);
  });

  it('서버 id 없는 집은 확인 후 로컬 강퇴로 흐른다', async () => {
    const onLocalKick = jest.fn();
    const demoHouse: House = { ...MISSION_HOUSE, houseId: undefined };
    const { getByText, getAllByText, queryByText } = await render(
      screenFor(demoHouse, { isOwner: true, onLocalKick }),
    );
    expect(getByText('구성원 관리')).toBeTruthy();
    // First member's "강퇴" button opens the confirm modal.
    await fireEvent.press(getAllByText('강퇴')[0]);
    expect(getByText('정말 강퇴할까요?')).toBeTruthy();
    // The modal's "강퇴" (confirm) is the last occurrence in the tree.
    const kicks = getAllByText('강퇴');
    await fireEvent.press(kicks[kicks.length - 1]);
    expect(queryByText('정말 강퇴할까요?')).toBeNull();
    expect(onLocalKick).toHaveBeenCalledWith('친구');
  });

  it('강퇴된 멤버는 목록에서 표시가 남는다', async () => {
    const { getByText } = await render(
      screenFor(MISSION_HOUSE, { isKicked: (name: string) => name === '친구' }),
    );
    expect(getByText('강퇴된 멤버')).toBeTruthy();
  });
});
