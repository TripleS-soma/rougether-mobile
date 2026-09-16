import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useArgs } from 'storybook/preview-api';
import { expect, fn, mocked, userEvent, within } from 'storybook/test';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ToggleSwitch, type ToggleSwitchProps } from '@/components/ui/toggle-switch';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const meta = {
  id: 'components-toggle-switch',
  title: '컴포넌트/토글',
  component: ToggleSwitch,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '설정 행과 입력 시트에서 사용하는 켜기·끄기 스위치입니다. 스위치를 누르면 Controls의 value도 함께 바뀝니다. 햅틱은 네이티브 기기에서 확인합니다.',
      },
    },
  },
  args: {
    value: false,
    accessibilityLabel: '루틴 알림',
    onToggle: fn(),
  },
  argTypes: {
    value: { control: 'boolean', description: '켜짐 여부' },
    accessibilityLabel: { control: 'text', description: '스크린 리더가 읽는 설정 이름' },
    onToggle: { control: false, description: '스위치를 누를 때 호출하는 콜백' },
  },
  render: function Render(args) {
    const [{ value }, updateArgs] = useArgs<ToggleSwitchProps>();
    return <ToggleRow {...args} value={value} onArgsValue={(v) => updateArgs({ value: v })} />;
  },
} satisfies Meta<typeof ToggleSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 누르면 로컬 상태를 바로 바꾸고 Controls에도 알린다. Controls에서 바꾼 value는 받아들인다.
 * (Vitest 포터블 스토리에서는 args 갱신이 다시 렌더로 돌아오지 않아 로컬 상태가 필요하다.)
 */
function ToggleRow({
  onArgsValue,
  ...props
}: ToggleSwitchProps & { onArgsValue: (value: boolean) => void }) {
  const t = useTokens();
  const Typography = useTypography();
  const [value, setValue] = useState(props.value);
  useEffect(() => setValue(props.value), [props.value]);

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[Typography.label, { color: t.text }]}>{props.accessibilityLabel}</Text>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {value ? '알림이 켜져 있어요' : '알림이 꺼져 있어요'}
        </Text>
      </View>
      <ToggleSwitch
        {...props}
        value={value}
        onToggle={() => {
          props.onToggle();
          setValue(!value);
          onArgsValue(!value);
        }}
      />
    </View>
  );
}

export const Off: Story = {
  name: '꺼짐',
  // Args updates rerun loaders; keep the spy until this play finishes.
  parameters: { test: { restoreMocks: false } },
  play: async ({ canvasElement, args }) => {
    mocked(args.onToggle).mockClear();
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: args.accessibilityLabel });

    await expect(canvas.getByText('알림이 꺼져 있어요')).toBeVisible();
    await userEvent.click(toggle);
    await expect(await canvas.findByText('알림이 켜져 있어요')).toBeVisible();
    await expect(args.onToggle).toHaveBeenCalledTimes(1);
    await userEvent.click(toggle);
    await expect(await canvas.findByText('알림이 꺼져 있어요')).toBeVisible();
    await expect(args.onToggle).toHaveBeenCalledTimes(2);
  },
};

export const On: Story = {
  name: '켜짐',
  args: { value: true },
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  copy: { flex: 1, gap: Spacing.one },
});
