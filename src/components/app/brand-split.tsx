import { Image } from 'expo-image';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import appIcon from '@/assets/images/login-app-icon.webp';
import { Radius, Spacing } from '@/constants/theme';
import { useAppFrame } from '@/hooks/use-app-frame';
import {
  BrandSplitContext,
  type BrandSplitValue,
  NOT_IN_BRAND_SPLIT,
} from '@/hooks/use-brand-split';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/**
 * 로그인·회원가입·온보딩의 넓은 화면 배치 — 펼친 폴더블·태블릿·데스크톱 웹.
 *
 * 이 화면들은 앱 셸 밖이라 탭 화면의 오른쪽 칸에 열 수 없고, 폰 폭 한 칸으로 가운데 서면 양옆이
 * 빈다. 2단에서는 왼쪽 칸에 앱 소개(아이콘·이름·한 줄 소개)를 채우고 오른쪽 칸에 화면을 둔다.
 * 가입 흐름 내내 왼쪽이 그대로라 화면이 바뀌어도 자리가 흔들리지 않는다.
 *
 * 한 칸(폰)에서는 children만 그린다. 그때도 같은 래퍼를 둬서 접었다 펼 때 입력 중인 화면이
 * 리마운트되지 않는다.
 */
export function BrandSplit({ children }: { children: ReactNode }) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const { split, width } = useAppFrame();
  const [measured, setMeasured] = useState<number | null>(null);
  // 2단을 벗어나면 잰 폭을 버린다 — 다른 폭으로 다시 펼쳤을 때 첫 프레임에 옛 폭이 쓰이지 않게.
  useEffect(() => {
    if (!split) setMeasured(null);
  }, [split]);
  const value = useMemo<BrandSplitValue>(
    () => (split ? { inSplit: true, paneWidth: measured ?? width / 2 } : NOT_IN_BRAND_SPLIT),
    [split, measured, width],
  );
  return (
    <View style={[styles.fill, split && styles.row]} testID="brand-split">
      {split ? (
        <View style={[styles.pane, { backgroundColor: t.primarySoft }]} testID="brand-split-brand">
          {/* 여백은 안쪽 상자에 — 칸 자체에 주면 그만큼 칸이 넓어져 1:1이 깨진다. */}
          <View style={styles.brand}>
            <View style={[styles.icon, { backgroundColor: t.surface }]}>
              <Image
                source={appIcon}
                style={styles.iconImg}
                contentFit="cover"
                accessibilityLabel={tr('member.login.appIconA11y')}
              />
            </View>
            <Text style={[Typography.h1, { color: t.text }]}>{tr('member.login.appName')}</Text>
            <Text style={[Typography.body, styles.tagline, { color: t.textMuted }]}>
              {tr('member.login.tagline')}
            </Text>
          </View>
        </View>
      ) : null}
      <View
        style={split ? styles.pane : styles.fill}
        onLayout={split ? (e) => setMeasured(e.nativeEvent.layout.width) : undefined}
        testID="brand-split-content">
        <BrandSplitContext.Provider value={value}>{children}</BrandSplitContext.Provider>
      </View>
    </View>
  );
}

const ICON_SIZE = 144;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  pane: { flex: 1, flexBasis: 0, minWidth: 0 },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  iconImg: { width: '100%', height: '100%' },
  tagline: { textAlign: 'center' },
});
