import { fireEvent, render } from '@testing-library/react-native';
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

  it('초대코드가 없으면(부원 — 서버 #249 대기) 카드와 버튼이 없다', async () => {
    const { queryByLabelText, queryByText } = await render(
      <ToastProvider>
        <HouseMembersScreen
          {...baseProps}
          isOwner={false}
          house={{ ...HOUSE, inviteCode: undefined, myRole: 'MEMBER' }}
        />
      </ToastProvider>,
    );
    expect(queryByText('초대코드')).toBeNull();
    expect(queryByLabelText('초대 링크 공유')).toBeNull();
  });
});
