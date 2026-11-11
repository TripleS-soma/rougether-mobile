import { act, fireEvent, render } from '@testing-library/react-native';

import { HouseChatPage } from '@/components/app/house-chat-page';
import { pickChatPhoto } from '@/lib/pick-chat-photo';
import { queryWrapper } from '@/test-utils/query-wrapper';

const mockSendPhoto = jest.fn();
jest.mock('@/hooks/use-house-chat', () => ({
  useHouseChat: () => ({ messages: [], myUserId: 1, roomId: 5, sendPhoto: mockSendPhoto }),
}));
jest.mock('@/hooks/use-chat-mute', () => ({ useChatMute: () => ({ loaded: false }) }));
jest.mock('@/lib/pick-chat-photo', () => ({ pickChatPhoto: jest.fn() }));
jest.mock('@/lib/push-events', () => ({ setForegroundPushFilter: jest.fn() }));

const selected = {
  uri: 'file:///chosen.jpg',
  name: 'chosen.jpg',
  type: 'image/jpeg',
  width: 400,
  height: 300,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(pickChatPhoto).mockResolvedValue(selected);
});

it('사진 선택은 미리보기만 열고 보내기를 연속 눌러도 한 번만 전송한다', async () => {
  const ui = await render(<HouseChatPage houseId={1} onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await fireEvent.press(ui.getByLabelText('사진 선택'));
  expect(mockSendPhoto).not.toHaveBeenCalled();
  const send = ui.getByRole('button', { name: '사진 보내기' });
  // 같은 렌더의 콜백을 연속 호출해 React가 상태를 반영하기 전 두 탭을 재현한다.
  let fiber = send.unstable_fiber;
  while (fiber && typeof fiber.memoizedProps?.onPress !== 'function') fiber = fiber.return;
  const onPress = fiber?.memoizedProps.onPress;
  expect(onPress).toEqual(expect.any(Function));
  await act(async () => {
    onPress();
    onPress();
  });
  expect(mockSendPhoto).toHaveBeenCalledTimes(1);
  expect(mockSendPhoto).toHaveBeenCalledWith(selected);
});

it('미리보기를 취소하면 전송하지 않는다', async () => {
  const ui = await render(<HouseChatPage houseId={1} onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await fireEvent.press(ui.getByLabelText('사진 선택'));
  await fireEvent.press(ui.getByRole('button', { name: '취소' }));
  expect(ui.queryByRole('button', { name: '사진 보내기' })).toBeNull();
  expect(mockSendPhoto).not.toHaveBeenCalled();
});

it('앨범을 연 상태에서 집이 바뀌면 이전 집의 선택 결과를 폐기한다', async () => {
  let finish!: (value: typeof selected) => void;
  jest.mocked(pickChatPhoto).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const ui = await render(<HouseChatPage houseId={1} onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await fireEvent.press(ui.getByLabelText('사진 선택'));
  await ui.rerender(<HouseChatPage houseId={2} onBack={jest.fn()} />);
  await act(async () => finish(selected));
  expect(ui.queryByRole('button', { name: '사진 보내기' })).toBeNull();
  expect(mockSendPhoto).not.toHaveBeenCalled();
});
