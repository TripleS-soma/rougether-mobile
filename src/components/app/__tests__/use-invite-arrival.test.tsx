import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { type UseInviteArrivalArgs, useInviteArrival } from '@/components/app/use-invite-arrival';
import type { InvitePreview } from '@/components/screens/invite-friends-screen';
import {
  clearPendingFriendInviteCode,
  clearPendingInviteCode,
  peekPendingFriendInviteCode,
  peekPendingInviteCode,
  setPendingFriendInviteCode,
} from '@/lib/pending-invite';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

const mockToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({ useToast: () => ({ show: mockToast }) }));

/**
 * 이 테스트는 **흐름(오케스트레이션)** 만 본다 — 시트의 모양·애니메이션·iOS Modal
 * 직렬화는 시트 자체 테스트(invite-sheets.test.tsx) 몫이다. 그래서 두 시트를 받은
 * props를 그대로 드러내는 가벼운 대역으로 바꾼다.
 */
jest.mock('@/components/screens/sheets/invite-arrival-sheet', () => {
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    InviteArrivalSheet: (p: {
      visible: boolean;
      preview: { inviterNickname: string | null; rewardCoin: number } | null;
      onAccept?: () => void;
      onLater?: () => void;
    }) =>
      p.visible && p.preview ? (
        <View>
          <Text>{`arrival:${p.preview.inviterNickname}:${p.preview.rewardCoin}`}</Text>
          <Pressable accessibilityLabel="accept" onPress={p.onAccept} />
          <Pressable accessibilityLabel="later" onPress={p.onLater} />
        </View>
      ) : null,
  };
});
jest.mock('@/components/screens/sheets/invite-paste-sheet', () => {
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    InvitePasteSheet: (p: {
      visible: boolean;
      error?: string | null;
      onPaste?: (text: string) => void;
      onDismiss?: () => void;
    }) =>
      p.visible ? (
        <View>
          <Text>paste-sheet</Text>
          {p.error ? <Text>{p.error}</Text> : null}
          <Pressable
            accessibilityLabel="paste-envelope"
            onPress={() => p.onPaste?.('rougether-invite:friend:abcd2345')}
          />
          <Pressable
            accessibilityLabel="paste-house"
            onPress={() => p.onPaste?.('rougether-invite:house:HOME77')}
          />
          <Pressable accessibilityLabel="paste-junk" onPress={() => p.onPaste?.('오늘 저녁 7시')} />
          <Pressable accessibilityLabel="dismiss" onPress={p.onDismiss} />
        </View>
      ) : null,
  };
});

const PREVIEW: InvitePreview = {
  code: 'ROUGE123',
  inviterNickname: '소마',
  rewardCoin: 50,
  alreadyRedeemed: false,
};

function Harness(props: UseInviteArrivalArgs) {
  const { sheets } = useInviteArrival(props);
  return sheets;
}

async function setup(overrides: Partial<UseInviteArrivalArgs> = {}) {
  const props: UseInviteArrivalArgs = {
    offerPaste: false,
    check: jest.fn(async (code: string) => ({
      kind: 'ok' as const,
      preview: { ...PREVIEW, code: code.toUpperCase() },
    })),
    redeem: jest.fn(async () => ({ rewardCoin: 50 })),
    onLater: jest.fn(),
    ...overrides,
  };
  const view = await render(<Harness {...props} />);
  return { props, view };
}

afterEach(() => {
  clearPendingFriendInviteCode();
  clearPendingInviteCode();
  mockTrack.mockClear();
  mockToast.mockClear();
});

