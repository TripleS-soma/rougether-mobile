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
  render: function Render(args) {
    // Storybook 훅(useArgs)과 React 훅을 한 함수에 섞지 않는다 — Vitest 포터블 스토리에서 오류.
    const [{ value }, updateArgs] = useArgs<FieldProps>();
    return (
      <ControlledField {...args} value={value} onArgsValue={(v) => updateArgs({ value: v })} />
    );
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 입력은 로컬 상태로 즉시 반영하고 Controls에도 알린다. Controls(args) 쪽 변경은 되돌아온
 * 메아리가 아닐 때만 받아들인다 — 빠른 입력 중 늦게 도착한 값이 글자를 지우지 않게.
 * Storybook UI 밖(Vitest)에서는 args 갱신이 되돌아오지 않아도 로컬 상태로 동작한다.
 */
function ControlledField({
  onArgsValue,
  ...props
}: FieldProps & { onArgsValue: (value: string) => void }) {
  const argsValue = props.value;
  const [value, setValue] = useState(argsValue);
  const pendingValues = useRef<string[]>([]);

  useEffect(() => {
    const acknowledged = pendingValues.current.lastIndexOf(argsValue);
    if (acknowledged !== -1) {
      pendingValues.current.splice(0, acknowledged + 1);
      return;
    }
    setValue(argsValue);
  }, [argsValue]);

  return (
    <Field
      {...props}
      value={value}
      onChangeText={(nextValue) => {
        pendingValues.current.push(nextValue);
        setValue(nextValue);
        props.onChangeText?.(nextValue);
        onArgsValue(nextValue);
      }}
    />
  );
}

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
