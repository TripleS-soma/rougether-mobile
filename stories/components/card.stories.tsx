import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text, View } from 'react-native';
import { fn } from 'storybook/test';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const onPress = fn();

const meta = {
  id: 'components-card',
  title: '컴포넌트/카드',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '공통 모서리와 안쪽 여백을 제공하는 콘텐츠 컨테이너입니다. 실제 텍스트·배지·버튼 조합으로 간격을 확인합니다.',
      },
    },
  },
  args: { children: null },
  argTypes: {
    children: { control: false, table: { disable: true } },
    style: { control: false, table: { disable: true } },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Content: Story = {
  name: '기본 콘텐츠',
  render: function ContentCard(args) {
    const t = useTokens();
    const Typography = useTypography();
    return (
      <Card {...args}>
        <Text style={[Typography.h3, { color: t.text }]}>작은 습관을 함께 쌓아요</Text>
        <Text style={[Typography.body, { color: t.textMuted }]}>
          오늘 할 일을 하나씩 완료하며 나만의 방을 가꿔 보세요.
        </Text>
      </Card>
    );
  },
};

export const WithAction: Story = {
  name: '정보와 동작 조합',
  render: function ActionCard(args) {
    const t = useTokens();
    const Typography = useTypography();
    return (
      <Card {...args}>
        <View style={styles.row}>
          <Text style={[Typography.h3, { color: t.text }]}>아침 산책</Text>
          <Badge label="루틴" />
        </View>
        <Text style={[Typography.body, { color: t.textMuted }]}>
          가벼운 발걸음으로 하루를 시작해요.
        </Text>
        <View style={styles.row}>
          <Pill label="매일" icon="calendar" />
          <Pill label="7일 연속" icon="flame" />
        </View>
        <Button label="완료하기" leftIcon="check" onPress={onPress} />
      </Card>
    );
  },
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
});
