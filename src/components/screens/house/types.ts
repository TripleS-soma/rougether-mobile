/**
 * 집 도메인 모델 (#리팩토링 4묶음) — 종전엔 house-screen.tsx 안에 있어 훅·어댑터·유틸이
 * **화면 모듈**을 import했다. 화면은 순수 prop 컴포넌트여야 하므로 타입을 여기로 떼고,
 * house-screen은 기존 임포터를 위해 재수출만 한다.
 */
import type { PictogramName } from '@/components/ui/pictograms';
import type { MissionStatus } from '@/utils/mission-cta';

// 방 렌더 데이터라 room.tsx가 정의한다 (#691) — 집 모델과 함께 쓰이므로 여기서도 내보낸다.
export type { MemberRoomPreview } from '@/components/room/room';

export type RoomCell = {
  name: string;
  /** Tile background tint (kept from the prototype palette). */
  color: string;
  /** A capacity seat nobody joined yet — quiet non-tappable tile. */
  vacant?: boolean;
  isMine?: boolean;
  /** This member is the house OWNER (👑 on the tile + 방장 badge). */
  isOwner?: boolean;
  /** 최근 40분 내 앱 접속 (#383) — 이름 앞 초록 점. lastAccessedAt 근사치. */
  online?: boolean;
  /** 오프라인일 때 이름 아래 붙는 마지막 접속 상대 시각 ("3시간 전"). */
  lastSeenLabel?: string;
  /** API membership id — enables the server kick action when provided. */
  membershipId?: number;
  /** API user id — the friend's room owner id (guestbook, room visit). */
  userId?: number;
  /**
   * 동거 봇 (서버 #307~#310). 온보딩 기본 집에 자동 입주하고 사람이 오면
   * 자리를 비켜준다. 사람인 줄 알고 응원을 보내거나 방장을 넘기지 않도록
   * 구성원 화면에서 배지로 구분한다.
   */
  bot?: boolean;
};

/** Context handed to onVisitFriend — ids enable server features (방명록, 방/루틴 조회). */
export type VisitedFriend = {
  name: string;
  userId?: number;
  houseId?: number;
  membershipId?: number;
};

export type Floor = { level: string; rooms: RoomCell[] };

export type HouseJoinRequest = {
  requestId: number;
  nickname: string;
  requestedAt?: string;
};

/** 승인 대기 중인 내 입주 신청 카드 (#648) — GET /me/join-requests에서. */
export type PendingJoinHouse = {
  requestId: number;
  name: string;
  /** ISO — 신청 시각. 없으면 라벨 생략. */
  requestedAt?: string;
};

export type House = {
  name: string;
  /** May be absent for non-owners (the API hides the code from members). */
  inviteCode?: string;
  floors: Floor[];
  /** API house id — enables server actions (kick/leave) when provided. */
  houseId?: number;
  myRole?: 'OWNER' | 'MEMBER';
  /** House growth level (히어로 레벨 pill; missions raise it). */
  level?: number;
  /** Accumulated growth points — 레벨 진행도(100pt/레벨) 표시용. */
  growthPoints?: number;
  /** Group missions shown in the "우리 집의 목표" card. */
  missions?: HouseMission[];
  /** House intro + capacity — prefill for the owner's edit form. */
  description?: string;
  maxMembers?: number;
  memberCount?: number;
  /** Current cover art key — prefill for the owner's edit form. */
  coverImageKey?: string;
  /** Pending browse-join requests, loaded for owners only. */
  joinRequests?: HouseJoinRequest[];
};

/** Owner's house-settings edit (PUT /houses/{id}; omitted fields are kept). */
export type HouseEditInput = {
  name: string;
  description?: string;
  maxMembers?: number;
  /** Cover from GET /houses/cover-images; omitted = keep the current one. */
  coverImageKey?: string;
};

/** Group mission (server house mission) shown in the missions card. */
export type HouseMission = {
  id: number;
  title: string;
  /** Mission-type description shown under the progress bar. */
  desc: string;
  /**
   * 진행 수치의 단위 (`%` / `회`). 유형마다 뜻이 달라서, 없으면 `25/100`이
   * 비율인지 횟수인지 카드에서 알 수 없다 (#887). 서버가 모르는 유형이면 빈 문자열.
   */
  unit?: string;
  icon: PictogramName;
  current: number;
  target: number;
  status: MissionStatus;
  /** Target reached — the reward is claimable while ACTIVE. */
  achieved?: boolean;
  /** Mission end date (device-local "YYYY-MM-DD"); absent = 무기한. */
  endsOn?: string;
};

/** Creatable mission types (STREAK_DAYS is not supported by the server yet). */
export type NewHouseMission = {
  title: string;
  missionType: 'DAILY_MEMBER_RATE' | 'WEEKLY_MEMBER_COUNT';
  targetValue: number;
  /** Optional period (ISO date-time, KST); omitted = 즉시 시작·무기한. */
  startsAt?: string;
  endsAt?: string;
};
