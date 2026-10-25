import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { House } from '@/components/screens/house/types';
import { manageableMembers } from '@/components/screens/house/members';
import { GlassSurface } from '@/components/ui/glass-surface';
import { HousePictogram } from '@/components/ui/pictograms';
import { FixedOverlay, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { assetSource } from '@/resources/asset';
import type { HouseFrame } from '@/resources/house-frame';

/**
 * 집 한 채의 장면 조각 — **실제 집 화면과 옆 집 미리보기(#1575)가 같이 쓴다.**
 *
 * 집 탭을 가로로 밀면 옆 집이 손가락을 따라 들어오고, 놓으면 그 집이 실제 화면으로
 * 바뀐다. 두 렌더의 프레임 크기·위치가 1px이라도 다르면 정착하는 순간 집이 튄다.
 * 그래서 크기를 정하는 계산과 레이아웃 스타일을 한 곳에 둔다 — 복사본이면 한쪽만
 * 고쳐지는 날이 온다.
 */

export type HouseFrameFit = {
  isThreeStorey: boolean;
  /** 프레임 아래 여백 — 세 층은 세로가 빠듯해 줄인다. */
  frameBottomGap: number;
  /** 세 층 세로 화면에서 첫 화면 안에 들도록 줄인 폭. 그 밖엔 undefined(전체 폭). */
  fittedFrameWidth: number | undefined;
};

/**
 * 프레임 크기 맞춤. 세 층 세로 프레임은 화면 폭 그대로면 첫 화면을 넘을 수 있어,
 * 측정한 헤더·하단 내비·프레임 여백을 빼고 맞춘다. 가로·짧은 화면(임베드 미리보기)은
 * 줄이지 않고 스크롤로 남긴다.
 */
export function fitHouseFrame(
  frame: Pick<HouseFrame, 'kind' | 'windowRects' | 'aspectRatio'>,
  viewport: { width: number; height: number },
  headerBottom: number,
  navInset: number,
): HouseFrameFit {
  const isThreeStorey = frame.kind === 'stacked' && frame.windowRects.length === 6;
  const frameBottomGap = isThreeStorey ? Spacing.three : Spacing.six;
  const available = viewport.height - headerBottom - navInset - frameBottomGap - Spacing.two;
  const fittedFrameWidth =
    isThreeStorey && viewport.height > viewport.width && headerBottom > 0 && available > 0
      ? Math.min(viewport.width, available * frame.aspectRatio)
      : undefined;
  return { isThreeStorey, frameBottomGap, fittedFrameWidth };
}

/** 하늘 전면 배경 — 집 커버의 테마 경로에서 파생된 키. 하단 탭은 셸의 형제라 안 덮는다. */
export function HouseBackground({ backgroundKey }: { backgroundKey: string | null | undefined }) {
  return (
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
  );
}

/**
 * 레벨·멤버 알약 — 프레임 여백과 정렬된 행. 고정 밝기 흰 스크림 위라 onTint 잉크.
 * 세 층은 지붕 옆 빈 모서리에 띄워 세 층을 아래로 밀지 않는다.
 */
export function HouseFramePills({
  house,
  floatingTop,
}: {
  house: House;
  /** 세 층 프레임이면 헤더 끝 좌표 — 그 자리에 띄운다. 아니면 undefined(흐름 배치). */
  floatingTop?: number;
}) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  return (
    <View
      style={[
        sceneStyles.framePillsRow,
        floatingTop != null ? [sceneStyles.floatingFramePills, { top: floatingTop }] : null,
      ]}>
      <GlassSurface
        interactive={false}
        fallbackColor={FixedOverlay.skyPill}
        style={sceneStyles.skyPill}>
        <HousePictogram size={12} />
        <Text style={[Typography.supporting, { color: t.onTint }]}>
          Lv.{house.level ?? 0}
          {house.growthPoints != null ? ` · ${house.growthPoints % 100}/100` : ''}
        </Text>
      </GlassSurface>
      <GlassSurface
        interactive={false}
        fallbackColor={FixedOverlay.skyPill}
        style={sceneStyles.skyPill}>
        <Text style={[Typography.supporting, { color: t.onTint }]}>
          {/* Vacant seats are not members — count the real ones. */}
          {tr('house.screen.members', {
            n: house.memberCount ?? manageableMembers(house).length,
          })}
          {house.maxMembers ? ` / ${house.maxMembers}` : ''}
        </Text>
      </GlassSurface>
    </View>
  );
}

const roomStyles = StyleSheet.create({
  roomPreviewFill: { width: '100%', height: '100%' },
  // 빈 좌석의 빈 방은 톤을 낮춰 멤버 방과 확실히 구분한다 (시안 A).
  vacantRoom: { opacity: 0.55 },
});

/** 빈방 프리뷰의 합성 스타일 — memo된 Room에 렌더마다 새 배열을 넘기지 않는다 (#539). */
export const VACANT_ROOM_STYLE = [roomStyles.roomPreviewFill, roomStyles.vacantRoom];

export const sceneStyles = StyleSheet.create({
  /** 한 채의 페이지 — 집 페이저(#1575)의 한 칸. */
  page: { flex: 1 },
  body: {
    // 하늘이 남은 높이를 먹는다 (#986) — 종전엔 paddingBottom 64에 더해
    // 남는 세로를 아무도 안 써서, 잔디 아래로 104~155px의 죽은 띠가 탭바까지
    // 이어졌다. 집이 선반에 얹힌 것처럼 보이던 원인이다.
    flexGrow: 1,
  },
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
  skySpacer: { flexGrow: 1 },
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
  // 프레임 PNG의 투명 창문 자리 — 좌석 타일이 이 안을 가득 채운다.
  windowSlot: {
    position: 'absolute',
  },
  windowFiller: {
    flex: 1,
    borderRadius: Radius.md,
    opacity: 0.6,
  },
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
});
