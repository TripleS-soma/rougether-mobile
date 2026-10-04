import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { FeedPostScreen } from '@/components/screens/feed-post-screen';
import {
  DEMO_FEED_COMMENTS,
  DEMO_FEED_COMPLETIONS,
  DEMO_FEED_POSTS,
  DEMO_FEED_TEXT_POST,
  DEMO_FEED_TODAY,
} from '@/mocks/fixtures';

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
    expect(other.queryByLabelText('게시물 수정')).toBeNull();

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

  it('게시판 배지를 보이고, 사진 없는 자유글은 사진 자리 없이 본문만 (서버 #428)', async () => {
    const ui = await render(<FeedPostScreen post={DEMO_FEED_TEXT_POST} />);
    expect(ui.getByTestId('feed-board-badge-FREE')).toBeTruthy();
    expect(ui.getByText(/요즘 아침 루틴을 어떻게/)).toBeTruthy();
    expect(ui.queryByLabelText(/^사진 1\//)).toBeNull();

    const verified = await render(<FeedPostScreen post={OTHER_POST} />);
    expect(verified.getByTestId('feed-board-badge-VERIFICATION')).toBeTruthy();
  });

  it('사진 없는 자유글은 인증으로 옮길 수 없고, 본문을 비우면 저장할 수 없다 (서버 #430)', async () => {
    const onEditPost = jest.fn().mockResolvedValue(true);
    const ui = await render(
      <FeedPostScreen post={{ ...DEMO_FEED_TEXT_POST, mine: true }} onEditPost={onEditPost} />,
    );
    await fireEvent.press(ui.getByLabelText('게시물 수정'));
    expect(ui.getByLabelText('인증 게시판').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(ui.getByText('사진이 있는 글만 인증게시판으로 옮길 수 있어요.')).toBeTruthy();

    const input = ui.getByPlaceholderText('본문을 입력하세요');
    await fireEvent.changeText(input, '   ');
    const save = ui.getByRole('button', { name: '저장' });
    expect(save.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.changeText(input, '고친 본문');
    expect(ui.getByRole('button', { name: '저장' }).props.accessibilityState).toMatchObject({
      disabled: false,
    });
    await fireEvent.press(ui.getByRole('button', { name: '저장' }));
    expect(onEditPost).toHaveBeenCalledWith(4, { content: '고친 본문' });
  });

  it('사진 있는 글은 본문을 비워도 저장할 수 있다', async () => {
    const ui = await render(<FeedPostScreen post={MY_POST} onEditPost={() => true} />);
    await fireEvent.press(ui.getByLabelText('게시물 수정'));
    await fireEvent.changeText(
      ui.getByPlaceholderText('본문을 입력하세요 (비워 둘 수 있어요)'),
      '',
    );
    expect(ui.getByRole('button', { name: '저장' }).props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('사진 있는 자유글 → 인증은 루틴을 골라야 저장되고, 게시판·루틴을 함께 보낸다', async () => {
    const onEditPost = jest.fn().mockResolvedValue(true);
    const onEditOpenChange = jest.fn();
    const ui = await render(
      <FeedPostScreen
        post={MY_POST}
        onEditPost={onEditPost}
        onEditOpenChange={onEditOpenChange}
        routinePicker={{ groups: DEMO_FEED_COMPLETIONS, loading: false, error: false }}
        today={DEMO_FEED_TODAY}
      />,
    );
    await fireEvent.press(ui.getByLabelText('게시물 수정'));
    expect(onEditOpenChange).toHaveBeenLastCalledWith(true);
    expect(ui.queryByTestId('feed-routine-picker')).toBeNull();

    await fireEvent.press(ui.getByLabelText('인증 게시판'));
    expect(ui.getByTestId('feed-routine-picker')).toBeTruthy();
    expect(ui.getByText('인증할 루틴을 골라 주세요.')).toBeTruthy();
    expect(ui.getByRole('button', { name: '저장' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.press(ui.getByLabelText('아침 스트레칭, 10/3 완료'));
    await fireEvent.press(ui.getByRole('button', { name: '저장' }));
    expect(onEditPost).toHaveBeenCalledWith(2, {
      content: MY_POST.content,
      boardType: 'VERIFICATION',
      routineCompletion: { routineId: 15, date: '2026-10-03' },
    });
    await waitFor(() => expect(onEditOpenChange).toHaveBeenLastCalledWith(false));
  });

  it('인증글 → 자유는 연결 해제 안내, 요청엔 routineCompletion이 없다', async () => {
    const onEditPost = jest.fn().mockResolvedValue(true);
    const ui = await render(
      <FeedPostScreen post={{ ...OTHER_POST, mine: true }} onEditPost={onEditPost} />,
    );
    await fireEvent.press(ui.getByLabelText('게시물 수정'));
    // 인증으로 남는 동안엔 지금 연결이 보이고, 루틴을 안 바꿔도 저장된다.
    expect(ui.getByText('지금 연결한 루틴')).toBeTruthy();
    expect(ui.getByText('바꾸지 않으면 지금 연결한 루틴이 그대로 남아요.')).toBeTruthy();

    await fireEvent.press(ui.getByLabelText('자유 게시판'));
    expect(ui.getByText('자유게시판으로 옮기면 연결한 루틴이 풀려요.')).toBeTruthy();
    await fireEvent.press(ui.getByRole('button', { name: '저장' }));
    expect(onEditPost).toHaveBeenCalledWith(3, { content: OTHER_POST.content, boardType: 'FREE' });
  });

  it('인증글은 루틴을 바꾸지 않으면 본문만 보낸다', async () => {
    const onEditPost = jest.fn().mockResolvedValue(true);
    const ui = await render(
      <FeedPostScreen post={{ ...OTHER_POST, mine: true }} onEditPost={onEditPost} />,
    );
    await fireEvent.press(ui.getByLabelText('게시물 수정'));
    await fireEvent.press(ui.getByRole('button', { name: '저장' }));
    expect(onEditPost).toHaveBeenCalledWith(3, { content: OTHER_POST.content });
  });

  it('다른 루틴을 골랐다가 되돌리면 창을 닫지 않고 원래 연결로 — 본문만 보낸다', async () => {
    const onEditPost = jest.fn().mockResolvedValue(true);
    const ui = await render(
      <FeedPostScreen
        post={{ ...OTHER_POST, mine: true }}
        onEditPost={onEditPost}
        routinePicker={{ groups: DEMO_FEED_COMPLETIONS, loading: false, error: false }}
        today={DEMO_FEED_TODAY}
      />,
    );
    await fireEvent.press(ui.getByLabelText('게시물 수정'));
    expect(ui.queryByLabelText('원래 연결한 루틴으로 되돌리기')).toBeNull();

    await fireEvent.press(ui.getByLabelText('아침 스트레칭, 10/3 완료'));
    await fireEvent.press(ui.getByLabelText('원래 연결한 루틴으로 되돌리기'));
    expect(ui.queryByLabelText('원래 연결한 루틴으로 되돌리기')).toBeNull();
    expect(ui.getByText('바꾸지 않으면 지금 연결한 루틴이 그대로 남아요.')).toBeTruthy();

    await fireEvent.press(ui.getByRole('button', { name: '저장' }));
    expect(onEditPost).toHaveBeenCalledWith(3, { content: OTHER_POST.content });
  });

  it('연결 루틴이 있는 인증글은 배지를 보인다', async () => {
    const ui = await render(<FeedPostScreen post={OTHER_POST} />);
    expect(ui.getByText('아침 스트레칭 · 9/22 완료')).toBeTruthy();
    const legacy = await render(<FeedPostScreen post={DEMO_FEED_POSTS[2]} />);
    expect(legacy.queryByTestId('feed-routine-badge')).toBeNull();
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
