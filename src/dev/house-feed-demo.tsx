import { useState } from 'react';
import { View } from 'react-native';

import {
  HouseNotificationBell,
  // 갤러리는 셸 배선 없이 종 버튼 모양만 빌려 쓴다.
} from '@/components/app/use-house-notifications';
import { FeedComposeScreen } from '@/components/screens/feed-compose-screen';
import { FeedPostScreen } from '@/components/screens/feed-post-screen';
import { FeedScreen } from '@/components/screens/feed-screen';
import type {
  FeedBoardFilter,
  FeedBoardType,
  FeedComment,
  FeedPost,
  FeedRoutineCompletion,
} from '@/components/screens/feed/types';
import {
  type HouseFeedPushField,
  HouseNotificationSheet,
} from '@/components/screens/house/house-notification-sheet';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { Button } from '@/components/ui/button';
import { DEMO_FEED_COMMENTS, DEMO_FEED_COMPLETIONS, DEMO_FEED_TODAY } from '@/mocks/fixtures';

/** 갤러리 기준 시각 — 상대 시각("30분 전")이 기기 날짜와 무관하게 같게 나온다. */
const NOW = new Date('2026-11-11T00:30:00Z');
const HOUSE_NAME = '아침을 여는 집';
const HOUSE_BOARDS: readonly FeedBoardFilter[] = ['ALL', 'FREE', 'VERIFICATION'];
const HOUSES = [
  { houseId: 3, name: HOUSE_NAME },
  { houseId: 8, name: '밤 산책 모임' },
];
const PICKER = { groups: DEMO_FEED_COMPLETIONS, loading: false, error: false };

const author = (userId: number, nickname: string) => ({ userId, nickname, profileImageKey: null });
const post = (p: Partial<FeedPost> & Pick<FeedPost, 'postId' | 'author'>): FeedPost => ({
  boardType: 'FREE',
  content: '',
  routine: null,
  images: [],
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  mine: false,
  houseId: 3,
  createdAt: '2026-11-11T00:00:00Z',
  updatedAt: '2026-11-11T00:00:00Z',
  ...p,
});

/** 집 피드 픽스처 — 방장은 모카(userId 4). 실제 회원 글이 아니다. */
const HOUSE_POSTS: FeedPost[] = [
  post({
    postId: 904,
    author: author(7, '솜이'),
    content: '주말에 다 같이 아침 산책 어때? 토요일 8시에 공원 입구에서 만나면 좋겠어',
    images: [
      { imageId: 41, width: 1200, height: 1200 },
      { imageId: 42, width: 1200, height: 1200 },
    ],
    likeCount: 2,
    commentCount: 3,
    likedByMe: true,
    createdAt: '2026-11-11T00:18:00Z',
  }),
  post({
    postId: 903,
    author: author(9, '도토리'),
    boardType: 'VERIFICATION',
    content: '오늘도 10분 스트레칭 완료. 어깨가 한결 가벼워졌어',
    routine: { routineId: 15, title: '아침 스트레칭', date: '2026-11-11' },
    images: [{ imageId: 43, width: 1200, height: 900 }],
    likeCount: 3,
    commentCount: 2,
    createdAt: '2026-11-11T00:05:00Z',
  }),
  post({
    postId: 902,
    author: author(4, '모카'),
    content: '이번 주 집 목표 벌써 반 넘었네. 다들 고마워, 조금만 더 힘내자!',
    likeCount: 4,
    mine: true,
    createdAt: '2026-11-10T23:30:00Z',
  }),
  post({
    postId: 901,
    author: author(11, '구름'),
    boardType: 'VERIFICATION',
    routine: { routineId: 16, title: '물 2L 마시기', date: '2026-11-10' },
    createdAt: '2026-11-10T09:00:00Z',
  }),
];

/** 집 피드 목록 — 작성자를 앞세운 줄, 전체·자유·인증 탭, 종 버튼으로 "이 집 알림" 시트. */
export function HouseFeedListDemo({ empty = false }: { empty?: boolean }) {
  const [board, setBoard] = useState<FeedBoardFilter>(empty ? 'VERIFICATION' : 'ALL');
  const [sheet, setSheet] = useState(false);
  const [chat, setChat] = useState(true);
  const [push, setPush] = useState({ freePostPush: true, verificationPostPush: false });
  const posts = empty
    ? []
    : board === 'ALL'
      ? HOUSE_POSTS
      : HOUSE_POSTS.filter((p) => p.boardType === board);
  const allMuted = !chat && !push.freePostPush && !push.verificationPostPush;
  return (
    <View style={{ height: 760, alignSelf: 'stretch' }}>
      <FeedScreen
        title={`${HOUSE_NAME} 피드`}
        onBack={() => {}}
        headerRight={<HouseNotificationBell muted={allMuted} onPress={() => setSheet(true)} />}
        boardOptions={HOUSE_BOARDS}
        scopeNote="이 집 구성원만 볼 수 있어요"
        emptyMessages={{
          ALL: '아직 우리 집에 올라온 글이 없어요.\n첫 글을 올려 보세요!',
          FREE: '아직 자유글이 없어요.\n첫 이야기를 남겨 보세요!',
          VERIFICATION: '아직 인증글이 없어요.\n오늘 완료한 루틴을 인증해 보세요!',
        }}
        authorFirst
        ownerUserId={4}
        posts={posts}
        board={board}
        onChangeBoard={setBoard}
        onCompose={() => {}}
        now={NOW}
      />
      <HouseNotificationSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        chat={{ on: chat, onToggle: () => setChat((v) => !v) }}
        feed={{
          state: 'ready',
          ...push,
          onToggle: (field: HouseFeedPushField) => setPush((v) => ({ ...v, [field]: !v[field] })),
        }}
      />
    </View>
  );
}

