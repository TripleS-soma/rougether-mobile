import type { FeedComment, FeedDraftImage, FeedPost } from '@/components/screens/feed/types';
import type { House, HouseMission } from '@/components/screens/house/types';
import type { GuestbookEntry } from '@/components/screens/friend-room-screen';
import type { NotificationEntry } from '@/components/screens/notification-list-screen';
import type { Routine } from '@/constants/routines';
import type { SearchHouse } from '@/components/screens/house-search-screen';

/** Sample browse-list houses for the dev gallery / screen tests. */
export const RECOMMENDED_HOUSES: SearchHouse[] = [
  {
    id: 1,
    name: '아침형 인간 모임',
    members: 3,
    capacity: 4,
    tag: '기상',
    icon: 'sunrise',
    bg: '#FFEFD8',
    border: '#F0C88A',
    description: '오전 7시 전 기상 인증을 함께 해요',
  },
  {
    id: 2,
    name: '개발자 루틴',
    members: 4,
    capacity: 4,
    tag: '코딩',
    icon: 'laptop',
    bg: '#E4F0DC',
    border: '#A8C898',
    description: '매일 코테 한 문제씩, 함께 성장하기',
  },
  {
    id: 3,
    name: '독서 1시간',
    members: 2,
    capacity: 4,
    tag: '독서',
    icon: 'book-open',
    bg: '#E4DCF0',
    border: '#B8A8D8',
    description: '하루 1시간 독서하고 한줄평 남기기',
  },
  {
    id: 4,
    name: '홈트 챌린지',
    members: 3,
    capacity: 4,
    tag: '운동',
    icon: 'dumbbell',
    bg: '#FBE0E0',
    border: '#E8B0A0',
    description: '주 3회 홈트 인증 그룹',
  },
  {
    id: 5,
    name: '물 2L 클럽',
    members: 4,
    capacity: 4,
    tag: '건강',
    icon: 'water',
    bg: '#D8E8F0',
    border: '#A8C4D8',
    description: '하루 물 2L 마시기 인증',
  },
];

