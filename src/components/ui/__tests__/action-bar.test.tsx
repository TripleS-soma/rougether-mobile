import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { render } from '@testing-library/react-native';

import { ActionBar } from '@/components/ui/action-bar';
import { Spacing } from '@/constants/theme';

const wrap = (node: React.ReactNode, bottom = 34) => (
  <SafeAreaInsetsContext.Provider value={{ top: 0, bottom, left: 0, right: 0 }}>
    {node}
  </SafeAreaInsetsContext.Provider>
);

describe('ActionBar (#1069)', () => {
  afterEach(() => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
  });

  it('글래스가 불가해도 바닥에서 띄운 오버레이 — 시스템 내비게이션 바 인셋 위에 뜬다 (#1074)', async () => {
    const { getByTestId } = await render(
      wrap(
        <ActionBar testID="bar">
          <Text>적용하기</Text>
        </ActionBar>,
      ),
    );
    const style = StyleSheet.flatten(getByTestId('bar').props.style);
    expect(style.position).toBe('absolute');
    expect(style.bottom).toBe(34 + Spacing.one);
  });

  it('글래스면 바닥에서 띄운 오버레이 — 레이아웃 높이가 없다', async () => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    const { getByTestId } = await render(
      wrap(
        <ActionBar testID="bar">
          <Text>적용하기</Text>
        </ActionBar>,
      ),
    );
    const style = StyleSheet.flatten(getByTestId('bar').props.style);
    expect(style.position).toBe('absolute');
    expect(style.bottom).toBeGreaterThan(34);
  });
});
