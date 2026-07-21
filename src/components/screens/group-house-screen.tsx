import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CharacterAvatar } from '@/components/character-avatar';
import { type HouseCover, HouseCoverPicker } from '@/components/house-cover-picker';
import { FRAME_ASPECT, WINDOW_RECTS } from '@/components/room/house-preview-frame';
import { Room } from '@/components/room/room';
import { DateRangeSheet } from '@/components/screens/sheets/date-range-sheet';
import { Icon } from '@/components/ui/icon';
import {
  CrownPictogram,
  DoorPictogram,
  HousePictogram,
  PencilPictogram,
  Pictogram,
  type PictogramName,
  TargetPictogram,
  TrashPictogram,
} from '@/components/ui/pictograms';
import { useToast } from '@/components/ui/toast';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';
import type { FurnitureItem, PlacedFurniture, Wallpaper } from '@/resources/furniture';
import { formatDate, todayIso, toIsoDate } from '@/utils/datetime';

/**
 * A member's live room resolved for the tile preview (their placement + worn
 * character). Absent entry = not loaded / fetch failed → plain tile fallback.
 */
export type MemberRoomPreview = {
  placedFurnitureIds: string[];
  /** FREE_V1 방의 자유 배치 (#327) — null이면 슬롯 렌더. */
  placements?: PlacedFurniture[] | null;
  wallpaperId?: string;
  floorId?: string | null;
  backgroundId?: string | null;
  characterId?: CharacterId;
};

export type RoomCell = {
  name: string;
  /** Tile background tint (kept from the prototype palette). */
  color: string;
  /** A capacity seat nobody joined yet — quiet non-tappable tile. */
  vacant?: boolean;
  isMine?: boolean;
  /** This member is the house OWNER (👑 on the tile + 방장 badge). */
  isOwner?: boolean;
  /** API membership id — enables the server kick action when provided. */
  membershipId?: number;
  /** API user id — the friend's room owner id (guestbook, room visit). */
  userId?: number;
};

/** Context handed to onVisitFriend — ids enable server features (방명록, 방/루틴 조회). */
export type VisitedFriend = {
  name: string;
  userId?: number;
  houseId?: number;
  membershipId?: number;
};

export type Floor = { level: string; rooms: RoomCell[] };

export type House = {
  title: string;
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
};

/** Owner's house-settings edit (PUT /houses/{id}; omitted fields are kept). */
export type HouseEditInput = {
  name: string;
  description?: string;
  maxMembers?: number;
  /** Cover from GET /houses/cover-images; omitted = keep the current one. */
  coverImageKey?: string;
};

/** Capacity choices for the edit form (server allows 1~10). */
const CAPACITY_OPTIONS = [2, 3, 4, 6, 8, 10];

