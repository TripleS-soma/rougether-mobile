import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 테마 색상·폰트 피커 공용 라이브 미리보기 카드 (#459 → #750에서 공유로 분리).
 * 고른 값이 즉시 앱 전역에 적용되므로 별도 미리보기 토큰 없이 **활성 토큰과
 * 활성 타입 스케일을 그대로** 렌더한다 — 색을 고르면 물들고 폰트를 고르면
 * 글자가 바뀌는, 화면 자체가 미리보기인 구조.
 *
 * 담긴 것은 앱에서 실제로 가장 자주 보는 조각들이다: 방 헤더(아바타·닉네임·
 * 코인 필), 달력 선택 원·카테고리 칩·추가 버튼, 그리고 주 CTA.
 */
export function AppearancePreview() {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();

  return (
    <View style={[styles.preview, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.previewTop}>
        <View style={[styles.avatar, { backgroundColor: t.primarySoft }]}>
          <Text style={styles.avatarGlyph}>🐯</Text>
        </View>
        {/*
          방 이름은 제목 롤로 — 실제 나의 방 헤더가 그렇기도 하고, 주아 혼합처럼
          제목 얼굴만 다른 폰트는 이 한 줄이 없으면 카드 안에서 차이가 안 보인다.
        */}
        <Text style={[Typography.h2, { color: t.text }]}>준서의 방</Text>
        <View style={[styles.coinPill, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[Typography.supporting, emph('bold'), { color: t.text }]}>9999+</Text>
        </View>
      </View>

      <View style={styles.previewRow}>
        {/* 선택 원 샘플 — 달력의 선택 날짜와 같은 primary 채움. */}
        <View style={[styles.dayCircle, { backgroundColor: t.primary }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>15</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: t.primarySoft }]}>
          <Text style={[Typography.supporting, emph('semibold'), { color: t.primaryText }]}>
            달력
          </Text>
        </View>
        <View style={[styles.addBtn, { backgroundColor: t.primary }]}>
          <Text style={[styles.addGlyph, { color: t.onPrimary }]}>＋</Text>
        </View>
      </View>

      <View style={[styles.cta, { backgroundColor: t.primary }]}>
        <Text style={[Typography.label, { color: t.onPrimary }]}>오늘 루틴 완료하기</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: {
    fontSize: 20,
  },
  coinPill: {
    marginLeft: 'auto',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  addBtn: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGlyph: {
    fontSize: 24,
    lineHeight: 26,
  },
  cta: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
