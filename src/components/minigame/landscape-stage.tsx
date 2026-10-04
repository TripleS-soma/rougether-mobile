import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 이 폭 이상(태블릿)이면 세로로도 충분히 커서 돌리지 않는다. */
const PHONE_MAX_SHORT_SIDE = 600;
/** 게임판 양옆 여백 — 나가기 버튼이 캔버스 HUD(왼쪽 위 점수, 오른쪽 위 일시정지)를 가리지 않게. */
const GUTTER = Spacing.five + Spacing.two;

/** 세로 폰에서만 가로 몰입 플레이 — 웹·태블릿·이미 가로인 창은 그대로 둔다. */
export function useLandscapeStage(): boolean {
  const { width, height } = useWindowDimensions();
  return Platform.OS !== 'web' && height > width && width < PHONE_MAX_SHORT_SIDE;
}

/**
 * 가로 몰입 무대 — 가로로 긴 게임판(`aspect`)을 화면 전체에 90° 돌려 띄운다. 앱 방향 설정
 * (app.json `orientation: portrait`)은 그대로라 네이티브 지문이 바뀌지 않는다 — 콘텐츠만 돈다.
 * 시계 방향으로 돌리므로 폰을 왼쪽으로 눕히면(노치가 왼쪽) 똑바로 보인다.
 *
 * `visible=false`면 Modal이 자식을 내린다 — 끝난 판(결과 화면)이나 다른 화면으로 떠난 뒤엔
 * 게임 문서가 남을 이유가 없다.
 */
export function LandscapeStage({
  visible,
  aspect,
  onExit,
  children,
}: {
  visible: boolean;
  /** 게임판 가로/세로 비율. */
  aspect: number;
  /** 판 그만두기 — ✕ 버튼과 안드로이드 뒤로가기. 없으면 Modal에서 빠져나갈 길이 없어 필수. */
  onExit: () => void;
  children: ReactNode;
}) {
  const t = useTokens();
  const tr = useT();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // 돌린 무대의 긴 변은 폰의 세로 — 노치·홈 인디케이터 쪽 인셋을 양끝에서 같이 비운다.
  const long = height - 2 * Math.max(insets.top, insets.bottom);
  const short = width;
  const frameWidth = Math.min(long - 2 * GUTTER, short * aspect);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onExit}>
      {visible ? <StatusBar hidden /> : null}
      <View style={[styles.backdrop, { backgroundColor: t.screen }]}>
        <View
          testID="landscape-stage"
          style={[
            styles.stage,
            {
              width: long,
              height: short,
              // 긴 변이 창 폭보다 넓다 — 중앙 정렬 오버플로에 기대지 않고 중심을 직접 맞춘 뒤 돌린다.
              left: (width - long) / 2,
              top: (height - short) / 2,
              transform: [{ rotate: '90deg' }],
            },
          ]}>
          <View style={{ width: frameWidth }}>{children}</View>
          <Pressable
            onPress={onExit}
            accessibilityRole="button"
            accessibilityLabel={tr('roomShop.minigame.play.exitA11y')}
            hitSlop={Spacing.two}
            style={[styles.exit, { backgroundColor: t.surface }]}>
            <Icon name="close" size={20} color={t.textMuted} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  stage: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  exit: {
    position: 'absolute',
    left: Spacing.one,
    top: Spacing.two,
    width: Spacing.five,
    height: Spacing.five,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
