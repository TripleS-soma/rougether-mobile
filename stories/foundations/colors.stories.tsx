import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, type SemanticColors, Spacing, THEME_OPTIONS } from '@/constants/theme';
import { useBrandTheme, useResolvedScheme, useTokens, useTypography } from '@/hooks/use-tokens';

const TOKEN_LABELS = {
  appShell: '앱 바깥 배경',
  screen: '화면 배경',
  surface: '시트·입력 영역',
  card: '카드',
  surfaceMuted: '차분한 표면',
  border: '테두리·구분선',
  text: '기본 글자',
  textMuted: '보조 글자',
  textDisabled: '비활성 글자',
  icon: '기본 아이콘',
  primary: '주요 액션 배경',
  primaryActive: '눌린 주요 액션',
  onPrimary: '주요 액션 위 글자',
  primaryText: '강조 글자·링크',
  onTint: '고정 밝은 배경 위 글자',
  success: '성공',
  warning: '주의',
  warningText: '주의 안내 글자',
  danger: '위험 액션 배경',
  info: '정보',
  primarySoft: '선택 상태 배경',
  warningSoft: '주의 안내 배경',
  dangerSoft: '위험 안내 배경',
  dangerText: '위험 안내 글자',
  disabledBg: '비활성 컨트롤',
  sky: '공동집 하늘',
  grass: '공동집 잔디',
} satisfies Record<keyof SemanticColors, string>;

function ColorTokens() {
  const t = useTokens();
  const Typography = useTypography();
  const { themeId } = useBrandTheme();
  const scheme = useResolvedScheme();
  const themeName = THEME_OPTIONS.find((theme) => theme.id === themeId)?.name ?? themeId;

  return (
    <View style={styles.stack}>
      <View style={styles.heading}>
        <Text style={[Typography.h2, { color: t.text }]}>{themeName} 색상</Text>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {scheme === 'dark' ? '다크' : '라이트'} 모드 · {Object.keys(t).length}개 역할
        </Text>
        <Text style={[Typography.body, { color: t.text }]}>
          상단 도구 모음에서 테마와 모드를 바꾸면 앱의 실제 색상 토큰이 반영돼요.
        </Text>
      </View>
      <View style={styles.grid}>
        {(Object.entries(t) as [keyof SemanticColors, string][]).map(([name, value]) => (
          <View
            key={name}
            style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View
              accessibilityLabel={`${name}: ${value}`}
              style={[styles.swatch, { backgroundColor: value, borderColor: t.border }]}
            />
            <Text selectable style={[Typography.label, { color: t.text }]}>
              {name}
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {TOKEN_LABELS[name]}
            </Text>
            <Text selectable style={[Typography.code, { color: t.textMuted }]}>
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const meta = {
  id: 'foundations-colors',
  title: '디자인 토큰/색상',
  component: ColorTokens,
  tags: ['autodocs'],
  parameters: {
    canvasWidth: 900,
    controls: { disable: true },
    docs: {
      description: {
        component:
          '`useTokens()`가 반환하는 시맨틱 색상 전체입니다. 반투명 토큰은 현재 테마의 surface 위에서 보여 줍니다. 강조 글자는 primaryText, 위험 안내 글자는 dangerText처럼 글자 전용 토큰을 사용합니다.',
      },
    },
  },
} satisfies Meta<typeof ColorTokens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveTheme: Story = { name: '현재 테마의 모든 색상' };

const styles = StyleSheet.create({
  stack: { gap: Spacing.four },
  heading: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: {
    flexBasis: '22%',
    flexGrow: 1,
    minWidth: Spacing.six * 2,
    padding: Spacing.two,
    gap: Spacing.half,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
  },
  swatch: {
    height: Spacing.six,
    marginBottom: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
  },
});
