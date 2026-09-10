/**
 * House adapters — house grid / presence / missions / covers / previews /
 * search cards / join requests, plus a member's day and activity for the
 * friend-room screen and guestbook entries.
 */
import { MISSION_TYPE_FALLBACK, MISSION_TYPE_RULES } from '@/constants/missions';
import { HouseBgs, HouseBorders, MyRoomTint, RoomTints } from '@/constants/theme';
import { CATEGORY_COLORS, type Routine, type RoutineCategoryMeta } from '@/constants/routines';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';
import { monthDayLabel, toIsoDate } from '@/utils/datetime';
import type { HouseCover } from '@/components/room/house-cover-picker';
import type {
  Floor,
  House,
  HouseMission,
  MemberRoomPreview,
  RoomCell,
} from '@/components/screens/house/types';
import type { FriendActivityDay, GuestbookEntry } from '@/components/screens/friend-room-screen';
import { type PictogramName } from '@/components/ui/pictograms';
import type {
  HousePreview,
  HousePreviewDetail,
  SearchHouse,
} from '@/components/screens/house-search-screen';
import { toCategoryIcon } from '@/api/adapters/shared';
import { characterIdFromCode, fromFriendRoomSlots, fromRoomPlacements } from '@/api/adapters/room';
import type { ShopCatalogue } from '@/api/adapters/shop-gacha';
import type {
  GuestbookItem,
  HouseCoverImage,
  HouseDetailResponse,
  HouseJoinRequestResponse,
  HouseMemberDayResponse,
  HouseMemberRoutineCompletionListResponse,
  HousePreviewDetailResponse,
  HousePreviewResponse,
  HouseSummary,
  MemberRoomSummary,
  MemberSummary,
  MissionSummary,
  RoomResponse,
} from '@/api/types';

// --- house (집) ------------------------------------------------------------

// Room tile tints + browse-card decorations, cycled by index (no art yet).
const HOUSE_ICONS: PictogramName[] = [
  'house',
  'sunrise',
  'laptop',
  'book',
  'dumbbell',
  'palette',
  'moon',
  'coffee',
];

/**
 * 접속 중 판정 창 (#383) — lastAccessedAt은 로그인/refresh 시에만 갱신되는
 * access token TTL(30분) 해상도라, TTL + 여유 10분 안이면 "접속 중"으로 본다.
 */
const ONLINE_WINDOW_MS = 40 * 60 * 1000;

/**
 * MemberSummary.lastAccessedAt(UTC) → 방 타일 접속 표시 (#383). 창 안이면
 * online, 밖이면 상대 시각 라벨("3시간 전"). 값이 없거나(접속 이력 없음)
 * 못 읽으면 둘 다 생략 — 타일은 아무것도 덧붙이지 않는다.
 */
export function toPresence(
  lastAccessedAt: string | undefined,
  nowMs: number,
): { online?: boolean; lastSeenLabel?: string } {
  if (!lastAccessedAt) return {};
  // 스웨거는 UTC를 약속하지만 존 표기가 빠져 오면 로컬로 오독된다 — Z를 보강.
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(lastAccessedAt) ? lastAccessedAt : `${lastAccessedAt}Z`;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return {};
  const diff = nowMs - then;
  if (diff <= ONLINE_WINDOW_MS) return { online: true };
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return { lastSeenLabel: `${minutes}분 전` };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { lastSeenLabel: `${hours}시간 전` };
  const days = Math.floor(hours / 24);
  if (days < 30) return { lastSeenLabel: `${days}일 전` };
  return { lastSeenLabel: '오래 전' };
}

/**
 * Build the house screen model from house detail + members. The grid is
 * sized by the house capacity (not the headcount): rooms fill two per floor
 * from the bottom-left — my room first, then the others in join order — and
 * the yet-unfilled seats render as quiet vacant tiles on the upper floors.
 * Occupied tiles carry the member's presence (#383) derived from
 * `lastAccessedAt` at `nowMs` (injectable for tests).
 */
