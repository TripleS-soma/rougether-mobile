import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { type HouseCover } from '@/components/room/house-cover-picker';
import { HouseOrderDots } from '@/components/room/house-order-dots';
import { FRAME_ASPECT, houseCoverKey, WINDOW_RECTS } from '@/components/room/house-preview-frame';
import { Loading } from '@/components/ui/loading';
import { CoachTarget } from '@/components/ui/coach-mark';
import { type MemberRoomPreview, type RoomCatalogProps } from '@/components/room/room';
import {
  camDefault,
  cameraClaimsMove,
  clampCam,
  isCamAway,
} from '@/components/screens/house/camera';
import { manageableMembers } from '@/components/screens/house-members-screen';
import { SeatTile } from '@/components/screens/house/seat-tile';
import { type SeatRect, seatAtPoint } from '@/components/screens/house/seat-drag';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icon } from '@/components/ui/icon';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import {
  CrownPictogram,
  HousePictogram,
  type PictogramName,
  TargetPictogram,
} from '@/components/ui/pictograms';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { characterIdForMember } from '@/hooks/use-member-room-previews';
import { FixedOverlay, Radius, ShadowColor, Spacing } from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { type ScrollRestoreProps, useScrollRestore } from '@/hooks/use-scroll-restore';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import type { MissionStatus } from '@/utils/mission-cta';
import { assetSource } from '@/resources/asset';
import { houseBackgroundKey } from '@/resources/house-background';
import { hapticSelection, hapticSuccess } from '@/utils/haptics';
import { DEFAULT_HOUSES } from '@/mocks/fixtures';
import type { Wallpaper } from '@/resources/furniture';
import {
  useAnimatedValue,
  useAnimatedValueXY,
  useConstant,
  useLatestRef,
  useStableCallback,
} from '@/hooks/use-stable-value';

// 방 렌더 데이터라 room.tsx로 이동 (#691) — 기존 임포터를 위한 재수출.
export type { MemberRoomPreview } from '@/components/room/room';
// 카메라 순수 로직은 house/camera.ts로 이동 (#693) — 기존 임포터(테스트)를 위한 재수출.
export { cameraClaimsMove } from '@/components/screens/house/camera';

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

// 빈방 타일의 바닥 밴드 — 일반 빈 방(#281)이라 서버 카탈로그와 무관한 고정
// 파스텔(방 타일 팔레트와 같은 결)로 그린다.
/**
 * 레일 첫 버튼(목표)이 Lv.·멤버 필과 같은 라인에 오도록 밀어내는 값 (#994).
 *
 * 스위처 줄(집 이름 뱃지 + 순서 점)이 차지하는 높이다 — 실측(390px 기준
 * 필 상단 106, 레일 상단 16)으로 맞췄다. 종전엔 레일이 화면 맨 위라 집이
 * 여럿인 사용자의 `다음 집` 화살표와 같은 띠를 다퉜다.
 */
const RAIL_TOP_GAP = 106;

const VACANT_FLOOR: Wallpaper[] = [
  { id: 'vacant-floor', name: '빈방 바닥', price: 0, assetKey: 'vacant-floor', color: '#E7D9BE' },
];
// Room이 memo 경계(#539)라 빈방 프리뷰의 prop도 렌더마다 새로 만들지 않는다.

// 커버 프레임 PNG(house-unified-*-frame.png, 3종 공통 567×508)의 투명 창문
// 4칸 — 알파 채널 측정값 (#287). 좌상·우상·좌하·우하 순.
// FRAME_ASPECT / WINDOW_RECTS는 집 탐색 미리보기(#328)와 공유 —
// house-preview-frame.tsx가 단일 출처.

