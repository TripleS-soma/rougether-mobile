import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
import { PickerRow, pickerStyles } from '@/components/screens/settings/picker-row';
import { ActionBar } from '@/components/ui/action-bar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenHeader } from '@/components/ui/screen-header';
import type { CharacterId } from '@/constants/characters';
import {
  type BrandFontId,
  DEFAULT_FONT_ID,
  displayFaceFor,
  FONT_OPTIONS,
  Radius,
} from '@/constants/theme';
import { useActionBarInset, useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { BrandThemePreview, useTokens, useTypography } from '@/hooks/use-tokens';

/** 글자 스와치에 쓸 견본 — 받침·둥근 획이 다 들어가 얼굴 차이가 잘 드러난다. */
const SWATCH_GLYPH = '가';

export type FontScreenProps = {
  /** 미리보기 카드에 그릴 내 정체성 (#899). */
  userName?: string;
  characterId?: CharacterId;
  /** 현재 적용된 폰트 — 초기 선택이자 적용하기 버튼의 활성 기준. */
  fontId?: BrandFontId;
  /** 적용하기 — 고른 값이 현재와 다를 때만 눌린다 (#1096). */
  onApplyFont?: (id: BrandFontId) => void;
  onBack?: () => void;
};

/**
 * "폰트" picker reached from 설정 → 폰트 (#750, 구 인라인 칩 그리드 #382).
 * 테마 색상 화면(#459)과 같은 짜임 — 고르면 **미리보기 카드만** 그 폰트로 바뀌고
 * (BrandThemePreview), 하단 적용하기를 눌러야 전역에 적용된다 (#1096). 적용하지
 * 않고 뒤로 가면 선택을 버린다. 순수/prop 기반이고 영속화는 셸이 맡는다.
 */
export function FontScreen({
  userName,
  characterId,
  fontId = DEFAULT_FONT_ID,
  onApplyFont,
  onBack,
}: FontScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const actionBarInset = useActionBarInset();
  // 고른 값 — 적용 전까지는 이 화면 안에만 산다.
  const [pending, setPending] = useState<BrandFontId>(fontId);
  const canApply = pending !== fontId;

  return (
    <View style={[pickerStyles.screen, useScreenStyle([])]}>
      <ScreenHeader title="폰트" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          pickerStyles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
          { paddingBottom: actionBarInset },
        ]}>
        <BrandThemePreview fontId={pending}>
          <AppearancePreview userName={userName} characterId={characterId} />
        </BrandThemePreview>

        <View style={pickerStyles.list}>
          {FONT_OPTIONS.map((opt) => (
            <PickerRow
              key={opt.id}
              name={opt.name}
              selected={opt.id === pending}
              accessibilityLabel={`${opt.name} 폰트`}
              onPress={() => setPending(opt.id)}
              swatch={
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: t.surfaceMuted, borderColor: t.border },
                  ]}>
                  {/* 이 글자만 해당 폰트로 — 이름은 활성 폰트라 목록 정렬이 흔들리지 않는다. */}
                  <Text style={[styles.swatchGlyph, displayFaceFor(opt.id), { color: t.text }]}>
                    {SWATCH_GLYPH}
                  </Text>
                </View>
              }
            />
          ))}
        </View>
      </ScrollView>

      {/* 적용하기 — 테마 색상 화면과 같은 떠 있는 액션 바 (#1069). */}
      <ActionBar>
        <Pressable
          onPress={() => canApply && onApplyFont?.(pending)}
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
    // 색 스와치는 원, 글자 스와치는 둥근 사각 — 글자가 원 안에서 답답해 보인다.
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchGlyph: {
    fontSize: 20,
    // 폰트별 기본 행간 차이로 글자가 위아래로 밀리지 않게 고정한다.
    lineHeight: 24,
  },
});