export function toHouse(
  detail: HouseDetailResponse,
  members: MemberSummary[],
  myUserId?: number,
  myNickname?: string,
  missions?: HouseMission[],
  nowMs: number = Date.now(),
  joinRequests?: HouseJoinRequestResponse[],
): House {
  const active = members.filter((m) => m.status !== 'LEFT');
  // Me first → my room lands on the bottom-left seat.
  const ordered = [
    ...active.filter((m) => m.userId === myUserId),
    ...active.filter((m) => m.userId !== myUserId),
  ];
  const cells: RoomCell[] = ordered.map((m, i) => ({
    // 내 좌석 이름은 **프로필이 우선**이다 (#924). 멤버 API의 nickname은 집을
    // 다시 불러올 때까지 옛 값을 들고 있어서, 프로필을 고쳐도 타일만 예전
    // 이름으로 남았다. 프로필 쪽이 같은 값의 출처이므로 항상 그쪽을 믿는다.
    // (멤버 API에 이름이 아예 없는 경우의 폴백도 겸한다.)
    name:
      (m.userId === myUserId ? myNickname : undefined) || m.nickname || `멤버 ${m.userId ?? i + 1}`,
    color: m.userId === myUserId ? MyRoomTint : RoomTints[i % RoomTints.length],
    isMine: m.userId === myUserId,
    isOwner: m.role === 'OWNER',
    membershipId: m.membershipId,
    userId: m.userId,
    // 동거 봇 (서버 #309) — 구성원 화면이 배지로 구분한다.
    bot: m.bot,
    /**
     * **봇에는 접속 표시를 붙이지 않는다** (#1013). 서버 스케줄러가 봇의
     * `lastAccessedAt`을 갱신하기 때문에, 그대로 통과시키면 좌석 타일에
     * "● 접속 중"이나 "1시간 전"이 떠서 **봇이 사람보다 활발해 보인다.**
     * 그건 사람의 접속과 뜻이 다른 값이라 같은 모양으로 보이면 거짓말이다.
     * 좌석 타일은 비워진 이 자리에 "봇"을 대신 넣는다.
     */
    ...(m.bot ? {} : toPresence(m.lastAccessedAt, nowMs)),
  }));
  // Pad to the capacity so the house always shows 정원 seats; the server keeps
  // maxMembers >= headcount, but clamp anyway so a stale detail can't drop rooms.
  const seats = Math.max(cells.length, detail.maxMembers ?? 0);
  for (let i = cells.length; i < seats; i++) {
    cells.push({ name: '빈방', color: 'transparent', vacant: true });
  }
  const floorCount = Math.max(1, Math.ceil(cells.length / 2));
  const floors: Floor[] = [];
  // cells[0] is the 1층 왼쪽 seat; the screen renders top floor first.
  for (let f = floorCount - 1; f >= 0; f--) {
    floors.push({
      level: `${f + 1}층`,
      rooms: cells.slice(f * 2, f * 2 + 2),
    });
  }
  return {
    houseId: detail.houseId,
    name: detail.name ?? '',
    inviteCode: detail.inviteCode ?? undefined,
    myRole: detail.myRole,
    level: detail.level ?? 0,
    floors,
    missions,
    description: detail.description ?? undefined,
    maxMembers: detail.maxMembers ?? undefined,
    memberCount: detail.currentMemberCount ?? active.length,
    coverImageKey: detail.coverImageKey ?? undefined,
    isPublic: detail.isPublic ?? undefined,
    growthPoints: detail.growthPoints ?? undefined,
    joinRequests: joinRequests
      // 처리(수락/거절)된 이력이 응답에 섞여도 대기 중만 노출한다 (#526 리뷰).
      ?.filter(
        (request) => request.requestId != null && (request.status ?? 'PENDING') === 'PENDING',
      )
      .map((request) => ({
        requestId: request.requestId!,
        nickname: request.nickname || `멤버 ${request.userId ?? ''}`.trim(),
        requestedAt: request.requestedAt,
      })),
  };
}

/**
 * Cover catalog entry (GET /houses/cover-images) → picker model. Entries
 * without a key can't render or be submitted — null result.
 */
export function toHouseCover(c: HouseCoverImage): HouseCover | null {
  if (!c.coverImageKey) return null;
  return {
    code: c.code ?? c.coverImageKey,
    name: c.name ?? '',
    coverImageKey: c.coverImageKey,
  };
}

/** House-mission card model from the API mission summary. */
/** Server date-time → device-local "YYYY-MM-DD" (mission period display). */
function localDateOf(dateTime: string): string | undefined {
  const d = new Date(dateTime);
  return Number.isNaN(d.getTime()) ? undefined : toIsoDate(d);
}

