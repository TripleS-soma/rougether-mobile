import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';

describe('ScreenHeader', () => {
  it('상태바 인셋만큼 자기 배경을 위로 확장한다 (#493)', async () => {
    const { getByTestId } = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 40, bottom: 0, left: 0, right: 0 }}>
        <ScreenHeader title="설정 서브" />
      </SafeAreaInsetsContext.Provider>,
    );
    // 헤더 surface가 상태바 밑까지 이어져 시스템 바와 한 색으로 읽힌다.
    const style = StyleSheet.flatten(getByTestId('screen-header').props.style);
    expect(style.paddingTop).toBe(40 + Spacing.three);
  });

  it('renders the title', async () => {
    const { getByText, queryByLabelText } = await render(<ScreenHeader title="가챠" />);
    expect(getByText('가챠')).toBeTruthy();
    // No back button without onBack.
    expect(queryByLabelText('뒤로 가기')).toBeNull();
  });

  it('shows a back button when onBack is provided', async () => {
    const { getByLabelText } = await render(<ScreenHeader title="가챠" onBack={() => {}} />);
    expect(getByLabelText('뒤로 가기')).toBeTruthy();
  });

  it('글래스가 가능하면 떠 있는 오버레이 — 레이아웃 높이 없이 제목·뒤로가기가 뜬다 (#1069)', async () => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    try {
      const onBack = jest.fn();
      const { getByTestId, getByText, getByLabelText } = await render(
        <SafeAreaInsetsContext.Provider value={{ top: 40, bottom: 0, left: 0, right: 0 }}>
          <ScreenHeader title="알림 설정" onBack={onBack} />
        </SafeAreaInsetsContext.Provider>,
      );
      const style = StyleSheet.flatten(getByTestId('screen-header').props.style);
      expect(style.position).toBe('absolute');
      expect(style.top).toBeGreaterThan(40);
      expect(getByText('알림 설정')).toBeTruthy();
      await fireEvent.press(getByLabelText('뒤로 가기'));
      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
    }
  });
});
