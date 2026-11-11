import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FeedbackPage } from '@/components/app/feedback-page';
import { fetchSuggestions, fetchUpdates, submitSuggestion } from '@/api/feedback';
import { queryWrapper } from '@/test-utils/query-wrapper';
jest.mock('@/api/auth', () => ({ getSessionUserId: () => 17 }));
jest.mock('@/api/feedback', () => ({
  fetchSuggestions: jest.fn(),
  fetchUpdates: jest.fn(),
  submitSuggestion: jest.fn(),
}));
const entry = { id: 3, title: '건의 제목', content: '내용', createdAt: '2026-11-11T11:00:00Z' };

it('제출 뒤 내 건의 목록을 다시 읽는다', async () => {
  jest
    .mocked(fetchSuggestions)
    .mockResolvedValueOnce({ items: [], nextCursor: null })
    .mockResolvedValue({ items: [entry], nextCursor: null });
  jest.mocked(submitSuggestion).mockResolvedValue(entry);
  const ui = await render(<FeedbackPage kind="suggestions" onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await waitFor(() => expect(ui.getByText('아직 보낸 건의가 없어요.')).toBeTruthy());
  await fireEvent.changeText(ui.getByLabelText('제목'), '건의 제목');
  await fireEvent.changeText(ui.getByLabelText('건의 내용'), '내용');
  await fireEvent.press(ui.getByLabelText('건의 보내기'));
  await waitFor(() => expect(ui.getByText('건의 제목')).toBeTruthy());
  expect(submitSuggestion).toHaveBeenCalledWith(
    { title: '건의 제목', content: '내용' },
    expect.anything(),
  );
  expect(fetchSuggestions).toHaveBeenCalledTimes(2);
});

it('업데이트 다음 커서를 사용해 이전 글을 불러온다', async () => {
  jest
    .mocked(fetchUpdates)
    .mockResolvedValueOnce({ items: [entry], nextCursor: 3 })
    .mockResolvedValueOnce({ items: [{ ...entry, id: 2, title: '이전 글' }], nextCursor: null });
  const ui = await render(<FeedbackPage kind="updates" onBack={jest.fn()} />, {
    wrapper: queryWrapper(),
  });
  await waitFor(() => expect(ui.getByLabelText('더 보기')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('더 보기'));
  await waitFor(() => expect(ui.getByText('이전 글')).toBeTruthy());
  expect(fetchUpdates).toHaveBeenLastCalledWith(3);
  expect(ui.queryByLabelText('더 보기')).toBeNull();
});
