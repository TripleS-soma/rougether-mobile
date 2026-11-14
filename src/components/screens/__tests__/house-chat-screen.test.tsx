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

describe('HouseChatScreen — 링크 (#1507)', () => {
  it('말풍선 속 주소는 링크로 보이고, 누르면 이동 확인을 묻는다', async () => {
    const screen = await render(
      <HouseChatScreen
        myUserId={1}
        messages={[
          { key: 's1', sequence: 1, senderUserId: 2, senderNickname: '이웃', content: '여기 봐요 https://a.com/x', createdAt: '2026-09-21T03:00:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
        ]}
      />,
    );
    await fireEvent.press(screen.getByLabelText('링크 https://a.com/x'));
    expect(screen.getByText('외부 사이트로 이동할까요?')).toBeTruthy();
  });
});

describe('HouseChatScreen — 방 알림 음소거 (서버 #435)', () => {
  it('종 버튼은 알림 켜짐을 스위치로 알리고, 누르면 onToggleMute', async () => {
    const onToggleMute = jest.fn();
    const screen = await render(
      <HouseChatScreen messages={[]} myUserId={1} muted onToggleMute={onToggleMute} />,
    );
    const bell = screen.getByLabelText('이 채팅방 알림');
    expect(bell.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(bell);
    expect(onToggleMute).toHaveBeenCalled();
  });

  it('음소거 상태를 모르면(콜백 없음) 종 버튼이 없다', async () => {
    const screen = await render(<HouseChatScreen messages={[]} myUserId={1} />);
    expect(screen.queryByLabelText('이 채팅방 알림')).toBeNull();
  });
});

it('사진 선택 버튼을 누르면 선택 콜백을 부른다', async () => {
  const pick = jest.fn();
  const screen = await render(<HouseChatScreen messages={[]} onPickPhoto={pick} />);
  await fireEvent.press(screen.getByLabelText('사진 선택'));
  expect(pick).toHaveBeenCalledTimes(1);
});

// 채팅 사진은 그 집 구성원에게만 보이는 사진이다 — 남이 올린 사진을 피드로 옮길 수 없다.
it('[피드에 올리기]는 내가 보낸 사진에만 붙는다 (2026-11-11)', async () => {
  const onSharePhoto = jest.fn();
  const photos: ChatMessageView[] = [
    { key: 'p1', sequence: 1, senderUserId: 2, senderNickname: '이웃', content: '', messageType: 'IMAGE', localImages: [{ uri: 'file:///tmp/theirs.jpg', name: 'theirs.jpg', type: 'image/jpeg' }], createdAt: '2026-11-11T11:30:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
    { key: 'p2', sequence: 2, senderUserId: 1, senderNickname: '나', content: '', messageType: 'IMAGE', localImages: [{ uri: 'file:///tmp/mine.jpg', name: 'mine.jpg', type: 'image/jpeg' }], createdAt: '2026-11-11T11:31:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
  ];
  const screen = await render(
    <HouseChatScreen messages={photos} myUserId={1} onSharePhoto={onSharePhoto} />,
  );
  // 목록은 최신 메시지가 먼저 그려진다(뒤집힌 리스트).
  const [mine, theirs] = screen.getAllByLabelText('사진 크게 보기');

  await fireEvent.press(theirs);
  expect(screen.getByTestId('chat-photo-sender')).toHaveTextContent('이웃');
  expect(screen.queryByLabelText('피드에 올리기')).toBeNull();
  await fireEvent.press(screen.getByLabelText('닫기'));

  await fireEvent.press(mine);
  await fireEvent.press(screen.getByLabelText('피드에 올리기'));
  expect(onSharePhoto).toHaveBeenCalledWith('file:///tmp/mine.jpg');
});

describe('HouseChatScreen — 이 집 알림 시트 (집 피드)', () => {
  it('onOpenNotifications가 있으면 종은 스위치가 아니라 시트를 여는 버튼', async () => {
    const onOpenNotifications = jest.fn();
    const onToggleMute = jest.fn();
    const screen = await render(
      <HouseChatScreen
        messages={[]}
        myUserId={1}
        onOpenNotifications={onOpenNotifications}
        onToggleMute={onToggleMute}
      />,
    );
    expect(screen.queryByLabelText('이 채팅방 알림')).toBeNull();
    const bell = screen.getByLabelText('이 집 알림 설정');
    expect(bell.props.accessibilityRole).toBe('button');
    await fireEvent.press(bell);
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
    expect(onToggleMute).not.toHaveBeenCalled();
  });
});

describe('HouseChatScreen — 길게 눌러 여는 메뉴 (2026-11-13)', () => {
  const SENT: ChatMessageView[] = [
    { key: 's1', messageId: 11, sequence: 1, senderUserId: 2, senderNickname: '이웃', content: '안녕하세요', createdAt: '2026-09-21T12:58:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
    { key: 's2', messageId: 12, sequence: 2, senderUserId: 1, senderNickname: '나', content: '반가워요', createdAt: '2026-09-21T13:00:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
  ];

  it('신고는 평소에 보이지 않고, 남의 말풍선을 길게 눌러야 나온다', async () => {
    const onReport = jest.fn();
    const screen = await render(
      <HouseChatScreen messages={SENT} myUserId={1} onReport={onReport} onReact={jest.fn()} />,
    );
    expect(screen.queryByLabelText('신고')).toBeNull();
    await fireEvent(screen.getByText('안녕하세요'), 'longPress');
    await fireEvent.press(screen.getByLabelText('신고'));
    expect(onReport).toHaveBeenCalledWith(11);
    // 고르면 메뉴가 닫힌다.
    expect(screen.queryByLabelText('신고')).toBeNull();
  });

  it('내 말풍선의 메뉴에는 신고가 없고 복사는 있다', async () => {
    const onCopy = jest.fn();
    const screen = await render(
      <HouseChatScreen messages={SENT} myUserId={1} onReport={jest.fn()} onCopy={onCopy} />,
    );
    await fireEvent(screen.getByText('반가워요'), 'longPress');
    expect(screen.queryByLabelText('신고')).toBeNull();
    await fireEvent.press(screen.getByLabelText('복사'));
    expect(onCopy).toHaveBeenCalledWith('반가워요');
  });

  it('메뉴에서 공감을 고르면 그 메시지와 유형으로 부르고, 이미 고른 공감을 다시 누르면 취소한다', async () => {
    const onReact = jest.fn();
    const reacted: ChatMessageView[] = [
      { ...SENT[0], reactions: [{ type: 'LIKE', userIds: [1, 3] }] },
    ];
    const screen = await render(
      <HouseChatScreen messages={reacted} myUserId={1} onReact={onReact} />,
    );
    await fireEvent(screen.getByText('안녕하세요'), 'longPress');
    await fireEvent.press(screen.getByLabelText('하트 공감'));
    expect(onReact).toHaveBeenLastCalledWith(11, 'HEART');
    await fireEvent(screen.getByText('안녕하세요'), 'longPress');
    await fireEvent.press(screen.getByLabelText('좋아요 공감'));
    expect(onReact).toHaveBeenLastCalledWith(11, null);
  });

  it('말풍선 아래 공감 칩은 사람 수를 보여 주고, 누르면 그 유형으로 공감한다', async () => {
    const onReact = jest.fn();
    const reacted: ChatMessageView[] = [
      { ...SENT[0], reactions: [{ type: 'HEART', userIds: [3, 4] }] },
    ];
    const screen = await render(
      <HouseChatScreen messages={reacted} myUserId={1} onReact={onReact} />,
    );
    await fireEvent.press(screen.getByLabelText('하트 공감 2명'));
    expect(onReact).toHaveBeenCalledWith(11, 'HEART');
  });

  it('보내는 중인 메시지는 길게 눌러도 메뉴가 열리지 않는다', async () => {
    const pending: ChatMessageView[] = [
      { key: 'cA', clientMessageId: 'A', senderUserId: 1, content: '가는 중', unreadCount: 0, status: 'pending' }, // prettier-ignore
    ];
    const screen = await render(
      <HouseChatScreen messages={pending} myUserId={1} onReact={jest.fn()} onCopy={jest.fn()} />,
    );
    await fireEvent(screen.getByText('가는 중'), 'longPress');
    expect(screen.queryByTestId('chat-message-menu')).toBeNull();
  });
});

describe('HouseChatScreen — 사진 묶음 (2026-11-13)', () => {
  const photo = (name: string) => ({ uri: `file:///tmp/${name}`, name, type: 'image/jpeg' });

  it('담아 둔 사진이 있으면 글이 비어도 보내고, 글은 함께 넘긴다', async () => {
    const onSend = jest.fn();
    const screen = await render(
      <HouseChatScreen messages={[]} onSend={onSend} photos={[photo('a.jpg'), photo('b.jpg')]} />,
    );
    expect(screen.getByText('사진 2/10장 · 글과 함께 한 번에 보내요')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('보내기'));
    expect(onSend).toHaveBeenLastCalledWith('');
    await fireEvent.changeText(screen.getByLabelText('메시지 입력'), '  어제 산책  ');
    await fireEvent.press(screen.getByLabelText('보내기'));
    expect(onSend).toHaveBeenLastCalledWith('어제 산책');
  });

  it('담아 둔 사진은 눌러서 자르기를 열고 따로 뺄 수 있다', async () => {
    const onEditPhoto = jest.fn();
    const onRemovePhoto = jest.fn();
    const screen = await render(
      <HouseChatScreen
        messages={[]}
        photos={[photo('a.jpg'), photo('b.jpg')]}
        onEditPhoto={onEditPhoto}
        onRemovePhoto={onRemovePhoto}
      />,
    );
    await fireEvent.press(screen.getByLabelText('2번째 사진 자르기'));
    expect(onEditPhoto).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByLabelText('1번째 사진 빼기'));
    expect(onRemovePhoto).toHaveBeenCalledWith(0);
  });

  it('사진을 10장 담으면 사진 버튼이 잠긴다', async () => {
    const pick = jest.fn();
    const full = Array.from({ length: 10 }, (_, i) => photo(`${i}.jpg`));
    const screen = await render(<HouseChatScreen messages={[]} photos={full} onPickPhoto={pick} />);
    await fireEvent.press(screen.getByLabelText('사진 선택'));
    expect(pick).not.toHaveBeenCalled();
  });

  it('이모티콘 메시지는 서버의 대체 문구로 보이고, 그 문구는 복사 메뉴에 올리지 않는다', async () => {
    const onCopy = jest.fn();
    const messages: ChatMessageView[] = [
      { key: 's1', messageId: 1, sequence: 1, senderUserId: 2, senderNickname: '이웃', content: '이모티콘을 보냈어요', messageType: 'EMOTICON', createdAt: '2026-09-21T12:58:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
    ];
    const screen = await render(
      <HouseChatScreen messages={messages} myUserId={1} onCopy={onCopy} onReact={jest.fn()} />,
    );
    await fireEvent(screen.getByText('이모티콘을 보냈어요'), 'longPress');
    expect(screen.getByLabelText('하트 공감')).toBeTruthy();
    expect(screen.queryByLabelText('복사')).toBeNull();
  });

  it('사진 여러 장은 묶음으로, 함께 보낸 글은 그 아래 말풍선으로 그린다', async () => {
    const messages: ChatMessageView[] = [
      { key: 's1', messageId: 1, sequence: 1, senderUserId: 1, senderNickname: '나', content: '어제 산책', caption: '어제 산책', messageType: 'IMAGE', localImages: [photo('a.jpg'), photo('b.jpg'), photo('c.jpg')], createdAt: '2026-09-21T12:58:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
    ];
    const screen = await render(<HouseChatScreen messages={messages} myUserId={1} />);
    expect(screen.getByTestId('chat-photo-grid')).toBeTruthy();
    expect(screen.getAllByLabelText('사진 크게 보기')).toHaveLength(3);
    expect(screen.getByText('어제 산책')).toBeTruthy();
  });

  it('사진만 보낸 메시지는 옛 앱용 대체 문구를 그리지 않는다', async () => {
    const messages: ChatMessageView[] = [
      { key: 's1', messageId: 1, sequence: 1, senderUserId: 2, senderNickname: '이웃', content: '사진을 보냈어요', messageType: 'IMAGE', localImages: [photo('a.jpg')], createdAt: '2026-09-21T12:58:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
    ];
    const screen = await render(<HouseChatScreen messages={messages} myUserId={1} />);
    expect(screen.queryByText('사진을 보냈어요')).toBeNull();
  });
});