export function toHouseMission(m: MissionSummary): HouseMission {
  // 아이콘·라벨·단위는 constants/missions의 단일 출처에서 (#887).
  const meta =
    MISSION_TYPE_RULES[m.missionType as keyof typeof MISSION_TYPE_RULES] ?? MISSION_TYPE_FALLBACK;
  const target = m.targetValue ?? 0;
  return {
    id: m.missionId ?? 0,
    title: m.title ?? '',
    desc: meta.label,
    icon: meta.icon,
    /** `25/100`이 %인지 횟수인지 카드에서 드러나게 (#887). */
    unit: meta.unit,
    current: m.currentValue ?? 0,
    target: Math.max(1, target),
    status: m.status ?? 'ACTIVE',
    achieved: target > 0 && (m.currentValue ?? 0) >= target,
    endsOn: m.endsAt ? localDateOf(m.endsAt) : undefined,
  };
}

/** Invite-code lookup → pre-join preview card model. */
export function toHousePreview(p: HousePreviewResponse): HousePreview {
  return {
    name: p.name ?? '',
    members: p.currentMemberCount ?? 0,
    capacity: p.maxMembers ?? undefined,
    expired: p.inviteExpired ?? false,
    // 부원 개인 코드 (#646/#648) — 입주 대신 신청이 생성되는 코드임을 미리 안내.
    requiresApproval: p.requiresApproval ?? false,
  };
}

/** Guestbook note → friend-room list entry (date shown as "M월 D일"). */
export function toGuestbookEntry(g: GuestbookItem): GuestbookEntry {
  const d = g.createdAt ? new Date(g.createdAt) : null;
  return {
    id: String(g.guestbookId ?? ''),
    author: g.authorNickname || `멤버 ${g.authorId ?? ''}`,
    content: g.content ?? '',
    date: d ? monthDayLabel(d) : '',
    // 방명록은 봇 스케줄러(서버 #310)가 실제로 글을 쓴다 — 누가 썼는지 밝힌다.
    authorBot: g.authorBot,
  };
}

/** Browse-list card model from the API house summary (decorations cycled). */
/**
 * 미리보기 memberRooms 항목 → 창문 타일 렌더 모델 (#386) — 집 화면 멤버 방과
 * 같은 변환(assetKey를 카탈로그로 역해석). room이 null(방 미생성)이면 집
 * 화면의 목업과 같은 기본 빈 방을 그린다.
 */
function toPreviewRoom(
  room: RoomResponse | null | undefined,
  cat: ShopCatalogue,
): MemberRoomPreview {
  if (!room) return { placements: [] };
  // 표면(벽지·바닥·배경)만 슬롯에서 읽는다 — 서버가 거기 저장한다 (서버 #162).
  const surfaces = fromFriendRoomSlots(room.slots ?? [], cat);
  return {
    // 가구는 자유 좌표가 정본 (#925) — layoutFormat 분기 없음.
    placements: fromRoomPlacements(room.placements ?? [], cat),
    wallpaperId: surfaces.wallpaperId ?? DEFAULT_WALLPAPER_ID,
    floorId: surfaces.floorId,
    backgroundId: surfaces.backgroundId,
    characterId: characterIdFromCode(room.character?.code),
  };
}

/**
 * GET /houses/{id}/preview → 탐색 미리보기 모달 모델 (#328). 카탈로그가 있으면
 * memberRooms를 실제 방 렌더 모델로 함께 변환한다 (#386) — 없으면(상점 미로드)
 * rooms를 비워 화면이 기존 목업으로 폴백하게 둔다.
 */
export function toHousePreviewDetail(
  p: HousePreviewDetailResponse,
  catalogue?: ShopCatalogue,
): HousePreviewDetail {
  return {
    id: p.houseId ?? 0,
    name: p.name ?? '',
    description: p.description || undefined,
    coverImageKey: p.coverImageKey ?? undefined,
    members: p.currentMemberCount ?? 0,
    capacity: p.maxMembers ?? undefined,
    level: p.level ?? undefined,
    goals: (p.goals ?? []).map((g) => g.name ?? '').filter(Boolean),
    isMember: p.isMember,
    isFull: p.isFull,
    rooms: catalogue
      ? (p.memberRooms ?? []).map((m: MemberRoomSummary) => toPreviewRoom(m.room, catalogue))
      : undefined,
    // 단체미션 미리보기 (#532) — 서버(#233)는 완료분까지 최신 생성순으로
    // 보내지만, 미리보기는 유인 목적이라 진행 중(ACTIVE)만 노출한다.
    // 완료 미션은 진행값이 리셋돼(0/3) 고장처럼 읽힌다.
    missions: (p.missions ?? []).map(toHouseMission).filter((m) => m.status === 'ACTIVE'),
  };
}

