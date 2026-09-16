import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const meta = {
  id: 'components-glass-surface',
  title: '컴포넌트/글래스 표면',
  component: GlassSurface,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '떠 있는 버튼·알약의 표면입니다. iOS 26에서는 리퀴드 글래스, 그 밖(Android·웹·iOS 25 이하)에서는 fallbackColor 반투명 면으로 그립니다. 브라우저에서는 항상 폴백 모습이므로 글래스 질감은 iOS 기기에서 확인하세요.',
      },
    },
  },
  args: { fallbackColor: '#FFFFFF', interactive: false, lift: true, children: null },
  argTypes: {
    fallbackColor: { control: 'color' },
    tintColor: { control: 'color' },
    interactive: { control: 'boolean' },
    lift: { control: 'boolean' },
    glassEffectStyle: { control: 'inline-radio', options: ['regular', 'clear'] },
    children: { control: false, table: { disable: true } },
    style: { control: false, table: { disable: true } },
  },
  render: function Render(args) {
    const t = useTokens();
    const Typography = useTypography();
    return (
      <GlassSurface {...args} style={styles.pill}>
        <Text style={[Typography.label, { color: t.text }]}>Lv. 14</Text>
      </GlassSurface>
    );
  },
} satisfies Meta<typeof GlassSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pill: Story = { name: '라벨 알약' };
export const NoLift: Story = { name: '그림자 없음', args: { lift: false } };

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
