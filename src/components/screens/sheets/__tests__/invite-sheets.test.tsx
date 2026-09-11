import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { InviteArrivalSheet } from '@/components/screens/sheets/invite-arrival-sheet';
import { __resetSheetSerializer } from '@/components/ui/bottom-sheet';
import { InvitePasteSheet } from '@/components/screens/sheets/invite-paste-sheet';

let mockPasteButtonAvailable = false;
const mockGetString = jest.fn(async () => 'rougether-invite:friend:ABCD2345');
const mockPasteButton = jest.fn((_props: unknown) => null);
jest.mock('expo-clipboard', () => ({
  __esModule: true,
  get isPasteButtonAvailable() {
    return mockPasteButtonAvailable;
  },
  getStringAsync: () => mockGetString(),
  setStringAsync: jest.fn(),
  ClipboardPasteButton: (props: unknown) => mockPasteButton(props),
}));

const PREVIEW = {
  code: 'ROUGE123',
  inviterNickname: '소마',
  rewardCoin: 50,
  alreadyRedeemed: false,
};

beforeEach(() => {
  // 앞 테스트의 시트가 닫히던 중 언마운트되면(자동 cleanup은 파일의 afterEach보다 늦게
  // 돈다) 직렬화기가 "퇴장 중"으로 남아 다음 시트의 열림을 붙잡는다 — 시작 전에 비운다.
  __resetSheetSerializer();
});

afterEach(() => {
  mockPasteButtonAvailable = false;
  mockPasteButton.mockClear();
});

describe('InviteArrivalSheet (#1007)', () => {
  it('초대자와 받을 코인을 보여 주고, 받기·나중에를 부른다', async () => {
    const onAccept = jest.fn();
    const onLater = jest.fn();
    const ui = await render(
      <InviteArrivalSheet visible preview={PREVIEW} onAccept={onAccept} onLater={onLater} />,
    );
    expect(ui.getByText('🎁 소마님의 초대로 오셨어요')).toBeTruthy();
    expect(ui.getByText(/코인 50개를 받아요/)).toBeTruthy();

    await fireEvent.press(ui.getByLabelText('초대 코인 받기'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    await fireEvent.press(ui.getByLabelText('초대 나중에 받기'));
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('닉네임이 없으면 친구로 부른다', async () => {
    const ui = await render(
      <InviteArrivalSheet visible preview={{ ...PREVIEW, inviterNickname: null }} />,
    );
    expect(ui.getByText('🎁 친구의 초대로 오셨어요')).toBeTruthy();
  });

  it('받는 중에는 버튼이 잠긴다 — 두 번 누르지 못한다', async () => {
    const onAccept = jest.fn();
    const ui = await render(
      <InviteArrivalSheet visible preview={PREVIEW} busy onAccept={onAccept} />,
    );
    expect(ui.getByText('받는 중...')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('초대 코인 받기'));
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('미리보기가 없으면 그리지 않는다', async () => {
    const ui = await render(<InviteArrivalSheet visible preview={null} />);
    expect(ui.queryByText(/초대로 오셨어요/)).toBeNull();
  });
});

describe('InvitePasteSheet (#1007)', () => {
  it('붙여넣기 버튼은 누를 때 클립보드를 읽어 넘긴다 — 자동으로 읽지 않는다', async () => {
    const onPaste = jest.fn();
    const ui = await render(<InvitePasteSheet visible onPaste={onPaste} />);
    expect(mockGetString).not.toHaveBeenCalled();

    await fireEvent.press(ui.getByLabelText('초대코드 붙여넣기'));
    await waitFor(() => expect(onPaste).toHaveBeenCalledWith('rougether-invite:friend:ABCD2345'));
  });

  it('iOS 시스템 붙여넣기 버튼이 되면 그 버튼을 쓴다 — 허용 팝업 없음', async () => {
    mockPasteButtonAvailable = true;
    const onPaste = jest.fn();
    const ui = await render(<InvitePasteSheet visible onPaste={onPaste} />);
    expect(ui.queryByLabelText('초대코드 붙여넣기')).toBeNull();
    expect(mockPasteButton).toHaveBeenCalled();

    const props = mockPasteButton.mock.calls[0][0] as {
      onPress: (data: { type: string; text?: string }) => void;
    };
    // 상태를 바꾸지 않는 콜백이라 act가 필요 없다 — 동기 act는 다음 테스트의 렌더를 깨뜨린다
    // (알림 목록 스와이프 테스트와 같은 하니스 특성).
    props.onPress({ type: 'text', text: 'ROUGE123' });
    expect(onPaste).toHaveBeenCalledWith('ROUGE123');
    // 이미지 붙여넣기는 무시.
    props.onPress({ type: 'image' });
    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  it('안내 문구와 아니에요', async () => {
    const onDismiss = jest.fn();
    const ui = await render(
      <InvitePasteSheet visible error="초대코드를 찾지 못했어요." onDismiss={onDismiss} />,
    );
    expect(ui.getByText('초대코드를 찾지 못했어요.')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('초대받지 않았어요'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
