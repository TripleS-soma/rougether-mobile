import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent } from 'storybook/test';

import { AppTextInput } from '@/components/ui/app-text-input';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

function InputDemo({ multiline = false }: { multiline?: boolean }) {
  const [value, setValue] = useState('루겓');
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={{ gap: Spacing.two }}>
      <AppTextInput
        accessibilityLabel="한글 입력"
        value={value}
        onChangeText={setValue}
        multiline={multiline}
        maxLength={40}
        style={[Typography.body, { backgroundColor: t.surfaceMuted, color: t.text }]}
      />
      <Button label="비우기" onPress={() => setValue('')} />
      <Button label="조합 중 음절 불러오기" onPress={() => setValue('루겓')} />
    </View>
  );
}

const meta = {
  title: '컴포넌트/한글 입력',
  component: AppTextInput,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '일부 폰트의 빈 한글 글리프를 피하는 네이티브 입력창입니다. 루게더를 입력하거나 지울 때 거치는 루겓을 포함해 모든 현대 한글 음절을 그립니다. 값과 이벤트는 기존 TextInput 그대로 전달합니다.',
      },
    },
  },
  render: () => <InputDemo />,
} satisfies Meta<typeof AppTextInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  name: '조합 중 음절과 초기화',
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox', { name: '한글 입력' });
    await expect(input).toHaveValue('루겓');
    await userEvent.clear(input);
    await userEvent.type(input, '루게더');
    await userEvent.type(input, '{backspace}');
    await expect(input).toHaveValue('루게');
    await userEvent.click(canvas.getByRole('button', { name: '조합 중 음절 불러오기' }));
    await expect(input).toHaveValue('루겓');
    await userEvent.click(canvas.getByRole('button', { name: '비우기' }));
    await expect(input).toHaveValue('');
    await userEvent.click(canvas.getByRole('button', { name: '조합 중 음절 불러오기' }));
    await expect(input).toHaveValue('루겓');
  },
};

export const Multiline: Story = {
  name: '여러 줄 입력',
  render: () => <InputDemo multiline />,
};
