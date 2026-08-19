import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
import { PickerRow, pickerStyles } from '@/components/screens/settings/picker-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import type { CharacterId } from '@/constants/characters';
import {
  type BrandFontId,
  DEFAULT_FONT_ID,
  displayFaceFor,
  FONT_OPTIONS,
  Radius,
} from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

/** 글자 스와치에 쓸 견본 — 받침·둥근 획이 다 들어가 얼굴 차이가 잘 드러난다. */
const SWATCH_GLYPH = '가';

export type FontScreenProps = {
  /** 미리보기 카드에 그릴 내 정체성 (#899). */
  userName?: string;
  characterId?: CharacterId;
  /** Active app font; drives the selected marker + live preview. */
  fontId?: BrandFontId;
  onChangeFont?: (id: BrandFontId) => void;
  onBack?: () => void;
};

/**
 * "폰트" picker reached from 설정 → 폰트 (#750, 구 인라인 칩 그리드 #382).
 * 테마 색상 화면(#459)과 같은 짜임 — 고른 폰트가 즉시 앱 전역에 적용되므로
 * 미리보기 카드와 이 화면의 글자가 통째로 바뀐다. 순수/prop 기반이고 영속화는
 * 셸(BrandThemeProvider)이 맡는다.
 */
export function FontScreen({
  userName,
  characterId,
  fontId = DEFAULT_FONT_ID,
  onChangeFont,
  onBack,
}: FontScreenProps) {
  const t = useTokens();

  return (
    <View style={[pickerStyles.screen, useScreenStyle([])]}>
      <ScreenHeader title="폰트" onBack={onBack} />

      <ScrollView contentContainerStyle={pickerStyles.body}>
        <AppearancePreview userName={userName} characterId={characterId} />

        <View style={pickerStyles.list}>
          {FONT_OPTIONS.map((opt) => (
            <PickerRow
              key={opt.id}
              name={opt.name}
              selected={opt.id === fontId}
              accessibilityLabel={`${opt.name} 폰트`}
              onPress={() => onChangeFont?.(opt.id)}
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
    </View>
  );
}

const styles = StyleSheet.create({
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
