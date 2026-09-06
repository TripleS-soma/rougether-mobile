import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
import { PickerRow, pickerStyles } from '@/components/screens/settings/picker-row';
import { ActionBar } from '@/components/ui/action-bar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenHeader } from '@/components/ui/screen-header';
import type { CharacterId } from '@/constants/characters';
import { DEFAULT_THEME_ID, Radius, THEME_OPTIONS, type ThemeId } from '@/constants/theme';
import { useActionBarInset, useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { BrandThemePreview, useTokens, useTypography } from '@/hooks/use-tokens';

export type ThemeScreenProps = {
  /** 미리보기 카드에 그릴 내 정체성 (#899). */
  userName?: string;
  characterId?: CharacterId;
  /** 현재 적용된 테마 — 초기 선택이자 적용하기 버튼의 활성 기준. */
  themeId?: ThemeId;
  /** 적용하기 — 고른 값이 현재와 다를 때만 눌린다 (#1096). */
  onApplyThemeId?: (id: ThemeId) => void;
  onBack?: () => void;
};

/**
 * "테마 색상" picker reached from 설정 → 테마 색상 (#459). 고르면 **미리보기
 * 카드만** 그 테마로 물들고(BrandThemePreview), 하단 적용하기를 눌러야 전역에
 * 적용된다 (#1096 — 종전엔 고르는 즉시 적용). 적용하지 않고 뒤로 가면 선택을
 * 버린다. Pure/prop-driven; 영속화는 셸이 onApplyThemeId로. Light/dark follows
 * the current mode. Fixed category dots are theme-independent by design.
 */
export function ThemeScreen({
  userName,
  characterId,
  themeId = DEFAULT_THEME_ID,
  onApplyThemeId,
  onBack,
}: ThemeScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const actionBarInset = useActionBarInset();
  // 고른 값 — 적용 전까지는 이 화면 안에만 산다.
  const [pending, setPending] = useState<ThemeId>(themeId);
  const canApply = pending !== themeId;

  return (
    <View style={[pickerStyles.screen, useScreenStyle([])]}>
      <ScreenHeader title="테마 색상" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          pickerStyles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
          { paddingBottom: actionBarInset },
        ]}>
        <BrandThemePreview themeId={pending}>
          <AppearancePreview userName={userName} characterId={characterId} />
        </BrandThemePreview>

        <View style={pickerStyles.list}>
          {THEME_OPTIONS.map((opt) => (
            <PickerRow
              key={opt.id}
              name={opt.name}
              selected={opt.id === pending}
              accessibilityLabel={`${opt.name} 테마`}
              onPress={() => setPending(opt.id)}
              swatch={
                <View
                  style={[styles.swatch, { backgroundColor: opt.swatch, borderColor: t.border }]}
                />
              }
            />
          ))}
        </View>
      </ScrollView>

      {/* 적용하기 — 프로필 편집의 저장과 같은 떠 있는 액션 바 (#1069). */}
      <ActionBar>
        <Pressable
          onPress={() => canApply && onApplyThemeId?.(pending)}
          disabled={!canApply}
          accessibilityRole="button"
          accessibilityLabel="적용하기"
          accessibilityState={{ disabled: !canApply }}
          style={styles.apply}>
          <GlassSurface
            style={styles.applyFace}
            tintColor={canApply ? t.primary : undefined}
            fallbackColor={canApply ? t.primary : t.surfaceMuted}>
            <Text style={[Typography.label, { color: canApply ? t.onPrimary : t.textMuted }]}>
              적용하기
            </Text>
          </GlassSurface>
        </Pressable>
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  apply: { height: 48 },
  applyFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
