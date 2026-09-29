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

  describe('신고·차단 (#1428)', () => {
    const moderation = () => ({
      onReportPost: jest.fn().mockResolvedValue(true),
      onReportComment: jest.fn().mockResolvedValue(true),
      onBlockUser: jest.fn(),
    });

    it('남의 글에는 더보기(수정·삭제 없음)', async () => {
      const handlers = moderation();
      const other = await render(
        <FeedPostScreen
          post={OTHER_POST}
          onEditPost={() => true}
          onDeletePost={() => {}}
          {...handlers}
        />,
      );
      expect(other.getByLabelText('게시물 더보기')).toBeTruthy();
      expect(other.queryByLabelText('게시물 삭제')).toBeNull();
    });

    it('내 글에는 더보기가 없다', async () => {
      const handlers = moderation();
      const mine = await render(
        <FeedPostScreen
          post={MY_POST}
          onEditPost={() => true}
          onDeletePost={() => {}}
          {...handlers}
        />,
      );
      expect(mine.queryByLabelText('게시물 더보기')).toBeNull();
      expect(mine.getByText('수정')).toBeTruthy();
    });

    it('댓글 더보기는 남의 댓글에만', async () => {
      const { getAllByLabelText } = await render(
        <FeedPostScreen post={OTHER_POST} comments={DEMO_FEED_COMMENTS} {...moderation()} />,
      );
      // 301(이웃) 한 개 — 302는 내 댓글.
      expect(getAllByLabelText('댓글 더보기')).toHaveLength(1);
    });

    it('콜백이 없으면 더보기도 없다', async () => {
      const { queryByLabelText } = await render(
        <FeedPostScreen post={OTHER_POST} comments={DEMO_FEED_COMMENTS} />,
      );
      expect(queryByLabelText('게시물 더보기')).toBeNull();
      expect(queryByLabelText('댓글 더보기')).toBeNull();
    });

    it('글 신고: 메뉴 → 사유 → 신고하기가 글 id로', async () => {
      const handlers = moderation();
      const { getByLabelText, findByLabelText } = await render(
        <FeedPostScreen post={OTHER_POST} {...handlers} />,
      );
      await fireEvent.press(getByLabelText('게시물 더보기'));
      await fireEvent.press(await findByLabelText('신고하기'));
      await fireEvent.press(await findByLabelText('스팸·광고'));
      await fireEvent.press(getByLabelText('신고하기'));
      await waitFor(() =>
        expect(handlers.onReportPost).toHaveBeenCalledWith(OTHER_POST.postId, 'SPAM', undefined),
      );
    });

    it('댓글 신고는 글 id·댓글 id로', async () => {
      const handlers = moderation();
      const { getByLabelText, findByLabelText } = await render(
        <FeedPostScreen post={OTHER_POST} comments={DEMO_FEED_COMMENTS} {...handlers} />,
      );
      await fireEvent.press(getByLabelText('댓글 더보기'));
      await fireEvent.press(await findByLabelText('신고하기'));
      await fireEvent.press(await findByLabelText('저작권 침해'));
      await fireEvent.press(getByLabelText('신고하기'));
      await waitFor(() =>
        expect(handlers.onReportComment).toHaveBeenCalledWith(
          OTHER_POST.postId,
          301,
          'COPYRIGHT',
          undefined,
        ),
      );
    });

    it('차단은 확인 다이얼로그 뒤에 작성자 id로', async () => {
      const handlers = moderation();
      const { getByLabelText, findByLabelText, findByText } = await render(
        <FeedPostScreen post={OTHER_POST} {...handlers} />,
      );
      await fireEvent.press(getByLabelText('게시물 더보기'));
      await fireEvent.press(await findByLabelText('이 사용자 차단'));
      expect(
        await findByText(
          '차단하면 이 사용자의 게시물과 댓글이 보이지 않아요. 설정에서 언제든 해제할 수 있어요.',
        ),
      ).toBeTruthy();
      expect(handlers.onBlockUser).not.toHaveBeenCalled();
      await fireEvent.press(getByLabelText('사용자 차단 확인'));
      expect(handlers.onBlockUser).toHaveBeenCalledWith(OTHER_POST.author.userId, 'post');
    });
  });
});
