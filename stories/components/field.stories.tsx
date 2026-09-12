import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect, useRef, useState } from 'react';
import { useArgs } from 'storybook/preview-api';
import { expect, fn, mocked, userEvent } from 'storybook/test';

import { Field, type FieldProps } from '@/components/ui/field';

const meta = {
  id: 'components-field',
  title: '컴포넌트/입력 필드',
  component: Field,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '라벨·안내·오류를 함께 표시하는 텍스트 입력입니다. 직접 입력한 내용과 Controls의 value가 서로 반영됩니다.',
      },
    },
  },
  args: {
    value: '',
    label: '닉네임',
    placeholder: '집에서 사용할 이름을 입력해 주세요',
    editable: true,
    secureTextEntry: false,
    autoCapitalize: 'none',
    onChangeText: fn(),
  },
  argTypes: {
    value: { control: 'text' },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    error: { control: 'text' },
    success: { control: 'text' },
    editable: { control: 'boolean' },
    secureTextEntry: { control: 'boolean' },
    maxLength: { control: { type: 'number', min: 1 } },
    keyboardType: {
      control: 'select',
      options: ['default', 'email-address', 'numeric', 'phone-pad'],
    },
    autoCapitalize: { control: 'select', options: ['none', 'sentences', 'words', 'characters'] },
    onChangeText: { control: false },
    trailing: { control: false, table: { disable: true } },
  },
  render: function ControlledField(args) {
    const [{ value: argsValue }, updateArgs] = useArgs<FieldProps>();
    const [value, setValue] = useState(argsValue);
    const pendingValues = useRef<string[]>([]);

    useEffect(() => {
      const acknowledged = pendingValues.current.lastIndexOf(argsValue);
      if (acknowledged !== -1) {
        // Delayed echoes must not replace text already entered locally.
        pendingValues.current.splice(0, acknowledged + 1);
        return;
      }
      setValue(argsValue);
    }, [argsValue]);

    return (
      <Field
        {...args}
        value={value}
        onChangeText={(nextValue) => {
          pendingValues.current.push(nextValue);
          setValue(nextValue);
          args.onChangeText(nextValue);
          updateArgs({ value: nextValue });
        }}
      />
    );
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { name: '입력 전' };

export const Interactive: Story = {
  name: '직접 입력',
  // Args updates rerun loaders; keep the spy until this play finishes.
  parameters: { test: { restoreMocks: false } },
  play: async ({ canvas, args }) => {
    mocked(args.onChangeText).mockClear();
    const input = canvas.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '루틴곰');
    await expect(input).toHaveValue('루틴곰');
    await expect(args.onChangeText).toHaveBeenLastCalledWith('루틴곰');
  },
};

export const Filled: Story = {
  name: '입력 완료',
  args: { value: '루틴곰' },
};

export const Error: Story = {
  name: '오류 안내',
  args: { value: '루', error: '닉네임은 두 글자 이상 입력해 주세요.' },
};

export const Success: Story = {
  name: '성공 안내',
  args: { value: '루틴곰', success: '사용할 수 있는 닉네임이에요.' },
};

export const ReadOnly: Story = {
  name: '읽기 전용',
  args: { label: '이메일', value: 'routine@example.com', editable: false },
};

export const Password: Story = {
  name: '비밀번호',
  args: {
    label: '비밀번호',
    placeholder: '비밀번호를 입력해 주세요',
    value: 'example1234',
    secureTextEntry: true,
  },
};