export function toSearchHouse(h: HouseSummary, index = 0): SearchHouse {
  return {
    id: h.houseId ?? 0,
    name: h.name ?? '',
    members: h.currentMemberCount ?? 0,
    capacity: h.maxMembers ?? 0,
    tag: h.goals?.[0]?.name ?? '루틴',
    // 검색용 — 목표 전부 (#1110). 칩은 대표 하나만 보여도 검색은 다 잡혀야 한다.
    tags: (h.goals ?? []).map((g) => g.name ?? '').filter((n) => n.length > 0),
    coverImageKey: h.coverImageKey ?? undefined,
    icon: HOUSE_ICONS[index % HOUSE_ICONS.length],
    bg: HouseBgs[index % HouseBgs.length],
    border: HouseBorders[index % HouseBorders.length],
    // No description: the boilerplate one only ever truncated (#234); the
    // level rides the meta line instead. Server summaries carry no intro text.
    level: h.level ?? 0,
    joinRequestStatus: h.myJoinRequestStatus,
  };
}

/**
 * A member's day (GET …/members/{id}/day) → the friend-room routine list:
 * routines first (server order: scheduled time asc), then todos. Uses the
 * read-only `completed` flag — visitors can't toggle a friend's items.
 */
export function toFriendRoutines(day: HouseMemberDayResponse): Routine[] {
  const routines = (day.routines ?? []).map((r): Routine => ({
    // originRoutineId is the stable lineage id; version ids change on edit.
    id: String(r.originRoutineId ?? r.id ?? ''),
    title: r.title ?? '루틴',
    kind: 'routine',
    completed: r.completed === true,
    time: r.scheduledTime ? r.scheduledTime.slice(0, 5) : undefined,
    alarmEnabled: !!r.scheduledTime,
    photoVerify: r.authType === 'PHOTO',
    // 카테고리 그룹핑 (#528, 서버 #237) — day.categories와 매칭용.
    category: r.categoryId != null ? String(r.categoryId) : undefined,
  }));
  const todos = (day.todos ?? []).map((t): Routine => ({
    id: `todo-${t.id ?? ''}`,
    title: t.title ?? '할 일',
    kind: 'todo',
    completed: t.status === 'COMPLETED',
    category: t.categoryId != null ? String(t.categoryId) : undefined,
  }));
  return [...routines, ...todos];
}

/**
 * 멤버 그날 현황의 카테고리 메타 (#528, 서버 #237) — 친구 방 루틴 목록을
 * 본인 화면처럼 카테고리 그룹으로 보여주기 위한 이름·색·아이콘. 비공개
 * 카테고리는 응답에 없으므로 매칭 안 되는 항목은 미분류로 흘러간다.
 */
export function toFriendCategories(day: HouseMemberDayResponse): RoutineCategoryMeta[] {
  return (day.categories ?? []).map((c, i) => ({
    id: String(c.id ?? ''),
    name: c.name ?? '',
    icon: toCategoryIcon(c.iconKey),
    color: c.colorHex || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    // 응답에 실리는 건 공개(HOUSE/PUBLIC) 카테고리뿐 — 표시용 기본값.
    visibility: 'neighbor',
  }));
}

/**
 * Completion history (GET …/routine-completions) → per-day rows for the
 * friend-room 최근 활동 list. The server already sorts date desc; rows keep
 * that order, each with a "M월 D일" label and the day's completed titles.
 */
export function toFriendActivity(
  resp: HouseMemberRoutineCompletionListResponse,
): FriendActivityDay[] {
  const days: FriendActivityDay[] = [];
  for (const c of resp.items ?? []) {
    const date = c.routineDate ?? '';
    if (!date) continue;
    let day = days[days.length - 1];
    if (!day || day.date !== date) {
      const [, m, d] = date.split('-').map(Number);
      day = { date, label: `${m}월 ${d}일`, titles: [] };
      days.push(day);
    }
    day.titles.push(c.title ?? '루틴');
  }
  return days;
}
