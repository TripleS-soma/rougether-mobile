import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text, View } from 'react-native';
import { fn } from 'storybook/test';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const meta = {
  id: 'components-bottom-sheet',
  title: '컴포넌트/바텀시트',
  component: BottomSheet,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '공용 바텀시트 컨테이너입니다. 스프링으로 올라오고, 배경 탭·끌어내리기로 닫힙니다. 웹 데스크톱에서는 딤은 창 전체, 카드는 앱 프레임 폭(폰 480, 2단 640)입니다 — 뷰포트 도구로 확인하세요. 끌어내리기 손맛은 기기에서 확인합니다.',
      },
      story: { inline: false, height: '520px' },
    },
  },
  args: { visible: true, onClose: fn(), children: null },
  argTypes: {
    visible: { control: 'boolean' },
    onClose: { control: false },
    children: { control: false, table: { disable: true } },
    cardStyle: { control: false, table: { disable: true } },
  },
  render: function Render(args) {
    const t = useTokens();
    const Typography = useTypography();
    return (
      <BottomSheet {...args} cardStyle={[styles.card, { backgroundColor: t.screen }]}>
        <SheetHandle />
        <View style={styles.body}>
          <Text style={[Typography.h3, { color: t.text }]}>루틴 메뉴</Text>
          <Text style={[Typography.body, { color: t.textMuted }]}>
            이름을 바꾸거나, 완료로 표시하거나, 알림 시간을 추가할 수 있어요.
          </Text>
          <Button label="완료로 표시" leftIcon="check" onPress={args.onClose ?? (() => {})} />
        </View>
      </BottomSheet>
    );
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = { name: '열림' };

const styles = StyleSheet.create({
  card: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing.five,
  },
  body: { padding: Spacing.four, gap: Spacing.three },
});
