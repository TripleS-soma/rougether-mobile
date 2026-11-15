import { act, fireEvent, render } from '@testing-library/react-native';

import { HouseChatScreen, type ChatMessageView } from '@/components/screens/house-chat-screen';

describe('chat emoticons', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends a quick double tap with the text once and starts a fresh selection after reopening', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const onSendEmoticon = jest.fn();
    const ui = await render(
      <HouseChatScreen messages={[]} onSend={jest.fn()} onSendEmoticon={onSendEmoticon} />,
    );
    await fireEvent.changeText(ui.getByLabelText('메시지 입력'), '같이 힘내요!');
    await fireEvent.press(ui.getByLabelText('이모티콘 선택'));
    await fireEvent.press(ui.getByLabelText('파이팅! 선택'));
    expect(onSendEmoticon).not.toHaveBeenCalled();
    clock.mockReturnValue(1100);
    await fireEvent.press(ui.getByLabelText('파이팅! 선택'));
    expect(onSendEmoticon).toHaveBeenCalledTimes(1);
    expect(onSendEmoticon).toHaveBeenCalledWith('ruyang_cheer', '같이 힘내요!');
    expect(ui.queryByTestId('chat-emoticon-picker')).toBeNull();
    expect(ui.queryByTestId('chat-emoticon-preview')).toBeNull();
    expect(ui.getByLabelText('메시지 입력').props.value).toBe('');
    await fireEvent.press(ui.getByLabelText('이모티콘 선택'));
    clock.mockReturnValue(1150);
    await fireEvent.press(ui.getByLabelText('파이팅! 선택'));
    expect(onSendEmoticon).toHaveBeenCalledTimes(1);
    expect(ui.getByLabelText('선택한 이모티콘: 파이팅!')).toBeTruthy();
  });

  it('does not send for a slow repeat or different items, and keeps the picker after an emoticon-only double tap', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const onSendEmoticon = jest.fn();
    const ui = await render(
      <HouseChatScreen messages={[]} onSend={jest.fn()} onSendEmoticon={onSendEmoticon} />,
    );
    await fireEvent.press(ui.getByLabelText('이모티콘 선택'));
    await fireEvent.press(ui.getByLabelText('안녕! 선택'));
    clock.mockReturnValue(1500);
    await fireEvent.press(ui.getByLabelText('안녕! 선택'));
    clock.mockReturnValue(1600);
    await fireEvent.press(ui.getByLabelText('좋아! 선택'));
    clock.mockReturnValue(1700);
    await fireEvent.press(ui.getByLabelText('안녕! 선택'));
    expect(onSendEmoticon).not.toHaveBeenCalled();
    clock.mockReturnValue(1800);
    await fireEvent.press(ui.getByLabelText('안녕! 선택'));
    expect(onSendEmoticon).toHaveBeenCalledTimes(1);
    expect(onSendEmoticon).toHaveBeenCalledWith('ruyang_hi', '');
    expect(ui.getByTestId('chat-emoticon-picker')).toBeTruthy();
    expect(ui.queryByTestId('chat-emoticon-preview')).toBeNull();
    // 세 번째 탭은 새 선택으로 시작하고 두 번째 전송이 되지 않음.
    clock.mockReturnValue(1850);
    await fireEvent.press(ui.getByLabelText('안녕! 선택'));
    expect(onSendEmoticon).toHaveBeenCalledTimes(1);
    expect(ui.getByLabelText('선택한 이모티콘: 안녕!')).toBeTruthy();
  });

  it('handles both taps before React commits without sending the remaining photo draft', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const onSend = jest.fn();
    const onSendEmoticon = jest.fn();
    const ui = await render(
      <HouseChatScreen
        messages={[]}
        onSend={onSend}
        onSendEmoticon={onSendEmoticon}
        photos={[{ uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' }]}
      />,
    );
    await fireEvent.changeText(ui.getByLabelText('메시지 입력'), '같이 힘내요!');
    await fireEvent.press(ui.getByLabelText('이모티콘 선택'));
    let fiber = ui.getByLabelText('파이팅! 선택').unstable_fiber;
    while (fiber && typeof fiber.memoizedProps?.onPress !== 'function') fiber = fiber.return;
    const onPress = fiber?.memoizedProps.onPress;
    expect(onPress).toEqual(expect.any(Function));
    await act(async () => {
      onPress();
      clock.mockReturnValue(1100);
      onPress();
    });
    expect(onSendEmoticon).toHaveBeenCalledTimes(1);
    expect(onSendEmoticon).toHaveBeenCalledWith('ruyang_cheer', '같이 힘내요!');
    expect(ui.queryByTestId('chat-emoticon-picker')).toBeNull();
    await fireEvent.press(ui.getByLabelText('보내기'));
    expect(onSend).not.toHaveBeenCalled();
    expect(ui.getByTestId('chat-composer-tray')).toBeTruthy();
  });

  it('previews a choice without sending; Send submits its key and the text together', async () => {
    const onSendEmoticon = jest.fn();
    const onSend = jest.fn();
    const ui = await render(
      <HouseChatScreen messages={[]} onSend={onSend} onSendEmoticon={onSendEmoticon} />,
    );
    await fireEvent.changeText(ui.getByLabelText('메시지 입력'), '이어서 쓸 글');
    await fireEvent.press(ui.getByLabelText('이모티콘 선택'));
    expect(ui.getAllByRole('button', { name: / 선택$/ })).toHaveLength(8);
    await fireEvent.press(ui.getByLabelText('파이팅! 선택'));
    expect(onSendEmoticon).not.toHaveBeenCalled();
    expect(ui.getByLabelText('선택한 이모티콘: 파이팅!')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('보내기'));
    expect(onSendEmoticon).toHaveBeenCalledTimes(1);
    expect(onSendEmoticon).toHaveBeenCalledWith('ruyang_cheer', '이어서 쓸 글');
    expect(onSend).not.toHaveBeenCalled();
    expect(ui.getByLabelText('메시지 입력').props.value).toBe('');
    expect(ui.queryByTestId('chat-emoticon-picker')).toBeNull();
    expect(ui.queryByTestId('chat-emoticon-preview')).toBeNull();
  });

  it.each(['', '  \n  '])(
    'keeps the picker open when sending only an emoticon (%j)',
    async (text) => {
      const onSendEmoticon = jest.fn();
      const ui = await render(
        <HouseChatScreen messages={[]} onSend={jest.fn()} onSendEmoticon={onSendEmoticon} />,
      );
      await fireEvent.changeText(ui.getByLabelText('메시지 입력'), text);
      await fireEvent.press(ui.getByLabelText('이모티콘 선택'));
      await fireEvent.press(ui.getByLabelText('안녕! 선택'));
      await fireEvent.press(ui.getByLabelText('보내기'));
      expect(onSendEmoticon).toHaveBeenCalledWith('ruyang_hi', '');
      expect(ui.getByTestId('chat-emoticon-picker')).toBeTruthy();
      expect(ui.getAllByRole('button', { name: / 선택$/ })).toHaveLength(8);
      expect(ui.queryByTestId('chat-emoticon-preview')).toBeNull();
    },
  );

  it('retains attached photos and prevents a double tap from sending the remaining photo draft', async () => {
    const onSendEmoticon = jest.fn();
    const onSend = jest.fn();
    const ui = await render(
      <HouseChatScreen
        messages={[]}
        onSend={onSend}
        onSendEmoticon={onSendEmoticon}
        photos={[{ uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' }]}
        onRemovePhoto={jest.fn()}
      />,
    );
    await fireEvent.changeText(ui.getByLabelText('메시지 입력'), '사진 설명');
    await fireEvent.press(ui.getByLabelText('이모티콘 선택'));
    await fireEvent.press(ui.getByLabelText('안녕! 선택'));
    const send = ui.getByLabelText('보내기');
    let fiber = send.unstable_fiber;
    while (fiber && typeof fiber.memoizedProps?.onPress !== 'function') fiber = fiber.return;
    const onPress = fiber?.memoizedProps.onPress;
    expect(onPress).toEqual(expect.any(Function));
    await act(async () => {
      onPress();
      onPress();
    });
    expect(onSendEmoticon).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    // React 갱신 후의 두 번째 탭도 남은 사진을 전송하지 않음.
    await fireEvent.press(ui.getByLabelText('보내기'));
    expect(onSendEmoticon).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(onSendEmoticon).toHaveBeenCalledWith('ruyang_hi', '사진 설명');
    expect(ui.getByTestId('chat-composer-tray')).toBeTruthy();
    expect(ui.getByLabelText('메시지 입력').props.value).toBe('');
    expect(ui.queryByTestId('chat-emoticon-picker')).toBeNull();
    // 사진은 보존하지만, 사용자가 다시 입력/첨부를 조작하기 전까지 전송을 보류함.
    await fireEvent(ui.getByLabelText('메시지 입력'), 'pressIn');
    await fireEvent.press(ui.getByLabelText('보내기'));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('');
  });

  it('cancels selection, switches to typing, and disables emoticon sends while loading', async () => {
    const onSendEmoticon = jest.fn();
    const ui = await render(
      <HouseChatScreen messages={[]} onSend={jest.fn()} onSendEmoticon={onSendEmoticon} />,
    );
    await fireEvent.press(ui.getByLabelText('이모티콘 선택'));
    await fireEvent.press(ui.getByLabelText('잘 자 선택'));
    await fireEvent.press(ui.getByLabelText('이모티콘 선택 취소'));
    expect(ui.queryByTestId('chat-emoticon-preview')).toBeNull();
    await fireEvent.press(ui.getByLabelText('고마워 선택'));
    await fireEvent(ui.getByLabelText('메시지 입력'), 'focus');
    expect(ui.queryByTestId('chat-emoticon-picker')).toBeNull();
    expect(ui.queryByTestId('chat-emoticon-preview')).toBeTruthy();
    await fireEvent.changeText(ui.getByLabelText('메시지 입력'), '오늘도 고마워');
    await fireEvent.press(ui.getByLabelText('보내기'));
    expect(onSendEmoticon).toHaveBeenCalledWith('ruyang_thanks', '오늘도 고마워');
    expect(ui.queryByTestId('chat-emoticon-picker')).toBeNull();
    onSendEmoticon.mockClear();
    await ui.rerender(
      <HouseChatScreen key="loading" messages={[]} loading onSendEmoticon={onSendEmoticon} />,
    );
    await fireEvent.press(ui.getByLabelText('이모티콘 선택'));
    expect(ui.queryByTestId('chat-emoticon-picker')).toBeNull();
    expect(onSendEmoticon).not.toHaveBeenCalled();
  });

  it('renders a received emoticon without fallback text, retains reaction/report menus, and falls back for an unknown key', async () => {
    const messages: ChatMessageView[] = [
      {
        key: 's1',
        messageId: 1,
        sequence: 1,
        senderUserId: 2,
        content: '이모티콘을 보냈어요',
        messageType: 'EMOTICON',
        emoticonKey: 'ruyang_like',
        unreadCount: 0,
        status: 'sent',
      },
    ];
    const onReport = jest.fn();
    const ui = await render(
      <HouseChatScreen
        messages={messages}
        myUserId={1}
        onReport={onReport}
        onCopy={jest.fn()}
        onReact={jest.fn()}
      />,
    );
    expect(ui.queryByText('이모티콘을 보냈어요')).toBeNull();
    await fireEvent(ui.getByLabelText('이모티콘: 좋아!'), 'longPress');
    expect(ui.queryByLabelText('복사')).toBeNull();
    await fireEvent.press(ui.getByLabelText('신고'));
    expect(onReport).toHaveBeenCalledWith(1);
    const onCopy = jest.fn();
    await ui.rerender(
      <HouseChatScreen messages={[{ ...messages[0], caption: '같이 힘내요!' }]} onCopy={onCopy} />,
    );
    expect(ui.getByText('같이 힘내요!')).toBeTruthy();
    await fireEvent(ui.getByLabelText('이모티콘: 좋아!'), 'longPress');
    await fireEvent.press(ui.getByLabelText('복사'));
    expect(onCopy).toHaveBeenCalledWith('같이 힘내요!');
    await ui.rerender(
      <HouseChatScreen messages={[{ ...messages[0], emoticonKey: 'future_cat' }]} />,
    );
    expect(ui.getByText('이모티콘을 보냈어요')).toBeTruthy();
  });
});
