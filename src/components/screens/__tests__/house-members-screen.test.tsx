import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { HouseMembersScreen } from '@/components/screens/house-members-screen';
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
    expect(message).toContain('rougether-landing/join.html?code=VLG7K2X');
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
