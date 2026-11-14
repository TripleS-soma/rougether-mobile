import { act, fireEvent, render } from '@testing-library/react-native';

import { HouseChatPage } from '@/components/app/house-chat-page';
import { pickChatPhotos } from '@/lib/pick-chat-photo';
import { dismissChatPushes } from '@/lib/push-events';
import { queryWrapper } from '@/test-utils/query-wrapper';

const mockSend = jest.fn();
const mockSendPhotos = jest.fn();
jest.mock('@/hooks/use-house-chat', () => ({
  useHouseChat: () => ({
    messages: [],
    myUserId: 1,
    roomId: 5,
    send: mockSend,
    sendPhotos: mockSendPhotos,
    react: jest.fn(),
  }),
}));
jest.mock('@/hooks/use-chat-mute', () => ({ useChatMute: () => ({ loaded: false }) }));
// 이 집 알림 시트(집 피드)는 전용 테스트가 맡는다 — 여기서는 사진 흐름만 본다.
jest.mock('@/components/app/use-house-notifications', () => ({
  useHouseNotifications: () => ({
    open: jest.fn(),
    close: jest.fn(),
    allMuted: false,
    sheet: null,
  }),
}));
jest.mock('@/lib/pick-chat-photo', () => ({
  ...jest.requireActual('@/lib/pick-chat-photo'),
  pickChatPhotos: jest.fn(),
}));
jest.mock('@/lib/push-events', () => ({
  setForegroundPushFilter: jest.fn(),
  dismissChatPushes: jest.fn(async () => {}),
}));

const photo = (name: string, extra: object = {}) => ({
  uri: `file:///${name}`,
  name,
  type: 'image/jpeg',
  width: 400,
  height: 300,
  ...extra,
});
const first = photo('first.jpg');
const second = photo('second.jpg');
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(pickChatPhotos).mockResolvedValue([first, second]);
});

it('고른 사진은 입력줄 위에 담기기만 하고, 보내기를 연속 눌러도 메시지 하나로 한 번만 나간다', async () => {
  const ui = await render(<HouseChatPage houseId={1} onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await fireEvent.press(ui.getByLabelText('사진 선택'));
  expect(pickChatPhotos).toHaveBeenCalledWith(10);
  expect(mockSendPhotos).not.toHaveBeenCalled();
  expect(ui.getByLabelText('2번째 사진 자르기')).toBeTruthy();
  await fireEvent.changeText(ui.getByLabelText('메시지 입력'), '어제 산책');
  const send = ui.getByLabelText('보내기');
  // 같은 렌더의 콜백을 연속 호출해 React가 상태를 반영하기 전 두 탭을 재현한다.
  let fiber = send.unstable_fiber;
  while (fiber && typeof fiber.memoizedProps?.onPress !== 'function') fiber = fiber.return;
  const onPress = fiber?.memoizedProps.onPress;
  expect(onPress).toEqual(expect.any(Function));
  await act(async () => {
    onPress();
    onPress();
  });
  expect(mockSendPhotos).toHaveBeenCalledTimes(1);
  expect(mockSendPhotos).toHaveBeenCalledWith([first, second], '어제 산책');
  // 두 번째 탭이 같은 글을 글 메시지로 한 번 더 보내지 않는다.
  expect(mockSend).not.toHaveBeenCalledWith('어제 산책');
  expect(ui.queryByLabelText('1번째 사진 자르기')).toBeNull();
});

it('담은 사진을 빼면 남은 사진만 보낸다', async () => {
  const ui = await render(<HouseChatPage houseId={1} onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await fireEvent.press(ui.getByLabelText('사진 선택'));
  await fireEvent.press(ui.getByLabelText('1번째 사진 빼기'));
  await fireEvent.press(ui.getByLabelText('보내기'));
  expect(mockSendPhotos).toHaveBeenCalledWith([second], '');
});

it('더 고를 때는 남은 자리만큼만 고르게 하고, 보낼 수 없는 사진은 빼고 담는다', async () => {
  jest
    .mocked(pickChatPhotos)
    .mockResolvedValueOnce([first, second])
    .mockResolvedValueOnce([photo('big.jpg', { fileSize: 10 * 1024 * 1024 + 1 }), photo('ok.jpg')]);
  const ui = await render(<HouseChatPage houseId={1} onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await fireEvent.press(ui.getByLabelText('사진 선택'));
  await fireEvent.press(ui.getByLabelText('사진 선택'));
  expect(pickChatPhotos).toHaveBeenLastCalledWith(8);
  expect(ui.getByLabelText('3번째 사진 자르기')).toBeTruthy();
  expect(ui.queryByLabelText('4번째 사진 자르기')).toBeNull();
});

it('자르기에서 정한 영역은 그 사진에만 실려 나간다', async () => {
  const ui = await render(<HouseChatPage houseId={1} onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await fireEvent.press(ui.getByLabelText('사진 선택'));
  await fireEvent.press(ui.getByLabelText('2번째 사진 자르기'));
  // 4:3 사진을 1:1로 — 가운데 3/4 폭.
  await fireEvent.press(ui.getByLabelText('1:1 비율로 자르기'));
  await fireEvent.press(ui.getByText('완료'));
  await fireEvent.press(ui.getByLabelText('보내기'));
  expect(mockSendPhotos).toHaveBeenCalledWith(
    [first, { ...second, crop: { x: 0.125, y: 0, width: 0.75, height: 1 } }],
    '',
  );
});

it('자르기를 취소하면 사진은 그대로다', async () => {
  const ui = await render(<HouseChatPage houseId={1} onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await fireEvent.press(ui.getByLabelText('사진 선택'));
  await fireEvent.press(ui.getByLabelText('1번째 사진 자르기'));
  await fireEvent.press(ui.getByLabelText('1:1 비율로 자르기'));
  await fireEvent.press(ui.getByText('취소'));
  await fireEvent.press(ui.getByLabelText('보내기'));
  expect(mockSendPhotos).toHaveBeenCalledWith([first, second], '');
});

it('사진이 없으면 글만 보낸다', async () => {
  const ui = await render(<HouseChatPage houseId={1} onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await fireEvent.changeText(ui.getByLabelText('메시지 입력'), '안녕');
  await fireEvent.press(ui.getByLabelText('보내기'));
  expect(mockSend).toHaveBeenCalledWith('안녕');
  expect(mockSendPhotos).not.toHaveBeenCalled();
});

it('앨범을 연 상태에서 집이 바뀌면 이전 집의 선택 결과를 폐기한다', async () => {
  let finish!: (value: (typeof first)[]) => void;
  jest.mocked(pickChatPhotos).mockImplementation(
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
  await act(async () => finish([first]));
  expect(ui.queryByLabelText('1번째 사진 자르기')).toBeNull();
  expect(mockSendPhotos).not.toHaveBeenCalled();
});

it('채팅을 열면 그 집의 채팅 알림을 트레이에서 지운다 (#1746)', async () => {
  await render(<HouseChatPage houseId={20} onBack={jest.fn()} />, { wrapper: queryWrapper() });
  expect(dismissChatPushes).toHaveBeenCalledWith(20);
});
