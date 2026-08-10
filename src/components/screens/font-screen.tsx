import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import {
  type BrandFontId,
  DEFAULT_FONT_ID,
  FONT_OPTIONS,
  Radius,
  Spacing,
  typographyFor,
} from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/** 글자 스와치에 쓸 견본 — 받침·둥근 획이 다 들어가 얼굴 차이가 잘 드러난다. */
const SWATCH_GLYPH = '가';

/**
 * 글자 스와치 스타일 (#382) — 각 폰트의 제목 얼굴로 크게 렌더한다. 주아 혼합은
 * 제목 롤만 Jua이고 본문은 Pretendard라, display1 롤을 그대로 쓰면 의도대로
 * Jua가 나온다(색 스와치가 그 테마의 대표색 하나를 보여주는 것과 같은 이치).
 */
function swatchStyle(id: BrandFontId) {
  const { fontFamily, fontWeight } = typographyFor(id).display1;
  return { fontFamily, fontWeight };
}

export type FontScreenProps = {
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
export function FontScreen({ fontId = DEFAULT_FONT_ID, onChangeFont, onBack }: FontScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="폰트" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        <AppearancePreview />

        <View style={styles.list}>
          {FONT_OPTIONS.map((opt) => {
            const selected = opt.id === fontId;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onChangeFont?.(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${opt.name} 폰트`}
                style={[
                  styles.optRow,
                  { backgroundColor: t.surface, borderColor: selected ? t.primary : t.border },
                  selected && styles.optRowSelected,
                ]}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: t.surfaceMuted, borderColor: t.border },
                  ]}>
                  {/* 이 글자만 해당 폰트로 — 이름은 활성 폰트라 목록 정렬이 흔들리지 않는다. */}
                  <Text style={[styles.swatchGlyph, swatchStyle(opt.id), { color: t.text }]}>
                    {SWATCH_GLYPH}
                  </Text>
                </View>
                <Text
                  style={[
                    Typography.body,
                    emph(selected ? 'bold' : 'normal'),
                    styles.optName,
                    { color: t.text },
                  ]}>
                  {opt.name}
                </Text>
                {selected ? <Icon name="check" size={20} color={t.primaryText} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  list: {
    gap: Spacing.two,
  },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  optRowSelected: {
    borderWidth: 2,
  },
  swatch: {
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
  optName: {
    flex: 1,
  },
});
