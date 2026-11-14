import { act, fireEvent, render } from '@testing-library/react-native';
import { FeedbackScreen } from '@/components/screens/feedback-screen';

it('전송 실패 시 내용을 보존하고 성공한 뒤에만 비운다', async () => {
  const onSubmit = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(undefined);
  const ui = await render(<FeedbackScreen kind="suggestions" onSubmit={onSubmit} />);
  await fireEvent.changeText(ui.getByLabelText('제목'), '  원하는 기능  ');
  await fireEvent.changeText(ui.getByLabelText('건의 내용'), '  이렇게 바뀌면 좋겠어요  ');
  await fireEvent.press(ui.getByLabelText('건의 보내기'));
  expect(ui.getByText('건의를 보내지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
  expect(ui.getByLabelText('건의 내용').props.value).toBe('  이렇게 바뀌면 좋겠어요  ');
  await fireEvent.press(ui.getByLabelText('건의 보내기'));
  expect(onSubmit).toHaveBeenLastCalledWith({
    title: '원하는 기능',
    content: '이렇게 바뀌면 좋겠어요',
  });
  expect(ui.getByLabelText('건의 내용').props.value).toBe('');
  expect(ui.getByText('건의를 보냈어요. 고마워요!')).toBeTruthy();
});

it('전송 중 중복 탭은 제출을 한 번만 수행한다', async () => {
  let finish!: () => void;
  const onSubmit = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const ui = await render(<FeedbackScreen kind="suggestions" onSubmit={onSubmit} />);
  await fireEvent.changeText(ui.getByLabelText('제목'), '제목');
  await fireEvent.changeText(ui.getByLabelText('건의 내용'), '내용');
  await fireEvent.press(ui.getByLabelText('건의 보내기'));
  await fireEvent.press(ui.getByLabelText('보내는 중…'));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  await act(async () => finish());
});

it('업데이트는 본문과 한국 날짜를 표시하고 작성 폼은 없다', async () => {
  const ui = await render(
    <FeedbackScreen
      kind="updates"
      entries={[
        {
          id: 1,
          title: '새 기능',
          content: '여러 줄\n업데이트 내용',
          createdAt: '2026-11-10T16:00:00Z',
        },
      ]}
    />,
  );
  expect(ui.getByText('2026.11.11')).toBeTruthy();
  expect(ui.getByText('여러 줄\n업데이트 내용')).toBeTruthy();
  expect(ui.queryByLabelText('건의 내용')).toBeNull();
});

it('조회 오류를 빈 목록으로 위장하지 않고 재시도와 더 보기를 제공한다', async () => {
  const retry = jest.fn();
  const more = jest.fn();
  const ui = await render(
    <FeedbackScreen kind="updates" error onRetry={retry} hasMore onMore={more} />,
  );
  expect(ui.queryByText('아직 등록된 업데이트가 없어요.')).toBeNull();
  await fireEvent.press(ui.getByLabelText('다시 시도'));
  await fireEvent.press(ui.getByLabelText('더 보기'));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(more).toHaveBeenCalledTimes(1);
});
