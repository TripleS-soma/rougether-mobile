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
  View,
} from 'react-native';

import { CharacterAvatar } from '@/components/character-avatar';
import { type HouseCover } from '@/components/house-cover-picker';
import {
  DEFAULT_HOUSE_COVER_KEY,
  FRAME_ASPECT,
  WINDOW_RECTS,
} from '@/components/room/house-preview-frame';
import { CoachTarget } from '@/components/ui/coach-mark';
import { Room } from '@/components/room/room';
import { HouseMembersScreen } from '@/components/screens/house-members-screen';
import { HouseMissionsSheet } from '@/components/screens/sheets/house-missions-sheet';
import { Icon } from '@/components/ui/icon';
import {
  CrownPictogram,
  HousePictogram,
  type PictogramName,
  TargetPictogram,
} from '@/components/ui/pictograms';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';
import type { FurnitureItem, PlacedFurniture, Wallpaper } from '@/resources/furniture';

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
  // 공동 미션 시트 (#287) — 하단 카드 대신 플로팅 버튼으로 연다.
  const [showMissions, setShowMissions] = useState(false);

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

  /**
   * 그 멤버 자신의 캐릭터 (#342) — 방 프리뷰에서 온다. 서버 멤버 목록에는
   * 캐릭터가 없어, 프리뷰가 아직 없으면 내 행만 내 캐릭터고 남은 기본 캐릭터.
   * (구성원 관리가 조기 return이라 여기서 선언해야 양쪽에서 보인다.)
   */
  const memberCharacterId = (member: RoomCell) =>
    (member.membershipId != null ? roomPreviews?.[member.membershipId]?.characterId : undefined) ??
    (member.isMine ? characterId : DEFAULT_CHARACTER_ID);

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
  // 프레임 아래 그리드로 이어붙는다. 커버를 안 고른 집도 기본 프레임으로 —
  // 어느 집이든 "커버 위에 방이 보이는" 같은 형태 (히어로 폴백은 안전망).
  const coverKey =
    currentHouse?.coverImageKey && isCdnKey(currentHouse.coverImageKey)
      ? currentHouse.coverImageKey
      : DEFAULT_HOUSE_COVER_KEY;
  const frameRows = seatRows.slice(-2);
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
  const gridSeatRows = seatRows.slice(0, -2);
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

  // 기본 카메라 = 집 전체(원배율) — 확대(1.3)는 프레임을 좌우로 잘라내서
  // 기본에서는 쓰지 않는다. 방 클로즈업은 더블탭/핀치로만 진입한다.
  const camDefault = () => ({ scale: 1, tx: 0, ty: 0 });
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
      <HouseMembersScreen
        house={currentHouse}
        members={members}
        isOwner={isOwner}
        covers={covers}
        isKicked={isKicked}
        memberCharacterId={memberCharacterId}
        onBack={() => setShowMembers(false)}
        onKickMember={onKickMember}
        onLocalKick={(name) => setKicked((prev) => [...prev, keyFor(name)])}
        onTransferOwnership={onTransferOwnership}
        onReissueInviteCode={onReissueInviteCode}
        onUpdateHouse={onUpdateHouse}
        onLeaveHouse={onLeaveHouse}
        onLeaveDone={() => setShowMembers(false)}
      />
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
          {empty || preview ? null : (
            <CharacterAvatar characterId={memberCharacterId(room)} size={64} />
          )}
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
        <CoachTarget id="house-search">
          <Pressable
            onPress={onOpenSearch}
            accessibilityRole="button"
            accessibilityLabel="집 탐색"
            style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="search" size={18} color={t.text} />
          </Pressable>
        </CoachTarget>
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
        {/* 프레임 모드(#287) — 하늘 위에 스위처·집 프레임, 방은 창문 안에.
            커버가 없어도 기본 프레임으로 통일(#328)이라 유일한 경로다. */}
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
          <CoachTarget id="house-frame">
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
                            testID="window-filler"
                          />
                        )}
                      </View>
                    );
                  })}
                  <Image
                    source={assetSource(coverKey)}
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
          </CoachTarget>
        </View>
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
        {/* absolute FAB이라 래퍼 대신 내용을 측정 (#351). */}
        <CoachTarget id="house-missions">
          <TargetPictogram size={24} color={t.onPrimary} />
        </CoachTarget>
        {missions.some((m) => m.status === 'ACTIVE' && m.achieved) ? (
          <View style={[styles.fabDot, { backgroundColor: t.warning }]} />
        ) : null}
      </Pressable>

      <HouseMissionsSheet
        visible={showMissions}
        house={currentHouse}
        missions={missions}
        isOwner={isOwner}
        linkedRoutines={linkedRoutines}
        contributedMissionIds={contributedMissionIds}
        onClose={() => setShowMissions(false)}
        onCreateMission={onCreateMission}
        onDeleteMission={onDeleteMission}
        onClaimMission={onClaimMission}
        onAddMissionRoutine={onAddMissionRoutine}
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
  // 여백 없이 화면 폭을 다 쓴다 — 기본 뷰(원배율)에서 집이 최대한 크게,
  // 잘리는 부분 없이 보이도록 (높이는 aspectRatio가 따라온다).
  cameraViewport: {
    marginTop: Spacing.two,
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
  // 커버 위 고정 밝기 요소들 — 테마와 무관해 literal 잉크를 쓴다.
  heroPillText: {
    color: '#4A403A',
    fontWeight: '700',
  },
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
  roomNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
