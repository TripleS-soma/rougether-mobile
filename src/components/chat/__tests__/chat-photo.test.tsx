import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { onSessionCleared } from '@/api/auth';
import { fetchChatImage } from '@/api/chat-images';
import { ChatPhoto } from '@/components/chat/chat-photo';

jest.mock('@/api/auth', () => ({ onSessionCleared: jest.fn() }));
jest.mock('@/api/chat-images', () => ({ fetchChatImage: jest.fn() }));
let changeState: (state: AppStateStatus) => void;
let logout: () => void;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchChatImage).mockResolvedValue('data:image/jpeg;base64,test');
  jest.mocked(onSessionCleared).mockImplementation((listener) => {
    logout = listener;
    return jest.fn();
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    changeState = listener;
    return { remove: jest.fn() };
  });
});
afterEach(() => jest.restoreAllMocks());

it('배경 진입 시 사진과 확대 창을 숨기고 복귀하면 권한을 다시 확인한다', async () => {
  const ui = await render(<ChatPhoto imageId={1} />);
  await waitFor(() => expect(ui.getByLabelText('사진 크게 보기')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('사진 크게 보기'));
  await act(async () => changeState('background'));
  expect(ui.queryByLabelText('사진 크게 보기')).toBeNull();
  await act(async () => changeState('active'));
  await waitFor(() => expect(fetchChatImage).toHaveBeenCalledTimes(2));
  expect(ui.getByLabelText('사진 크게 보기')).toBeTruthy();
});

it('로그아웃 후 도착한 사진 응답을 화면에 표시하지 않는다', async () => {
  let finish!: (uri: string) => void;
  jest.mocked(fetchChatImage).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const ui = await render(<ChatPhoto imageId={1} />);
  await act(async () => logout());
  await act(async () => finish('data:image/jpeg;base64,old-session'));
  expect(ui.queryByLabelText('사진 크게 보기')).toBeNull();
});

it('조회 실패 뒤 누르면 같은 사진을 다시 조회한다', async () => {
  jest.mocked(fetchChatImage).mockRejectedValueOnce(new Error('offline'));
  const ui = await render(<ChatPhoto imageId={1} />);
  await waitFor(() => expect(ui.getByLabelText('사진 다시 불러오기')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('사진 다시 불러오기'));
  await waitFor(() => expect(ui.getByLabelText('사진 크게 보기')).toBeTruthy());
  expect(fetchChatImage).toHaveBeenCalledTimes(2);
});

it('사진을 누르면 보낸 사람과 보낸 시각이 뜨는 크게 보기가 열리고, 뒤로가기로 닫힌다', async () => {
  const ui = await render(
    <ChatPhoto imageId={1} senderName="김다현" sentLabel="11월 11일 수요일 오후 8:30" />,
  );
  await waitFor(() => expect(ui.getByLabelText('사진 크게 보기')).toBeTruthy());
  expect(ui.queryByTestId('chat-photo-sender')).toBeNull();
  await fireEvent.press(ui.getByLabelText('사진 크게 보기'));
  expect(ui.getByTestId('chat-photo-sender')).toHaveTextContent('김다현');
  expect(ui.getByTestId('chat-photo-sent')).toHaveTextContent('11월 11일 수요일 오후 8:30');
  await fireEvent.press(ui.getByLabelText('닫기'));
  expect(ui.queryByTestId('chat-photo-sender')).toBeNull();
});

it('[피드에 올리기]를 누르면 크게 보기를 닫고 지금 보이는 사진의 주소로 부른다', async () => {
  const onShareToFeed = jest.fn();
  const ui = await render(<ChatPhoto imageId={1} onShareToFeed={onShareToFeed} />);
  await waitFor(() => expect(ui.getByLabelText('사진 크게 보기')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('사진 크게 보기'));
  await fireEvent.press(ui.getByLabelText('피드에 올리기'));
  expect(onShareToFeed).toHaveBeenCalledWith('data:image/jpeg;base64,test');
  // 뷰어가 열린 채 화면이 바뀌면 작성 화면을 덮는다.
  expect(ui.queryByTestId('chat-photo-viewer')).toBeNull();
});

it('넘겨받지 않으면 [피드에 올리기]를 그리지 않는다', async () => {
  const ui = await render(<ChatPhoto imageId={1} />);
  await waitFor(() => expect(ui.getByLabelText('사진 크게 보기')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('사진 크게 보기'));
  expect(ui.getByTestId('chat-photo-viewer')).toBeTruthy();
  expect(ui.queryByLabelText('피드에 올리기')).toBeNull();
});
