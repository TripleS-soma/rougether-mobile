import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useSettingsSurface } from '@/components/app/use-settings-surface';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/hooks/use-auth';
import { DEFAULT_HAPTIC_STRENGTH, getHapticStrength, setHapticStrength } from '@/utils/haptics';
import { BrandThemeProvider } from '@/hooks/use-tokens';
const PROFILE = { nickname: '준서', bio: '', characterId: 'cat' as const, onSave: jest.fn() };
const STATS = { streak: 3, coin: 120, diamond: 2 };

/**
 * 훅이 만든 서브화면을 그대로 렌더한다 — 토스트 로직이 훅 안에 있고 핸들러는
 * 그 화면에만 넘어가므로, 실제로 눌러야 검증이 된다.
 */
function Harness({ screen }: { screen: 'theme' | 'font' | 'sound' | null }) {
  const { subScreen, settingsProps } = useSettingsSurface({
    screen: screen ?? 'settings',
    setScreen: jest.fn(),
    profile: PROFILE,
    stats: STATS,
  });
  return screen === null ? <SettingsScreen {...settingsProps} /> : <>{subScreen}</>;
}

const show = (screen: 'theme' | 'font' | 'sound' | null) =>
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
  it('다른 테마를 고르면 바뀐 이름을 토스트로 알린다', async () => {
    const { getByLabelText, findByText } = await show('theme');
    await fireEvent.press(getByLabelText('인디고 타이드 테마'));
    await fireEvent.press(getByLabelText('적용하기'));
    expect(await findByText(/인디고 타이드.*적용했어요/)).toBeTruthy();
  });

  it('다른 폰트를 고르면 바뀐 이름을 토스트로 알린다', async () => {
    const { getByLabelText, findByText } = await show('font');
    await fireEvent.press(getByLabelText('SUIT 폰트'));
    await fireEvent.press(getByLabelText('적용하기'));
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
    await fireEvent.press(getByLabelText('적용하기'));
    await waitFor(() => expect(queryByText(/적용했어요/)).toBeNull());
  });
});

describe('햅틱 세기 마이그레이션 (#974)', () => {
  beforeEach(() => {
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

// 무효화 누락 2건 (리팩토링 3묶음) — 가져온 루틴과 초대 보상이 즉시 반영되게 셸 콜백을 부른다.
const mockImportSelected = jest.fn();
jest.mock('@/hooks/use-calendar-import', () => ({
  useCalendarImport: () => ({
    calendars: [],
    candidates: [
      {
        seriesId: 's1',
        occurrenceId: 's1@2026-09-09',
        title: '아침 러닝',
        date: '2026-09-09',
        allDay: false,
        repeat: null,
        similar: [],
      },
    ],
    busy: false,
    denied: false,
    embeddingApplied: false,
    connect: jest.fn(),
    preview: jest.fn(),
    importSelected: mockImportSelected,
  }),
}));
const mockRedeem = jest.fn();
jest.mock('@/hooks/use-invites', () => ({
  useInvites: () => ({
    info: null,
    loading: false,
    loadError: false,
    load: jest.fn(),
    redeem: mockRedeem,
  }),
}));

function GapHarness({
  screen,
  onRoutinesImported,
  onWalletChanged,
}: {
  screen: 'calendarImport' | 'inviteFriends';
  onRoutinesImported?: () => void;
  onWalletChanged?: () => void;
}) {
  const { subScreen } = useSettingsSurface({
    screen,
    setScreen: jest.fn(),
    profile: PROFILE,
    stats: STATS,
    onRoutinesImported,
    onWalletChanged,
  });
  return <>{subScreen}</>;
}
const showGap = (props: Parameters<typeof GapHarness>[0]) =>
  render(
    <AuthProvider>
      <BrandThemeProvider>
        <ToastProvider>
          <GapHarness {...props} />
        </ToastProvider>
      </BrandThemeProvider>
    </AuthProvider>,
  );

describe('가져오기·초대 보상 뒤 재조회 콜백', () => {
  it('캘린더 가져오기가 하나라도 만들면 onRoutinesImported, 0개면 부르지 않는다', async () => {
    const onRoutinesImported = jest.fn();
    mockImportSelected.mockResolvedValueOnce({
      imported: 1,
      skipped: 0,
      failed: 0,
      importedRoutines: 1,
    });
    const ui = await showGap({ screen: 'calendarImport', onRoutinesImported });
    await fireEvent.press(await ui.findByText('1개 가져오기'));
    await waitFor(() => expect(onRoutinesImported).toHaveBeenCalledTimes(1));

    mockImportSelected.mockResolvedValueOnce({
      imported: 0,
      skipped: 1,
      failed: 0,
      importedRoutines: 0,
    });
    await fireEvent.press(ui.getByText('1개 가져오기'));
    await waitFor(() => expect(mockImportSelected).toHaveBeenCalledTimes(2));
    expect(onRoutinesImported).toHaveBeenCalledTimes(1);
  });

  it('초대 코드 보상이 들어오면 onWalletChanged를 부른다', async () => {
    const onWalletChanged = jest.fn();
    mockRedeem.mockResolvedValueOnce({ rewardCoin: 100 });
    const ui = await showGap({ screen: 'inviteFriends', onWalletChanged });
    await fireEvent.changeText(ui.getByLabelText('초대코드 입력'), 'ABCD12');
    await fireEvent.press(ui.getByText('사용하기'));
    await waitFor(() => expect(onWalletChanged).toHaveBeenCalledTimes(1));
    // 화면도 보상 상태로 — 입력란이 결과 문구로 바뀐다.
    expect(ui.getByText('코인 100개를 받았어요!')).toBeTruthy();
  });

  it('초대 코드 사용이 실패(null)면 지갑을 건드리지 않는다', async () => {
    const onWalletChanged = jest.fn();
    mockRedeem.mockResolvedValueOnce(null);
    const ui = await showGap({ screen: 'inviteFriends', onWalletChanged });
    await fireEvent.changeText(ui.getByLabelText('초대코드 입력'), 'ZZZZ99');
    await fireEvent.press(ui.getByText('사용하기'));
    await waitFor(() => expect(mockRedeem).toHaveBeenCalledTimes(1));
    expect(onWalletChanged).not.toHaveBeenCalled();
  });
});
