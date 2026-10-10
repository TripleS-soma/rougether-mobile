import { act, fireEvent, render } from '@testing-library/react-native';
import { DeviceEventEmitter, Platform, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import {
  type ChatMessageView,
  chatDayLabel,
  HouseChatScreen,
} from '@/components/screens/house-chat-screen';

const MESSAGES: ChatMessageView[] = [
  { key: 's1', sequence: 1, senderUserId: 2, senderNickname: '이웃', content: '안녕하세요', createdAt: '2026-09-21T12:58:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
  { key: 's2', sequence: 2, senderUserId: 1, senderNickname: '나', content: '반가워요', createdAt: '2026-09-21T13:00:00Z', unreadCount: 2, status: 'sent' }, // prettier-ignore
];

describe('HouseChatScreen (#1408)', () => {
  it('다른 구성원은 닉네임과 함께, 내 말풍선은 안 읽은 수와 함께 그린다', async () => {
    const screen = await render(<HouseChatScreen messages={MESSAGES} myUserId={1} />);
    expect(screen.getByText('안녕하세요')).toBeTruthy();
    expect(screen.getByText('이웃')).toBeTruthy();
    expect(screen.getByText('반가워요')).toBeTruthy();
    // 내 닉네임은 말풍선 위에 그리지 않는다.
    expect(screen.queryByText('나')).toBeNull();
    expect(screen.getByLabelText('안 읽은 사람 2명')).toBeTruthy();
  });

  it('보내기는 다듬은 본문으로 부르고 입력칸을 비운다', async () => {
    const onSend = jest.fn();
    const screen = await render(<HouseChatScreen messages={[]} myUserId={1} onSend={onSend} />);
    const input = screen.getByLabelText('메시지 입력');
    await fireEvent.changeText(input, '  오늘도 화이팅  ');
    await fireEvent.press(screen.getByLabelText('보내기'));
    expect(onSend).toHaveBeenCalledWith('오늘도 화이팅');
    expect(screen.getByLabelText('메시지 입력').props.value).toBe('');
  });

  it('비었거나 공백뿐인 본문은 보내지 않는다', async () => {
    const onSend = jest.fn();
    const screen = await render(<HouseChatScreen messages={[]} myUserId={1} onSend={onSend} />);
    await fireEvent.press(screen.getByLabelText('보내기'));
    await fireEvent.changeText(screen.getByLabelText('메시지 입력'), '   \n ');
    await fireEvent.press(screen.getByLabelText('보내기'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('보인 메시지 중 가장 큰 순서를 onVisible로 알린다', async () => {
    const onVisible = jest.fn();
    const screen = await render(
      <HouseChatScreen messages={MESSAGES} myUserId={1} onVisible={onVisible} />,
    );
    const list = screen.getByTestId('house-chat-list');
    await act(async () => {
      list.props.onViewableItemsChanged({
        viewableItems: [
          { item: MESSAGES[1], isViewable: true, index: 0, key: 's2' },
          { item: MESSAGES[0], isViewable: true, index: 1, key: 's1' },
          // 보내는 중(순서 없음)은 건너뛴다.
          { item: { key: 'cX', content: 'x', unreadCount: 0, status: 'pending' }, isViewable: true, index: 2, key: 'cX' }, // prettier-ignore
        ],
        changed: [],
      });
    });
    expect(onVisible).toHaveBeenCalledWith(2);
  });

  it('실패한 내 메시지는 다시 보내기를 같은 clientMessageId로 부른다', async () => {
    const onRetrySend = jest.fn();
    const screen = await render(
      <HouseChatScreen
        messages={[{ key: 'cA', clientMessageId: 'A', senderUserId: 1, content: '실패', unreadCount: 0, status: 'failed' }]} // prettier-ignore
        myUserId={1}
        onRetrySend={onRetrySend}
      />,
    );
    await fireEvent.press(screen.getByLabelText('다시 보내기'));
    expect(onRetrySend).toHaveBeenCalledWith('A');
  });

  it('대화가 없으면 빈 상태 문구', async () => {
    const screen = await render(<HouseChatScreen messages={[]} myUserId={1} />);
    expect(screen.getByText('아직 대화가 없어요. 먼저 인사를 건네 보세요!')).toBeTruthy();
  });
});

describe('HouseChatScreen 키보드 — Android', () => {
  const NAV_BAR = 48;
  const KEYBOARD = 282; // ime − system bars, what keyboardDidShow reports (ReactRootView)

  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('입력줄 아래 여백은 내비바 인셋 위에 키보드 높이를 더한다 — 내비바만큼 가려지지 않게', async () => {
    const screen = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 40, bottom: NAV_BAR, left: 0, right: 0 }}>
        <HouseChatScreen messages={[]} myUserId={1} />
      </SafeAreaInsetsContext.Provider>,
    );
    const bottom = () => {
      let node = screen.getByLabelText('메시지 입력').parent;
      while (node) {
        const pb = StyleSheet.flatten(node.props.style)?.paddingBottom;
        if (typeof pb === 'number') return pb;
        node = node.parent;
      }
      return undefined;
    };
    const closed = bottom()!;
    expect(closed).toBeGreaterThanOrEqual(NAV_BAR);

    await act(async () => {
      DeviceEventEmitter.emit('keyboardDidShow', {
        endCoordinates: { screenX: 0, screenY: 0, width: 411, height: KEYBOARD },
        easing: 'keyboard',
        duration: 0,
      });
    });
    expect(bottom()).toBe(closed + KEYBOARD);
  });
});

describe('HouseChatScreen — 날짜 구분선', () => {
  // UTC 03:00 = KST 정오 — 단말 시간대(KST/UTC)와 무관하게 같은 날짜로 묶인다.
  const msg = (seq: number, sender: number, day: string, content: string): ChatMessageView => ({
    key: `s${seq}`,
    sequence: seq,
    senderUserId: sender,
    senderNickname: sender === 1 ? '나' : '이웃',
    content,
    createdAt: `${day}T03:00:00Z`,
    unreadCount: 0,
    status: 'sent',
  });

  it('날이 바뀌는 첫 메시지 위에 날짜를 한 번씩 그린다', async () => {
    const screen = await render(
      <HouseChatScreen
        myUserId={1}
        messages={[
          msg(1, 2, '2026-09-20', '어제 첫 말'),
          msg(2, 2, '2026-09-20', '어제 둘째 말'),
          msg(3, 1, '2026-09-21', '오늘 말'),
        ]}
      />,
    );
    expect(screen.getAllByText('9월 20일 일요일')).toHaveLength(1);
    expect(screen.getAllByText('9월 21일 월요일')).toHaveLength(1);
  });

  it('같은 사람이 이어 말해도 날이 바뀌면 닉네임을 다시 보여 준다', async () => {
    const screen = await render(
      <HouseChatScreen
        myUserId={1}
        messages={[
          msg(1, 2, '2026-09-20', '어제 말'),
          msg(2, 2, '2026-09-20', '어제 또'),
          msg(3, 2, '2026-09-21', '오늘 말'),
        ]}
      />,
    );
    expect(screen.getAllByText('이웃')).toHaveLength(2);
  });

  it('보내는 중(시각 없음)인 메시지는 날짜 경계를 만들지 않는다', async () => {
    const screen = await render(
      <HouseChatScreen
        myUserId={1}
        messages={[
          msg(1, 1, '2026-09-21', '보낸 말'),
          { key: 'c1', content: '보내는 중', unreadCount: 0, status: 'pending', senderUserId: 1 },
        ]}
      />,
    );
    expect(screen.getAllByText(/9월 21일/)).toHaveLength(1);
  });

  it('올해가 아니면 연도까지 붙인다', () => {
    expect(chatDayLabel('2025-12-31', new Date(2026, 9, 10))).toBe('2025년 12월 31일 수요일');
    expect(chatDayLabel('2026-09-21', new Date(2026, 9, 10))).toBe('9월 21일 월요일');
  });
});
