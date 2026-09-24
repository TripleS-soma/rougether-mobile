import { fireEvent, render } from '@testing-library/react-native';

import { FeedScreen } from '@/components/screens/feed-screen';
import { DEMO_FEED_POSTS } from '@/mocks/fixtures';

const NOW = new Date('2026-09-22T03:30:00Z');

describe('FeedScreen (#1409)', () => {
  it('게시물 카드 — 작성자·본문·좋아요/댓글 수, 닉네임 없으면 기본 표기', async () => {
    const { getByText, getAllByText } = await render(
      <FeedScreen posts={DEMO_FEED_POSTS} now={NOW} />,
    );
    expect(getByText('피드')).toBeTruthy();
    expect(getByText('루틴친구')).toBeTruthy();
    expect(getByText(/오늘 아침 루틴 완료/)).toBeTruthy();
    expect(getByText('좋아요 3')).toBeTruthy();
    expect(getByText('댓글 2')).toBeTruthy();
    // 사진 2장 — 첫 장만 보이고 나머지 장수 배지.
    expect(getByText('+1')).toBeTruthy();
    expect(getByText('30분 전')).toBeTruthy();
    // 닉네임 null(탈퇴 직후 등) → 앱 기본 표기.
    expect(getAllByText('알 수 없는 사용자').length).toBeGreaterThan(0);
  });

  it('좋아요를 누르면 그 글 id로 토글을 부른다 — 이미 누른 글은 취소 라벨', async () => {
    const onToggleLike = jest.fn();
    const { getAllByLabelText, getByLabelText } = await render(
      <FeedScreen posts={DEMO_FEED_POSTS} onToggleLike={onToggleLike} />,
    );
    await fireEvent.press(getAllByLabelText('좋아요')[0]);
    expect(onToggleLike).toHaveBeenCalledWith(3);
    await fireEvent.press(getByLabelText('좋아요 취소'));
    expect(onToggleLike).toHaveBeenCalledWith(2);
  });

  it('카드를 누르면 상세, + 버튼은 작성', async () => {
    const onOpenPost = jest.fn();
    const onCompose = jest.fn();
    const { getByLabelText } = await render(
      <FeedScreen posts={DEMO_FEED_POSTS} onOpenPost={onOpenPost} onCompose={onCompose} />,
    );
    await fireEvent.press(getByLabelText('루틴친구의 게시물 보기'));
    expect(onOpenPost).toHaveBeenCalledWith(3);
    await fireEvent.press(getByLabelText('게시물 쓰기'));
    expect(onCompose).toHaveBeenCalled();
  });

  it('목록 끝에 닿으면 다음 페이지 — 다음이 없으면 부르지 않는다', async () => {
    const onLoadMore = jest.fn();
    const ui = await render(<FeedScreen posts={DEMO_FEED_POSTS} hasNext onLoadMore={onLoadMore} />);
    await scrollToEnd(ui.getByTestId('feed-list'));
    expect(onLoadMore).toHaveBeenCalled();

    onLoadMore.mockClear();
    await ui.rerender(
      <FeedScreen posts={DEMO_FEED_POSTS} hasNext={false} onLoadMore={onLoadMore} />,
    );
    await scrollToEnd(ui.getByTestId('feed-list'));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('첫 페이지 실패는 빈 상태가 아니라 재시도, 비었으면 안내', async () => {
    const onRetry = jest.fn();
    const { getByText, rerender } = await render(<FeedScreen loadError onRetry={onRetry} />);
    expect(getByText('피드를 불러오지 못했어요.')).toBeTruthy();
    await fireEvent.press(getByText('다시 시도'));
    expect(onRetry).toHaveBeenCalled();

    await rerender(<FeedScreen posts={[]} />);
    expect(getByText(/아직 게시물이 없어요/)).toBeTruthy();
  });
});

/** 목록을 끝까지 내린 스크롤 이벤트 — VirtualizedList가 onEndReached를 판단한다. */
async function scrollToEnd(list: Parameters<typeof fireEvent.scroll>[0]) {
  await fireEvent(list, 'layout', { nativeEvent: { layout: { width: 390, height: 600 } } });
  await fireEvent(list, 'contentSizeChange', 390, 2000);
  await fireEvent.scroll(list, {
    nativeEvent: {
      contentOffset: { x: 0, y: 1400 },
      contentSize: { width: 390, height: 2000 },
      layoutMeasurement: { width: 390, height: 600 },
    },
  });
}
