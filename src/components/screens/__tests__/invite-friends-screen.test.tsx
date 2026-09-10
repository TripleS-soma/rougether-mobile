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

  // 링크 공유 (#667) — 랜딩 경유 https 링크를 Share 시트로.
  it('링크 공유를 누르면 초대 링크가 담긴 공유 시트를 연다', async () => {
    const { Share } = jest.requireActual('react-native');
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    try {
      const { getByLabelText } = await render(<InviteFriendsScreen info={INFO} />);
      await fireEvent.press(getByLabelText('초대 링크 공유'));
      expect(shareSpy).toHaveBeenCalledWith({
        message: expect.stringContaining('invite.html?code=ROUGE123'),
      });
    } finally {
      shareSpy.mockRestore();
    }
  });

  // 초대 링크 딥링크 진입 (#667) — 받은 코드 입력란 프리필 + 소비 통지.
  it('initialRedeemCode가 입력란에 프리필되고 소비 콜백이 1회 불린다', async () => {
    const onConsumed = jest.fn();
    const { getByLabelText } = await render(
      <InviteFriendsScreen
        info={INFO}
        initialRedeemCode="FRIEND42"
        onInitialRedeemCodeConsumed={onConsumed}
      />,
    );
    await waitFor(() => expect(getByLabelText('초대코드 입력').props.value).toBe('FRIEND42'));
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });
});

// 사용 전 초대자 확인 (#1007) — 직접 입력한 코드도 계정당 평생 1회라 한 번 더 묻는다.
describe('InviteFriendsScreen — 사용 전 미리보기 (#1007)', () => {
  const PREVIEW = {
    code: 'FRIEND99',
    inviterNickname: '소마',
    rewardCoin: 30,
    alreadyRedeemed: false,
  };

  it('사용하기는 곧장 쓰지 않고 초대자를 보여 준 뒤, 확정해야 쓴다', async () => {
    const onPreview = jest.fn(async () => PREVIEW);
    const onRedeem = jest.fn(async () => ({ rewardCoin: 30 }));
    const ui = await render(
      <InviteFriendsScreen info={INFO} onPreview={onPreview} onRedeem={onRedeem} />,
    );

    await fireEvent.changeText(ui.getByLabelText('초대코드 입력'), ' friend99 ');
    await fireEvent.press(ui.getByLabelText('초대코드 사용'));
    expect(onPreview).toHaveBeenCalledWith('friend99');
    await waitFor(() => expect(ui.getByText('소마님의 초대가 맞나요?')).toBeTruthy());
    expect(onRedeem).not.toHaveBeenCalled();

    await fireEvent.press(ui.getByLabelText('초대코드 사용 확정'));
    // 미리보기가 정규화한 코드로 쓴다.
    expect(onRedeem).toHaveBeenCalledWith('FRIEND99');
    await waitFor(() => expect(ui.getByText('코인 30개를 받았어요!')).toBeTruthy());
  });

  it('닉네임이 없는 초대자는 친구로 부른다', async () => {
    const onPreview = jest.fn(async () => ({ ...PREVIEW, inviterNickname: null }));
    const ui = await render(
      <InviteFriendsScreen info={INFO} onPreview={onPreview} onRedeem={jest.fn()} />,
    );
    await fireEvent.changeText(ui.getByLabelText('초대코드 입력'), 'FRIEND99');
    await fireEvent.press(ui.getByLabelText('초대코드 사용'));
    await waitFor(() => expect(ui.getByText('친구의 초대가 맞나요?')).toBeTruthy());
  });

  it('이미 보상을 받은 계정이면 쓰지 않고 안내만 한다', async () => {
    const onPreview = jest.fn(async () => ({ ...PREVIEW, alreadyRedeemed: true }));
    const onRedeem = jest.fn();
    const ui = await render(
      <InviteFriendsScreen info={INFO} onPreview={onPreview} onRedeem={onRedeem} />,
    );
    await fireEvent.changeText(ui.getByLabelText('초대코드 입력'), 'FRIEND99');
    await fireEvent.press(ui.getByLabelText('초대코드 사용'));
    await waitFor(() => expect(ui.getByText('이미 초대 보상을 받은 계정이에요.')).toBeTruthy());
    expect(onRedeem).not.toHaveBeenCalled();
    expect(ui.queryByText(/초대가 맞나요/)).toBeNull();
  });

  it('미리보기 실패(null)면 입력 그대로, 다시 입력은 확인에서 입력으로 돌아간다', async () => {
    const onPreview = jest.fn(async (): Promise<typeof PREVIEW | null> => null);
    const ui = await render(
      <InviteFriendsScreen info={INFO} onPreview={onPreview} onRedeem={jest.fn()} />,
    );
    await fireEvent.changeText(ui.getByLabelText('초대코드 입력'), 'NOPE1234');
    await fireEvent.press(ui.getByLabelText('초대코드 사용'));
    await waitFor(() => expect(onPreview).toHaveBeenCalled());
    expect(ui.getByLabelText('초대코드 입력').props.value).toBe('NOPE1234');

    onPreview.mockResolvedValueOnce(PREVIEW);
    await fireEvent.press(ui.getByLabelText('초대코드 사용'));
    await waitFor(() => expect(ui.getByText('소마님의 초대가 맞나요?')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('초대코드 다시 입력'));
    expect(ui.getByLabelText('초대코드 입력').props.value).toBe('NOPE1234');
  });

  it('서버 공유 링크(shareUrl)가 있으면 그 링크로 공유한다', async () => {
    const { Share } = jest.requireActual('react-native');
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    try {
      const { getByLabelText } = await render(
        <InviteFriendsScreen info={{ ...INFO, shareUrl: 'https://rougether.app/i/ROUGE123' }} />,
      );
      await fireEvent.press(getByLabelText('초대 링크 공유'));
      const message = (shareSpy.mock.calls[0][0] as { message: string }).message;
      expect(message).toContain('https://rougether.app/i/ROUGE123');
      expect(message).not.toContain('invite.html');
    } finally {
      shareSpy.mockRestore();
    }
  });
});
