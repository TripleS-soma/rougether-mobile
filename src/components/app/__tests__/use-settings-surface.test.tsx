import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useSettingsSurface } from '@/components/app/use-settings-surface';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/hooks/use-auth';
import { DEFAULT_HAPTIC_STRENGTH, getHapticStrength, setHapticStrength } from '@/utils/haptics';
import { BrandThemeProvider } from '@/hooks/use-tokens';

const PROFILE = { nickname: '준서', bio: '', characterId: 'cat' as const, onSave: jest.fn() };

/**
 * 훅이 만든 서브화면을 그대로 렌더한다 — 토스트 로직이 훅 안에 있고 핸들러는
 * 그 화면에만 넘어가므로, 실제로 눌러야 검증이 된다.
 */
function Harness({ screen }: { screen: 'theme' | 'font' | 'sound' }) {
  const { subScreen } = useSettingsSurface({
    screen,
    setScreen: jest.fn(),
    profile: PROFILE,
  });
  return <>{subScreen}</>;
}

const show = (screen: 'theme' | 'font' | 'sound') =>
  render(
    <AuthProvider>
      <BrandThemeProvider>
        <ToastProvider>
          <Harness screen={screen} />
        </ToastProvider>
      </BrandThemeProvider>
    </AuthProvider>,
  );

describe('폰트·테마 변경 안내 (#972)', () => {
  // BrandThemeProvider가 선택을 AsyncStorage에 남긴다 — 안 지우면 앞 테스트가
  // 고른 테마가 다음 테스트의 '현재값'이 돼 "같은 값" 케이스가 무너진다.
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('다른 테마를 고르면 바뀐 이름을 토스트로 알린다', async () => {
    const { getByLabelText, findByText } = await show('theme');
    await fireEvent.press(getByLabelText('인디고 타이드 테마'));
    expect(await findByText(/인디고 타이드.*적용했어요/)).toBeTruthy();
  });

  it('다른 폰트를 고르면 바뀐 이름을 토스트로 알린다', async () => {
    const { getByLabelText, findByText } = await show('font');
    await fireEvent.press(getByLabelText('SUIT 폰트'));
    expect(await findByText(/SUIT.*적용했어요/)).toBeTruthy();
  });

  it('이미 쓰고 있는 값을 다시 골라도 토스트를 띄우지 않는다', async () => {
    // 바뀐 게 없는데 "바꿨어요"가 뜨면 그게 더 헷갈린다.
    const { getByLabelText, queryByText } = await show('theme');
    // 기본값이 실제로 선택돼 있는지 먼저 확인하고 누른다.
    await waitFor(() =>
      expect(getByLabelText('포근 테마').props.accessibilityState.selected).toBe(true),
    );
    await fireEvent.press(getByLabelText('포근 테마'));
    await waitFor(() => expect(queryByText(/적용했어요/)).toBeNull());
  });
});

describe('햅틱 세기 마이그레이션 (#974)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setHapticStrength(DEFAULT_HAPTIC_STRENGTH);
  });

  /** 종전 저장 형태 — `haptics: boolean`. */
  const seedLegacy = (haptics: boolean) =>
    AsyncStorage.setItem(
      'rougether.device-settings',
      JSON.stringify({ sound: { effects: true, music: false, haptics } }),
    );

  it('꺼둔 사람은 끄기로 옮겨진다', async () => {
    await seedLegacy(false);
    await show('sound');
    await waitFor(() => expect(getHapticStrength()).toBe('off'));
  });

  it('켜둔 사람은 보통으로 옮겨진다', async () => {
    await seedLegacy(true);
    await show('sound');
    await waitFor(() => expect(getHapticStrength()).toBe('medium'));
  });

  it('새 형태로 저장돼 있으면 그 값을 그대로 쓴다', async () => {
    await AsyncStorage.setItem(
      'rougether.device-settings',
      JSON.stringify({ sound: { effects: true, music: false, hapticStrength: 'heavy' } }),
    );
    await show('sound');
    await waitFor(() => expect(getHapticStrength()).toBe('heavy'));
  });

  it('저장값이 없으면 기본값(보통)이다', async () => {
    await show('sound');
    await waitFor(() => expect(getHapticStrength()).toBe('medium'));
  });
});
