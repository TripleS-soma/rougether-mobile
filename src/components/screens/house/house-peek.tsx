import { Image } from 'expo-image';
import { memo, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { HouseOrderDots, type OrderableHouse } from '@/components/room/house-order-dots';
import type { MemberRoomPreview, RoomCatalogProps } from '@/components/room/room';
import {
  fitHouseFrame,
  HouseBackground,
  HouseFramePills,
  sceneStyles,
  VACANT_ROOM_STYLE,
} from '@/components/screens/house/house-scene';
import { HouseSwitcher } from '@/components/screens/house/house-switcher';
import { SeatTile } from '@/components/screens/house/seat-tile';
import { seatRowsFor } from '@/components/screens/house/seat-geometry';
import type { House } from '@/components/screens/house/types';
import { CrownPictogram, HousePictogram } from '@/components/ui/pictograms';
import type { CharacterId } from '@/constants/characters';
import { useHouseFrame } from '@/hooks/use-house-frame';
import { characterIdForMember } from '@/hooks/use-member-room-previews';
import { useHeaderInsetStyle } from '@/hooks/use-screen-style';
import { useResolvedScheme, useTokens } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import { houseBackgroundKey } from '@/resources/house-background';
import { type HouseFrameOptions, houseWindowSeats } from '@/resources/house-frame';
import { VACANT_FLOOR } from '@/resources/furniture';

export type HousePeekProps = Pick<HouseFrameOptions, 'enabled' | 'previewTheme'> & {
  house: House;
  /** 이 페이지의 전체 페이지 기준 위치 — 도트가 이 자리를 가리킨다. */
  pageIndex: number;
  totalPages: number;
  orderableHouses: OrderableHouse[];
  pendingCount: number;
  /** 실제 집 화면이 잰 값 — 헤더 구조가 집마다 같아 그대로 쓴다. */
  viewport: { width: number; height: number };
  headerBottom: number;
  navInset: number;
  /** membershipId 키 — 이미 다녀온 집이면 실제 방이 캐시에 있다. 없으면 아바타. */
  roomPreviews?: Record<number, MemberRoomPreview>;
  characterId: CharacterId;
  userName: string;
  catalogs: RoomCatalogProps;
};

const noop = () => {};

/**
 * 옆 집 미리보기 (#1575) — 집 탭을 가로로 밀 때 손가락을 따라 들어오는 집.
 *
 * **보이기만 한다.** 카메라·자리 드래그·방문 탭은 실제 집 화면 한 벌에만 있다. 집
 * 화면을 두세 벌 띄우면 그 상태가 중복되고 방 미리보기 요청이 배로 는다. 놓아서
 * 정착하면 이 자리가 실제 집 화면으로 바뀐다.
 *
 * 크기·위치는 `house-scene`의 같은 계산과 스타일을 쓴다 — 달라지면 바뀌는 순간 튄다.
 * 방은 이미 받아 둔 미리보기가 있으면 그리고, 없으면 좌석 타일의 아바타 폴백이다.
 * 처음 가는 집은 정착한 뒤 방이 로드된다 — 화살표로 넘길 때와 같다.
 */
export const HousePeek = memo(function HousePeek({
  house,
  pageIndex,
  totalPages,
  orderableHouses,
  pendingCount,
  viewport,
  headerBottom,
  navInset,
  roomPreviews,
  characterId,
  userName,
  catalogs,
  enabled,
  previewTheme,
}: HousePeekProps) {
  const t = useTokens();
  const scheme = useResolvedScheme();
  const headerInset = useHeaderInsetStyle();
  // 타일 계약(#775)이 공유값 참조 고정을 요구한다 — 미리보기는 움직이지 않으니 상수.
  const dragPan = useRef(useSharedValue({ x: 0, y: 0 })).current;
  const liftScale = useRef(useSharedValue(1)).current;
  const seatMetaOpacity = useRef(useSharedValue(1)).current;

  const rowShapes = useMemo(() => house.floors.map((f) => f.rooms.length), [house]);
  const cells = useMemo(() => house.floors.flatMap((f) => f.rooms), [house]);
  const seatRows = useMemo(() => seatRowsFor(rowShapes), [rowShapes]);
  const { frame } = useHouseFrame(house.coverImageKey, {
    failureScope: house.houseId ?? pageIndex,
    maxMembers: house.maxMembers,
    minimumSeats: cells.length,
    enabled,
    previewTheme,
  });
  const windowSlots = useMemo(
    () => houseWindowSeats(seatRows, frame.windowRects.length),
    [seatRows, frame.windowRects],
  );
  const { isThreeStorey, frameBottomGap, fittedFrameWidth } = fitHouseFrame(
    frame,
    viewport,
    headerBottom,
    navInset,
  );

  return (
    <View
      style={sceneStyles.page}
      pointerEvents="none"
      // 화면에 잠깐 보이는 그림일 뿐이다 — 스크린리더가 두 집을 동시에 읽으면 안 된다.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`house-peek-${pageIndex}`}>
      <HouseBackground backgroundKey={houseBackgroundKey(frame.canonicalKey, scheme)} />
      <View style={[sceneStyles.body, navInset ? { paddingBottom: navInset } : null]}>
        <View style={[sceneStyles.skySection, headerInset, { paddingBottom: frameBottomGap }]}>
          <HouseSwitcher
            icon={
              house.myRole === 'OWNER' ? <CrownPictogram size={14} /> : <HousePictogram size={14} />
            }
            title={house.name}
            showArrows={totalPages > 1}
            onPrev={noop}
            onNext={noop}
          />
          <HouseOrderDots houses={orderableHouses} pendingCount={pendingCount} index={pageIndex} />
          <HouseFramePills house={house} floatingTop={isThreeStorey ? headerBottom : undefined} />
          <View style={sceneStyles.skySpacer} />
          <View
            testID={`house-peek-frame-${pageIndex}`}
            style={[
              sceneStyles.cameraViewportOuter,
              fittedFrameWidth == null ? null : { maxWidth: fittedFrameWidth, alignSelf: 'center' },
            ]}>
            <View style={sceneStyles.cameraViewport}>
              <View style={[sceneStyles.frameWrap, { aspectRatio: frame.aspectRatio }]}>
                {frame.windowRects.map((rect, w) => {
                  const seatIdx = windowSlots[w];
                  const room = seatIdx != null ? cells[seatIdx] : undefined;
                  return (
                    <View key={`window-${w}`} style={[sceneStyles.windowSlot, rect]}>
                      {room && seatIdx != null ? (
                        <SeatTile
                          seatIdx={seatIdx}
                          displayName={room.isMine ? userName : room.name}
                          // 강퇴 낙관 반영(isKickedMember)은 받지 않는다 — 그 함수는 현재 집
                          // 인덱스를 키에 묶고 있어(`${houseIndex}-${name}`) 옆 집 이름에 대면
                          // 현재 집의 강퇴 목록을 잘못 적용한다. 강퇴한 집을 떠났다가 밀어서
                          // 돌아오는 한 세션 안의 좁은 경우만 미리보기가 사람 있는 방으로
                          // 보이고, 서버 목록이 갱신되면 그마저 사라진다.
                          empty={!!room.vacant}
                          isMine={!!room.isMine}
                          isOwner={!!room.isOwner}
                          bot={!!room.bot}
                          online={!!room.online}
                          lastSeenLabel={room.lastSeenLabel}
                          color={room.color}
                          fill
                          squareFrame={frame.kind === 'stacked'}
                          dragging={false}
                          zoomed={false}
                          preview={
                            !room.vacant && room.membershipId != null
                              ? roomPreviews?.[room.membershipId]
                              : undefined
                          }
                          avatarCharacterId={characterIdForMember(room, roomPreviews, characterId)}
                          catalogs={catalogs}
                          vacantFloor={VACANT_FLOOR}
                          vacantRoomStyle={VACANT_ROOM_STYLE}
                          dragPan={dragPan}
                          liftScale={liftScale}
                          seatMetaOpacity={seatMetaOpacity}
                          onVisit={noop}
                          onLongPress={noop}
                          onPressOut={noop}
                          registerRef={noop}
                        />
                      ) : (
                        <View
                          style={[sceneStyles.windowFiller, { backgroundColor: t.surfaceMuted }]}
                        />
                      )}
                    </View>
                  );
                })}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Image
                    source={assetSource(frame.assetKey)}
                    style={StyleSheet.absoluteFill}
                    contentFit="fill"
                    cachePolicy="memory-disk"
                    recyclingKey={frame.assetKey}
                    accessible={false}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
});
