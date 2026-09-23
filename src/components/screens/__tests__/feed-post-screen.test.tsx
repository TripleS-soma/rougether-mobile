import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { FeedPostScreen } from '@/components/screens/feed-post-screen';
import { DEMO_FEED_COMMENTS, DEMO_FEED_POSTS } from '@/mocks/fixtures';

const [OTHER_POST, MY_POST] = DEMO_FEED_POSTS;

describe('FeedPostScreen (#1409)', () => {
  it('본문·댓글을 그리고, 내 댓글에만 삭제가 있다', async () => {
    const { getByText, getAllByLabelText } = await render(
      <FeedPostScreen post={OTHER_POST} comments={DEMO_FEED_COMMENTS} onDeleteComment={() => {}} />,
    );
    expect(getByText(/오늘 아침 루틴 완료/)).toBeTruthy();
    expect(getByText('멋져요! 저도 내일부터 스트레칭 해볼게요.')).toBeTruthy();
    expect(getByText('같이 해요 🙌')).toBeTruthy();
    expect(getAllByLabelText('내 댓글 삭제')).toHaveLength(1);
  });

  it('댓글은 앞뒤 공백을 떼고 보내며, 성공하면 입력칸을 비운다', async () => {
    const onAddComment = jest.fn().mockResolvedValue(true);
    const { getByLabelText } = await render(
      <FeedPostScreen post={OTHER_POST} comments={[]} onAddComment={onAddComment} />,
    );
    const input = getByLabelText('댓글 입력');
    await fireEvent.changeText(input, '  반가워요  ');
    await fireEvent.press(getByLabelText('보내기'));
    expect(onAddComment).toHaveBeenCalledWith('반가워요');
    await waitFor(() => expect(getByLabelText('댓글 입력').props.value).toBe(''));
  });

  it('공백뿐인 댓글은 보내지 않는다', async () => {
    const onAddComment = jest.fn();
    const { getByLabelText } = await render(
      <FeedPostScreen post={OTHER_POST} onAddComment={onAddComment} />,
    );
    await fireEvent.changeText(getByLabelText('댓글 입력'), '   ');
    await fireEvent.press(getByLabelText('보내기'));
    expect(onAddComment).not.toHaveBeenCalled();
  });

  it('내 댓글 삭제는 확인을 거쳐 그 댓글 id로', async () => {
    const onDeleteComment = jest.fn();
    const { getByLabelText, getByText, getAllByText } = await render(
      <FeedPostScreen
        post={OTHER_POST}
        comments={DEMO_FEED_COMMENTS}
        onDeleteComment={onDeleteComment}
      />,
    );
    await fireEvent.press(getByLabelText('내 댓글 삭제'));
    expect(getByText('댓글을 삭제할까요?')).toBeTruthy();
    expect(onDeleteComment).not.toHaveBeenCalled();
    // 행의 '삭제'와 다이얼로그 확정 버튼 — 확정은 마지막에 그려진다.
    const confirm = getAllByText('삭제');
    await fireEvent.press(confirm[confirm.length - 1]);
    expect(onDeleteComment).toHaveBeenCalledWith(302);
  });

  it('내 글만 헤더에 수정·삭제 — 삭제는 확인 다이얼로그 뒤', async () => {
    const onDeletePost = jest.fn();
    const other = await render(
      <FeedPostScreen post={OTHER_POST} onDeletePost={onDeletePost} onEditPost={() => true} />,
    );
    expect(other.queryByLabelText('게시물 삭제')).toBeNull();
    expect(other.queryByLabelText('게시물 본문 수정')).toBeNull();

    const mine = await render(
      <FeedPostScreen post={MY_POST} onDeletePost={onDeletePost} onEditPost={() => true} />,
    );
    await fireEvent.press(mine.getAllByLabelText('게시물 삭제')[0]);
    expect(mine.getByText('게시물을 삭제할까요?')).toBeTruthy();
    expect(onDeletePost).not.toHaveBeenCalled();
    // 다이얼로그의 확정 버튼(같은 접근성 라벨의 두 번째).
    const buttons = mine.getAllByLabelText('게시물 삭제');
    await fireEvent.press(buttons[buttons.length - 1]);
    expect(onDeletePost).toHaveBeenCalledWith(2);
  });

  it('사라진 글(404)은 삭제 안내만', async () => {
    const { getByText } = await render(<FeedPostScreen post={null} notFound />);
    expect(getByText('삭제되었거나 볼 수 없는 게시물이에요.')).toBeTruthy();
  });
});
