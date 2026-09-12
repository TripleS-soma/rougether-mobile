import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useArgs } from 'storybook/preview-api';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SpringProgressBar, type SpringProgressBarProps } from '@/components/ui/spring-progress';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const meta = {
  id: 'components-spring-progress',
  title: '컴포넌트/진행 바',
  component: SpringProgressBar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '루틴과 집 미션의 진행률을 보여주는 스프링 진행 바입니다. 진행률을 높이면 바운스하고, 100%에 도달하면 흰빛이 스칩니다. Controls의 progress 또는 아래 버튼으로 변화를 확인하세요.',
      },
    },
  },
  args: { progress: 0.5, color: '', trackColor: '', height: 10 },
  argTypes: {
    progress: {
      control: { type: 'range', min: 0, max: 1, step: 0.1 },
      description: '진행률(0~1)',
    },
    color: {
      control: 'color',
      description: '채움 색. 이 미리보기에서 빈 값은 테마 primary입니다.',
    },
    trackColor: {
      control: 'color',
      description: '트랙 색. 이 미리보기에서 빈 값은 테마 surfaceMuted입니다.',
    },
    height: { control: { type: 'range', min: 4, max: 20, step: 2 }, description: '트랙 높이(px)' },
    style: { control: false, table: { disable: true } },
  },
  render: function Render(args) {
    const [{ progress }, updateArgs] = useArgs<SpringProgressBarProps>();
    const t = useTokens();
    const Typography = useTypography();

    return (
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text style={[Typography.label, { color: t.text }]}>오늘의 루틴</Text>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <SpringProgressBar
          {...args}
          progress={progress}
          color={args.color || t.primary}
          trackColor={args.trackColor || t.surfaceMuted}
        />
        <View style={styles.actions}>
          <Button
            label="처음으로"
            variant="secondary"
            onPress={() => updateArgs({ progress: 0 })}
            style={styles.button}
          />
          <Button
            label="20% 채우기"
            disabled={progress >= 1}
            onPress={() =>
              updateArgs({ progress: Math.min(1, Math.round((progress + 0.2) * 10) / 10) })
            }
            style={styles.button}
          />
        </View>
      </View>
    );
  },
} satisfies Meta<typeof SpringProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = { name: '진행 중' };

export const Empty: Story = {
  name: '시작 전',
  args: { progress: 0 },
};

export const Complete: Story = {
  name: '완료',
  args: { progress: 1 },
};

export const Thin: Story = {
  name: '미션 미리보기 높이',
  args: { progress: 0.7, height: 6 },
};

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  button: { flexGrow: 1 },
});
