import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { expect, fn } from 'storybook/test';

import { ModalCard } from '@/components/ui/modal-card';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

function FormBody() {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  return (
    <View style={styles.form}>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>미션 이름</Text>
      <TextInput
        accessibilityLabel="미션 이름"
        defaultValue="함께 물 2L 마시기"
        style={[styles.input, emph('normal'), { color: t.text, backgroundColor: t.surfaceMuted }]}
      />
    </View>
  );
}

const meta = {
  id: 'components-modal-card',
  title: '컴포넌트/모달 카드',
  component: ModalCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '폼을 담는 화면 위 모달 카드입니다. 본문이 문자열뿐이면 확인 다이얼로그를 쓰고, 입력칸·선택지처럼 무엇이든 담아야 할 때 씁니다. 화면 안에 겹치므로 부모 영역을 덮습니다.',
      },
      story: { inline: false, height: '420px' },
    },
  },
  decorators: [
    (Story) => (
      <View style={{ height: 380 }}>
        <Story />
      </View>
    ),
  ],
  args: {
    title: '미션 만들기',
    children: <FormBody />,
    cancel: { label: '취소', accessibilityLabel: '미션 만들기 취소', onPress: fn() },
    confirm: { label: '만들기', onPress: fn() },
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof ModalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {
  name: '폼',
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '만들기' }));
    await expect(args.confirm.onPress).toHaveBeenCalled();
  },
};

export const ConfirmDisabled: Story = {
  name: '확정 비활성',
  args: { confirm: { label: '만들기', onPress: fn(), disabled: true } },
};

const styles = StyleSheet.create({
  form: { marginTop: Spacing.three, gap: Spacing.two },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
