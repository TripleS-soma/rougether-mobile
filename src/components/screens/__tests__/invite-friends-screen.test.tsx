import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { InviteFriendsScreen } from '@/components/screens/invite-friends-screen';

const INFO = {
  code: 'ROUGE123',
  rewardedCount: 2,
  maxRewardedCount: 10,
  inviterRewardCoin: 50,
  inviteeRewardCoin: 30,
};

describe('InviteFriendsScreen (#518 — 친구 초대 리워드)', () => {
  it('내 코드·보상 안내·현황을 보여준다', async () => {
    const { getByText, getByLabelText } = await render(<InviteFriendsScreen info={INFO} />);
    expect(getByText('ROUGE123')).toBeTruthy();
    expect(getByText(/나는 코인 50개, 친구는 코인 30개/)).toBeTruthy();
    expect(getByText(/지금까지 2 \/ 10명/)).toBeTruthy();
    expect(getByLabelText('초대코드 복사')).toBeTruthy();
  });

  it('받은 코드를 입력해 사용하면 onRedeem 후 보상 코인이 표시된다', async () => {
    const onRedeem = jest.fn(async () => ({ rewardCoin: 30 }));
    const { getByLabelText, getByText, queryByLabelText } = await render(
      <InviteFriendsScreen info={INFO} onRedeem={onRedeem} />,
    );

    await fireEvent.changeText(getByLabelText('초대코드 입력'), ' friend99 ');
    await fireEvent.press(getByLabelText('초대코드 사용'));
    expect(onRedeem).toHaveBeenCalledWith('friend99');
    await waitFor(() => expect(getByText('코인 30개를 받았어요!')).toBeTruthy());
    // 사용 후 입력 폼은 사라진다 — 평생 1회.
    expect(queryByLabelText('초대코드 입력')).toBeNull();
  });

  it('사용 실패(null)면 폼이 유지된다', async () => {
    const onRedeem = jest.fn(async () => null);
    const { getByLabelText, queryByText } = await render(
      <InviteFriendsScreen info={INFO} onRedeem={onRedeem} />,
    );

    await fireEvent.changeText(getByLabelText('초대코드 입력'), 'USED0000');
    await fireEvent.press(getByLabelText('초대코드 사용'));
    await waitFor(() => expect(onRedeem).toHaveBeenCalled());
    expect(queryByText(/받았어요!/)).toBeNull();
    expect(getByLabelText('초대코드 입력')).toBeTruthy();
  });

  it('로드 실패면 다시 시도를 보여준다', async () => {
    const onRetry = jest.fn();
    const { getByText } = await render(<InviteFriendsScreen loadError onRetry={onRetry} />);
    expect(getByText('초대 정보를 불러오지 못했어요.')).toBeTruthy();
    await fireEvent.press(getByText('다시 시도'));
    expect(onRetry).toHaveBeenCalled();
  });
});
