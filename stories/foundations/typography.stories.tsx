import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text, View } from 'react-native';

import { FONT_OPTIONS, Radius, Spacing, type TypeRole, type TypeStyle } from '@/constants/theme';
import { BrandThemePreview, useBrandTheme, useTokens, useTypography } from '@/hooks/use-tokens';

type TypographyProps = { sample: string };

function TypeScale({ sample }: TypographyProps) {
  const t = useTokens();
  const Typography = useTypography();
  const { fontId } = useBrandTheme();
  const fontName = FONT_OPTIONS.find((font) => font.id === fontId)?.name ?? fontId;

  return (
    <View style={styles.stack}>
      <View style={styles.heading}>
        <Text style={[Typography.h2, { color: t.text }]}>{fontName}</Text>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          상단에서 폰트를 바꾸고 Controls에서 예문을 수정해 보세요.
        </Text>
      </View>
      {(Object.entries(Typography) as [TypeRole, TypeStyle][]).map(([role, style]) => (
        <View key={role} style={[styles.typeRow, { borderColor: t.border }]}>
          <Text style={[Typography.label, { color: t.primaryText }]}>{role}</Text>
          <Text style={[style, { color: t.text }]}>{sample}</Text>
          <Text selectable style={[Typography.supporting, { color: t.textMuted }]}>
            {style.fontSize}px / 행간 {style.lineHeight}px ·{' '}
            {style.fontFamily ?? `시스템 ${style.fontWeight}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function FontSample({ sample, name }: TypographyProps & { name: string }) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={[styles.fontCard, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[Typography.label, { color: t.primaryText }]}>{name}</Text>
      <Text style={[Typography.h1, { color: t.text }]}>{sample}</Text>
      <Text style={[Typography.body, { color: t.text }]}>작은 루틴을 쌓아 나만의 방을 가꿔요.</Text>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>Rougether · 0123456789</Text>
    </View>
  );
}

function FontComparison({ sample }: TypographyProps) {
  return (
    <View style={styles.stack}>
      {FONT_OPTIONS.map((font) => (
        <BrandThemePreview key={font.id} fontId={font.id}>
          <FontSample sample={sample} name={font.name} />
        </BrandThemePreview>
      ))}
    </View>
  );
}

const meta = {
  id: 'foundations-typography',
  title: '디자인 토큰/타이포그래피',
  component: TypeScale,
  tags: ['autodocs'],
  args: { sample: '오늘도 한 걸음' },
  argTypes: { sample: { control: 'text', description: '모든 역할에 적용할 예문' } },
  parameters: {
    docs: {
      description: {
        component:
          '`useTypography()`의 10개 역할과 실제 폰트 파일을 비교합니다. 커스텀 폰트의 굵기는 fontWeight 덧씌우기 없이 역할에 맞는 fontFamily로 표현합니다. 주아 혼합은 큰 제목에 주아, 본문에 프리텐다드를 사용합니다.',
      },
    },
  },
} satisfies Meta<typeof TypeScale>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Roles: Story = { name: '현재 폰트의 타입 스케일' };

export const Fonts: Story = {
  name: '선택 가능한 폰트 비교',
  render: (args) => <FontComparison {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          '설정의 FONT_OPTIONS에 등록된 폰트를 한 번에 비교합니다. 각 카드의 폰트는 고정되며 상단 테마·모드 선택은 그대로 반영됩니다.',
      },
    },
  },
};

const styles = StyleSheet.create({
  stack: { gap: Spacing.four },
  heading: { gap: Spacing.two },
  typeRow: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fontCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
