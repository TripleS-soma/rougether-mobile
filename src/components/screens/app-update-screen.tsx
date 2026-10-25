import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type AppUpdateProps = {
  /** 안내에 띄울 최신 버전("1.5.4"). 없으면 문구에서 생략한다. */
  latestVersion?: string;
  onOpenStore?: () => void;
};

/**
 * 더 이상 쓸 수 없는 버전에 뜨는 화면 (#1572). 닫을 수 없다 — 서버 계약이
 * 실제로 깨진 버전에만 쓸 판정이고, 그 상태로 앱을 돌리면 조용히 잘못된 요청을
 * 보낸다. 평소에 쓰는 건 `AppUpdateSheet`(닫을 수 있는 안내)다.
 */
export function AppUpdateScreen({ latestVersion, onOpenStore }: AppUpdateProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  // 넓은 화면에서 본문이 끝까지 늘어나지 않게 (#725). 배경은 바깥이 칠한다 —
  // 이 화면은 앱 트리 위에 덮이므로 컬럼 밖이 비면 아래가 그대로 보인다.
  const column = useResponsiveColumn();
  return (
    <View
      style={[styles.screen, { backgroundColor: t.screen }]}
      accessibilityRole="alert"
      accessibilityLabel={tr('app.versionGate.a11y')}>
      <View style={[styles.content, column]}>
        <Text style={[Typography.h2, { color: t.text }]}>{tr('app.versionGate.blockedTitle')}</Text>
        <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
          {tr('app.versionGate.blockedBody')}
        </Text>
        {latestVersion ? (
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('app.versionGate.version', { version: latestVersion })}
          </Text>
        ) : null}
        <Button label={tr('app.versionGate.update')} style={styles.action} onPress={onOpenStore} />
      </View>
    </View>
  );
}

export type AppUpdateSheetProps = AppUpdateProps & {
  visible: boolean;
  /** 나중에 — 이 세션에서 감춘다. */
  onLater?: () => void;
};

/** 새 버전이 나왔을 때의 안내 (#1572). 닫을 수 있고, 다음 버전이 나오면 다시 뜬다. */
export function AppUpdateSheet({
  visible,
  latestVersion,
  onOpenStore,
  onLater,
}: AppUpdateSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  return (
    <BottomSheet
      visible={visible}
      accessibilityLabel={tr('app.versionGate.a11y')}
      onClose={onLater}
      cardStyle={[styles.sheet, { backgroundColor: t.surface }]}>
      <Text style={[Typography.h3, { color: t.text }]}>{tr('app.versionGate.noticeTitle')}</Text>
      <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
        {tr('app.versionGate.noticeBody')}
      </Text>
      {latestVersion ? (
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('app.versionGate.version', { version: latestVersion })}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={tr('app.versionGate.later')}
          variant="secondary"
          style={styles.action}
          onPress={onLater}
        />
        <Button label={tr('app.versionGate.update')} style={styles.action} onPress={onOpenStore} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: Spacing.six },
  content: { gap: Spacing.two },
  sheet: {
    padding: Spacing.five,
    gap: Spacing.two,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  body: { marginBottom: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  action: { flex: 1 },
});
