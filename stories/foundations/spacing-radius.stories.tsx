import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

function SpacingScale() {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.stack}>
      <Text style={[Typography.body, { color: t.text }]}>
        여백과 요소 사이 간격에 사용하는 실제 크기예요.
      </Text>
      {Object.entries(Spacing).map(([name, value]) => (
        <View key={name} style={[styles.row, { borderColor: t.border }]}>
          <View style={styles.label}>
            <Text style={[Typography.label, { color: t.text }]}>{name}</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>{value}px</Text>
          </View>
          <View
            accessibilityLabel={`${name}: ${value}px`}
            style={[styles.spacingBar, { width: value, backgroundColor: t.primary }]}
          />
        </View>
      ))}
    </View>
  );
}

function RadiusScale() {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.stack}>
      <Text style={[Typography.body, { color: t.text }]}>
        카드부터 둥근 버튼까지 같은 반지름 토큰으로 모서리를 맞춰요.
      </Text>
      {Object.entries(Radius).map(([name, value]) => (
        <View key={name} style={[styles.row, { borderColor: t.border }]}>
          <View style={styles.label}>
            <Text style={[Typography.label, { color: t.text }]}>{name}</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>{value}px</Text>
          </View>
          <View
            accessibilityLabel={`${name}: ${value}px`}
            style={[
              styles.radiusSample,
              { borderRadius: value, backgroundColor: t.primary, borderColor: t.primaryActive },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const meta = {
  id: 'foundations-spacing-radius',
  title: '디자인 토큰/간격과 모서리',
  component: SpacingScale,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          '`src/constants/theme.ts`의 Spacing과 Radius를 그대로 그립니다. 간격 막대의 가로 폭은 토큰의 실제 픽셀 값이며, 모서리 예시는 모두 같은 크기로 비교합니다.',
      },
    },
  },
} satisfies Meta<typeof SpacingScale>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpacingTokens: Story = { name: '간격 7단계' };
export const RadiusTokens: Story = {
  name: '모서리 5단계',
  render: () => <RadiusScale />,
};

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { width: Spacing.six, gap: Spacing.half },
  spacingBar: { height: Spacing.four },
  radiusSample: {
    width: Spacing.six * 2,
    height: Spacing.six,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