/** Group mission (server house mission) shown in the missions card. */
export type HouseMission = {
  id: number;
  title: string;
  /** Mission-type description shown under the progress bar. */
  desc: string;
  icon: PictogramName;
  current: number;
  target: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
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

/** "YYYY-MM-DD" + n days → "YYYY-MM-DD" (device-local; noon avoids DST edges). */
function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

const MISSION_TYPE_OPTIONS: {
  type: NewHouseMission['missionType'];
  icon: PictogramName;
  label: string;
}[] = [
  { type: 'DAILY_MEMBER_RATE', icon: 'sun', label: '일일 달성률' },
  { type: 'WEEKLY_MEMBER_COUNT', icon: 'calendar', label: '주간 달성 횟수' },
];

const DEMO_MISSIONS: HouseMission[] = [
  { id: 1, title: '이번 주 다같이 루틴 지키기', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 12, target: 20, status: 'ACTIVE' }, // prettier-ignore
  { id: 2, title: '아침 기상 인증 모으기', desc: '일일 구성원 달성률', icon: 'sun', current: 8, target: 8, status: 'ACTIVE', achieved: true }, // prettier-ignore
  { id: 3, title: '지난주 스트레칭 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 20, target: 20, status: 'COMPLETED' }, // prettier-ignore
];

// 빈방 타일의 바닥 밴드 — 일반 빈 방(#281)이라 서버 카탈로그와 무관한 고정
// 파스텔(방 타일 팔레트와 같은 결)로 그린다.
const VACANT_FLOOR: Wallpaper[] = [
  { id: 'vacant-floor', name: '빈방 바닥', price: 0, assetKey: 'vacant-floor', color: '#E7D9BE' },
];

// 커버 프레임 PNG(house-unified-*-frame.png, 3종 공통 567×508)의 투명 창문
// 4칸 — 알파 채널 측정값 (#287). 좌상·우상·좌하·우하 순.
// FRAME_ASPECT / WINDOW_RECTS는 집 탐색 미리보기(#328)와 공유 —
// house-preview-frame.tsx가 단일 출처.

// 기본 카메라 확대 (#307, 시안 B) — 방 4칸이 뷰포트를 채우는 배율. 창문 블록이
// 가로 12.7%~86.3%를 쓰므로 1.34를 넘으면 창이 좌우로 잘린다.
const CAM_DEFAULT_SCALE = 1.3;
// 창문 블록 세로 중심(25.4%~89.1% → 57.25%)을 뷰포트 중앙에 맞추는 기준값.
const CAM_WINDOW_CENTER_Y = 0.5725;
const CAM_MAX_SCALE = 3;
// 방 더블탭 줌 — 창문(폭 35%)이 카메라 뷰포트를 거의 가득 채우는 배율.
const CAM_ROOM_SCALE = 2.9;
// 이 간격 안의 두 번째 탭 = 더블탭(줌). 한 번 탭(방문)은 이만큼 기다렸다 실행.
const DOUBLE_TAP_MS = 260;

// Demo layout mirrors the adapter's default fill: my room bottom-left, others
// in join order, vacant capacity seats on the top floor (정원 6 / 멤버 4).
const DEFAULT_HOUSES: House[] = [
  {
    title: '소마파이팅',
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
          { name: '장진형', color: '#D9E8D4' },
          { name: '임채영', color: '#F5E8C8' },
        ],
      },
      {
        level: '1층',
        rooms: [
          { name: '나의 방', color: '#E8E0D0', isMine: true },
          { name: '최준서', color: '#F5E1D8', isOwner: true },
        ],
      },
    ],
  },
  {
    title: '소마 2번째 집',
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

export type GroupHouseScreenProps = {
  houses?: House[];
  /** True while my houses are loading from the API. */
  loading?: boolean;
  characterId?: CharacterId;
  /**
   * Controlled house-switcher index. The screen unmounts while visiting a
   * friend's room, so the shell keeps this to restore the house being viewed
   * (#241). Omit for internal state (dev gallery).
   */
  houseIndex?: number;
  onHouseIndexChange?: (index: number) => void;
  onVisitFriend?: (friend: VisitedFriend) => void;
  onVisitMyRoom?: () => void;
  onOpenSearch?: () => void;
  /** Kick a member via the API (owner only); shown when the house has ids. */
  onKickMember?: (houseId: number, membershipId: number) => void;
  /** Leave the current house via the API. */
  onLeaveHouse?: (houseId: number) => void;
  /** File a mission as a daily routine under the house-named category. */
  onAddMissionRoutine?: (houseId: number, mission: HouseMission) => void;
  /** My routines in this house's category — 연동/기여함 라벨 판정. */
  linkedRoutines?: { title: string; completedToday?: boolean }[];
  /** Mission ids contributed this session (기여 직후 즉시 반영용 보조 신호). */
  contributedMissionIds?: number[];
  /** Claim the reward of an achieved mission. */
  onClaimMission?: (houseId: number, missionId: number) => void;
  /** Create a new group mission. */
  onCreateMission?: (houseId: number, input: NewHouseMission) => void;
  /** Delete a mission (server: OWNER only, COMPLETED not deletable). */
  onDeleteMission?: (houseId: number, missionId: number) => void;
  /** Edit the house settings via the API (owner only). */
  onUpdateHouse?: (houseId: number, input: HouseEditInput) => void;
  /** Cover catalog (GET /houses/cover-images); empty hides the edit section. */
  covers?: HouseCover[];
  /** Live room previews by membershipId — tiles render the member's actual room. */
  roomPreviews?: Record<number, MemberRoomPreview>;
  // Catalogue the previews resolve against (server shop items; local defaults otherwise).
  furniture?: FurnitureItem[];
  wallpapers?: Wallpaper[];
  floors?: Wallpaper[];
  backgrounds?: Wallpaper[];
  /** Hand the OWNER role to a member via the API (owner only). */
  onTransferOwnership?: (houseId: number, membershipId: number) => void;
  /** Reissue the invite code via the API (owner only; the old code expires). */
  onReissueInviteCode?: (houseId: number) => void;
  /**
   * Drag-and-drop tile swap (#278). Seat indices are display order (top-left
   * first) of the houses handed in — the shell persists and re-arranges via
   * useRoomLayouts. Omitted (demo gallery) falls back to a local swap.
   */
  onSwapSeats?: (houseId: number, seatA: number, seatB: number) => void;
};

/**
 * Group house screen, ported from the prototype `GroupHouseScreen`: a house
 * switcher, the members' rooms (tap to visit), a group-goals card, and a member
 * management sub-view with an invite code and kick flow. The prototype's
 * absolutely-positioned windows over a house PNG are adapted to a token-based
 * floor/room grid. Spec domain: rougether-spec domains/house.
 */
export function GroupHouseScreen({
  houses = DEFAULT_HOUSES,
  loading = false,
  characterId = DEFAULT_CHARACTER_ID,
  houseIndex: houseIndexProp,
  onHouseIndexChange,
  onVisitFriend,
  onVisitMyRoom,
  onOpenSearch,
  onKickMember,
  onLeaveHouse,
  onAddMissionRoutine,
  linkedRoutines = [],
  contributedMissionIds = [],
  onClaimMission,
  onCreateMission,
  onDeleteMission,
  onUpdateHouse,
  covers = [],
  roomPreviews,
  furniture,
  wallpapers,
  floors: floorSurfaces,
  backgrounds,
  onTransferOwnership,
  onReissueInviteCode,
  onSwapSeats,
}: GroupHouseScreenProps) {
  const t = useTokens();
  const { show: toast } = useToast();
  const headerInset = useHeaderInsetStyle();
  const screenStyle = useScreenStyle([]);

  const [internalHouseIndex, setInternalHouseIndex] = useState(0);
  const houseIndex = houseIndexProp ?? internalHouseIndex;
  const setHouseIndex = (next: number) => {
    setInternalHouseIndex(next);
    onHouseIndexChange?.(next);
  };
  const [showMembers, setShowMembers] = useState(false);
  const [kicked, setKicked] = useState<string[]>([]);
  const [memberToKick, setMemberToKick] = useState<RoomCell | null>(null);
  const [showCreateMission, setShowCreateMission] = useState(false);
  // 공동 미션 시트 (#287) — 하단 카드 대신 플로팅 버튼으로 연다.
  const [showMissions, setShowMissions] = useState(false);
  const [missionTitle, setMissionTitle] = useState('');
  const [missionType, setMissionType] =
    useState<NewHouseMission['missionType']>('WEEKLY_MEMBER_COUNT');
  const [missionTarget, setMissionTarget] = useState('10');
  // Optional mission period (기간 설정 토글) — off sends nothing (즉시 시작·무기한).
  const [missionHasPeriod, setMissionHasPeriod] = useState(false);
  const [missionStart, setMissionStart] = useState(todayIso());
  const [missionEnd, setMissionEnd] = useState<string | undefined>(undefined);
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  // 미션 → 내 루틴 추가 확인 모달의 대상.
  const [missionToAdd, setMissionToAdd] = useState<HouseMission | null>(null);
  // 미션 삭제 확인 모달의 대상 (#305).
  const [missionToDelete, setMissionToDelete] = useState<HouseMission | null>(null);
  const [showEditHouse, setShowEditHouse] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMax, setEditMax] = useState<number | undefined>(undefined);
  const [editCover, setEditCover] = useState<string | undefined>(undefined);
  const [transferTarget, setTransferTarget] = useState<RoomCell | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showReissueConfirm, setShowReissueConfirm] = useState(false);

  const currentHouse: House | undefined = houses[Math.min(houseIndex, houses.length - 1)];
  const members = useMemo(
    () =>
      (currentHouse?.floors ?? []).flatMap((f) =>
        // Vacant capacity seats are tiles only — they are not members to manage.
        f.rooms.filter((r) => !r.vacant).map((r) => ({ ...r, level: f.level })),
      ),
    [currentHouse],
  );
  const keyFor = (name: string) => `${houseIndex}-${name}`;
  const isKicked = (name: string) => kicked.includes(keyFor(name));

  const prevHouse = () => setHouseIndex((houseIndex - 1 + houses.length) % houses.length);
  const nextHouse = () => setHouseIndex((houseIndex + 1) % houses.length);

  const missions = currentHouse?.missions ?? [];
  const activeMissions = missions.filter((m) => m.status === 'ACTIVE');
  /** 오늘 기여 완료 판정 — 세션 추적 또는 연동 루틴의 오늘 완료에서 파생. */
  const isContributed = (mission: HouseMission) =>
    contributedMissionIds.includes(mission.id) ||
    linkedRoutines.some((r) => r.title === mission.title && r.completedToday);
  const contributedToday = activeMissions.filter(isContributed).length;
  const toNextLevel =
    currentHouse?.growthPoints != null ? 100 - (currentHouse.growthPoints % 100) : undefined;
  // 층 라벨 없이 한 그리드로 — 행은 어댑터의 층 구성을 그대로 쓴다. 홀수 정원의
  // 반쪽 행이 위층에 있어서, 평탄화 후 2개씩 다시 끊으면 행이 밀린다.
  const rowShapes = (currentHouse?.floors ?? []).map((f) => f.rooms.length);
  const cellsInOrder = (currentHouse?.floors ?? []).flatMap((f) => f.rooms);
  // Demo fallback (#278): without onSwapSeats a local permutation keeps the
  // gallery drag interactive. Wired houses arrive already re-arranged.
  const [demoPerm, setDemoPerm] = useState<Record<number, number[]>>({});
  const perm = demoPerm[houseIndex];
  const displayCells =
    !onSwapSeats && perm?.length === cellsInOrder.length
      ? perm.map((i) => cellsInOrder[i])
      : cellsInOrder;
  // 표시 행(어댑터 층 구성)별 좌석 인덱스.
  const seatRows: number[][] = [];
  {
    let seatOffset = 0;
    for (const size of rowShapes) {
      seatRows.push(Array.from({ length: size }, (_, i) => seatOffset + i));
      seatOffset += size;
    }
  }
  // 프레임 모드(#287): 커버 PNG는 창문 4칸(2×2)이 투명하게 뚫린 집 프레임이다.
  // 아래 두 행(내 방·초기 멤버)이 창문에 들어가고, 그 위 행들(초과 좌석·빈방)은
  // 프레임 아래 그리드로 이어붙는다. 커버가 없으면 기존 히어로+그리드 폴백.
  const frameActive = isCdnKey(currentHouse?.coverImageKey);
  const frameRows = frameActive ? seatRows.slice(-2) : [];
  // WINDOW_RECTS 순서(좌상·우상·좌하·우하)로 좌석 매핑 — 아래 행이 아래 창문.
  const windowSlots: (number | null)[] = [null, null, null, null];
  frameRows
    .slice()
    .reverse()
    .forEach((row, r) =>
      row.forEach((seatIdx, c) => {
        const slot = (r === 0 ? 2 : 0) + c;
        if (slot < windowSlots.length) windowSlots[slot] = seatIdx;
      }),
    );
  const gridSeatRows = frameActive ? seatRows.slice(0, -2) : seatRows;
  const roomPairs: RoomCell[][] = gridSeatRows.map((row) => row.map((i) => displayCells[i]));
  const rowOffsets: number[] = gridSeatRows.map((row) => row[0] ?? 0);

  // --- 타일 드래그 앤 드롭 (자리 맞바꾸기, #278) ---
  // Long-press lifts a tile, the grid captures the active touch and the tile
  // follows the finger; releasing over another seat swaps the two. Seat rects
  // are measured (window coords) at lift time, so drops hit-test directly
  // against gestureState.moveX/Y.
  const [dragSeat, setDragSeat] = useState<number | null>(null);
  const dragSeatRef = useRef<number | null>(null);
  const dragGranted = useRef(false);
  const dragPan = useRef(new Animated.ValueXY()).current;
  const tileRefs = useRef(new Map<number, View>());
  const tileRects = useRef(new Map<number, { x: number; y: number; w: number; h: number }>());

  const startDrag = (seat: number) => {
    tileRects.current.clear();
    tileRefs.current.forEach((ref, idx) =>
      ref.measureInWindow((x, y, w, h) => tileRects.current.set(idx, { x, y, w, h })),
    );
    dragSeatRef.current = seat;
    dragGranted.current = false;
    setDragSeat(seat);
  };
  const endDrag = () => {
    dragSeatRef.current = null;
    dragGranted.current = false;
    dragPan.setValue({ x: 0, y: 0 });
    setDragSeat(null);
  };
  const dropAt = (x: number, y: number) => {
    const from = dragSeatRef.current;
    if (from != null) {
      let to: number | null = null;
      tileRects.current.forEach((r, idx) => {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) to = idx;
      });
      if (to != null && to !== from) {
        if (onSwapSeats && currentHouse?.houseId != null) {
          onSwapSeats(currentHouse.houseId, from, to);
        } else {
          const target = to;
          setDemoPerm((prev) => {
            const base =
              prev[houseIndex]?.length === displayCells.length
                ? [...prev[houseIndex]]
                : displayCells.map((_, i) => i);
            [base[from], base[target]] = [base[target], base[from]];
            return { ...prev, [houseIndex]: base };
          });
        }
      }
    }
    endDrag();
  };
  // The responder is created once — route through a ref so the release sees
  // the current house/permutation, not the mount-time closure.
  const dropAtRef = useRef(dropAt);
  dropAtRef.current = dropAt;
  const gridPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Claim the ongoing touch only once a long-press lifted a tile.
      onMoveShouldSetPanResponderCapture: () => dragSeatRef.current != null,
      onPanResponderGrant: () => {
        dragGranted.current = true;
      },
      onPanResponderMove: Animated.event([null, { dx: dragPan.x, dy: dragPan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_evt, g) => dropAtRef.current(g.moveX, g.moveY),
      onPanResponderTerminate: () => endDrag(),
    }),
  ).current;
  // A lift with no movement never grants the responder — the tile's pressOut
  // is then the only release signal, so it clears the stuck lift.
  const onTilePressOut = () => {
    if (dragSeatRef.current == null) return;
    setTimeout(() => {
      if (!dragGranted.current) endDrag();
    }, 80);
  };

  // --- 프레임 카메라 (핀치줌·팬, #290) ---
  // 두 손가락으로 확대(1×~2.5×), 확대 상태에서 한 손가락 팬. 확대 중에는
  // 자리 교환 드래그를 끄고(좌표계 어긋남 방지) 탭 방문만 유지한다.
  const [zoomed, setZoomed] = useState(false);
  const zoomedRef = useRef(false);
  const camScale = useRef(new Animated.Value(1)).current;
  const camTx = useRef(new Animated.Value(0)).current;
  const camTy = useRef(new Animated.Value(0)).current;
  const cam = useRef({ scale: 1, tx: 0, ty: 0 });
  const frameSize = useRef({ w: 0, h: 0 });
  const pinchAnchor = useRef({ dist: 0, cx: 0, cy: 0, scale: 1, tx: 0, ty: 0 });
  const panAnchor = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const camTouchCount = useRef(0);

  // 기본 카메라 = 방 4칸 클로즈업 (#307). 원배율(1×)은 지붕·마당까지 보이는
  // 축소 뷰로, 핀치 아웃으로만 진입한다.
  const camDefault = () => ({
    scale: CAM_DEFAULT_SCALE,
    tx: 0,
    ty: -(CAM_WINDOW_CENTER_Y - 0.5) * frameSize.current.h * CAM_DEFAULT_SCALE,
  });
  const clampCam = (scale: number, tx: number, ty: number) => {
    const { w, h } = frameSize.current;
    const s = Math.min(CAM_MAX_SCALE, Math.max(1, scale));
    // 팬은 프레임 경계까지 — translate는 스케일 바깥(화면 px) 기준.
    const maxTx = ((s - 1) * w) / 2;
    const maxTy = ((s - 1) * h) / 2;
    return {
      scale: s,
      tx: Math.min(maxTx, Math.max(-maxTx, tx)),
      ty: Math.min(maxTy, Math.max(-maxTy, ty)),
    };
  };
  // ⟲ 리셋·팬·드래그 게이트는 "기본 프리셋에서 벗어났는가"로 판단한다.
  const isCamAway = (c: { scale: number; tx: number; ty: number }) => {
    const d = camDefault();
    return (
      Math.abs(c.scale - d.scale) > 0.04 || Math.abs(c.tx - d.tx) > 6 || Math.abs(c.ty - d.ty) > 6
    );
  };
  const syncZoomed = () => {
    const away = isCamAway(cam.current);
    if (away !== zoomedRef.current) {
      zoomedRef.current = away;
      setZoomed(away);
    }
  };
  const setCam = (scale: number, tx: number, ty: number) => {
    const c = clampCam(scale, tx, ty);
    cam.current = c;
    camScale.setValue(c.scale);
    camTx.setValue(c.tx);
    camTy.setValue(c.ty);
    syncZoomed();
  };
  const animateCamTo = (scale: number, tx: number, ty: number) => {
    const c = clampCam(scale, tx, ty);
    cam.current = c;
    syncZoomed();
    Animated.parallel([
      Animated.spring(camScale, { toValue: c.scale, useNativeDriver: false }),
      Animated.spring(camTx, { toValue: c.tx, useNativeDriver: false }),
      Animated.spring(camTy, { toValue: c.ty, useNativeDriver: false }),
    ]).start();
  };
  const resetCam = () => {
    const d = camDefault();
    animateCamTo(d.scale, d.tx, d.ty);
  };
  // 더블탭 줌 — 그 방의 창문이 카메라 뷰포트를 거의 가득 채우게 (#307).
  const zoomToSeat = (seatIdx: number) => {
    const slot = windowSlots.indexOf(seatIdx);
    const { w, h } = frameSize.current;
    if (slot < 0 || !w) return;
    const rect = WINDOW_RECTS[slot];
    const cx = (parseFloat(rect.left) + parseFloat(rect.width) / 2) / 100;
    const cy = (parseFloat(rect.top) + parseFloat(rect.height) / 2) / 100;
    animateCamTo(
      CAM_ROOM_SCALE,
      -CAM_ROOM_SCALE * (cx - 0.5) * w,
      -CAM_ROOM_SCALE * (cy - 0.5) * h,
    );
  };
  const anchorCamera = (evt: { nativeEvent: { touches: { pageX: number; pageY: number }[] } }) => {
    const ts = evt.nativeEvent.touches;
    camTouchCount.current = ts.length;
    if (ts.length >= 2) {
      const dx = ts[0].pageX - ts[1].pageX;
      const dy = ts[0].pageY - ts[1].pageY;
      pinchAnchor.current = {
        dist: Math.hypot(dx, dy),
        cx: (ts[0].pageX + ts[1].pageX) / 2,
        cy: (ts[0].pageY + ts[1].pageY) / 2,
        scale: cam.current.scale,
        tx: cam.current.tx,
        ty: cam.current.ty,
      };
    } else if (ts.length === 1) {
      panAnchor.current = {
        x: ts[0].pageX,
        y: ts[0].pageY,
        tx: cam.current.tx,
        ty: cam.current.ty,
      };
    }
  };
  const cameraResponder = useRef(
    PanResponder.create({
      // 두 손가락은 즉시, 한 손가락은 확대 상태에서만 (드래그 중엔 양보).
      onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponderCapture: (evt) =>
        dragSeatRef.current == null && (evt.nativeEvent.touches.length >= 2 || zoomedRef.current),
      onPanResponderGrant: (evt) => anchorCamera(evt),
      onPanResponderMove: (evt) => {
        const ts = evt.nativeEvent.touches;
        // 손가락 수가 바뀌면(2→1, 1→2) 기준점을 다시 잡는다.
        if (ts.length !== camTouchCount.current) {
          anchorCamera(evt);
          return;
        }
        if (ts.length >= 2) {
          const a = pinchAnchor.current;
          if (a.dist === 0) return;
          const dx = ts[0].pageX - ts[1].pageX;
          const dy = ts[0].pageY - ts[1].pageY;
          const cx = (ts[0].pageX + ts[1].pageX) / 2;
          const cy = (ts[0].pageY + ts[1].pageY) / 2;
          setCam(a.scale * (Math.hypot(dx, dy) / a.dist), a.tx + (cx - a.cx), a.ty + (cy - a.cy));
        } else if (ts.length === 1 && zoomedRef.current) {
          const a = panAnchor.current;
          setCam(cam.current.scale, a.tx + (ts[0].pageX - a.x), a.ty + (ts[0].pageY - a.y));
        }
      },
      onPanResponderRelease: () => {
        camTouchCount.current = 0;
        // 거의 원배율(축소 조망)이면 딱 1×로 스냅 — 기본(방 뷰) 복귀는 ⟲로.
        if (cam.current.scale < 1.05) animateCamTo(1, 0, 0);
      },
      onPanResponderTerminate: () => {
        camTouchCount.current = 0;
      },
    }),
  ).current;

  // --- 집 스와이프 전환 (#297) — 가로 우세 플링이면 이전/다음 집. ---
  // 확대 중(카메라 팬)·드래그 중에는 양보하고, 버블 단계라 자식 제스처가 우선.
  const switchRef = useRef({ prev: () => {}, next: () => {} });
  switchRef.current = { prev: prevHouse, next: nextHouse };
  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, g) =>
        dragSeatRef.current == null &&
        !zoomedRef.current &&
        evt.nativeEvent.touches.length === 1 &&
        Math.abs(g.dx) > 24 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_evt, g) => {
        if (g.dx <= -40) switchRef.current.next();
        else if (g.dx >= 40) switchRef.current.prev();
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  // Owner tools need the OWNER role and a server house id.
  const isOwner = currentHouse?.myRole === 'OWNER' && !!currentHouse?.houseId;
  // Kick is server-side owner-only too; the demo (no houseId) keeps the local
  // placeholder flow so the gallery preview stays interactive.
  const canKick = isOwner || !currentHouse?.houseId;
  // Mission creation is owner-only on the server (403 HOUSE_NOT_OWNER).
  const canCreateMission = !!(onCreateMission && isOwner);
  // Mission deletion too; COMPLETED rows hide the button (server 409s them).
  const canDeleteMission = !!(onDeleteMission && isOwner);
  const missionTargetNum = Number(missionTarget);
  const canSubmitMission =
    missionTitle.trim().length > 0 &&
    Number.isInteger(missionTargetNum) &&
    missionTargetNum >= 1 &&
    missionTargetNum <= 1000;
  const submitMission = () => {
    // Blocked taps explain themselves, first unmet condition first.
    if (missionTitle.trim().length === 0) return toast('미션 이름을 입력해주세요', 'error');
    if (!Number.isInteger(missionTargetNum) || missionTargetNum < 1 || missionTargetNum > 1000)
      return toast('목표값은 1~1000 사이 숫자로 입력해주세요', 'error');
    if (!currentHouse?.houseId) return;
    onCreateMission?.(currentHouse.houseId, {
      title: missionTitle.trim(),
      missionType,
      targetValue: missionTargetNum,
      // KST day bounds: 시작일 자정부터 종료일 하루 끝까지 (종료일 당일 포함).
      ...(missionHasPeriod
        ? {
            startsAt: `${missionStart}T00:00:00+09:00`,
            endsAt: missionEnd ? `${missionEnd}T23:59:59+09:00` : undefined,
          }
        : {}),
    });
    setShowCreateMission(false);
    setMissionTitle('');
    setMissionTarget('10');
    setMissionHasPeriod(false);
  };
  const toggleMissionPeriod = () => {
    setMissionHasPeriod((prev) => {
      const next = !prev;
      if (next) {
        // Re-derive on each enable — the mounted default goes stale overnight.
        const start = todayIso();
        setMissionStart(start);
        setMissionEnd(addDaysIso(start, 7));
      }
      return next;
    });
  };
  const openEditHouse = () => {
    setEditName(currentHouse?.title ?? '');
    setEditDesc(currentHouse?.description ?? '');
    setEditMax(currentHouse?.maxMembers);
    setEditCover(currentHouse?.coverImageKey);
    setShowEditHouse(true);
  };
  const editNameValid = editName.trim().length >= 2 && editName.trim().length <= 30;
  const submitEditHouse = () => {
    if (!editNameValid) return toast('집 이름은 2~30자로 입력해주세요', 'error');
    if (!currentHouse?.houseId) return;
    onUpdateHouse?.(currentHouse.houseId, {
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      maxMembers: editMax,
      // Omitted keeps the server value — only send an actual pick.
      coverImageKey: editCover,
    });
    setShowEditHouse(false);
  };
  const confirmTransfer = () => {
    if (transferTarget?.membershipId && currentHouse?.houseId) {
      onTransferOwnership?.(currentHouse.houseId, transferTarget.membershipId);
    }
    setTransferTarget(null);
  };
  // Leaving needs the server house id; the server rejects an OWNER's leave
  // until ownership is transferred, so the owner sees guidance instead.
  const canLeave = !!(onLeaveHouse && currentHouse?.houseId);
  // 혼자 남은 방장은 위임 상대가 없어 바로 탈퇴할 수 있고, 마지막 구성원이
  // 나가면 집이 정리된다(서버 계약) — 버튼을 '집 삭제'로 정직하게 표기 (#309).
  const isLoneOwner = isOwner && members.filter((m) => !isKicked(m.name)).length <= 1;
  const confirmLeave = () => {
    if (currentHouse?.houseId) onLeaveHouse?.(currentHouse.houseId);
    setShowLeaveConfirm(false);
    setShowMembers(false);
  };
  const confirmKick = () => {
    if (memberToKick) {
      // Server kick when wired to the API; local placeholder otherwise (demo).
      if (onKickMember && currentHouse?.houseId && memberToKick.membershipId) {
        onKickMember(currentHouse.houseId, memberToKick.membershipId);
      } else {
        setKicked((prev) => [...prev, keyFor(memberToKick.name)]);
      }
    }
    setMemberToKick(null);
  };

  // No houses yet (fresh account) → guide to 집 탐색 instead of crashing on
  // an empty switcher.
  // 창문 타일 탭 판정 (#307): 한 번 탭 = 방문(더블탭 간격만큼 지연 실행),
  // 더블탭 = 그 방으로 카메라 줌인. 그리드 타일(프레임 밖)은 기존 즉시 방문.
  // (훅이라 조건부 return들보다 앞에 있어야 한다.)
  const pendingVisit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeatTap = useRef({ seatIdx: -1, at: 0 });
  useEffect(
    () => () => {
      if (pendingVisit.current) clearTimeout(pendingVisit.current);
    },
    [],
  );

  if (!currentHouse) {
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={styles.emptyWrap}>
          {loading ? (
            <>
              <ActivityIndicator color={t.primary} />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>불러오는 중…</Text>
            </>
          ) : (
            <>
              <Text style={[Typography.h3, { color: t.text }]}>아직 함께하는 집이 없어요</Text>
              <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
                집을 만들거나 초대코드로 입주해 친구들과 루틴을 함께 키워보세요.
              </Text>
              <Pressable
                onPress={onOpenSearch}
                accessibilityRole="button"
                accessibilityLabel="집 탐색"
                style={[styles.emptyCta, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>집 탐색하기</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  if (showMembers) {
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
          <Pressable
            onPress={() => setShowMembers(false)}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="back" size={26} color={t.text} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={[Typography.supporting, { color: t.primaryText }]}>
              {currentHouse.title}
            </Text>
            <Text style={[Typography.h3, { color: t.text }]}>구성원 관리</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {currentHouse.inviteCode ? (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.codeHead}>
                <Text style={[Typography.label, styles.flex, { color: t.text }]}>초대코드</Text>
                {isOwner && onReissueInviteCode ? (
                  <Pressable
                    onPress={() => setShowReissueConfirm(true)}
                    accessibilityRole="button"
                    accessibilityLabel="초대코드 재발급"
                    style={[styles.reissueBtn, { backgroundColor: t.surfaceMuted }]}>
                    <Text style={[Typography.supporting, { color: t.primaryText }]}>재발급</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                친구에게 코드를 공유해 집에 초대하세요.
              </Text>
              <View
                style={[
                  styles.codeBox,
                  { borderColor: t.border, backgroundColor: t.surfaceMuted },
                ]}>
                <Text style={[Typography.h3, styles.code, { color: t.text }]}>
                  {currentHouse.inviteCode}
                </Text>
              </View>
            </View>
          ) : null}

          {isOwner && onUpdateHouse ? (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[Typography.label, { color: t.text }]}>집 정보</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                집 이름·소개·정원을 바꿀 수 있어요. (방장 전용)
              </Text>
              <Pressable
                onPress={openEditHouse}
                accessibilityRole="button"
                accessibilityLabel="집 정보 수정"
                style={[styles.editHouseBtn, { backgroundColor: t.surfaceMuted }]}>
                <PencilPictogram size={14} />
                <Text style={[Typography.label, { color: t.primaryText }]}>집 정보 수정</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.memberList}>
            {members.map((member) => {
              const kickedOut = isKicked(member.name);
              return (
                <View
                  key={`${member.level}-${member.name}`}
                  style={[styles.memberRow, { backgroundColor: t.surface }]}>
                  <View
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: kickedOut ? t.surfaceMuted : member.color },
                    ]}>
                    {kickedOut ? (
                      <Icon name="leave" size={22} color={t.textMuted} />
                    ) : (
                      <CharacterAvatar characterId={characterId} size={36} />
                    )}
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.memberNameRow}>
                      <Text style={[Typography.label, { color: t.text }]}>{member.name}</Text>
                      {member.isOwner ? (
                        <View style={[styles.ownerBadge, { backgroundColor: `${t.primary}22` }]}>
                          <CrownPictogram size={10} />
                          <Text style={[styles.ownerBadgeText, { color: t.primaryText }]}>
                            방장
                          </Text>
                        </View>
                      ) : null}
                      {member.isMine ? (
                        <Text
                          style={[styles.myBadge, { backgroundColor: t.warning, color: t.onTint }]}>
                          MY
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      {kickedOut ? '강퇴된 멤버' : member.level}
                    </Text>
                  </View>
                  {isOwner &&
                  onTransferOwnership &&
                  !member.isMine &&
                  member.membershipId &&
                  !kickedOut ? (
                    <Pressable
                      onPress={() => setTransferTarget(member)}
                      accessibilityRole="button"
                      accessibilityLabel={`${member.name} 방장 위임`}
                      style={[styles.kickBtn, { backgroundColor: `${t.primary}22` }]}>
                      <Text style={[Typography.supporting, { color: t.primaryText }]}>위임</Text>
                    </Pressable>
                  ) : null}
                  {/* 내 카드에는 강퇴 버튼 자체를 두지 않는다 (disable 아님). */}
                  {canKick && !member.isMine ? (
                    <Pressable
                      onPress={() => setMemberToKick(member)}
                      disabled={kickedOut}
                      accessibilityRole="button"
                      accessibilityLabel={`${member.name} 강퇴`}
                      style={[
                        styles.kickBtn,
                        { backgroundColor: kickedOut ? t.surfaceMuted : `${t.danger}22` },
                      ]}>
                      <Text
                        style={[
                          Typography.supporting,
                          { color: kickedOut ? t.textDisabled : t.danger },
                        ]}>
                        {kickedOut ? '강퇴됨' : '강퇴'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          {canLeave ? (
            <View style={styles.leaveWrap}>
              {isOwner && !isLoneOwner ? (
                <Text style={[Typography.supporting, styles.leaveHint, { color: t.textMuted }]}>
                  방장은 다른 멤버에게 방장을 위임한 뒤 나갈 수 있어요.
                </Text>
              ) : (
                <Pressable
                  onPress={() => setShowLeaveConfirm(true)}
                  accessibilityRole="button"
                  accessibilityLabel={isLoneOwner ? '집 삭제' : '집 나가기'}
                  style={[styles.leaveBtn, { backgroundColor: `${t.danger}22` }]}>
                  <DoorPictogram size={14} />
                  <Text style={[Typography.label, { color: t.danger }]}>
                    {isLoneOwner ? '집 삭제' : '집 나가기'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </ScrollView>

        {showReissueConfirm ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>초대코드를 재발급할까요?</Text>
              <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
                기존 코드는 즉시 만료돼요. 이미 공유한 코드로는 더 이상 입주할 수 없어요.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setShowReissueConfirm(false)}
                  accessibilityRole="button"
                  accessibilityLabel="재발급 취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (currentHouse.houseId) onReissueInviteCode?.(currentHouse.houseId);
                    setShowReissueConfirm(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="재발급 확인"
                  style={[styles.modalBtn, { backgroundColor: t.primary }]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>재발급</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {showLeaveConfirm ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>
                {isLoneOwner ? '집을 삭제할까요?' : '집에서 나갈까요?'}
              </Text>
              <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
                {isLoneOwner
                  ? `혼자 남은 집이라 나가면 '${currentHouse?.title}' 집이 삭제되고 탐색·조회에서 사라져요.`
                  : '나가도 기여 기록은 유지되고, 초대를 받아 다시 참여하면 이전 기록이 복원돼요.'}
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setShowLeaveConfirm(false)}
                  accessibilityRole="button"
                  accessibilityLabel="나가기 취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={confirmLeave}
                  accessibilityRole="button"
                  accessibilityLabel={isLoneOwner ? '집 삭제 확인' : '나가기 확인'}
                  style={[styles.modalBtn, { backgroundColor: t.danger }]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>
                    {isLoneOwner ? '삭제' : '나가기'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {memberToKick ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>정말 강퇴할까요?</Text>
              <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
                {memberToKick.name}님을 강퇴하면 집 화면에서 빈방으로 표시됩니다.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setMemberToKick(null)}
                  accessibilityRole="button"
                  accessibilityLabel="취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={confirmKick}
                  accessibilityRole="button"
                  accessibilityLabel="강퇴 확인"
                  style={[styles.modalBtn, { backgroundColor: t.danger }]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>강퇴</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {transferTarget ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>방장을 위임할까요?</Text>
              <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
                {transferTarget.name}님에게 방장을 넘기면 집 관리 권한(정보 수정·강퇴·초대코드)이
                이동하고 되돌릴 수 없어요.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setTransferTarget(null)}
                  accessibilityRole="button"
                  accessibilityLabel="위임 취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={confirmTransfer}
                  accessibilityRole="button"
                  accessibilityLabel="위임 확인"
                  style={[styles.modalBtn, { backgroundColor: t.primary }]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>위임</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {showEditHouse ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>집 정보 수정</Text>
              <ScrollView style={styles.editScroll} contentContainerStyle={styles.missionForm}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  집 이름 (2~30자)
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={(v) => setEditName(v.slice(0, 30))}
                  accessibilityLabel="집 이름"
                  placeholder="집 이름"
                  placeholderTextColor={t.textMuted}
                  style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
                />
                <Text style={[Typography.supporting, { color: t.textMuted }]}>한 줄 소개</Text>
                <TextInput
                  value={editDesc}
                  onChangeText={setEditDesc}
                  accessibilityLabel="집 소개"
                  placeholder="어떤 루틴을 함께 하나요?"
                  placeholderTextColor={t.textMuted}
                  style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
                />
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  정원{currentHouse.memberCount ? ` (현재 ${currentHouse.memberCount}명)` : ''}
                </Text>
                <View style={styles.missionTypeRow}>
                  {CAPACITY_OPTIONS.map((n) => {
                    const selected = n === editMax;
                    // The server rejects a capacity below the current headcount.
                    const tooSmall = !!currentHouse.memberCount && n < currentHouse.memberCount;
                    return (
                      <Pressable
                        key={n}
                        onPress={() =>
                          tooSmall
                            ? toast('현재 인원보다 작게 줄일 수 없어요', 'error')
                            : setEditMax(n)
                        }
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled: tooSmall }}
                        accessibilityLabel={`정원 ${n}명`}
                        style={[
                          styles.capacityBtn,
                          {
                            backgroundColor: selected
                              ? t.primary
                              : tooSmall
                                ? t.disabledBg
                                : t.surfaceMuted,
                          },
                        ]}>
                        <Text
                          style={[
                            Typography.supporting,
                            {
                              color: selected
                                ? t.onPrimary
                                : tooSmall
                                  ? t.textDisabled
                                  : t.textMuted,
                            },
                          ]}>
                          {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {covers.length > 0 ? (
                  <>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>대표 이미지</Text>
                    <HouseCoverPicker
                      covers={covers}
                      selectedKey={editCover}
                      onSelect={setEditCover}
                    />
                  </>
                ) : null}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setShowEditHouse(false)}
                  accessibilityRole="button"
                  accessibilityLabel="집 정보 수정 취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={submitEditHouse}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !editNameValid }}
                  accessibilityLabel="집 정보 저장"
                  style={[
                    styles.modalBtn,
                    { backgroundColor: editNameValid ? t.primary : t.disabledBg },
                  ]}>
                  <Text
                    style={[
                      Typography.label,
                      { color: editNameValid ? t.onPrimary : t.textMuted },
                    ]}>
                    저장
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // 좌석 타일 — 프레임 창문(#287)과 평면 그리드가 같은 타일을 공유한다.
  // fill=true(창문)면 슬롯을 가득 채우고, 아니면 반칸 정사각형.
  const visitSeat = (room: RoomCell) => {
    if (room.isMine) return onVisitMyRoom?.();
    onVisitFriend?.({
      name: room.name,
      userId: room.userId,
      houseId: currentHouse?.houseId,
      membershipId: room.membershipId,
    });
  };
  const onSeatPress = (room: RoomCell, seatIdx: number, inWindow: boolean) => {
    if (!inWindow) return visitSeat(room);
    const now = Date.now();
    const isDouble =
      lastSeatTap.current.seatIdx === seatIdx && now - lastSeatTap.current.at < DOUBLE_TAP_MS;
    lastSeatTap.current = { seatIdx: isDouble ? -1 : seatIdx, at: now };
    if (pendingVisit.current) {
      clearTimeout(pendingVisit.current);
      pendingVisit.current = null;
    }
    if (isDouble) return zoomToSeat(seatIdx);
    pendingVisit.current = setTimeout(() => {
      pendingVisit.current = null;
      visitSeat(room);
    }, DOUBLE_TAP_MS);
  };

  const renderSeatTile = (room: RoomCell, seatIdx: number, fill = false) => {
    const dragging = dragSeat === seatIdx;
    const empty = room.vacant || isKicked(room.name);
    const preview =
      !empty && room.membershipId != null ? roomPreviews?.[room.membershipId] : undefined;
    return (
      <Animated.View
        // Vacant seats all read '빈방' — the seat index keys them.
        key={`seat-${seatIdx}-${room.name}`}
        ref={(el: View | null) => {
          if (el) tileRefs.current.set(seatIdx, el);
          else tileRefs.current.delete(seatIdx);
        }}
        style={[
          styles.roomCellWrap,
          dragging && {
            transform: [...dragPan.getTranslateTransform(), { scale: 1.05 }],
            ...styles.roomCellLifted,
          },
        ]}>
        <Pressable
          onPress={empty ? undefined : () => onSeatPress(room, seatIdx, fill)}
          onLongPress={empty || zoomed ? undefined : () => startDrag(seatIdx)}
          delayLongPress={220}
          onPressOut={onTilePressOut}
          disabled={empty}
          accessibilityRole="button"
          accessibilityLabel={room.isMine ? `${room.name} (나)` : room.name}
          accessibilityHint={
            empty
              ? undefined
              : fill
                ? '두 번 탭해 확대, 길게 눌러 자리 옮기기'
                : '길게 눌러 자리 옮기기'
          }
          style={[
            fill ? styles.roomCellFill : styles.roomCell,
            {
              backgroundColor: empty ? t.surfaceMuted : room.color,
              borderColor: t.border,
            },
          ]}>
          {/* The member's live room fills the tile (visit preview);
              plain tint + avatar stand in until it loads. */}
          {preview ? (
            <View style={styles.roomPreview} pointerEvents="none" testID="room-preview">
              <Room
                placedFurnitureIds={preview.placedFurnitureIds}
                placements={preview.placements ?? null}
                wallpaperId={preview.wallpaperId}
                floorId={preview.floorId}
                backgroundId={preview.backgroundId}
                characterId={preview.characterId}
                furniture={furniture}
                wallpapers={wallpapers}
                floors={floorSurfaces}
                backgrounds={backgrounds}
                fill
                style={styles.roomPreviewFill}
              />
            </View>
          ) : null}
          {/* 빈 좌석은 캐릭터 없는 기본 빈 방을 낮춘 톤으로 —
              "방은 준비돼 있고 주인만 없다" (#281, 시안 A). */}
          {empty ? (
            <View style={styles.roomPreview} pointerEvents="none" testID="vacant-room">
              <Room
                placedFurnitureIds={[]}
                characterId={null}
                floorId={VACANT_FLOOR[0].id}
                floors={VACANT_FLOOR}
                fill
                style={[styles.roomPreviewFill, styles.vacantRoom]}
              />
            </View>
          ) : null}
          {room.isMine ? (
            <View style={[styles.myTag, { backgroundColor: t.warning }]}>
              <Text style={[styles.myTagText, { color: t.onTint }]}>MY</Text>
            </View>
          ) : null}
          {empty || preview ? null : <CharacterAvatar characterId={characterId} size={64} />}
          {/* Tiles keep their fixed pastel bg in dark mode — the name needs
              onTint ink, not the (light) theme text. Over a preview it drops
              to a bottom scrim for contrast. 빈 좌석은 라벨 없이 빈 방
              비주얼만 — 접근성 라벨은 Pressable이 유지한다. */}
          {empty ? null : (
            <View style={[styles.roomNameRow, preview && styles.roomNameOverlay]}>
              {room.isOwner ? <CrownPictogram size={12} /> : null}
              <Text
                style={[
                  Typography.supporting,
                  styles.roomName,
                  { color: preview ? '#FFFFFF' : t.onTint },
                ]}>
                {room.isMine ? `${room.name} (나)` : room.name}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.screen, screenStyle]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <View style={styles.flex} />
        <Pressable
          onPress={onOpenSearch}
          accessibilityRole="button"
          accessibilityLabel="집 탐색"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="search" size={18} color={t.text} />
        </Pressable>
        <Pressable
          onPress={() => setShowMembers(true)}
          accessibilityRole="button"
          accessibilityLabel="구성원 목록"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="members" size={18} color={t.text} />
        </Pressable>
      </View>

      {/* 타일 드래그 중에는 스크롤이 제스처를 뺏지 않게 잠근다 (#278). */}
      <ScrollView
        contentContainerStyle={styles.body}
        scrollEnabled={dragSeat == null}
        testID="house-scroll">
        {frameActive ? (
          /* 프레임 모드(#287) — 하늘 위에 스위처·집 프레임, 방은 창문 안에. */
          <View
            style={[styles.skySection, { backgroundColor: t.sky }]}
            {...swipeResponder.panHandlers}>
            {/* 마당 잔디 — 프레임 하단이 밟고 서는 밴드. */}
            <View style={[styles.grassBand, { backgroundColor: t.grass }]} />
            <View style={styles.switcher}>
              {houses.length > 1 ? (
                <Pressable
                  onPress={prevHouse}
                  accessibilityRole="button"
                  accessibilityLabel="이전 집"
                  hitSlop={8}
                  style={[styles.iconBtn, { backgroundColor: t.surface }]}>
                  <Icon name="back" size={18} color={t.text} />
                </Pressable>
              ) : null}
              <View style={[styles.titleBadge, { backgroundColor: t.surface }]}>
                {currentHouse.myRole === 'OWNER' ? (
                  <CrownPictogram size={14} />
                ) : (
                  <HousePictogram size={14} />
                )}
                <Text style={[Typography.h3, { color: t.text }]}>{currentHouse.title}</Text>
              </View>
              {houses.length > 1 ? (
                <Pressable
                  onPress={nextHouse}
                  accessibilityRole="button"
                  accessibilityLabel="다음 집"
                  hitSlop={8}
                  style={[styles.iconBtn, { backgroundColor: t.surface }]}>
                  <Icon name="forward" size={18} color={t.text} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.dots}>
              {houses.map((house, i) => (
                <View
                  key={house.houseId ?? `demo-${i}`}
                  style={[
                    styles.dot,
                    i === houseIndex
                      ? { width: 20, backgroundColor: t.primary }
                      : { width: 6, backgroundColor: t.surface },
                  ]}
                />
              ))}
            </View>
            {/* 레벨·멤버 pill — 프레임 여백과 정렬된 행 (모서리 절대배치는
                화면 끝에 걸려 보였다). 고정 밝기 스크림 위라 literal 잉크. */}
            <View style={styles.framePillsRow}>
              <View style={[styles.skyPill, { backgroundColor: 'rgba(255,255,255,0.88)' }]}>
                <HousePictogram size={12} />
                <Text style={[Typography.supporting, styles.heroPillText]}>
                  Lv.{currentHouse.level ?? 0}
                  {currentHouse.growthPoints != null
                    ? ` · ${currentHouse.growthPoints % 100}/100`
                    : ''}
                </Text>
              </View>
              <View style={[styles.skyPill, { backgroundColor: 'rgba(255,255,255,0.88)' }]}>
                <Text style={[Typography.supporting, styles.heroPillText]}>
                  {/* Vacant seats are not members — count the real ones. */}
                  멤버 {currentHouse.memberCount ?? members.length}
                  {currentHouse.maxMembers ? ` / ${currentHouse.maxMembers}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.cameraViewport} {...cameraResponder.panHandlers}>
              <Animated.View
                style={{
                  transform: [{ translateX: camTx }, { translateY: camTy }, { scale: camScale }],
                }}>
                <View style={styles.frameWrap} {...gridPanResponder.panHandlers}>
                  {/* 프레임 측정용 — 반응자 프롭이 있는 부모에는 테스트에서
                      layout 이벤트가 닿지 않아 absolute-fill 형제로 잰다. */}
                  <View
                    testID="frame-camera"
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                    onLayout={(e) => {
                      const first = frameSize.current.w === 0;
                      frameSize.current = {
                        w: e.nativeEvent.layout.width,
                        h: e.nativeEvent.layout.height,
                      };
                      // 첫 레이아웃에 기본 카메라(방 4칸 클로즈업)를 즉시 적용 (#307).
                      if (first) {
                        const d = camDefault();
                        cam.current = d;
                        camScale.setValue(d.scale);
                        camTx.setValue(d.tx);
                        camTy.setValue(d.ty);
                      }
                    }}
                  />
                  {/* 창문 뒤 좌석 — 프레임 PNG의 투명 창문으로 방이 보인다. */}
                  {WINDOW_RECTS.map((rect, w) => {
                    const seatIdx = windowSlots[w];
                    return (
                      <View
                        key={`window-${w}`}
                        style={[
                          styles.windowSlot,
                          rect,
                          seatIdx != null && dragSeat === seatIdx && styles.dragRow,
                        ]}>
                        {seatIdx != null ? (
                          renderSeatTile(displayCells[seatIdx], seatIdx, true)
                        ) : (
                          /* 정원 밖 창문 — 조용한 벽 패널. */
                          <View
                            style={[styles.windowFiller, { backgroundColor: t.surfaceMuted }]}
                          />
                        )}
                      </View>
                    );
                  })}
                  <Image
                    source={assetSource(currentHouse.coverImageKey)}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    transition={120}
                    pointerEvents="none"
                    accessibilityLabel={`${currentHouse.title} 집`}
                    testID="house-frame"
                  />
                </View>
              </Animated.View>
              {zoomed ? (
                <Pressable
                  onPress={resetCam}
                  accessibilityRole="button"
                  accessibilityLabel="확대 종료"
                  style={[styles.camReset, { backgroundColor: t.surface }]}>
                  <Icon name="refresh" size={16} color={t.text} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            {/* 커버가 없는 집 — 기존 히어로 폴백 (#276 B안). */}
            <View style={styles.hero} {...swipeResponder.panHandlers}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: t.surfaceMuted }]} />
              <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.88)' }]}>
                <HousePictogram size={12} />
                <Text style={[Typography.supporting, styles.heroPillText]}>
                  Lv.{currentHouse.level ?? 0}
                  {currentHouse.growthPoints != null
                    ? ` · ${currentHouse.growthPoints % 100}/100`
                    : ''}
                </Text>
              </View>
              {houses.length > 1 ? (
                <>
                  <Pressable
                    onPress={prevHouse}
                    accessibilityRole="button"
                    accessibilityLabel="이전 집"
                    hitSlop={8}
                    style={[styles.heroNav, styles.heroNavLeft]}>
                    <Icon name="back" size={16} color="#4A403A" />
                  </Pressable>
                  <Pressable
                    onPress={nextHouse}
                    accessibilityRole="button"
                    accessibilityLabel="다음 집"
                    hitSlop={8}
                    style={[styles.heroNav, styles.heroNavRight]}>
                    <Icon name="forward" size={16} color="#4A403A" />
                  </Pressable>
                </>
              ) : null}
              <View style={styles.heroFoot}>
                <Text style={[Typography.h3, styles.heroName]}>{currentHouse.title}</Text>
                <Text style={[Typography.supporting, styles.heroMeta]}>
                  {/* Vacant seats are not members — count the real ones. */}
                  멤버 {currentHouse.memberCount ?? members.length}
                  {currentHouse.maxMembers ? ` / ${currentHouse.maxMembers}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.dots}>
              {houses.map((house, i) => (
                <View
                  // houseId when wired; titles can repeat, so fall back to index.
                  key={house.houseId ?? `demo-${i}`}
                  style={[
                    styles.dot,
                    i === houseIndex
                      ? { width: 20, backgroundColor: t.primary }
                      : { width: 6, backgroundColor: t.border },
                  ]}
                />
              ))}
            </View>
          </>
        )}

        {/* 요약 스탯 — 스크롤 없이 집의 오늘이 보인다 (B안). */}
        <View style={styles.summaryRow}>
          <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.statV, { color: t.primaryText }]}>{activeMissions.length}</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>진행 중 미션</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.statV, { color: t.primaryText }]}>
              {contributedToday}/{activeMissions.length}
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>오늘 나의 기여</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.statV, { color: t.primaryText }]}>{toNextLevel ?? '—'}</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>다음 레벨까지</Text>
          </View>
        </View>

        <View style={styles.floors} {...gridPanResponder.panHandlers}>
          {roomPairs.map((pair, pairIdx) => {
            // The dragged tile must float above sibling rows too.
            const rowHasDrag =
              dragSeat != null &&
              dragSeat >= rowOffsets[pairIdx] &&
              dragSeat < rowOffsets[pairIdx] + pair.length;
            return (
              // Vacant rows share the '빈방' name — the row index keys them.
              <View
                key={`${pairIdx}-${pair[0]?.name ?? ''}`}
                style={[styles.floor, rowHasDrag && styles.dragRow]}>
                <View style={styles.floorRooms}>
                  {pair.map((room, i) => renderSeatTile(room, rowOffsets[pairIdx] + i))}
                  {/* Odd capacity → invisible filler keeps the lone tile half-width. */}
                  {pair.length === 1 ? (
                    <View style={styles.roomSpacer} testID="room-spacer" />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 공동 미션 플로팅 버튼 (#287) — 보상 수령 가능하면 점 표시. */}
      <Pressable
        onPress={() => setShowMissions(true)}
        accessibilityRole="button"
        accessibilityLabel="공동 미션"
        style={[styles.missionFab, { backgroundColor: t.primary }]}>
        <TargetPictogram size={24} color={t.onPrimary} />
        {missions.some((m) => m.status === 'ACTIVE' && m.achieved) ? (
          <View style={[styles.fabDot, { backgroundColor: t.warning }]} />
        ) : null}
      </Pressable>

      {showMissions ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <View style={styles.missionHead}>
              <View style={[styles.flex, styles.missionTitleRow]}>
                <TargetPictogram size={18} />
                <Text style={[Typography.h3, { color: t.text }]}>우리 집의 목표</Text>
              </View>
              {canCreateMission ? (
                <Pressable
                  onPress={() => setShowCreateMission(true)}
                  accessibilityRole="button"
                  accessibilityLabel="미션 만들기"
                  style={[styles.missionAddBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.supporting, { color: t.primaryText }]}>＋ 만들기</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView style={styles.editScroll}>
              {missions.length === 0 ? (
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  아직 미션이 없어요. 첫 미션을 만들어 다 같이 도전해보세요!
                </Text>
              ) : (
                <View style={styles.goals}>
                  {missions.map((mission) => {
                    const pct = Math.min(1, mission.current / mission.target);
                    const claimable = mission.status === 'ACTIVE' && mission.achieved;
                    return (
                      <View
                        key={mission.id}
                        style={[styles.goalRow, { backgroundColor: t.surfaceMuted }]}>
                        <Pictogram name={mission.icon} size={22} />
                        <View style={styles.flex}>
                          <View style={styles.goalHead}>
                            <Text
                              style={[Typography.label, styles.flex, { color: t.text }]}
                              numberOfLines={1}>
                              {mission.title}
                            </Text>
                            <Text style={[Typography.supporting, { color: t.primaryText }]}>
                              {mission.current}/{mission.target}
                            </Text>
                            {canDeleteMission && mission.status !== 'COMPLETED' ? (
                              <Pressable
                                onPress={() => setMissionToDelete(mission)}
                                accessibilityRole="button"
                                accessibilityLabel={`${mission.title} 삭제`}
                                hitSlop={8}
                                style={styles.missionDeleteBtn}>
                                <TrashPictogram size={14} color={t.textMuted} />
                              </Pressable>
                            ) : null}
                          </View>
                          <View style={[styles.goalTrack, { backgroundColor: t.border }]}>
                            <View
                              style={[
                                styles.goalFill,
                                { backgroundColor: t.primary, width: `${pct * 100}%` },
                              ]}
                            />
                          </View>
                          <View style={styles.missionFoot}>
                            <Text
                              style={[Typography.supporting, styles.flex, { color: t.textMuted }]}
                              numberOfLines={1}>
                              {mission.desc}
                            </Text>
                            {/* Own node (not a desc suffix) so the long type label
                            truncates instead of the date. */}
                            {mission.endsOn && mission.status === 'ACTIVE' ? (
                              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                                ~{mission.endsOn.slice(5).replace('-', '.')}
                              </Text>
                            ) : null}
                            {mission.status === 'COMPLETED' ? (
                              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                                완료
                              </Text>
                            ) : mission.status === 'EXPIRED' ? (
                              <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                                기간 만료
                              </Text>
                            ) : claimable && currentHouse.houseId && onClaimMission ? (
                              <Pressable
                                onPress={() => onClaimMission(currentHouse.houseId!, mission.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`${mission.title} 보상 받기`}
                                style={[styles.missionBtn, { backgroundColor: t.warning }]}>
                                <Text style={[Typography.supporting, { color: t.text }]}>
                                  보상 받기
                                </Text>
                              </Pressable>
                            ) : mission.status === 'ACTIVE' && isContributed(mission) ? (
                              // 오늘 기여 완료 — 연동 루틴의 오늘 완료 여부로도 파생되어
                              // 앱을 다시 켜도 라벨이 유지된다.
                              <Text style={[Typography.supporting, { color: t.primaryText }]}>
                                기여함
                              </Text>
                            ) : mission.status === 'ACTIVE' &&
                              linkedRoutines.some((r) => r.title === mission.title) ? (
                              // Filed as my routine — completing it contributes.
                              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                                루틴 연동됨
                              </Text>
                            ) : mission.status === 'ACTIVE' &&
                              currentHouse.houseId &&
                              onAddMissionRoutine ? (
                              <Pressable
                                onPress={() => setMissionToAdd(mission)}
                                accessibilityRole="button"
                                accessibilityLabel={`${mission.title} 내 루틴에 추가`}
                                style={[styles.missionBtn, { backgroundColor: t.primary }]}>
                                <Text style={[Typography.supporting, { color: t.onPrimary }]}>
                                  ＋ 내 루틴에
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowMissions(false)}
                accessibilityRole="button"
                accessibilityLabel="공동 미션 닫기"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>닫기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {missionToAdd && currentHouse?.houseId ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>내 루틴에 추가하시겠습니까?</Text>
            <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
              {`'${currentHouse.title}' 카테고리에 '${missionToAdd.title}' 루틴이 만들어져요. 루틴을 완료하면 자동으로 미션에 기여돼요.`}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setMissionToAdd(null)}
                accessibilityRole="button"
                accessibilityLabel="루틴 추가 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>아니요</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onAddMissionRoutine?.(currentHouse.houseId!, missionToAdd);
                  setMissionToAdd(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="루틴 추가 확인"
                style={[styles.modalBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>네</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {missionToDelete && currentHouse?.houseId ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>미션 삭제</Text>
            <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
              {`'${missionToDelete.title}' 미션을 삭제할까요?\n지금까지의 기여 기록은 남지만 미션은 목록에서 사라져요. 멤버들이 만든 연동 루틴은 삭제되지 않아요.`}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setMissionToDelete(null)}
                accessibilityRole="button"
                accessibilityLabel="미션 삭제 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onDeleteMission?.(currentHouse.houseId!, missionToDelete.id);
                  setMissionToDelete(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="미션 삭제 확인"
                style={[styles.modalBtn, { backgroundColor: t.danger }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>삭제</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showCreateMission ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>새 미션 만들기</Text>
            <View style={styles.missionForm}>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>미션 제목</Text>
              <TextInput
                value={missionTitle}
                onChangeText={(v) => setMissionTitle(v.slice(0, 160))}
                placeholder="예) 이번 주 다같이 루틴 지키기"
                placeholderTextColor={t.textMuted}
                accessibilityLabel="미션 제목"
                style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>미션 유형</Text>
              <View style={styles.missionTypeRow}>
                {MISSION_TYPE_OPTIONS.map((opt) => {
                  const selected = opt.type === missionType;
                  return (
                    <Pressable
                      key={opt.type}
                      onPress={() => setMissionType(opt.type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[
                        styles.missionTypeBtn,
                        { backgroundColor: selected ? t.primary : t.surfaceMuted },
                      ]}>
                      <Pictogram
                        name={opt.icon}
                        size={14}
                        color={selected ? t.onPrimary : t.textMuted}
                      />
                      <Text
                        style={[
                          Typography.supporting,
                          { color: selected ? t.onPrimary : t.textMuted },
                        ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                목표 수치 (1~1000)
              </Text>
              <TextInput
                value={missionTarget}
                onChangeText={setMissionTarget}
                keyboardType="number-pad"
                accessibilityLabel="목표 수치"
                style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              />
              <View style={styles.periodRow}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>기간 설정</Text>
                <ToggleSwitch
                  value={missionHasPeriod}
                  onToggle={toggleMissionPeriod}
                  accessibilityLabel="기간 설정"
                />
              </View>
              {missionHasPeriod ? (
                <Pressable
                  onPress={() => setShowPeriodSheet(true)}
                  accessibilityRole="button"
                  accessibilityLabel="미션 기간 선택"
                  style={[styles.missionInput, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.supporting, { color: t.text }]}>
                    {formatDate(missionStart)} ~ {missionEnd ? formatDate(missionEnd) : '무기한'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCreateMission(false)}
                accessibilityRole="button"
                accessibilityLabel="미션 만들기 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={submitMission}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmitMission }}
                accessibilityLabel="미션 만들기 확인"
                style={[
                  styles.modalBtn,
                  { backgroundColor: canSubmitMission ? t.primary : t.disabledBg },
                ]}>
                <Text
                  style={[
                    Typography.label,
                    { color: canSubmitMission ? t.onPrimary : t.textMuted },
                  ]}>
                  만들기
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Mission period picker — its overlay (zIndex 100) sits above the modal. */}
      <DateRangeSheet
        visible={showPeriodSheet}
        initialStartDate={missionStart}
        initialEndDate={missionEnd}
        onSave={(start, end) => {
          setMissionStart(start);
          setMissionEnd(end);
        }}
        onClose={() => setShowPeriodSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  emptyBody: {
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 18,
  },
  body: {
    paddingBottom: Spacing.six,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  dot: {
    height: 6,
    borderRadius: Radius.pill,
  },
  floors: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  floor: {
    gap: Spacing.two,
  },
  floorRooms: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  roomSpacer: {
    flex: 1,
  },
  roomCellWrap: {
    flex: 1,
  },
  // Lifted (dragging) tile floats above its row; the row itself gets dragRow
  // so it also floats above sibling rows.
  roomCellLifted: {
    zIndex: 10,
    elevation: 8,
  },
  dragRow: {
    zIndex: 10,
    elevation: 8,
  },
  roomCell: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    overflow: 'hidden',
  },
  roomPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  // 빈 좌석의 빈 방은 톤을 낮춰 멤버 방과 확실히 구분한다 (시안 A).
  vacantRoom: {
    opacity: 0.55,
  },
  roomPreviewFill: {
    width: '100%',
    height: '100%',
  },
  // Over a room preview the name drops to the bottom edge on a dark scrim.
  roomNameOverlay: {
    position: 'absolute',
    bottom: Spacing.one,
    // 0.4는 밝은 방 프리뷰 위에서 흰 글자가 4.5:1 아래로 떨어졌다(UX 감사).
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  roomName: {
    fontWeight: '600',
  },
  myTag: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  myTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  codeBox: {
    marginTop: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  code: {
    letterSpacing: 4,
  },
  memberList: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  myBadge: {
    fontSize: 9,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  kickBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  // The edit form scrolls (cover grid makes it taller than small screens).
  editScroll: {
    flexGrow: 0,
  },
  modalBody: {
    marginTop: Spacing.two,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  modalBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  goals: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  hero: {
    position: 'relative',
    height: 132,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  // --- 프레임 모드 (#287) ---
  skySection: {
    position: 'relative',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    marginBottom: Spacing.two,
  },
  // 잔디 밴드 — 프레임 하단 뒤에 깔린다.
  grassBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  cameraViewport: {
    marginTop: Spacing.two,
    marginHorizontal: Spacing.three,
    overflow: 'hidden',
  },
  frameWrap: {
    width: '100%',
    aspectRatio: FRAME_ASPECT,
  },
  camReset: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    // 확대된 프레임 콘텐츠 위에 떠야 한다.
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  // 프레임 PNG의 투명 창문 자리 — 좌석 타일이 이 안을 가득 채운다.
  windowSlot: {
    position: 'absolute',
  },
  windowFiller: {
    flex: 1,
    borderRadius: Radius.md,
    opacity: 0.6,
  },
  // 창문용 타일 — 슬롯을 가득 채운다 (정사각형 비율 대신).
  roomCellFill: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    overflow: 'hidden',
  },
  framePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.three,
  },
  skyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  missionFab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.five,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  heroPill: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  // 커버 위 고정 밝기 요소들 — 테마와 무관해 literal 잉크를 쓴다.
  heroPillText: {
    color: '#4A403A',
    fontWeight: '700',
  },
  heroNav: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNavLeft: { left: Spacing.two },
  heroNavRight: { right: Spacing.two },
  heroFoot: {
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  heroName: { color: '#FFFFFF' },
  heroMeta: { color: 'rgba(255,255,255,0.85)' },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    // 스탯 카드가 화면 선에 붙지 않게 — pill 행·미션 카드와 같은 여백.
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.three,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  statV: {
    fontSize: 18,
    fontWeight: '800',
  },
  missionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  missionAddBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  missionFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  missionBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  missionDeleteBtn: {
    marginLeft: Spacing.one,
  },
  missionForm: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionInput: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  missionTypeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  missionTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  editHouseBtn: {
    marginTop: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  leaveWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  codeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reissueBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  leaveHint: {
    textAlign: 'center',
  },
  leaveBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  capacityBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  roomNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  ownerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  goalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  goalTrack: {
    height: 6,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
});
