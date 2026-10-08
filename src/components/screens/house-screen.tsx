import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import { type HouseCover } from '@/components/room/house-cover-picker';
import { HouseOrderDots } from '@/components/room/house-order-dots';
import { useHouseFrame } from '@/hooks/use-house-frame';
import { type HouseFrameOptions, houseWindowSeats } from '@/resources/house-frame';
import { CoachTarget } from '@/components/ui/coach-mark';
import { GlassSurface } from '@/components/ui/glass-surface';
import { type MemberRoomPreview, type RoomCatalogProps } from '@/components/room/room';
import type {
  House,
  HouseEditInput,
  PendingJoinHouse,
  RoomCell,
  VisitedFriend,
} from '@/components/screens/house/types';
import { HouseEmptyState } from '@/components/screens/house/house-empty-state';
import { HouseSwitcher } from '@/components/screens/house/house-switcher';
import { manageableMembers } from '@/components/screens/house/members';
import { PendingHousePage } from '@/components/screens/house/pending-house-page';
import { RailButton } from '@/components/screens/house/rail-button';
import { SeatTile } from '@/components/screens/house/seat-tile';
import { useFrameCamera } from '@/components/screens/house/use-frame-camera';
import { useSeatDrag } from '@/components/screens/house/use-seat-drag';
import { gridRoomPairs, seatRowsFor } from '@/components/screens/house/seat-geometry';
import { Icon } from '@/components/ui/icon';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { CrownPictogram, HousePictogram, TargetPictogram } from '@/components/ui/pictograms';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { characterIdForMember } from '@/hooks/use-member-room-previews';
import { FixedOverlay, Radius, ShadowColor, Spacing } from '@/constants/theme';
import { useBottomNavInset, useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { type ScrollRestoreProps, useScrollRestore } from '@/hooks/use-scroll-restore';
import { useResolvedScheme, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { assetSource } from '@/resources/asset';
import { houseBackgroundKey } from '@/resources/house-background';
import { DEFAULT_HOUSES } from '@/mocks/fixtures';
import { VACANT_FLOOR } from '@/resources/furniture';
import { useAnimatedValue, useConstant, useStableCallback } from '@/hooks/use-stable-value';
import { NATIVE_DRIVER } from '@/utils/animation';

// 카메라 순수 로직은 house/camera.ts로 이동 (#693) — 기존 임포터(테스트)를 위한 재수출.
export { cameraClaimsMove } from '@/components/screens/house/camera';

// 집 도메인 타입은 house/types.ts로 이동 (리팩토링 4묶음) — 기존 임포터를 위한 재수출.
export type * from '@/components/screens/house/types';
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

// Room이 memo 경계(#539)라 빈방 프리뷰의 prop도 렌더마다 새로 만들지 않는다.

// Frame geometry is shared with browse previews through resources/house-frame.

// RoomCatalogProps: 좌석 타일 미리보기가 해석할 카탈로그 4종 (#691).
export type HouseScreenProps = RoomCatalogProps &
  Pick<HouseFrameOptions, 'enabled' | 'previewTheme'> &
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
    /** 집 채팅 열기 (#1408) — 없으면(houseId 없는 집·데모) 레일에 '채팅'을 그리지 않는다. */
    onOpenChat?: () => void;
    /** 레일 '채팅'의 안 읽은 메시지 수 — 0이면 배지 없음. */
    chatUnread?: number;
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
  onOpenChat,
  chatUnread = 0,
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
  enabled,
  previewTheme,
}: HouseScreenProps) {
  const t = useTokens();
  const tr = useT();
  const scheme = useResolvedScheme();
  const Typography = useTypography();
  // 배경 이미지를 못 고른 집(매핑에 없는 새 테마)의 폴백 (#992). 시간·날씨에
  // 따라 바뀌던 하늘은 집별 배경 아트(#989)가 대체했다 — 정적 색만 남긴다.
  const skyColor = t.sky;
  const headerInset = useHeaderInsetStyle();
  // 글래스 알약 바텀바가 떠 있으면 잔디·집 프레임이 그 밑에 안 깔리게 (#1049).
  const navInset = useBottomNavInset();
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
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.timing(switchFade, { toValue: 1, duration: 200, useNativeDriver: NATIVE_DRIVER }),
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
  const [houseViewport, setHouseViewport] = useState({ width: 0, height: 0 });
  const [headerBottom, setHeaderBottom] = useState(0);
  const measureHouseViewport = useStableCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHouseViewport((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    );
  });
  const measureHeaderBottom = useStableCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setHeaderBottom(y + height);
  });

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
  // 입주 신청 철회 (#648) — 확인 다이얼로그는 대기 페이지가 가진다. 없으면
  // 페이지가 취소 버튼을 안 그리므로 undefined를 그대로 넘긴다.
  const cancelJoinRequest = onCancelJoinRequest
    ? (requestId: number) => {
        onCancelJoinRequest(requestId);
        // 마지막 대기 카드였다면 유효한 집 페이지로 복귀.
        if (pendingList.length <= 1) setHouseIndex(Math.max(0, houses.length - 1));
      }
    : undefined;

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
  // 표시 행(어댑터 층 구성)별 좌석 인덱스 — 산식은 house/seat-geometry.ts.
  const seatRows = useMemo(() => seatRowsFor(rowShapes), [rowShapes]);
  // Resolve the asset and its cutouts together. Legacy art keeps its lower
  // two rows plus overflow; stacked art contains all supported capacity rows.
  const { frame, onFrameError } = useHouseFrame(currentHouse?.coverImageKey, {
    failureScope: currentHouse?.houseId ?? houseIndex,
    maxMembers: currentHouse?.maxMembers,
    minimumSeats: displayCells.length,
    enabled,
    previewTheme,
  });
  const coverKey = frame.assetKey;
  const isThreeStorey = frame.kind === 'stacked' && frame.windowRects.length === 6;
  const frameBottomGap = isThreeStorey ? Spacing.three : Spacing.six;
  // Three portrait floors can exceed the first viewport at full screen width.
  // Reserve the measured header, floating navigation and existing frame gaps.
  // Landscape/short embedded previews retain scrolling instead of collapsing.
  const availableFrameHeight =
    houseViewport.height - headerBottom - navInset - frameBottomGap - Spacing.two;
  const fittedFrameWidth =
    isThreeStorey &&
    houseViewport.height > houseViewport.width &&
    headerBottom > 0 &&
    availableFrameHeight > 0
      ? Math.min(houseViewport.width, availableFrameHeight * frame.aspectRatio)
      : undefined;
  // 서버가 가진 coverImageKey의 테마 경로에서 전면 배경을 파생한다. 집 전환과
  // 같은 렌더에 키가 바뀌므로 별도 저장 상태 없이 항상 프레임과 맞는다.
  const backgroundKey = houseBackgroundKey(frame.canonicalKey, scheme);
  // Preserve adapter row order; first members stay on the bottom story.
  const windowSlots = useMemo(
    () => houseWindowSeats(seatRows, frame.windowRects.length),
    [seatRows, frame.windowRects],
  );
  const { roomPairs, rowOffsets } = useMemo(
    () => gridRoomPairs(seatRows, displayCells, frame.windowRects.length),
    [seatRows, displayCells, frame.windowRects],
  );

  // --- 타일 드래그 앤 드롭 (자리 맞바꾸기, #278) — house/use-seat-drag (장부 15번) ---
  const swapSeats = (from: number, to: number) => {
    if (onSwapSeats && currentHouse?.houseId != null) {
      onSwapSeats(currentHouse.houseId, from, to);
    } else {
      setDemoPerm((prev) => {
        const base =
          prev[houseIndex]?.length === displayCells.length
            ? [...prev[houseIndex]]
            : displayCells.map((_, i) => i);
        [base[from], base[to]] = [base[to], base[from]];
        return { ...prev, [houseIndex]: base };
      });
    }
  };
  const {
    dragSeat,
    dragPan,
    liftScale,
    draggingSV,
    tileRefs,
    startDrag,
    onTilePressOut,
    frameDragGesture,
    floorsDragGesture,
  } = useSeatDrag({ swapSeats });

  // --- 프레임 카메라 (핀치줌·팬, #290) — house/use-frame-camera (장부 15번) ---
  const { zoomed, camStyle, seatMetaOpacity, cameraGesture, resetCam, onFrameLayout } =
    useFrameCamera({ draggingSV });
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

  // 집 전환 가로 플링은 폐지 (#761) — 셸 탭 페이저(#563)와 같은 축을 다퉈
  // "어디선 탭이 넘어가고 어디선 집이 넘어가는" 불예측성이 남았다. 가로
  // 스와이프는 항상 탭 전환이고, 집 순회는 상단 ‹ › 화살표·점 인디케이터로만.
  // cameraClaimsMove가 한 손가락·비확대에서 false라 프레임 위 스와이프도
  // 그대로 페이저로 흐른다.
  //
  // 확대 중에는 페이저를 잠그지 않는다 (#1347). 종전(#563)엔 확대만 해도 '확대 종료'를
  // 누를 때까지 탭 스와이프가 통째로 막혀, 확대가 남은 채 돌아온 사용자가 "집 탭에서
  // 스와이프가 안 된다"고 느꼈다. 대신 순서로 가른다: 캔버스 위 한 손가락 가로 이동은
  // 카메라가 CAM_PAN_SLOP(8)에서 먼저 활성화되고, 활성화된 제스처가 아직 SWIPE_CLAIM_DX(24)에
  // 못 미친 페이저를 취소한다. 캔버스 밖(헤더·목록)에서 시작한 스와이프는 카메라가 받지
  // 않으니 그대로 탭 이동이다. 자리 드래그는 같은 터치 안에서 전권을 가져가야 해 잠금 유지.
  // Pending/empty content keeps HouseScreen mounted but removes the camera and
  // its reset button. A hidden camera must not keep the entire pager locked.
  const pagerLocked = currentHouse != null && !pendingHouse && dragSeat != null;
  useEffect(() => {
    onPagerLockChange?.(pagerLocked);
  }, [pagerLocked, onPagerLockChange]);
  // The camera/seat gesture no longer owns any touches once this screen exits.
  useEffect(() => () => onPagerLockChange?.(false), [onPagerLockChange]);

  // No houses yet (fresh account) → guide to 집 탐색 instead of crashing on
  // an empty switcher.
  // 창문 타일 탭 판정 (#307): 한 번 탭 = 방문(더블탭 간격만큼 지연 실행),
  // 더블탭 = 그 방으로 카메라 줌인. 그리드 타일(프레임 밖)은 기존 즉시 방문.

  // 승인 대기 페이지 (#648) — 잠금형 카드. 메인 프레임 트리와 독립 렌더라
  // 카메라·좌석 로직과 얽히지 않고, 스위처 산술(totalPages)만 공유한다.
  if (pendingHouse) {
    return (
      <PendingHousePage
        pendingHouse={pendingHouse}
        screenStyle={screenStyle}
        totalPages={totalPages}
        onPrev={prevHouse}
        onNext={nextHouse}
        orderableHouses={orderableHouses}
        pendingCount={pendingList.length}
        houseIndex={houseIndex}
        onReorderHouses={onReorderHouses}
        onCancelJoinRequest={cancelJoinRequest}
      />
    );
  }

  if (!currentHouse) {
    return (
      <HouseEmptyState
        screenStyle={screenStyle}
        loading={loading}
        loadError={loadError}
        onRetry={onRetry}
        onOpenSearch={onOpenSearch}
      />
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
        squareFrame={frame.kind === 'stacked'}
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
      m.contributedToday === true ||
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
        onLayout={measureHouseViewport}
        onRefresh={onRefresh}
        // 자리 드래그 중 당김 잠금 — 놓는 순간 새로고침이 배치를 끊지 않게.
        refreshDisabled={dragSeat != null}
        refreshTestID="house-refresh"
        // 이 화면은 폭 제한에서 뺀다 (#986) — 하늘이 화면을 꽉 채워야 하고,
        // 태블릿에서 560으로 잘리면 좌우가 크림으로 남아 목적과 반대가 된다.
        // 프레임은 aspectRatio라 폭을 따라 커지지만, 좌석 좌표는 정규화라 안전.
        contentContainerStyle={[styles.body, navInset ? { paddingBottom: navInset } : null]}
        scrollEnabled={dragSeat == null}
        testID="house-scroll">
        {/* 프레임 모드(#287) — 하늘 위에 스위처·집 프레임, 방은 창문 안에.
            커버가 없어도 기본 프레임으로 통일(#328)이라 유일한 경로다. */}
        {/* 배경·비는 #989가 화면 루트의 absoluteFill 레이어로 옮겼다 — 여기선
            안전영역 여백만 준다(헤더바가 없어 하늘이 맨 위부터 시작한다). */}
        <View
          style={[styles.skySection, headerInset, { paddingBottom: frameBottomGap }]}
          testID="sky-section">
          <HouseSwitcher
            icon={
              currentHouse.myRole === 'OWNER' ? (
                <CrownPictogram size={14} />
              ) : (
                <HousePictogram size={14} />
              )
            }
            title={currentHouse.name}
            showArrows={totalPages > 1}
            onPrev={prevHouse}
            onNext={nextHouse}
          />
          {/* 대기 카드 페이지(#648)는 내 집이 아니라 정렬 대상에서 빠진다. */}
          <HouseOrderDots
            houses={orderableHouses}
            pendingCount={pendingList.length}
            index={houseIndex}
            onReorder={onReorderHouses}
          />
          <View onLayout={measureHeaderBottom} testID="house-header-end" />
          {/* 레벨·멤버 pill — 프레임 여백과 정렬된 행 (모서리 절대배치는
                화면 끝에 걸려 보였다). 고정 밝기 흰 스크림 위라 onTint 잉크. */}
          <View
            style={[
              styles.framePillsRow,
              // Tall roofs leave quiet corners beside the balloon/roof peak.
              // Float metadata there instead of pushing all three floors down.
              isThreeStorey ? [styles.floatingFramePills, { top: headerBottom }] : null,
            ]}>
            <GlassSurface
              interactive={false}
              fallbackColor={FixedOverlay.skyPill}
              style={styles.skyPill}>
              <HousePictogram size={12} />
              <Text style={[Typography.supporting, { color: t.onTint }]}>
                Lv.{currentHouse.level ?? 0}
                {currentHouse.growthPoints != null
                  ? ` · ${currentHouse.growthPoints % 100}/100`
                  : ''}
              </Text>
            </GlassSurface>
            <GlassSurface
              interactive={false}
              fallbackColor={FixedOverlay.skyPill}
              style={styles.skyPill}>
              <Text style={[Typography.supporting, { color: t.onTint }]}>
                {/* Vacant seats are not members — count the real ones. */}
                {tr('house.screen.members', {
                  n: currentHouse.memberCount ?? manageableMembers(currentHouse).length,
                })}
                {currentHouse.maxMembers ? ` / ${currentHouse.maxMembers}` : ''}
              </Text>
            </GlassSurface>
          </View>
          {/* 남는 세로를 여기서 먹어 집을 잔디에 붙인다 (#986). CoachTarget이
              flex 자식이라 안쪽 View에 auto 마진을 줘도 안 먹는다 — 명시 스페이서. */}
          <View style={styles.skySpacer} />
          <CoachTarget id="house-frame">
            <Animated.View
              testID="house-frame-viewport"
              style={[
                styles.cameraViewportOuter,
                fittedFrameWidth == null
                  ? null
                  : { maxWidth: fittedFrameWidth, alignSelf: 'center' },
                { opacity: switchFade, transform: [{ translateX: switchX }] },
              ]}>
              <GestureDetector gesture={cameraGesture}>
                <View style={styles.cameraViewport}>
                  <Reanimated.View style={camStyle}>
                    <GestureDetector gesture={frameDragGesture}>
                      <View style={[styles.frameWrap, { aspectRatio: frame.aspectRatio }]}>
                        {/* 프레임 측정용 — 반응자 프롭이 있는 부모에는 테스트에서
                      layout 이벤트가 닿지 않아 absolute-fill 형제로 잰다. */}
                        <View
                          testID="frame-camera"
                          pointerEvents="none"
                          style={StyleSheet.absoluteFill}
                          onLayout={onFrameLayout}
                        />
                        {/* 창문 뒤 좌석 — 프레임 PNG의 투명 창문으로 방이 보인다. */}
                        {frame.windowRects.map((rect, w) => {
                          const seatIdx = windowSlots[w];
                          return (
                            <View
                              key={`window-${w}`}
                              testID={`house-window-${w}`}
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
                            key={coverKey}
                            source={assetSource(coverKey)}
                            style={StyleSheet.absoluteFill}
                            contentFit="fill"
                            transition={frame.kind === 'stacked' ? 0 : 120}
                            onError={onFrameError}
                            recyclingKey={coverKey}
                            // 디스크 캐시 유지 — 앱 재실행 후에도 재요청 없이 즉시 (#463).
                            cachePolicy="memory-disk"
                            accessibilityLabel={tr('house.screen.houseA11y', {
                              name: currentHouse.name,
                            })}
                            testID="house-frame"
                          />
                        </View>
                      </View>
                    </GestureDetector>
                  </Reanimated.View>
                </View>
              </GestureDetector>
              {/* ⟲ 리셋 버튼은 카메라 제스처를 가진 cameraViewport
                  바깥, 그 형제로 둔다 — zoomed 동안 부모의 capture move 핸들러가
                  버튼 위 탭의 미세한 손가락 이동마저 가로채 onPress가 취소됐다
                  (실기기, #307 후속). cameraViewportOuter가 절대배치 기준. */}
              {zoomed ? (
                <Pressable
                  onPress={resetCam}
                  accessibilityRole="button"
                  accessibilityLabel={tr('house.screen.zoomExit')}
                  style={styles.camReset}>
                  <GlassSurface style={styles.iconBtnFace} fallbackColor={t.surface}>
                    <Icon name="refresh" size={16} color={t.text} />
                  </GlassSurface>
                </Pressable>
              ) : null}
            </Animated.View>
          </CoachTarget>
        </View>
        {/* 프레임 모드에선 방이 창문 안에 그려져 이 격자가 비는데, paddingTop이
            남아 잔디 아래 24px 크림 띠를 만들었다 (#986). 내용이 있을 때만 그린다. */}
        {roomPairs.length === 0 ? null : (
          <GestureDetector gesture={floorsDragGesture}>
            <View style={styles.floors}>
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
          </GestureDetector>
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
              label={tr('house.screen.railMissions')}
              onPress={onOpenMissions}
              /* 줄에서 버튼이 되며 '오늘 1/1'이 눈에서 사라진다 (#875가 드러내려던
                 것이다) — 라벨에는 그대로 담고, 받을 보상은 점으로 남긴다. */
              accessibilityLabel={[
                tr('house.screen.missionsA11yTitle'),
                activeMissionCount > 0
                  ? tr('house.screen.missionsA11yToday', {
                      done: contributedTodayCount,
                      total: activeMissionCount,
                    })
                  : tr('house.screen.missionsA11yNone'),
                claimableCount > 0
                  ? tr('house.screen.missionsA11yClaimable', { n: claimableCount })
                  : null,
              ]
                .filter(Boolean)
                .join(', ')}
              badge={claimableCount > 0 ? t.warning : undefined}
              t={t}
              Typography={Typography}
            />
          </CoachTarget>
        ) : null}
        {onOpenChat ? (
          <RailButton
            icon={<Icon name="chat" size={20} color={t.text} />}
            label={tr('house.chat.rail')}
            onPress={onOpenChat}
            accessibilityLabel={
              chatUnread > 0
                ? tr('house.chat.railA11yUnread', { n: chatUnread })
                : tr('house.chat.railA11y')
            }
            count={chatUnread}
            t={t}
            Typography={Typography}
          />
        ) : null}
        <CoachTarget id="house-search">
          <RailButton
            icon={<Icon name="search" size={20} color={t.text} />}
            label={tr('house.screen.railSearch')}
            onPress={onOpenSearch}
            accessibilityLabel={tr('house.screen.railSearch')}
            t={t}
            Typography={Typography}
          />
        </CoachTarget>
        {/* 튜토리얼 '친구 초대' 첫 대상 (#1324). */}
        <CoachTarget id="house-manage">
          <RailButton
            icon={<Icon name="members" size={20} color={t.text} />}
            label={tr('house.screen.railManage')}
            onPress={onOpenMembers}
            accessibilityLabel={tr('house.screen.railManage')}
            t={t}
            Typography={Typography}
          />
        </CoachTarget>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  // 떠 있는 원형 버튼의 면 (#1050) — 위치·크기는 버튼이, 모양·배경은 면이.
  iconBtnFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
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
  floatingFramePills: {
    position: 'absolute',
    left: 0,
    zIndex: 2,
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