describe('useInviteArrival (#1007)', () => {
  it('링크로 들어온 친구 코드는 미리보기 → 확인 시트, 받기를 눌러야 쓴다', async () => {
    const { props, view } = await setup();

    await act(async () => setPendingFriendInviteCode('rouge123'));
    await waitFor(() => expect(view.getByText('arrival:소마:50')).toBeTruthy());
    expect(props.check).toHaveBeenCalledWith('ROUGE123');
    // 확인 전에는 절대 쓰지 않는다 — 자동 redeem 금지.
    expect(props.redeem).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith('invite_arrival_view', { via: 'link' });

    await fireEvent.press(view.getByLabelText('accept'));
    await waitFor(() => expect(props.redeem).toHaveBeenCalledWith('ROUGE123', 'link'));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('코인 50개를 받았어요', 'success'));
    expect(peekPendingFriendInviteCode()).toBeNull();
    expect(view.queryByText(/^arrival:/)).toBeNull();
  });

  it('같은 코드가 다시 흘러와도(재구독·복원) 미리보기는 한 번', async () => {
    const { props, view } = await setup();
    await act(async () => setPendingFriendInviteCode('ROUGE123'));
    await act(async () => setPendingFriendInviteCode('ROUGE123'));
    await waitFor(() => expect(view.getByText('arrival:소마:50')).toBeTruthy());
    expect(props.check).toHaveBeenCalledTimes(1);
  });

  it('이미 보상을 받은 계정이면 시트 없이 조용히 끝낸다', async () => {
    const { props, view } = await setup({
      check: jest.fn(async () => ({
        kind: 'ok' as const,
        preview: { ...PREVIEW, alreadyRedeemed: true },
      })),
    });

    await act(async () => setPendingFriendInviteCode('ROUGE123'));
    await waitFor(() => expect(peekPendingFriendInviteCode()).toBeNull());
    expect(props.check).toHaveBeenCalledTimes(1);
    expect(view.queryByText(/^arrival:/)).toBeNull();
    expect(props.redeem).not.toHaveBeenCalled();
  });

  it('쓸 수 없는 코드(invalid)는 이유를 알리고 비운다', async () => {
    const { props, view } = await setup({
      check: jest.fn(async () => ({
        kind: 'invalid' as const,
        message: '초대코드를 찾을 수 없어요',
      })),
    });
    await act(async () => setPendingFriendInviteCode('NOPE1234'));
    await waitFor(() => expect(peekPendingFriendInviteCode()).toBeNull());
    expect(mockToast).toHaveBeenCalledWith('초대코드를 찾을 수 없어요', 'error');
    expect(view.queryByText(/^arrival:/)).toBeNull();
    expect(props.redeem).not.toHaveBeenCalled();
  });

  // #1286 리뷰 — 설치 직후 네트워크가 흔들려도 되찾은 코드를 잃으면 안 된다.
  it('일시적 실패(unavailable)면 코드를 지우지 않고 조용히 두며, 다시 오면 재확인한다', async () => {
    const check = jest
      .fn<Promise<import('@/hooks/use-invites').InviteCheck>, [string]>()
      .mockResolvedValueOnce({ kind: 'unavailable' })
      .mockResolvedValueOnce({ kind: 'ok', preview: PREVIEW });
    const { view } = await setup({ check });

    await act(async () => setPendingFriendInviteCode('ROUGE123'));
    await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    expect(peekPendingFriendInviteCode()).toBe('ROUGE123');
    expect(mockToast).not.toHaveBeenCalled();
    expect(view.queryByText(/^arrival:/)).toBeNull();

    // 재구독·다음 실행 복원처럼 같은 코드가 다시 흐르면 재확인해 시트로 잇는다.
    await act(async () => setPendingFriendInviteCode('ROUGE123'));
    await waitFor(() => expect(view.getByText('arrival:소마:50')).toBeTruthy());
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('나중에는 쓰지 않고 코드를 친구 초대 화면 프리필로 넘긴다', async () => {
    const { props, view } = await setup();

    await act(async () => setPendingFriendInviteCode('ROUGE123'));
    await waitFor(() => expect(view.getByLabelText('later')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('later'));

    expect(props.onLater).toHaveBeenCalledWith('ROUGE123');
    expect(props.redeem).not.toHaveBeenCalled();
    expect(peekPendingFriendInviteCode()).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('invite_arrival_later');
  });

  it('사용이 실패하면(이미 사용 등) 같은 코드로 다시 묻지 않는다', async () => {
    const { props, view } = await setup({ redeem: jest.fn(async () => null) });
    await act(async () => setPendingFriendInviteCode('ROUGE123'));
    await waitFor(() => expect(view.getByLabelText('accept')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('accept'));
    await waitFor(() => expect(view.queryByText(/^arrival:/)).toBeNull());
    expect(props.redeem).toHaveBeenCalledTimes(1);
    expect(peekPendingFriendInviteCode()).toBeNull();
    expect(mockToast).not.toHaveBeenCalledWith(expect.stringContaining('받았어요'), 'success');
  });

  describe('첫 온보딩 직후 붙여넣기', () => {
    it('붙여넣은 봉투에서 친구 코드를 찾아 확인 시트로 잇는다 — via paste', async () => {
      const { props, view } = await setup({ offerPaste: true });

      await waitFor(() => expect(view.getByText('paste-sheet')).toBeTruthy());
      expect(mockTrack).toHaveBeenCalledWith('invite_paste_view');

      await fireEvent.press(view.getByLabelText('paste-envelope'));
      await waitFor(() => expect(props.check).toHaveBeenCalledWith('ABCD2345'));
      await waitFor(() => expect(view.getByText('arrival:소마:50')).toBeTruthy());
      expect(view.queryByText('paste-sheet')).toBeNull();
      expect(mockTrack).toHaveBeenCalledWith('invite_paste_result', { kind: 'friend' });
      expect(mockTrack).toHaveBeenCalledWith('invite_arrival_view', { via: 'paste' });

      await fireEvent.press(view.getByLabelText('accept'));
      await waitFor(() => expect(props.redeem).toHaveBeenCalledWith('ABCD2345', 'paste'));
    });

    // #1286 리뷰 — 붙여넣기 코드가 무효로 끝난 뒤 같은 문자열이 링크로 오면 via는 link.
    it('붙여넣은 코드가 무효로 끝나면, 같은 코드가 나중에 링크로 올 때 via는 link', async () => {
      const check = jest
        .fn<Promise<import('@/hooks/use-invites').InviteCheck>, [string]>()
        .mockResolvedValueOnce({ kind: 'invalid', message: '초대코드를 찾을 수 없어요' })
        .mockResolvedValueOnce({ kind: 'ok', preview: { ...PREVIEW, code: 'ABCD2345' } });
      const { view } = await setup({ offerPaste: true, check });

      await waitFor(() => expect(view.getByLabelText('paste-envelope')).toBeTruthy());
      await fireEvent.press(view.getByLabelText('paste-envelope'));
      await waitFor(() => expect(peekPendingFriendInviteCode()).toBeNull());

      await act(async () => setPendingFriendInviteCode('ABCD2345'));
      await waitFor(() => expect(view.getByText('arrival:소마:50')).toBeTruthy());
      expect(mockTrack).toHaveBeenCalledWith('invite_arrival_view', { via: 'link' });
      expect(mockTrack).not.toHaveBeenCalledWith('invite_arrival_view', { via: 'paste' });
    });

    it('집 코드면 집 채널로 넘긴다 — 친구 확인 시트는 뜨지 않는다', async () => {
      const { props, view } = await setup({ offerPaste: true });
      await waitFor(() => expect(view.getByLabelText('paste-house')).toBeTruthy());
      await fireEvent.press(view.getByLabelText('paste-house'));
      expect(peekPendingInviteCode()).toBe('HOME77');
      expect(props.check).not.toHaveBeenCalled();
      expect(mockTrack).toHaveBeenCalledWith('invite_paste_result', { kind: 'house' });
    });

    it('코드가 아니면 시트에 안내하고 그대로 둔다', async () => {
      const { props, view } = await setup({ offerPaste: true });
      await waitFor(() => expect(view.getByLabelText('paste-junk')).toBeTruthy());
      await fireEvent.press(view.getByLabelText('paste-junk'));
      expect(view.getByText(/초대코드를 찾지 못했어요/)).toBeTruthy();
      expect(view.getByText('paste-sheet')).toBeTruthy();
      expect(props.check).not.toHaveBeenCalled();
      expect(mockTrack).toHaveBeenCalledWith('invite_paste_result', { kind: 'invalid' });
    });

    it('아니에요는 시트만 닫는다', async () => {
      const { view } = await setup({ offerPaste: true });
      await waitFor(() => expect(view.getByLabelText('dismiss')).toBeTruthy());
      await fireEvent.press(view.getByLabelText('dismiss'));
      expect(view.queryByText('paste-sheet')).toBeNull();
      expect(mockTrack).toHaveBeenCalledWith('invite_paste_result', { kind: 'dismiss' });
    });

    it('링크로 이미 코드가 들어와 있으면 붙여넣기를 묻지 않는다', async () => {
      setPendingFriendInviteCode('ROUGE123');
      const { view } = await setup({ offerPaste: true });
      await waitFor(() => expect(view.getByText('arrival:소마:50')).toBeTruthy());
      expect(view.queryByText('paste-sheet')).toBeNull();
      expect(mockTrack).not.toHaveBeenCalledWith('invite_paste_view');
    });

    it('첫 온보딩이 아니면 묻지 않는다', async () => {
      const { view } = await setup({ offerPaste: false });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(view.queryByText('paste-sheet')).toBeNull();
    });
  });
});