// RoomCatalogProps: 좌석 타일 미리보기가 해석할 카탈로그 4종 (#691).
export type HouseScreenProps = RoomCatalogProps &
  ScrollRestoreProps & {
    houses?: House[];
    /** True while my houses are loading from the API. */
    loading?: boolean;
    /** True when the initial load failed (#549) — 빈 상태 대신 에러 + 다시 시도. */
    loadError?: boolean;
    /** Re-run the failed load (다시 시도 button). */
    onRetry?: () => void;
    /** 당겨서 새로고침 (#454) — 내 집 목록 조용한 리로드. */
    onRefresh?: () => Promise<void> | void;
    characterId?: CharacterId;
    /** 방 타일의 표시 이름 — 내 자리를 '(나)'로 가리키는 데 쓴다. */
    userName?: string;
    /**
     * Controlled house-switcher index. The screen unmounts while visiting a
     * friend's room, so the shell keeps this to restore the house being viewed
     * (#241). Omit for internal state (dev gallery).
     */
    houseIndex?: number;
    /**
     * 집 순서 확정 (#820) — 원하는 순서의 houseId 배열을 전량 넘긴다
     * (`PUT /me/houses/order` 계약). 없으면 인디케이터가 정렬 제스처 없이
     * 도트로만 동작한다.
     */
    onReorderHouses?: (houseIds: number[]) => void;
    onHouseIndexChange?: (index: number) => void;
    /**
     * 승인 대기 중인 내 입주 신청 (#648, 서버 #255) — 스위처의 마지막
     * 페이지들에 잠금형 카드로 보인다. 스와이프/화살표로 오갈 수 있다.
     */
    pendingHouses?: PendingJoinHouse[];
    /** 입주 신청 철회 (#648) — 확인 다이얼로그 뒤에만 불린다. */
    onCancelJoinRequest?: (requestId: number) => void;
    onVisitFriend?: (friend: VisitedFriend) => void;
    onVisitMyRoom?: () => void;
    onOpenSearch?: () => void;
    /** 구성원 관리 화면 열기 (#753) — 셸 화면('houseMembers')으로 승격됐다. */
    onOpenMembers?: () => void;
    /** 강퇴 낙관 반영 (#753 승격 후 셸 소유) — 참이면 좌석을 빈 타일로 그린다. */
    isKickedMember?: (name: string) => boolean;
    /** Kick a member via the API (owner only); shown when the house has ids. */
    onKickMember?: (houseId: number, membershipId: number) => void;
    /** Leave the current house via the API. */
    onLeaveHouse?: (houseId: number) => void;
    /** 공동 미션 화면 열기 (#875) — 요약 줄 탭. 없으면 요약 줄을 그리지 않는다. */
    onOpenMissions?: () => void;
    /** 현재 집 미션에 연동된 내 루틴 (#578) — 연동/기여함 라벨 판정. */
    linkedRoutines?: { missionId: number; completedToday?: boolean }[];
    /** Mission ids contributed this session (기여 직후 즉시 반영용 보조 신호). */
    contributedMissionIds?: number[];
    /** Edit the house settings via the API (owner only). */
    onUpdateHouse?: (houseId: number, input: HouseEditInput) => void;
    /** Cover catalog (GET /houses/cover-images); empty hides the edit section. */
    covers?: HouseCover[];
    /** Live room previews by membershipId — tiles render the member's actual room. */
    roomPreviews?: Record<number, MemberRoomPreview>;
    /** Hand the OWNER role to a member via the API (owner only). */
    onTransferOwnership?: (houseId: number, membershipId: number) => void;
    /** Reissue the invite code via the API (owner only; the old code expires). */
    onReissueInviteCode?: (houseId: number) => Promise<string | null> | void;
    /**
     * 확대 카메라·자리 드래그처럼 이 화면이 제스처 전권을 가져야 하는 동안
     * true — 셸이 탭 페이저(#563)를 잠그는 데 쓴다.
     */
    onPagerLockChange?: (locked: boolean) => void;
    /** Accept a pending browse-join request (owner only). */
    onAcceptJoinRequest?: (houseId: number, requestId: number) => void;
    /** Reject a pending browse-join request (owner only). */
    onRejectJoinRequest?: (houseId: number, requestId: number) => void;
    /**
     * Drag-and-drop tile swap (#278). Seat indices are display order (top-left
     * first) of the houses handed in — the shell persists and re-arranges via
     * useRoomLayouts. Omitted (demo gallery) falls back to a local swap.
     */
    onSwapSeats?: (houseId: number, seatA: number, seatB: number) => void;
  };

/**
 * House screen, ported from the prototype: a house
 * switcher, the members' rooms (tap to visit), a group-goals card, and a member
 * management sub-view with an invite code and kick flow. The prototype's
 * absolutely-positioned windows over a house PNG are adapted to a token-based
 * floor/room grid. Spec domain: rougether-spec domains/house.
 *
 * memo 경계 (#539): 셸의 무관한 상태 변화에서 리렌더를 끊는다 — AppShell이
 * 넘기는 함수/객체 prop의 참조 안정이 전제다.
 */
