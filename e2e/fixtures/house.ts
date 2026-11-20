import type {
  ChatRoomResponse,
  HouseCoverImage,
  HouseDetailResponse,
  HouseJoinRequestResponse,
  MemberSummary,
  MissionSummary,
  MyHouseSummary,
  MyJoinRequestSummary,
} from '../../src/api/types';
import { E2E_USER_ID, HOUSE_ID, type List, NOW_ISO } from './common';
import { MEMBER_ROOM } from './room';

const COVER = 'house/coral-aquarium/house-unified-coral-aquarium-frame.png';

const myHouse = {
  houseId: HOUSE_ID,
  name: '테스트 하우스',
  coverImageKey: COVER,
  level: 2,
  currentMemberCount: 4,
  maxMembers: 4,
  isPublic: false,
  myRole: 'OWNER',
  joinedAt: '2026-11-01T03:00:00Z',
  displayMode: 'DIORAMA',
} satisfies MyHouseSummary;

const detail = {
  houseId: HOUSE_ID,
  name: myHouse.name,
  description: '',
  coverImageKey: COVER,
  maxMembers: 4,
  isPublic: false,
  currentMemberCount: 4,
  level: 2,
  growthPoints: 30,
  goals: [{ goalId: 1, code: 'HEALTH', name: '건강' }],
  myRole: 'OWNER',
  inviteCode: 'E2ECODE1',
  inviteExpiresAt: '2026-12-31T15:00:00Z',
  displayMode: 'DIORAMA',
} satisfies HouseDetailResponse;

// 4명 = 2층(층마다 두 칸).
const members = ['테스트', '구성원 둘', '구성원 셋', '구성원 넷'].map(
  (nickname, i) =>
    ({
      membershipId: 601 + i,
      userId: i === 0 ? E2E_USER_ID : 9002 + i,
      nickname,
      role: i === 0 ? 'OWNER' : 'MEMBER',
      status: 'ACTIVE',
      joinedAt: '2026-11-01T03:00:00Z',
      lastAccessedAt: NOW_ISO,
      bot: false,
    }) satisfies MemberSummary,
);

const missions = [
  {
    missionId: 701,
    title: '다 같이 루틴 완료',
    missionType: 'DAILY_MEMBER_COUNT',
    targetValue: 4,
    currentValue: 2,
    status: 'ACTIVE',
    startsAt: '2026-11-18T15:00:00Z',
    endsAt: '2026-11-19T15:00:00Z',
    todayClaimed: false,
    myContribution: 1,
    contributedToday: true,
    createdAt: '2026-11-18T15:00:00Z',
  },
] satisfies MissionSummary[];

/** 집 — 구성원 4명(2층)인 집 1채, 내가 방장. */
export const HOUSE_FIXTURES = {
  'GET /me/houses': { items: [myHouse] } satisfies List<MyHouseSummary>,
  'GET /me/join-requests': { items: [] } satisfies List<MyJoinRequestSummary>,
  'GET /houses/cover-images': {
    items: [{ code: 'coral-aquarium', name: '산호 수족관', coverImageKey: COVER }],
  } satisfies List<HouseCoverImage>,
  'GET /houses/:id': detail,
  'GET /houses/:id/members': { items: members } satisfies List<MemberSummary>,
  'GET /houses/:id/missions': { items: missions } satisfies List<MissionSummary>,
  'GET /houses/:id/join-requests': { items: [] } satisfies List<HouseJoinRequestResponse>,
  'GET /houses/:id/members/:id/room': MEMBER_ROOM,
  'POST /houses/:id/chat-room': {
    roomId: 801,
    roomType: 'HOUSE',
    houseId: HOUSE_ID,
    lastSequence: 0,
    readers: [],
  } satisfies ChatRoomResponse,
};
