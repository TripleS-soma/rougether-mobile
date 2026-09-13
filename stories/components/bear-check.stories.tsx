import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { StyleSheet, Text, View } from 'react-native';

import { BearCheck, type BearCheckProps } from '@/components/ui/bear-check';
import { CATEGORY_COLORS } from '@/constants/routines';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const meta = {
  id: 'components-bear-check',
  title: '컴포넌트/곰 체크',
  component: BearCheck,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '루틴 완료 여부를 표시하는 곰 모양 체크입니다. 미완료에서 완료로 바꿀 때 스프링 애니메이션이 실행됩니다. onPress를 생략하면 표시 전용으로 사용합니다.',
      },
    },
  },
  args: {
    checked: false,
    size: 26,
    accessibilityLabel: '책 10쪽 읽기 완료',
    onPress: fn(),
  },
  argTypes: {
    checked: { control: 'boolean', description: '완료 여부' },
    color: {
      control: 'color',
      description: '완료 색상. 생략하면 활성 테마의 primary를 사용합니다.',
    },
    size: {
      control: { type: 'range', min: 18, max: 48, step: 2 },
      description: '곰 머리 지름(px)',
    },
    accessibilityLabel: { control: 'text', description: '선택 가능한 체크의 접근성 이름' },
    onPress: { control: false, description: '생략하면 눌러도 값이 바뀌지 않는 표시 전용 상태' },
  },
  render: function Render(args) {
    const [{ checked }, updateArgs] = useArgs<BearCheckProps>();
    const t = useTokens();
    const Typography = useTypography();

    return (
      <View style={styles.row}>
        <BearCheck
          {...args}
          checked={checked}
          onPress={
            args.onPress
              ? (event) => {
                  args.onPress?.(event);
                  updateArgs({ checked: !checked });
                }
              : undefined
          }
        />
        <View style={styles.copy}>
          <Text style={[Typography.body, { color: t.text }]}>책 10쪽 읽기</Text>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {args.onPress ? (checked ? '완료했어요' : '곰을 눌러 완료해 보세요') : '표시 전용'}
          </Text>
        </View>
      </View>
    );
  },
} satisfies Meta<typeof BearCheck>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = { name: '미완료' };

export const Checked: Story = {
  name: '완료',
  args: { checked: true },
};

export const CategoryColor: Story = {
  name: '카테고리 색상',
  args: { checked: true, color: CATEGORY_COLORS[1] },
};

export const ReadOnly: Story = {
  name: '표시 전용',
  args: { checked: true, onPress: undefined },
};

export const Large: Story = {
  name: '큰 체크',
  args: { checked: true, size: 40 },
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  copy: { flex: 1, gap: Spacing.one },
});
