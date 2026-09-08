import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { RailButton } from '@/components/screens/house/rail-button';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/** 화면이 넘기는 것과 같은 토큰·타이포를 훅으로 읽어 건넨다. */
function Harness(props: { onPress?: () => void; badge?: string; label?: string }) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <RailButton
      icon={<Text>아이콘</Text>}
      label={props.label ?? '목표'}
      onPress={props.onPress}
      accessibilityLabel="우리 집의 목표"
      badge={props.badge}
      t={t}
      Typography={Typography}
    />
  );
}

describe('RailButton', () => {
  it('라벨과 접근성 라벨을 그리고 탭하면 onPress를 부른다', async () => {
    const onPress = jest.fn();
    const { getByText, getByLabelText } = await render(<Harness onPress={onPress} />);
    expect(getByText('목표')).toBeTruthy();
    expect(getByText('목표').props.numberOfLines).toBe(1);
    await fireEvent.press(getByLabelText('우리 집의 목표'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('badge 색이 있을 때만 점을 그린다', async () => {
    // 호스트 트리를 걸어 점(배경색이 badge 색인 노드)이 있는지 본다.
    type Json = ReturnType<RenderResult['toJSON']>;
    const hasBadgeDot = (node: Json | string): boolean => {
      if (!node || typeof node === 'string') return false;
      if (Array.isArray(node)) return node.some(hasBadgeDot);
      if (StyleSheet.flatten(node.props.style)?.backgroundColor === '#FF0000') return true;
      return (node.children ?? []).some(hasBadgeDot);
    };

    const withBadge = await render(<Harness badge="#FF0000" />);
    expect(hasBadgeDot(withBadge.toJSON())).toBe(true);

    const without = await render(<Harness />);
    expect(hasBadgeDot(without.toJSON())).toBe(false);
  });

  it('onPress가 없어도 눌렀을 때 터지지 않는다', async () => {
    const { getByLabelText } = await render(<Harness />);
    expect(() => fireEvent.press(getByLabelText('우리 집의 목표'))).not.toThrow();
  });
});
