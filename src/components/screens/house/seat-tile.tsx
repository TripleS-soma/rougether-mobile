import { memo, useCallback, useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import {
  memberRoomScene,
  type MemberRoomPreview,
  type RoomCatalogProps,
  Room,
} from '@/components/room/room';
import { OnlineDot } from '@/components/screens/house/online-dot';
import { CrownPictogram } from '@/components/ui/pictograms';
import { type CharacterId } from '@/constants/characters';
import { Overlay, Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import type { Wallpaper } from '@/resources/furniture';

/** 빈 좌석에 그리는 기본 빈 방 (#281) — 모듈 상수라 참조가 고정된다. */
export type SeatTileProps = {
  seatIdx: number;
  /** 화면에 보일 이름 (내 좌석은 라이브 닉네임, #479). */
  displayName: string;
  /** 빈 좌석(정원 여분 또는 강퇴 낙관 반영) — 방문·드래그 불가. */
  empty: boolean;
  isMine: boolean;
  isOwner: boolean;
  online: boolean;
  lastSeenLabel?: string;
  /** 좌석 배경 틴트 — 다크에서도 고정 파스텔이라 onTint 잉크를 쓴다. */
  color: string;
  /** 프레임 창문 안이면 슬롯을 가득 채운다. */
  fill: boolean;
  /** 지금 들려 있는 좌석인가. */
  dragging: boolean;
  /** 확대 중 — 롱프레스 드래그를 막는다(카메라 팬과 충돌). */
  zoomed: boolean;
  /**
   * 그 멤버의 실제 방 (없으면 아바타 폴백). **원본 프리뷰를 그대로** 받는다 —
   * 부모에서 `memberRoomScene`으로 조합해 넘기면 매 렌더 새 객체라 memo가
   * 통째로 무효가 된다 (#775 리뷰). 조합은 아래에서 memo로 한다.
   */
  preview?: MemberRoomPreview;
  /** 프리뷰가 없을 때 세울 캐릭터. */
  avatarCharacterId: CharacterId;
  catalogs: RoomCatalogProps;
  vacantFloor: Wallpaper[];
  vacantRoomStyle: React.ComponentProps<typeof Room>['style'];

  // --- 아래는 전부 참조 고정 계약 (#775). ---
  /** 들린 좌석이 손가락을 따라가는 오프셋 (한 번에 하나만 들린다). */
  dragPan: Animated.ValueXY;
  /** 픽업 스프링. */
  liftScale: Animated.Value;
  /** 확대 시 이름표를 접는 페이드 — camScale에서 보간된 값이라 Value가 아니다. */
  seatMetaOpacity: Animated.AnimatedInterpolation<number> | Animated.Value;
  onVisit: (seatIdx: number) => void;
  onLongPress: (seatIdx: number) => void;
  onPressOut: () => void;
  registerRef: (seatIdx: number, node: View | null) => void;
};

/**
 * 집 좌석 타일 (#775에서 렌더 함수 → memo 컴포넌트로 승격).
 *
 * 승격 전에는 `renderSeatTile(...)` 호출이라 memo 경계가 없었고, 좌석 하나마다
 * `<Room>`(원격 이미지 최대 3장 + 가구 N장)이 들어 있는데 **확대 진입/이탈과
 * 드래그 시작/종료가 곧 전 좌석 재조정**이었다. 정원 8~12석 집에서 핀치 줌
 * 순간 프레임이 떨어지던 지점.
 */
function SeatTileBase({
  seatIdx,
  displayName,
  empty,
  isMine,
  isOwner,
  online,
  lastSeenLabel,
  color,
  fill,
  dragging,
  zoomed,
  preview,
  avatarCharacterId,
  catalogs,
  vacantFloor,
  vacantRoomStyle,
  dragPan,
  liftScale,
  seatMetaOpacity,
  onVisit,
  onLongPress,
  onPressOut,
  registerRef,
}: SeatTileProps) {
  const t = useTokens();
  const Typography = useTypography();
  // 원본 프리뷰·카탈로그가 그대로일 때 씬 객체도 그대로 — <Room>의 memo까지 산다.
  const scene = useMemo(
    () => (preview ? memberRoomScene(preview, catalogs) : null),
    [preview, catalogs],
  );

  const setRef = useCallback((el: View | null) => registerRef(seatIdx, el), [registerRef, seatIdx]);
  const visit = useCallback(() => onVisit(seatIdx), [onVisit, seatIdx]);
  const lift = useCallback(() => onLongPress(seatIdx), [onLongPress, seatIdx]);

  return (
    <Animated.View
      ref={setRef}
      style={[
        styles.roomCellWrap,
        dragging && {
          transform: [...dragPan.getTranslateTransform(), { scale: liftScale }],
          ...styles.roomCellLifted,
        },
      ]}>
      <Pressable
        onPress={empty ? undefined : visit}
        onLongPress={empty || zoomed ? undefined : lift}
        delayLongPress={220}
        onPressOut={onPressOut}
        disabled={empty}
        accessibilityRole="button"
        accessibilityLabel={[
          isMine ? `${displayName} (나)` : displayName,
          online ? '접속 중' : lastSeenLabel && `${lastSeenLabel} 접속`,
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityHint={
          empty
            ? undefined
            : fill
              ? '두 번 탭해 확대, 길게 눌러 자리 옮기기'
              : '길게 눌러 자리 옮기기'
        }
        style={[
          fill ? styles.roomCellFill : styles.roomCell,
          { backgroundColor: empty ? t.surfaceMuted : color, borderColor: t.border },
        ]}>
        {/* 그 멤버의 실제 방이 타일을 채운다(방문 미리보기); 로드 전엔
            단색 틴트 + 아바타가 자리를 지킨다. */}
        {scene ? (
          <View style={styles.roomPreview} pointerEvents="none" testID="room-preview">
            <Room
              {...scene}
              // 재실 좌석은 캐릭터 미지정 시 빈 방이 아니라 기본 캐릭터로.
              characterId={preview?.characterId}
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
              characterId={null}
              floorId={vacantFloor[0].id}
              floors={vacantFloor}
              fill
              style={vacantRoomStyle}
            />
          </View>
        ) : null}
        {empty || preview ? null : <CharacterAvatar characterId={avatarCharacterId} size={64} />}
        {/* 타일은 다크에서도 고정 파스텔 배경이라 이름은 (밝은) theme text가
            아니라 onTint 잉크를 쓴다. 프리뷰 위에서는 하단 스크림으로 대비를
            확보한다. 빈 좌석은 라벨 없이 빈 방 비주얼만 — 접근성 라벨은
            Pressable이 유지한다. */}
        {empty ? null : (
          <Animated.View
            testID={`seat-meta-${seatIdx}`}
            style={[
              styles.roomMeta,
              preview && styles.roomNameOverlay,
              { opacity: seatMetaOpacity },
            ]}>
            <View style={styles.roomNameRow}>
              {isOwner ? <CrownPictogram size={12} /> : null}
              {/* 최근 접속(#383) — 초록 점. 은은한 펄스로 "지금 있음" (#450). */}
              {online ? <OnlineDot color={t.success} /> : null}
              <Text
                // 이름만 줄인다 (#999) — 시간 라벨은 3~5글자로 폭이 거의
                // 일정해서, 둘 다 줄이면 어느 쪽이 잘릴지 타일마다 달라진다.
                numberOfLines={1}
                style={[
                  Typography.supporting,
                  styles.roomName,
                  { color: preview ? StaticWhite : t.onTint },
                ]}>
                {isMine ? `${displayName} (나)` : displayName}
              </Text>
              {/* 마지막 접속은 이름과 같은 줄에 (#999) — 온라인일 때 초록 점이
                  그렇듯 한 줄로 끝나야 뱃지 높이가 좌석마다 흔들리지 않는다.
                  가운뎃점은 흐린 톤을 같이 받도록 라벨 텍스트에 붙인다. */}
              {!online && lastSeenLabel ? (
                <Text
                  style={[
                    Typography.supporting,
                    styles.lastSeen,
                    { color: preview ? StaticWhite : t.onTint },
                  ]}>
                  {`· ${lastSeenLabel}`}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export const SeatTile = memo(SeatTileBase);

const styles = StyleSheet.create({
  roomCellWrap: {
    flex: 1,
  },
  roomCellLifted: {
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
  roomPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  roomPreviewFill: {
    width: '100%',
    height: '100%',
  },
  roomMeta: {
    alignItems: 'center',
    // 말줄임이 걸리려면 줄의 폭이 타일 안에서 유계여야 한다 (#999) — 부모가
    // alignItems:'center'라 이게 없으면 폭이 내용만큼 늘어나 이름이 그냥 넘친다.
    maxWidth: '100%',
  },
  roomNameOverlay: {
    position: 'absolute',
    bottom: Spacing.one,
    // 0.4는 밝은 방 프리뷰 위에서 흰 글자가 4.5:1 아래로 떨어졌다(UX 감사).
    backgroundColor: Overlay.strong,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  roomNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  roomName: {
    fontSize: 12,
    lineHeight: 16,
    // 좁을 때 줄어드는 건 이름 쪽 (#999).
    flexShrink: 1,
  },
  lastSeen: {
    opacity: 0.75,
    // roomName과 같은 이유로 이전 크기 고정 (#669).
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 0,
  },
});