/**
 * 글쓰기의 올릴 곳 — `locked`면 집 피드에서 연 작성(그 집으로 고정), 아니면 공개 피드에서 연
 * 작성(전체 공개 ↔ 내 집 선택, 기본 전체 공개).
 */
export function HouseFeedComposeDemo({ locked = false }: { locked?: boolean }) {
  const [board, setBoard] = useState<FeedBoardType>('FREE');
  const [content, setContent] = useState('');
  const [routine, setRoutine] = useState<FeedRoutineCompletion | null>(null);
  const [houseId, setHouseId] = useState<number | null>(locked ? 3 : null);
  return (
    <View style={{ height: 760, alignSelf: 'stretch' }}>
      <FeedComposeScreen
        scope={
          locked
            ? { houseId: 3, houses: [HOUSES[0]], locked: true }
            : { houseId, houses: HOUSES, onChange: setHouseId }
        }
        board={board}
        onChangeBoard={setBoard}
        routine={routine}
        onChangeRoutine={setRoutine}
        routinePicker={PICKER}
        today={DEMO_FEED_TODAY}
        content={content}
        onChangeContent={setContent}
        onSubmit={() => {}}
        onBack={() => {}}
      />
    </View>
  );
}

/** 방장이 보는 남의 글 — 더보기에 게시물 삭제·신고·차단, 남의 댓글에도 댓글 삭제. */
export function HouseFeedOwnerPostDemo({ owner = true }: { owner?: boolean }) {
  const comments: FeedComment[] = DEMO_FEED_COMMENTS.map((c) => ({
    ...c,
    postId: 903,
    deletable: owner && !c.mine,
  }));
  return (
    <View style={{ height: 760, alignSelf: 'stretch' }}>
      <FeedPostScreen
        post={{ ...HOUSE_POSTS[1], deletable: owner }}
        comments={comments}
        onAddComment={() => true}
        onDeleteComment={() => {}}
        onDeletePost={() => {}}
        onReportPost={() => true}
        onReportComment={() => true}
        onBlockUser={() => {}}
        onBack={() => {}}
        now={NOW}
      />
    </View>
  );
}

/** "이 집 알림" 시트 — 준비됨 / 서버 준비 중(글 알림 두 줄 잠김) 두 상태. */
export function HouseNotificationSheetDemo() {
  const [open, setOpen] = useState<'ready' | 'unavailable' | null>(null);
  const [chat, setChat] = useState(true);
  const [push, setPush] = useState({ freePostPush: true, verificationPostPush: false });
  return (
    <View style={{ gap: 8 }}>
      <Button label="이 집 알림 열기" onPress={() => setOpen('ready')} />
      <Button
        label="서버 준비 중 상태로 열기"
        variant="secondary"
        onPress={() => setOpen('unavailable')}
      />
      <HouseNotificationSheet
        visible={open !== null}
        onClose={() => setOpen(null)}
        chat={{ on: chat, onToggle: () => setChat((v) => !v) }}
        feed={{
          state: open === 'unavailable' ? 'unavailable' : 'ready',
          ...push,
          onToggle: (field) => setPush((v) => ({ ...v, [field]: !v[field] })),
        }}
      />
    </View>
  );
}

const RAIL_HOUSE: House = {
  houseId: 3,
  name: HOUSE_NAME,
  myRole: 'OWNER',
  level: 3,
  growthPoints: 340,
  maxMembers: 6,
  memberCount: 4,
  floors: [
    {
      level: '2층',
      rooms: [
        { name: '모카', color: '#E8E0D0', isMine: true, isOwner: true, userId: 4 },
        { name: '솜이', color: '#D9E8D4', userId: 7 },
      ],
    },
    {
      level: '1층',
      rooms: [
        { name: '도토리', color: '#F5E8C8', userId: 9 },
        { name: '구름', color: '#E4DCF0', userId: 11 },
      ],
    },
  ],
};

/** 집 화면 레일 — 채팅 아래 '집 피드', 그 아래 집 탐색. */
export function HouseFeedRailDemo() {
  return (
    <View style={{ height: 760, alignSelf: 'stretch' }}>
      <HouseScreen
        houses={[RAIL_HOUSE]}
        onOpenMissions={() => {}}
        onOpenMembers={() => {}}
        onOpenChat={() => {}}
        chatUnread={3}
        onOpenFeed={() => {}}
      />
    </View>
  );
}
