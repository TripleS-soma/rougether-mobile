import { fireEvent, render } from '@testing-library/react-native';

import {
  FeedMinigameRecordCard,
  feedRecordDraftText,
} from '@/components/feed/feed-minigame-record';
import { FeedPostScreen } from '@/components/screens/feed-post-screen';
import { FeedScreen } from '@/components/screens/feed-screen';
import { DEMO_FEED_RECORD_POST } from '@/mocks/fixtures';

const RECORD = DEMO_FEED_RECORD_POST.minigameRecord!;

describe('미니게임 기록 카드 (서버 feat/feed-minigame-record)', () => {
  it('게임 이름·큰 점수·전체 순위·새 최고 기록 배지를 그린다', async () => {
    const ui = await render(<FeedMinigameRecordCard record={RECORD} />);
    expect(ui.getByText('고양이 탑 쌓기')).toBeTruthy();
    expect(ui.getByText('1,240점')).toBeTruthy();
    expect(ui.getByText('전체 3위')).toBeTruthy();
    expect(ui.getByText('새 최고 기록')).toBeTruthy();
    expect(
      ui.getByLabelText('미니게임 기록: 고양이 탑 쌓기, 1,240점, 전체 3위, 새 최고 기록'),
    ).toBeTruthy();
    // onChallenge가 없으면 버튼도 없다.
    expect(ui.queryByText('나도 도전하기')).toBeNull();
  });

  it('순위가 없으면 순위 줄을, 최고 기록이 아니면 배지를 뺀다', async () => {
    const ui = await render(
      <FeedMinigameRecordCard record={{ ...RECORD, rank: null, personalBest: false }} />,
    );
    expect(ui.getByText('1,240점')).toBeTruthy();
    expect(ui.queryByText(/전체 \d+위/)).toBeNull();
    expect(ui.queryByText('새 최고 기록')).toBeNull();
  });

  it('[나도 도전하기]는 그 게임 코드로 부른다 — 모르는 게임엔 버튼이 없다', async () => {
    const onChallenge = jest.fn();
    const ui = await render(<FeedMinigameRecordCard record={RECORD} onChallenge={onChallenge} />);
    await fireEvent.press(ui.getByLabelText('고양이 탑 쌓기 나도 도전하기'));
    expect(onChallenge).toHaveBeenCalledWith('cat-tower');

    await ui.rerender(
      <FeedMinigameRecordCard
        record={{ ...RECORD, gameCode: 'future-game' }}
        onChallenge={onChallenge}
      />,
    );
    expect(ui.getByText('미니게임')).toBeTruthy();
    expect(ui.queryByText('나도 도전하기')).toBeNull();
  });

  it('작성 화면에서는 ✕로 뺄 수 있다', async () => {
    const onRemove = jest.fn();
    const ui = await render(<FeedMinigameRecordCard record={RECORD} onRemove={onRemove} />);
    await fireEvent.press(ui.getByLabelText('기록 카드 빼기'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('본문 초안은 내 점수·내 순위만 담는다', () => {
    expect(feedRecordDraftText(RECORD)).toBe('🐱 고양이 탑 쌓기 1,240점, 전체 3위 달성!');
    expect(feedRecordDraftText({ ...RECORD, rank: null })).toBe('🐱 고양이 탑 쌓기 1,240점 달성!');
  });

  it('목록은 기록을 작게 요약하고, 상세의 카드에서 도전 버튼이 게임을 연다', async () => {
    const onChallenge = jest.fn();
    const list = await render(<FeedScreen posts={[DEMO_FEED_RECORD_POST]} />);
    // 썸네일 자리의 게임 타일(점수) — 카드·도전 버튼은 목록에 없다.
    // 타일은 장식이라 스크린리더에서 숨긴다(줄 라벨로 읽는다).
    expect(list.getByText('1,240', { includeHiddenElements: true })).toBeTruthy();
    expect(list.queryByText('나도 도전하기')).toBeNull();

    const detail = await render(
      <FeedPostScreen post={DEMO_FEED_RECORD_POST} onChallenge={onChallenge} />,
    );
    expect(detail.getByText('전체 3위')).toBeTruthy();
    await fireEvent.press(detail.getByText('나도 도전하기'));
    expect(onChallenge).toHaveBeenCalledWith('cat-tower');
  });

  it('기록 글은 수정에서 인증게시판으로 옮길 수 없다(사진이 있어도)', async () => {
    const onEditPost = jest.fn().mockResolvedValue(true);
    const ui = await render(
      <FeedPostScreen
        post={{
          ...DEMO_FEED_RECORD_POST,
          mine: true,
          images: [{ imageId: 9, width: 10, height: 10 }],
        }}
        onEditPost={onEditPost}
      />,
    );
    await fireEvent.press(ui.getByLabelText('게시물 수정'));
    expect(ui.getByLabelText('인증 게시판').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(ui.getByText('기록 카드가 있는 글은 자유게시판에만 둘 수 있어요.')).toBeTruthy();
    await fireEvent.press(ui.getByRole('button', { name: '저장' }));
    expect(onEditPost).toHaveBeenCalledWith(5, { content: DEMO_FEED_RECORD_POST.content });
  });
});