/** 공동 미션 데모 (#694 이관) — 집 화면 프리뷰 fallback. */
export const DEMO_MISSIONS: HouseMission[] = [
  { id: 1, title: '이번 주 다같이 루틴 지키기', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 12, target: 20, status: 'ACTIVE' }, // prettier-ignore
  { id: 2, title: '아침 기상 인증 모으기', desc: '일일 구성원 달성률', icon: 'sun', current: 8, target: 8, status: 'ACTIVE', achieved: true }, // prettier-ignore
  { id: 3, title: '지난주 스트레칭 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 20, target: 20, status: 'COMPLETED', achieved: true }, // prettier-ignore
];

// Demo layout mirrors the adapter's default fill: my room bottom-left, others
// in join order, vacant capacity seats on the top floor (정원 6 / 멤버 4).
export const DEFAULT_HOUSES: House[] = [
  {
    name: '소마파이팅',
    inviteCode: 'SOMA-2143',
    level: 3,
    missions: DEMO_MISSIONS,
    maxMembers: 6,
    memberCount: 4,
    floors: [
      {
        level: '3층',
        rooms: [
          { name: '빈방', color: 'transparent', vacant: true },
          { name: '빈방', color: 'transparent', vacant: true },
        ],
      },
      {
        level: '2층',
        rooms: [
          { name: '장진형', color: '#D9E8D4', online: true },
          { name: '임채영', color: '#F5E8C8', lastSeenLabel: '3시간 전' },
        ],
      },
      {
        level: '1층',
        rooms: [
          { name: '나의 방', color: '#E8E0D0', isMine: true, online: true },
          { name: '최준서', color: '#F5E1D8', isOwner: true, lastSeenLabel: '2일 전' },
        ],
      },
    ],
  },
  {
    name: '소마 2번째 집',
    inviteCode: 'SOMA-7788',
    level: 1,
    missions: DEMO_MISSIONS.slice(0, 1),
    maxMembers: 4,
    memberCount: 4,
    floors: [
      {
        level: '2층',
        rooms: [
          { name: '박서연', color: '#FBE0D8' },
          { name: '이지우', color: '#D8E8F0' },
        ],
      },
      {
        level: '1층',
        rooms: [
          { name: '나의 방', color: '#E8E0D0', isMine: true },
          { name: '김도현', color: '#E4DCF0', isOwner: true },
        ],
      },
    ],
  },
];

/** 친구 방 프리뷰 fallback 루틴 (#694 이관). */
export const FRIEND_DEMO_ROUTINES: Routine[] = [
  { id: 'friend-1', title: '아침 기상', completed: true, alarmEnabled: true, time: '07:00' },
  { id: 'friend-2', title: '독서 30분', completed: true },
  { id: 'friend-3', title: '운동 인증', completed: true },
  { id: 'friend-4', title: '영어 공부', completed: true, alarmEnabled: true, time: '20:00' },
  { id: 'friend-5', title: '하루 회고', completed: false, alarmEnabled: true, time: '23:00' },
];

/** 친구 방 프리뷰 fallback 방명록 (#694 이관). */
export const DEMO_GUESTBOOK: GuestbookEntry[] = [
  { id: 'g1', author: '임채영', content: '방 예쁘다! 오늘도 루틴 화이팅', date: '7월 6일' },
  { id: 'g2', author: '장진형', content: '기상 인증 대단해요', date: '7월 5일' },
];

/** 알림 목록 프리뷰 fallback (#694 이관). */
export const DEMO_NOTIFICATIONS: NotificationEntry[] = [
  { id: 1, type: 'ROUTINE_REMINDER', title: '루틴 리마인드', body: '물 마시기 할 시간이에요', read: false, date: '오늘' }, // prettier-ignore
  { id: 2, type: 'HOUSE_KICK', title: '집 알림', body: '아침 기상단에서 내보내졌어요', read: true, date: '7월 5일' }, // prettier-ignore
];

/** 피드 갤러리·테스트용 게시물 (#1409) — 사진은 로더가 없어 자리표시로 그려진다. */
export const DEMO_FEED_POSTS: FeedPost[] = [
  {
    postId: 3,
    author: { userId: 7, nickname: '루틴친구', profileImageKey: null },
    content: '오늘 아침 루틴 완료! 물 한 잔, 스트레칭 10분, 일기 세 줄.',
    images: [
      { imageId: 31, width: 1200, height: 1600 },
      { imageId: 32, width: 1600, height: 1200 },
    ],
    likeCount: 3,
    commentCount: 2,
    likedByMe: false,
    mine: false,
    createdAt: '2026-09-22T03:00:00Z',
    updatedAt: '2026-09-22T03:00:00Z',
  },
  {
    postId: 2,
    author: { userId: 4, nickname: '나', profileImageKey: null },
    content: '방을 새로 꾸몄어요. 창가 화분이 제일 마음에 들어요.',
    images: [{ imageId: 21, width: 1200, height: 1200 }],
    likeCount: 12,
    commentCount: 0,
    likedByMe: true,
    mine: true,
    createdAt: '2026-09-21T12:30:00Z',
    updatedAt: '2026-09-21T13:00:00Z',
  },
  {
    postId: 1,
    author: { userId: 9, nickname: null, profileImageKey: null },
    content: '',
    images: [{ imageId: 11, width: 1600, height: 900 }],
    likeCount: 0,
    commentCount: 1,
    likedByMe: false,
    mine: false,
    createdAt: '2026-09-15T08:00:00Z',
    updatedAt: '2026-09-15T08:00:00Z',
  },
];

export const DEMO_FEED_COMMENTS: FeedComment[] = [
  {
    commentId: 301,
    postId: 3,
    author: { userId: 8, nickname: '이웃', profileImageKey: null },
    content: '멋져요! 저도 내일부터 스트레칭 해볼게요.',
    mine: false,
    createdAt: '2026-09-22T03:02:00Z',
  },
  {
    commentId: 302,
    postId: 3,
    author: { userId: 4, nickname: '나', profileImageKey: null },
    content: '같이 해요 🙌',
    mine: true,
    createdAt: '2026-09-22T03:10:00Z',
  },
];

export const DEMO_FEED_DRAFT: FeedDraftImage[] = [
  { key: 'draft-1', uri: '', status: 'done', imageId: 41 },
  { key: 'draft-2', uri: '', status: 'uploading' },
  { key: 'draft-3', uri: '', status: 'failed', error: '사진 저장소가 잠시 불안정해요.' },
];