export const HouseScreen = memo(function HouseScreen({
  houses = DEFAULT_HOUSES,
  loading = false,
  loadError = false,
  onRetry,
  onRefresh,
  characterId = DEFAULT_CHARACTER_ID,
  userName = '',
  houseIndex: houseIndexProp,
  onReorderHouses,
  onHouseIndexChange,
  pendingHouses,
  onCancelJoinRequest,
  onVisitFriend,
  onVisitMyRoom,
  onOpenSearch,
  onOpenMembers,
  isKickedMember,
  onKickMember,
  onLeaveHouse,
  onOpenMissions,
  linkedRoutines = [],
  contributedMissionIds = [],
  onUpdateHouse,
  covers = [],
  roomPreviews,
  furniture,
  wallpapers,
  floors: floorSurfaces,
  backgrounds,
  onTransferOwnership,
  onReissueInviteCode,
  onAcceptJoinRequest,
  onRejectJoinRequest,
  onSwapSeats,
  onPagerLockChange,
  getInitialScrollY,
  onScrollY,
}: HouseScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  // 배경 이미지를 못 고른 집(매핑에 없는 새 테마)의 폴백 (#992). 시간·날씨에
  // 따라 바뀌던 하늘은 집별 배경 아트(#989)가 대체했다 — 정적 색만 남긴다.
  const skyColor = t.sky;
  const headerInset = useHeaderInsetStyle();
  // 레일을 스위처 줄 아래로 내려 첫 버튼(목표)이 Lv.·멤버 필과 같은 라인에
  // 오게 한다 (#994). 종전엔 레일이 맨 위라 집이 여럿인 사용자의 `다음 집`
  // 화살표와 같은 띠를 다퉜다 — 이름이 길수록 화살표가 레일 쪽으로 밀렸다.
  const railInset = useHeaderInsetStyle(RAIL_TOP_GAP);
  const screenStyle = useScreenStyle([]);

  const [internalHouseIndex, setInternalHouseIndex] = useState(0);
  const houseIndex = houseIndexProp ?? internalHouseIndex;
  // 집 전환 넛지 (#450) — 이동 방향에서 프레임이 살짝 밀려 들어온다.
  const switchX = useAnimatedValue(0);
  const switchFade = useAnimatedValue(1);
  const prevHouseIndex = useRef(houseIndex);
  useEffect(() => {
    const prev = prevHouseIndex.current;
    if (prev === houseIndex) return;
    const dir = houseIndex > prev ? 1 : -1;
    prevHouseIndex.current = houseIndex;
    // 대기 페이지(#648)가 낀 전환은 프레임이 언마운트/마운트되는 경우라
    // 슬라이드 없이 정지 상태로만 둔다 — 언마운트된 노드에 애니메이션 금지.
    if (houseIndex >= houses.length || prev >= houses.length) {
      switchX.setValue(0);
      switchFade.setValue(1);
      return;
    }
    switchX.setValue(36 * dir);
    switchFade.setValue(0.4);
    Animated.parallel([
      Animated.timing(switchX, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(switchFade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [houseIndex, houses.length, switchX, switchFade]);
  const setHouseIndex = (next: number) => {
    setInternalHouseIndex(next);
    onHouseIndexChange?.(next);
  };
  // 공동 미션 시트 (#287) — 하단 카드 대신 플로팅 버튼으로 연다.

  const currentHouse: House | undefined = houses[Math.min(houseIndex, houses.length - 1)];
  // 서브화면(구성원 관리·집 탐색 …)에 다녀와도 보던 자리로 (#763).
  const scrollRef = useRef<ScrollView>(null);
  const scrollRestore = useScrollRestore(scrollRef, { getInitialScrollY, onScrollY });

  // 승인 대기 신청 (#648) — 집 페이지들 뒤에 잠금 카드 페이지로 이어 붙는다.
  const pendingList = pendingHouses ?? [];
  const totalPages = houses.length + pendingList.length;
  // 인디케이터 정렬 대상 — houseId가 있는 내 집만. 서버 계약이 id 배열이라
  // id 없는 로컬/데모 집은 순서를 보낼 수 없어 제외한다.
  const orderableHouses = useMemo(
    () => houses.flatMap((h) => (h.houseId != null ? [{ houseId: h.houseId, name: h.name }] : [])),
    [houses],
  );
  const pendingHouse =
    houseIndex >= houses.length && pendingList.length > 0
      ? pendingList[Math.min(houseIndex - houses.length, pendingList.length - 1)]
      : undefined;
  const [pendingToCancel, setPendingToCancel] = useState<PendingJoinHouse | null>(null);

  const prevHouse = () => setHouseIndex((houseIndex - 1 + totalPages) % totalPages);
  const nextHouse = () => setHouseIndex((houseIndex + 1) % totalPages);

  const missions = currentHouse?.missions ?? [];
  // 층 라벨 없이 한 그리드로 — 행은 어댑터의 층 구성을 그대로 쓴다. 홀수 정원의
  // 반쪽 행이 위층에 있어서, 평탄화 후 2개씩 다시 끊으면 행이 밀린다.
  const rowShapes = useMemo(
    () => (currentHouse?.floors ?? []).map((f) => f.rooms.length),
    [currentHouse],
  );
  const cellsInOrder = useMemo(
    () => (currentHouse?.floors ?? []).flatMap((f) => f.rooms),
    [currentHouse],
  );
  // Demo fallback (#278): without onSwapSeats a local permutation keeps the
  // gallery drag interactive. Wired houses arrive already re-arranged.
  const [demoPerm, setDemoPerm] = useState<Record<number, number[]>>({});
  const perm = demoPerm[houseIndex];
  const displayCells = useMemo(
    () =>
      !onSwapSeats && perm?.length === cellsInOrder.length
        ? perm.map((i) => cellsInOrder[i])
        : cellsInOrder,
    [onSwapSeats, perm, cellsInOrder],
  );
  // 표시 행(어댑터 층 구성)별 좌석 인덱스.
  const seatRows = useMemo(() => {
    const rows: number[][] = [];
    let seatOffset = 0;
    for (const size of rowShapes) {
      rows.push(Array.from({ length: size }, (_, i) => seatOffset + i));
      seatOffset += size;
    }
    return rows;
  }, [rowShapes]);
  // 프레임 모드(#287): 커버 PNG는 창문 4칸(2×2)이 투명하게 뚫린 집 프레임이다.
  // 아래 두 행(내 방·초기 멤버)이 창문에 들어가고, 그 위 행들(초과 좌석·빈방)은
  // 프레임 아래 그리드로 이어붙는다. 커버를 안 고른 집도 기본 프레임으로 —
  // 어느 집이든 "커버 위에 방이 보이는" 같은 형태 (히어로 폴백은 안전망).
  const coverKey = houseCoverKey(currentHouse?.coverImageKey);
  // 서버가 가진 coverImageKey의 테마 경로에서 전면 배경을 파생한다. 집 전환과
  // 같은 렌더에 키가 바뀌므로 별도 저장 상태 없이 항상 프레임과 맞는다.
  const backgroundKey = houseBackgroundKey(coverKey);
  // WINDOW_RECTS 순서(좌상·우상·좌하·우하)로 좌석 매핑 — 아래 행이 아래 창문.
  const windowSlots = useMemo(() => {
    const frameRows = seatRows.slice(-2);
    const slots: (number | null)[] = [null, null, null, null];
    frameRows
      .slice()
      .reverse()
      .forEach((row, r) =>
        row.forEach((seatIdx, c) => {
          const slot = (r === 0 ? 2 : 0) + c;
          if (slot < slots.length) slots[slot] = seatIdx;
        }),
      );
    return slots;
  }, [seatRows]);
  const { roomPairs, rowOffsets } = useMemo(() => {
    const gridSeatRows = seatRows.slice(0, -2);
    return {
      roomPairs: gridSeatRows.map((row) => row.map((i) => displayCells[i])) as RoomCell[][],
      rowOffsets: gridSeatRows.map((row) => row[0] ?? 0),
    };
  }, [seatRows, displayCells]);

  // --- 타일 드래그 앤 드롭 (자리 맞바꾸기, #278) ---
  // Long-press lifts a tile, the grid captures the active touch and the tile
  // follows the finger; releasing over another seat swaps the two. Seat rects
  // are measured (window coords) at lift time, so drops hit-test directly
  // against gestureState.moveX/Y.
  const [dragSeat, setDragSeat] = useState<number | null>(null);
  const dragSeatRef = useRef<number | null>(null);
  const dragGranted = useRef(false);
  const dragPan = useAnimatedValueXY();
  const tileRefs = useRef(new Map<number, View>());
  const tileRects = useRef(new Map<number, SeatRect>());

  // 픽업 순간 스프링으로 살짝 떠오르는 리프트 (#450).
  const liftScale = useAnimatedValue(1);
  const startDrag = (seat: number) => {
    hapticSelection();
    liftScale.setValue(1);
    Animated.spring(liftScale, {
      toValue: 1.07,
      friction: 4,
      tension: 220,
      useNativeDriver: false,
    }).start();
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
      const to = seatAtPoint(tileRects.current, x, y);
      if (to != null && to !== from) {
        hapticSuccess();
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
  const dropAtRef = useLatestRef(dropAt);
  const gridPanResponder = useConstant(() =>
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
  );
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
  const camScale = useAnimatedValue(1);
  const camTx = useAnimatedValue(0);
  const camTy = useAnimatedValue(0);
  // 확대 = '방 구경 모드' (#665) — 이름/접속 라벨은 카메라와 함께 스케일돼
  // 방을 덮으므로, 배율 1→1.15 구간에서 핀치에 연속 추종하며 사라진다.
  const seatMetaOpacity = useConstant(() =>
    camScale.interpolate({ inputRange: [1, 1.15], outputRange: [1, 0], extrapolate: 'clamp' }),
  );
  const visitSeat = (room: RoomCell) => {
    if (room.isMine) return onVisitMyRoom?.();
    onVisitFriend?.({
      name: room.name,
      userId: room.userId,
      houseId: currentHouse?.houseId,
      membershipId: room.membershipId,
    });
  };
  // 좌석 카탈로그 묶음 — memo 타일로 내려가는 prop이라 참조 고정 필수 (#775).
  const seatCatalogs = useMemo(
    () => ({ furniture, wallpapers, floors: floorSurfaces, backgrounds }),
    [furniture, wallpapers, floorSurfaces, backgrounds],
  );
  const registerTileRef = useStableCallback((seatIdx: number, el: View | null) => {
    if (el) tileRefs.current.set(seatIdx, el);
    else tileRefs.current.delete(seatIdx);
  });
  /**
   * 좌석 → 방 레지스트리 (#775) — 콜백 참조를 고정하려면 seatIdx만 받아야
   * 하는데, `displayCells[seatIdx]`로 되찾는 건 그리드 행의 좌석 번호가
   * 연속이라는 가정에 기댄다(창문 슬롯과 평면 그리드가 서로 다른 산식을
   * 쓴다). 렌더한 방을 그대로 기억해 두면 그 가정이 필요 없다.
   */
  const seatRooms = useConstant(() => new Map<number, RoomCell>());
  const handleSeatVisit = useStableCallback((seatIdx: number) => {
    const room = seatRooms.get(seatIdx);
    if (room) visitSeat(room);
  });
  const handleSeatLongPress = useStableCallback((seatIdx: number) => startDrag(seatIdx));
  const handleTilePressOut = useStableCallback(() => onTilePressOut());

  const cam = useRef({ scale: 1, tx: 0, ty: 0 });
  const frameSize = useRef({ w: 0, h: 0 });
  const pinchAnchor = useRef({ dist: 0, cx: 0, cy: 0, scale: 1, tx: 0, ty: 0 });
  const panAnchor = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const camTouchCount = useRef(0);

  // 카메라 상수·판정·클램프 수학은 house/camera.ts로 이동 (#693).
  const syncZoomed = () => {
    const away = isCamAway(cam.current);
    if (away !== zoomedRef.current) {
      zoomedRef.current = away;
      setZoomed(away);
    }
  };
  const setCam = (scale: number, tx: number, ty: number) => {
    const c = clampCam(frameSize.current, scale, tx, ty);
    cam.current = c;
    camScale.setValue(c.scale);
    camTx.setValue(c.tx);
    camTy.setValue(c.ty);
    syncZoomed();
  };
  const animateCamTo = (scale: number, tx: number, ty: number) => {
    const c = clampCam(frameSize.current, scale, tx, ty);
    cam.current = c;
    syncZoomed();
    Animated.parallel([
      Animated.spring(camScale, { toValue: c.scale, useNativeDriver: true }),
      Animated.spring(camTx, { toValue: c.tx, useNativeDriver: true }),
      Animated.spring(camTy, { toValue: c.ty, useNativeDriver: true }),
    ]).start();
  };
  const resetCam = () => {
    const d = camDefault();
    animateCamTo(d.scale, d.tx, d.ty);
  };
  // 더블탭 줌 — 그 방의 창문이 카메라 뷰포트를 거의 가득 채우게 (#307).
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
  const cameraResponder = useConstant(() =>
    PanResponder.create({
      // 두 손가락은 즉시, 한 손가락은 확대 상태에서 슬롭을 넘겼을 때만
      // (드래그 중엔 양보) — 탭 지터 캡처가 방 탭 방문을 죽였다 (#669).
      onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponderCapture: (evt, g) =>
        cameraClaimsMove(
          evt.nativeEvent.touches.length,
          zoomedRef.current,
          dragSeatRef.current != null,
          g.dx,
          g.dy,
        ),
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
  );

  // 집 전환 가로 플링은 폐지 (#761) — 셸 탭 페이저(#563)와 같은 축을 다퉈
  // "어디선 탭이 넘어가고 어디선 집이 넘어가는" 불예측성이 남았다. 가로
  // 스와이프는 항상 탭 전환이고, 집 순회는 상단 ‹ › 화살표·점 인디케이터로만.
  // cameraClaimsMove가 한 손가락·비확대에서 false라 프레임 위 스와이프도
  // 그대로 페이저로 흐른다 (확대·드래그 중엔 아래 잠금이 페이저를 막는다).

  // 확대·자리 드래그 동안 셸의 탭 페이저를 잠근다 (#563).
  useEffect(() => {
    onPagerLockChange?.(zoomed || dragSeat != null);
  }, [zoomed, dragSeat, onPagerLockChange]);

  // No houses yet (fresh account) → guide to 집 탐색 instead of crashing on
  // an empty switcher.
  // 창문 타일 탭 판정 (#307): 한 번 탭 = 방문(더블탭 간격만큼 지연 실행),
  // 더블탭 = 그 방으로 카메라 줌인. 그리드 타일(프레임 밖)은 기존 즉시 방문.

  // 승인 대기 페이지 (#648) — 잠금형 카드. 메인 프레임 트리와 독립 렌더라
  // 카메라·좌석 로직과 얽히지 않고, 스위처 산술(totalPages)만 공유한다.
  if (pendingHouse) {
    return (
      <View style={[styles.screen, screenStyle]} testID="pending-house-page">
        <View style={styles.emptyWrap}>
          <View style={styles.switcher}>
            {totalPages > 1 ? (
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
              <Icon name="lock" size={14} color={t.textMuted} />
              {/* 서버는 집 이름을 30자까지 받는다 — 안 자르면 뱃지가 부풀어
                  좌우 전환 화살표를 화면 밖으로 밀어낸다 (#994). */}
              <Text style={[Typography.h3, styles.titleText, { color: t.text }]} numberOfLines={1}>
                {pendingHouse.name}
              </Text>
            </View>
            {totalPages > 1 ? (
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
          <View style={[styles.pendingCard, { backgroundColor: t.surface }]}>
            <Icon name="lock" size={40} color={t.textDisabled} />
            <Text style={[Typography.h3, styles.pendingTitle, { color: t.text }]}>
              방장 승인을 기다리고 있어요
            </Text>
            <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
              승인되면 이 자리에 집이 열려요. 조금만 기다려 주세요!
            </Text>
            {pendingHouse.requestedAt ? (
              <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                {pendingHouse.requestedAt.slice(0, 10).replace(/-/g, '.')} 신청
              </Text>
            ) : null}
            {onCancelJoinRequest ? (
              <ScalePressable
                onPress={() => setPendingToCancel(pendingHouse)}
                accessibilityRole="button"
                accessibilityLabel="입주 신청 취소"
                style={[styles.pendingCancelBtn, { borderColor: t.border }]}>
                <Text style={[Typography.label, { color: t.textMuted }]}>신청 취소</Text>
              </ScalePressable>
            ) : null}
          </View>
          {/* 대기 카드 페이지(#648)는 내 집이 아니라 정렬 대상에서 빠진다. */}
          <HouseOrderDots
            houses={orderableHouses}
            pendingCount={pendingList.length}
            index={houseIndex}
            onReorder={onReorderHouses}
          />
        </View>

        <ConfirmDialog
          visible={pendingToCancel != null}
          title="입주 신청을 취소할까요?"
          body={
            pendingToCancel
              ? `'${pendingToCancel.name}' 집에 보낸 신청이 철회돼요. 초대코드가 있으면 다시 신청할 수 있어요.`
              : ''
          }
          confirmLabel="신청 취소"
          confirmAccessibilityLabel="신청 취소 확인"
          cancelLabel="유지"
          destructive
          onConfirm={() => {
            if (pendingToCancel) {
              onCancelJoinRequest?.(pendingToCancel.requestId);
              // 마지막 대기 카드였다면 유효한 집 페이지로 복귀.
              if (pendingList.length <= 1) setHouseIndex(Math.max(0, houses.length - 1));
            }
            setPendingToCancel(null);
          }}
          onCancel={() => setPendingToCancel(null)}
        />
      </View>
    );
  }

  if (!currentHouse) {
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={styles.emptyWrap}>
          {loading ? (
            <>
              <Loading />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>불러오는 중...</Text>
            </>
          ) : loadError ? (
            // 로드 실패 (#549) — 집이 있는 사용자가 '집 없음' 가입 유도를 보지
            // 않도록 빈 상태 분기보다 먼저 처리한다.
            <>
              <Text style={[Typography.h3, { color: t.text }]}>집 정보를 불러오지 못했어요</Text>
              <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
                네트워크 상태를 확인하고 다시 시도해 주세요.
              </Text>
              <ScalePressable
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="다시 시도"
                style={[styles.emptyCta, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>다시 시도</Text>
              </ScalePressable>
            </>
          ) : (
            <>
              <Text style={[Typography.h3, { color: t.text }]}>아직 함께하는 집이 없어요</Text>
              <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
                집을 만들거나 초대코드로 입주해 친구들과 루틴을 함께 키워보세요.
              </Text>
              <ScalePressable
                onPress={onOpenSearch}
                accessibilityRole="button"
                accessibilityLabel="집 탐색"
                style={[styles.emptyCta, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>집 탐색하기</Text>
              </ScalePressable>
            </>
          )}
        </View>
      </View>
    );
  }

  // 좌석 타일 — 프레임 창문(#287)과 평면 그리드가 같은 타일을 공유한다.
  // fill=true(창문)면 슬롯을 가득 채우고, 아니면 반칸 정사각형.
  // 더블탭 줌 제거 (#727) — 판정 대기(260ms) 때문에 방문 탭 반응이 늦었다.
  // 줌은 핀치 전용으로 남고, 탭은 즉시 방문한다.

  const renderSeatTile = (room: RoomCell, seatIdx: number, fill = false) => {
    seatRooms.set(seatIdx, room);
    const empty = room.vacant || !!isKickedMember?.(room.name);
    // 내 타일 이름은 라이브 userName(=현재 닉네임)으로 — houses는 프로필 저장 시
    // 재요청되지 않아 room.name이 stale하다 (#479).
    const displayName = room.isMine ? userName : room.name;
    const preview =
      !empty && room.membershipId != null ? roomPreviews?.[room.membershipId] : undefined;
    return (
      <SeatTile
        // Vacant seats all read '빈방' — the seat index keys them.
        key={`seat-${seatIdx}-${room.name}`}
        seatIdx={seatIdx}
        displayName={displayName}
        empty={empty}
        isMine={!!room.isMine}
        isOwner={!!room.isOwner}
        bot={!!room.bot}
        online={!!room.online}
        lastSeenLabel={room.lastSeenLabel}
        color={room.color}
        fill={fill}
        dragging={dragSeat === seatIdx}
        zoomed={zoomed}
        preview={preview}
        avatarCharacterId={characterIdForMember(room, roomPreviews, characterId)}
        catalogs={seatCatalogs}
        vacantFloor={VACANT_FLOOR}
        vacantRoomStyle={vacantRoomStyle}
        dragPan={dragPan}
        liftScale={liftScale}
        seatMetaOpacity={seatMetaOpacity}
        onVisit={handleSeatVisit}
        onLongPress={handleSeatLongPress}
        onPressOut={handleTilePressOut}
        registerRef={registerTileRef}
      />
    );
  };

  // 요약 줄 파생 (#875) — 시트가 목록 위에 그리던 것과 같은 값.
  const activeMissions = missions.filter((m) => m.status === 'ACTIVE');
  const activeMissionCount = activeMissions.length;
  const claimableCount = activeMissions.filter((m) => m.achieved).length;
  const contributedTodayCount = activeMissions.filter(
    (m) =>
      contributedMissionIds.includes(m.id) ||
      linkedRoutines.some((r) => r.missionId === m.id && r.completedToday),
  ).length;

  return (
    <View style={[styles.screen, screenStyle, { backgroundColor: skyColor }]} testID="house-screen">
      {/* 하단 탭은 AppShell의 형제라 이 absoluteFill 배경에 포함되지 않는다.
          9:16 마스터를 cover/center로 그려 다양한 화면 높이에서도 가장자리만
          자연스럽게 잘리고 집 뒤 핵심 여백은 유지한다. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="house-background-layer">
        {backgroundKey ? (
          <Image
            source={assetSource(backgroundKey)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={backgroundKey}
            accessible={false}
            testID="house-background"
          />
        ) : null}
      </View>
      {/* 타일 드래그 중에는 스크롤이 제스처를 뺏지 않게 잠근다 (#278). */}
      <PawRefreshScroll
        scrollRef={scrollRef}
        {...scrollRestore}
        onRefresh={onRefresh}
        // 자리 드래그 중 당김 잠금 — 놓는 순간 새로고침이 배치를 끊지 않게.
        refreshDisabled={dragSeat != null}
        refreshTestID="house-refresh"
        // 이 화면은 폭 제한에서 뺀다 (#986) — 하늘이 화면을 꽉 채워야 하고,
        // 태블릿에서 560으로 잘리면 좌우가 크림으로 남아 목적과 반대가 된다.
        // 프레임은 aspectRatio라 폭을 따라 커지지만, 좌석 좌표는 정규화라 안전.
        contentContainerStyle={styles.body}
        scrollEnabled={dragSeat == null}
        testID="house-scroll">
        {/* 프레임 모드(#287) — 하늘 위에 스위처·집 프레임, 방은 창문 안에.
            커버가 없어도 기본 프레임으로 통일(#328)이라 유일한 경로다. */}
        {/* 배경·비는 #989가 화면 루트의 absoluteFill 레이어로 옮겼다 — 여기선
            안전영역 여백만 준다(헤더바가 없어 하늘이 맨 위부터 시작한다). */}
        <View style={[styles.skySection, headerInset]} testID="sky-section">
          <View style={styles.switcher}>
            {totalPages > 1 ? (
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
              <Text style={[Typography.h3, styles.titleText, { color: t.text }]} numberOfLines={1}>
                {currentHouse.name}
              </Text>
            </View>
            {totalPages > 1 ? (
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
          {/* 대기 카드 페이지(#648)는 내 집이 아니라 정렬 대상에서 빠진다. */}
          <HouseOrderDots
            houses={orderableHouses}
            pendingCount={pendingList.length}
            index={houseIndex}
            onReorder={onReorderHouses}
          />
          {/* 레벨·멤버 pill — 프레임 여백과 정렬된 행 (모서리 절대배치는
                화면 끝에 걸려 보였다). 고정 밝기 흰 스크림 위라 onTint 잉크. */}
          <View style={styles.framePillsRow}>
            <View style={[styles.skyPill, { backgroundColor: FixedOverlay.skyPill }]}>
              <HousePictogram size={12} />
              <Text style={[Typography.supporting, { color: t.onTint }]}>
                Lv.{currentHouse.level ?? 0}
                {currentHouse.growthPoints != null
                  ? ` · ${currentHouse.growthPoints % 100}/100`
                  : ''}
              </Text>
            </View>
            <View style={[styles.skyPill, { backgroundColor: FixedOverlay.skyPill }]}>
              <Text style={[Typography.supporting, { color: t.onTint }]}>
                {/* Vacant seats are not members — count the real ones. */}
                멤버 {currentHouse.memberCount ?? manageableMembers(currentHouse).length}
                {currentHouse.maxMembers ? ` / ${currentHouse.maxMembers}` : ''}
              </Text>
            </View>
          </View>
          {/* 남는 세로를 여기서 먹어 집을 잔디에 붙인다 (#986). CoachTarget이
              flex 자식이라 안쪽 View에 auto 마진을 줘도 안 먹는다 — 명시 스페이서. */}
          <View style={styles.skySpacer} />
          <CoachTarget id="house-frame">
            <Animated.View
              style={[
                styles.cameraViewportOuter,
                { opacity: switchFade, transform: [{ translateX: switchX }] },
              ]}>
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
                    {/* Android는 Image 계열이 pointerEvents prop을 무시하고 터치를
                      삼킨다(#401) — ViewGroup 래퍼가 확실하게 투과시킨다. */}
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                      <Image
                        source={assetSource(coverKey)}
                        style={StyleSheet.absoluteFill}
                        contentFit="contain"
                        transition={120}
                        // 디스크 캐시 유지 — 앱 재실행 후에도 재요청 없이 즉시 (#463).
                        cachePolicy="memory-disk"
                        accessibilityLabel={`${currentHouse.name} 집`}
                        testID="house-frame"
                      />
                    </View>
                  </View>
                </Animated.View>
              </View>
              {/* ⟲ 리셋 버튼은 cameraResponder(팬 responder)를 가진 cameraViewport
                  바깥, 그 형제로 둔다 — zoomed 동안 부모의 capture move 핸들러가
                  버튼 위 탭의 미세한 손가락 이동마저 가로채 onPress가 취소됐다
                  (실기기, #307 후속). cameraViewportOuter가 절대배치 기준. */}
              {zoomed ? (
                <Pressable
                  onPress={resetCam}
                  accessibilityRole="button"
                  accessibilityLabel="확대 종료"
                  style={[styles.camReset, { backgroundColor: t.surface }]}>
                  <Icon name="refresh" size={16} color={t.text} />
                </Pressable>
              ) : null}
            </Animated.View>
          </CoachTarget>
        </View>
        {/* 프레임 모드에선 방이 창문 안에 그려져 이 격자가 비는데, paddingTop이
            남아 잔디 아래 24px 크림 띠를 만들었다 (#986). 내용이 있을 때만 그린다. */}
        {roomPairs.length === 0 ? null : (
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
        )}
      </PawRefreshScroll>

      {/* 화면 고정 플로팅 레일 (#986) — 헤더바를 없애고 하늘이 맨 위부터
          시작하게 하려면 액션이 아트 **위에** 떠야 한다. 흰 원 + 라벨은
          배경이 하늘색이든 다크모드든 대비가 보장되는 형태다(#232). */}
      <View style={[styles.rail, railInset]} pointerEvents="box-none">
        {onOpenMissions ? (
          <CoachTarget id="house-missions">
            <RailButton
              icon={<TargetPictogram size={20} />}
              label="목표"
              onPress={onOpenMissions}
              /* 줄에서 버튼이 되며 '오늘 1/1'이 눈에서 사라진다 (#875가 드러내려던
                 것이다) — 라벨에는 그대로 담고, 받을 보상은 점으로 남긴다. */
              accessibilityLabel={[
                '우리 집의 목표',
                activeMissionCount > 0
                  ? `오늘 ${contributedTodayCount}/${activeMissionCount} 기여`
                  : '진행 중 없음',
                claimableCount > 0 ? `받을 보상 ${claimableCount}개` : null,
              ]
                .filter(Boolean)
                .join(', ')}
              badge={claimableCount > 0 ? t.warning : undefined}
              t={t}
              Typography={Typography}
            />
          </CoachTarget>
        ) : null}
        <CoachTarget id="house-search">
          <RailButton
            icon={<Icon name="search" size={20} color={t.text} />}
            label="집 탐색"
            onPress={onOpenSearch}
            accessibilityLabel="집 탐색"
            t={t}
            Typography={Typography}
          />
        </CoachTarget>
        <RailButton
          icon={<Icon name="members" size={20} color={t.text} />}
          label="구성원"
          onPress={onOpenMembers}
          accessibilityLabel="구성원 목록"
          t={t}
          Typography={Typography}
        />
      </View>
    </View>
  );
});

/** 아트 위에 뜨는 액션 하나 — 흰 원 아이콘 + 그 아래 라벨. */
function RailButton({
  icon,
  label,
  onPress,
  accessibilityLabel,
  badge,
  t,
  Typography,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  accessibilityLabel: string;
  /** 점 색 — 받을 보상처럼 '지금 할 게 있다'를 남길 때만. */
  badge?: string;
  t: ReturnType<typeof useTokens>;
  Typography: ReturnType<typeof useTypography>;
}) {
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.railBtn}>
      <View style={[styles.railCircle, { backgroundColor: t.surface }]}>
        {icon}
        {badge ? <View style={[styles.railBadge, { backgroundColor: badge }]} /> : null}
      </View>
      <View style={[styles.railLabelWrap, { backgroundColor: t.surface }]}>
        <Text style={[Typography.supporting, { color: t.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </ScalePressable>
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
  // --- 승인 대기 페이지 (#648) ---
  pendingCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.three,
  },
  pendingTitle: {
    textAlign: 'center',
  },
  pendingCancelBtn: {
    marginTop: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
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
  skySpacer: { flexGrow: 1 },
  rail: {
    position: 'absolute',
    right: Spacing.three,
    top: 0,
    gap: Spacing.three,
    alignItems: 'center',
    zIndex: 30,
  },
  railBtn: { alignItems: 'center', gap: Spacing.half },
  railCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railBadge: {
    position: 'absolute',
    top: Spacing.half,
    right: Spacing.half,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  railLabelWrap: {
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.pill,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    // 하늘이 남은 높이를 먹는다 (#986) — 종전엔 paddingBottom 64에 더해
    // 남는 세로를 아무도 안 써서, 잔디 아래로 104~155px의 죽은 띠가 탭바까지
    // 이어졌다. 집이 선반에 얹힌 것처럼 보이던 원인이다.
    flexGrow: 1,
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
  // Lifted (dragging) tile floats above its row; the row itself gets dragRow
  // so it also floats above sibling rows.
  dragRow: {
    zIndex: 10,
    elevation: 8,
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
  // 타일 라벨은 전역 +2(#660)에서 제외 (#669) — supporting 14가 방 위에선
  // 캐릭터를 가릴 만큼 커서, 이 두 라벨만 이전 크기(12)로 고정한다.
  // --- 프레임 모드 (#287) ---
  skySection: {
    position: 'relative',
    // paddingTop은 headerInset이 준다 (안전영역 + 기본 여백) — 헤더바를 없애며
    // 하늘이 화면 맨 위부터 시작해서, 상태바·노치와 겹치지 않게 해야 한다.
    // 집을 위로 올린다 — 배경 아트의 바닥이 그만큼 넓게 보인다 (#989 이후
    // 잔디는 밴드가 아니라 테마 배경 이미지가 그린다).
    paddingBottom: Spacing.six,
    // 남은 높이를 여기서 먹는다 (#986). 프레임 앞의 skySpacer가 그 여유를
    // **집 위쪽**으로 몰아, 집은 잔디에 붙고 하늘만 트인다 — 집이 공중에
    // 뜨지 않게 하는 게 요점이다.
    flexGrow: 1,
  },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    // 부모가 폭을 안 정해주면 뱃지의 flexShrink가 줄일 대상이 없어 말줄임이
    // 안 걸린다 (#994 리뷰). 승인 대기 페이지는 emptyWrap(alignItems: center)
    // 안이라 이게 없으면 긴 이름이 화살표를 화면 밖으로 민다. 일반 페이지는
    // skySection이 이미 stretch라 무해하다.
    alignSelf: 'stretch',
  },
  titleText: { flexShrink: 1 },
  titleBadge: {
    flexShrink: 1,
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
  cameraViewportOuter: {
    width: '100%',
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
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: ShadowColor,
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
  framePillsRow: {
    // 레벨 위에 멤버를 세로로 쌓는다 — 좌우로 벌리면 멤버 필이 우측 플로팅
    // 레일과 같은 줄에 놓여 서로 밀어낸다.
    alignItems: 'flex-start',
    gap: Spacing.one,
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
  // Name row + optional last-seen line (#383), centered as one block.
});

// 빈방 프리뷰의 합성 스타일 — memo된 Room에 렌더마다 새 배열을 넘기지 않는다 (#539).
const vacantRoomStyle = [styles.roomPreviewFill, styles.vacantRoom];
