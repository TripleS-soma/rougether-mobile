import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Linking } from 'react-native';

import { type Screen } from '@/components/app/navigation';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { BugReportScreen } from '@/components/screens/bug-report-screen';
import { HelpScreen } from '@/components/screens/help-screen';
import { InviteFriendsScreen } from '@/components/screens/invite-friends-screen';
import { CalendarImportScreen } from '@/components/screens/calendar-import-screen';
import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';
import { getPushDiagnostic } from '@/lib/push-token';
import { ProfileEditScreen } from '@/components/screens/profile-edit-screen';
import {
  DEFAULT_SOUND_SETTINGS,
  type SoundSettings,
  SoundSettingsScreen,
} from '@/components/screens/sound-settings-screen';
import { FontScreen } from '@/components/screens/font-screen';
import { ThemeScreen } from '@/components/screens/theme-screen';
import { useToast } from '@/components/ui/toast';
import { FONT_OPTIONS, THEME_OPTIONS, type BrandFontId, type ThemeId } from '@/constants/theme';
import { useCalendarImport } from '@/hooks/use-calendar-import';
import type { CharacterId } from '@/constants/characters';
import { SUPPORT_EMAIL } from '@/constants/policy';
import { useAuth } from '@/hooks/use-auth';
import { useBugReports } from '@/hooks/use-bug-reports';
import { useInvites } from '@/hooks/use-invites';
import { useNotificationSettings } from '@/hooks/use-notification-settings';
import { useBrandTheme } from '@/hooks/use-tokens';
import {
  clearPendingFriendInviteCode,
  subscribePendingFriendInviteCode,
} from '@/lib/pending-invite';
import { pickLibraryImage } from '@/lib/pick-image';
import type { ScrollRestoreProps } from '@/hooks/use-scroll-restore';
import { useConstant, useStableCallback } from '@/hooks/use-stable-value';
import { DEFAULT_HAPTIC_STRENGTH, setHapticStrength } from '@/utils/haptics';

/** 사운드 설정의 기기 보관 키 (#405) — 알림 설정은 서버로 이관됨 (#495). */
const DEVICE_SETTINGS_KEY = 'rougether.device-settings';

/**
 * 마이페이지·설정 서피스 배선 (#692 2단계 → #1088) — 마이페이지 탭과 그
 * 서브화면 9종(설정·테마·폰트·프로필·알림·사운드·버그 제보·도움말·친구 초대)의
 * 도메인 훅·콜백·JSX를 소유한다. 서브화면에 있는 동안 탭 페이저가
 * 언마운트되므로 상태는 컴포넌트가 아니라 항상 마운트된 셸에서 이 훅으로
 * 산다. 셸은 `myPageProps`를 `<MyPageScreen {...myPageProps} />`로 스프레드하고
 * `subScreen`을 렌더만 한다. 설정 화면 자체도 서브화면이라 `subScreen`이 그린다.
 */
export function useSettingsSurface({
  screen,
  setScreen,
  onReplayOnboarding,
  onOpenWeeklyReport,
  profile,
  stats,
  shortcuts,
}: {
  screen: Screen;
  setScreen: Dispatch<SetStateAction<Screen>>;
  /** 설정 → 튜토리얼 다시 보기 (셸 prop 통과). */
  onReplayOnboarding?: () => void;
  /** 마이페이지 → 주간회고 다시 보기 (#1056) — 회고 데이터는 나의 방 페이지 훅이 소유. */
  onOpenWeeklyReport?: () => void;
  /** 프로필 카드·편집 배선 — 닉네임·소개는 나의 방 헤더와 공유라 셸 소유. */
  profile: {
    nickname: string;
    bio: string;
    characterId: CharacterId;
    characterFrames?: string[];
    onSave: (nickname: string, bio: string) => void;
  };
  /** 마이페이지 지표 한 줄 (#1088) — 스트릭·지갑은 나의 방 데이터 훅 소유. */
  stats: { streak: number; coin: number; diamond: number };
  /** 마이페이지 바로가기 (#1089) — 출석·재화 내역 시트는 셸이 들고 있다. */
  shortcuts?: {
    onOpenAttendance?: () => void;
    attendancePending?: boolean;
    onOpenWalletHistory?: () => void;
  };
}) {
  const { themeId, setThemeId, mode: themeMode, setMode: setThemeMode, fontId, setFontId } = useBrandTheme(); // prettier-ignore
  const { show: toast } = useToast();

  // 폰트·테마는 적용돼도 화면이 조용히 바뀔 뿐이라 "눌린 건가?" 싶다 — 바뀐
  // 이름을 토스트로 확인시킨다 (#972). **같은 값을 다시 고르면 안 띄운다**:
  // 바뀐 게 없는데 알림이 뜨면 그게 더 헷갈린다.
  //
  // 문구에 `으로/로`를 쓰지 않는 건 **조사가 이름마다 달라지기 때문**이다 —
  // "포근"은 받침이 있어 `으로`, "인디고 타이드"는 없어 `로`다. 이름을 앞에 두고
  // 고정 조사(`를`)만 쓰면 어떤 이름이 와도 맞는다.
  const changeThemeId = useCallback(
    (id: ThemeId) => {
      if (id === themeId) return;
      setThemeId(id);
      const name = THEME_OPTIONS.find((o) => o.id === id)?.name;
      if (name) toast(`“${name}” 테마를 적용했어요`);
    },
    [themeId, setThemeId, toast],
  );

  const changeFontId = useCallback(
    (id: BrandFontId) => {
      if (id === fontId) return;
      setFontId(id);
      const name = FONT_OPTIONS.find((o) => o.id === id)?.name;
      if (name) toast(`“${name}” 폰트를 적용했어요`);
    },
    [fontId, setFontId, toast],
  );
  // 캘린더 임포트 상태 (#844) — 권한·조회·임포트를 훅이 쥔다.
  const calendarImport = useCalendarImport();
  // 스토어 요건(#545): 도움말의 실제 앱 버전 표기.
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const { logout, withdraw } = useAuth();
  const handleLogout = useCallback(() => {
    // Clearing the session flips auth status → AppRoot redirects to /login.
    void logout();
  }, [logout]);
  const handleWithdraw = useCallback(() => {
    // 성공 시 status가 guest로 바뀌어 AppRoot가 로그인으로 보낸다 (#547).
    void withdraw().then((ok) => {
      if (ok) toast('탈퇴가 완료됐어요');
      else toast('탈퇴에 실패했어요. 잠시 후 다시 시도해 주세요', 'error');
    });
  }, [withdraw, toast]);

  // 외부 링크 — 핸들러 없는 기기(메일 앱 미설정 등)에서 reject되므로 토스트로 안내.
  const openSupportMail = useCallback(() => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[루게더] 문의')}`).catch(
      () => toast('링크를 열 수 없어요. 잠시 후 다시 시도해 주세요.', 'error'),
    );
  }, [toast]);

  // 버그 제보 (#496) — 화면을 열 때 내 제보 내역을 불러온다.
  const {
    entries: bugReports,
    load: loadBugReports,
    submit: submitBugReport,
    loadScreenshot: loadBugScreenshot,
  } = useBugReports();

  // 친구 초대 리워드 (#518) — 마이페이지 → 친구 초대 화면의 데이터·액션.
  const {
    info: inviteInfo,
    loading: invitesLoading,
    loadError: invitesLoadError,
    load: loadInvites,
    redeem: redeemInviteCode,
  } = useInvites();
  // 친구 초대 링크 (#667) — 친구 초대 화면을 열고 받은 코드 입력을 프리필.
  const [pendingFriendCode, setPendingFriendCode] = useState<string | null>(null);
  useEffect(
    () =>
      subscribePendingFriendInviteCode((code) => {
        setPendingFriendCode(code);
        setScreen('inviteFriends');
        void loadInvites();
      }),
    // loadInvites·setScreen은 안정 참조 — 마운트 1회 구독.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 알림 설정은 서버 보관으로 이관 (#495) — 열 때 GET, 토글마다 낙관적 PATCH.
  const {
    settings: notificationSettings,
    loadError: notificationSettingsLoadError,
    load: loadNotificationSettings,
    toggle: toggleNotificationSetting,
  } = useNotificationSettings((message) => toast(message, 'error'));

  // 사운드 설정은 서버 API가 생기기 전까지 기기(AsyncStorage)에 보관 (#405).
  // 예전 저장값의 notifications 필드는 서버 이관(#495) 후 무시된다.
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);
  useEffect(() => {
    void AsyncStorage.getItem(DEVICE_SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try {
        // 종전 저장값은 `haptics: boolean`이었다 (#586 → #974). 켜져 있던 사람은
        // '보통', 꺼둔 사람은 '끄기'로 옮긴다 — 안 하면 저장값이 그대로 남아
        // hapticStrength가 undefined가 되고 기본값(보통)으로 되살아난다.
        const saved = JSON.parse(raw) as {
          sound?: Partial<SoundSettings> & { haptics?: boolean };
        };
        if (saved.sound) {
          const { haptics, ...rest } = saved.sound;
          const migrated =
            rest.hapticStrength ?? (haptics === undefined ? undefined : haptics ? 'medium' : 'off');
          setSoundSettings((p) => ({
            ...p,
            ...rest,
            ...(migrated ? { hapticStrength: migrated } : {}),
          }));
        }
      } catch {
        // 손상된 저장값은 기본값으로 무시.
      }
    });
  }, []);
  const persistDeviceSettings = (sound: SoundSettings) => {
    void AsyncStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify({ sound })).catch(() => {});
  };
  // 햅틱 세기를 전역 게이트에 주입 (#586 → #974) — 이 이펙트가 없으면 설정이
  // 저장만 되고 아무것도 제어하지 않는다(휠 틱·완료 햅틱 등 전부 무조건 발사).
  useEffect(() => {
    setHapticStrength(soundSettings.hapticStrength ?? DEFAULT_HAPTIC_STRENGTH);
  }, [soundSettings.hapticStrength]);

  // 마이페이지·설정 화면 콜백 — 둘 다 memo라(#539 후속) 인라인 람다면 셸
  // 리렌더마다 memo가 뚫린다. 전부 참조 고정.
  const openSettings = useCallback(() => setScreen('settings'), [setScreen]);
  const openTheme = useCallback(() => setScreen('theme'), [setScreen]);
  const openFont = useCallback(() => setScreen('font'), [setScreen]);
  const openProfileEdit = useCallback(() => setScreen('profileEdit'), [setScreen]);
  const openNotificationSettings = useCallback(() => {
    setScreen('notifications');
    // 화면을 열 때마다 서버값으로 최신화 (실패 시 기본값/직전값 유지).
    void loadNotificationSettings();
  }, [setScreen, loadNotificationSettings]);
  const openSound = useCallback(() => setScreen('sound'), [setScreen]);
  // 캘린더 연동 (#844 → 마이페이지 행 #1097) — 화면에서 권한을 요청하므로 여는 것만 한다.
  const openCalendarImport = useCallback(() => setScreen('calendarImport'), [setScreen]);
  const openHelp = useCallback(() => setScreen('help'), [setScreen]);
  // 친구 초대 (#518) — 진입 시점에 내 코드를 로드(없으면 서버가 발급).
  const openInviteFriends = useCallback(() => {
    setScreen('inviteFriends');
    void loadInvites();
  }, [setScreen, loadInvites]);
  // 약관/처리방침은 외부 브라우저 대신 인앱 웹뷰 라우트로 (#652).
  const openTerms = useCallback(
    () => router.push({ pathname: '/policy', params: { doc: 'terms' } }),
    [],
  );
  const openPrivacy = useCallback(
    () => router.push({ pathname: '/policy', params: { doc: 'privacy' } }),
    [],
  );
  const openBugReport = useCallback(() => {
    setScreen('bugReport');
    void loadBugReports();
  }, [setScreen, loadBugReports]);

  /** 탭 페이저의 마이페이지 prop — `<MyPageScreen {...myPageProps} />`. */
  const myPageProps = {
    nickname: profile.nickname,
    bio: profile.bio,
    characterId: profile.characterId,
    characterFrames: profile.characterFrames,
    streakDays: stats.streak,
    coinBalance: stats.coin,
    diamondBalance: stats.diamond,
    onEditProfile: openProfileEdit,
    onOpenSettings: openSettings,
    onOpenAttendance: shortcuts?.onOpenAttendance,
    attendancePending: shortcuts?.attendancePending ?? false,
    onOpenWalletHistory: shortcuts?.onOpenWalletHistory,
    onOpenWeeklyReport,
    onOpenCalendarImport: openCalendarImport,
    onInviteFriends: openInviteFriends,
    onOpenHelp: openHelp,
    onReportBug: openBugReport,
  };

  // 설정 서브화면의 스크롤 위치 (#763) — 테마·폰트·알림에 다녀오면 설정 화면이
  // 리마운트되므로 탭 스크롤(use-tab-scroll)과 같은 방식으로 훅이 들고 있는다.
  const settingsOffset = useConstant(() => ({ y: 0 }));
  const settingsScroll: ScrollRestoreProps = {
    getInitialScrollY: useStableCallback(() => settingsOffset.y),
    onScrollY: useStableCallback((y: number) => {
      settingsOffset.y = y;
    }),
  };

  /** 설정 서브화면 prop — `<SettingsScreen {...settingsProps} />` (테스트 하네스용 노출). */
  const settingsProps = {
    themeMode,
    onChangeThemeMode: setThemeMode,
    themeId,
    fontId,
    onOpenFont: openFont,
    onOpenTheme: openTheme,
    onOpenNotifications: openNotificationSettings,
    onOpenSound: openSound,
    onOpenTerms: openTerms,
    onOpenPrivacy: openPrivacy,
    onReplayOnboarding,
    onLogout: handleLogout,
    onWithdraw: handleWithdraw,
  };

  const backToMyPage = useCallback(() => setScreen('myPage'), [setScreen]);
  const backToSettings = openSettings;

  /** 현재 화면이 마이페이지 서브화면이면 그 JSX, 아니면 null — 셸이 그대로 렌더. */
  const subScreen =
    screen === 'settings' ? (
      <SettingsScreen {...settingsProps} {...settingsScroll} onBack={backToMyPage} />
    ) : screen === 'theme' ? (
      <ThemeScreen
        themeId={themeId}
        onChangeThemeId={changeThemeId}
        userName={profile.nickname}
        characterId={profile.characterId}
        onBack={backToSettings}
      />
    ) : screen === 'font' ? (
      <FontScreen
        fontId={fontId}
        onChangeFont={changeFontId}
        userName={profile.nickname}
        characterId={profile.characterId}
        onBack={backToSettings}
      />
    ) : screen === 'profileEdit' ? (
      <ProfileEditScreen
        initialNickname={profile.nickname}
        initialBio={profile.bio}
        characterId={profile.characterId}
        onSave={(nick, b) => {
          profile.onSave(nick, b);
          setScreen('myPage');
        }}
        onBack={backToMyPage}
      />
    ) : screen === 'notifications' ? (
      <NotificationSettingsScreen
        settings={notificationSettings}
        onToggle={toggleNotificationSetting}
        loadError={notificationSettingsLoadError}
        onRetry={loadNotificationSettings}
        // 화면을 열 때의 등록 상태 (#903) — 로그인 시 syncPushToken이 남긴다.
        pushStep={getPushDiagnostic().step}
        onBack={backToSettings}
      />
    ) : screen === 'calendarImport' ? (
      <CalendarImportScreen
        calendars={calendarImport.calendars}
        candidates={calendarImport.candidates}
        busy={calendarImport.busy}
        denied={calendarImport.denied}
        embeddingApplied={calendarImport.embeddingApplied}
        onConnect={() => void calendarImport.connect()}
        onPreview={(ids) => void calendarImport.preview(ids)}
        onImport={async (selected) => {
          const out = await calendarImport.importSelected(selected);
          toast(
            out.failed > 0
              ? `${out.imported}개를 가져왔어요. ${out.failed}개는 실패했어요.`
              : out.skipped > 0
                ? `${out.imported}개를 가져왔어요. ${out.skipped}개는 이미 가져온 일정이에요.`
                : `${out.imported}개를 가져왔어요.`,
          );
          return out;
        }}
        onBack={backToMyPage}
      />
    ) : screen === 'sound' ? (
      <SoundSettingsScreen
        initialSettings={soundSettings}
        onChange={(next) => {
          setSoundSettings(next);
          persistDeviceSettings(next);
        }}
        onBack={backToSettings}
      />
    ) : screen === 'bugReport' ? (
      <BugReportScreen
        entries={bugReports}
        onLoadScreenshot={loadBugScreenshot}
        onSubmit={submitBugReport}
        onPickImage={pickLibraryImage}
        onBack={backToMyPage}
      />
    ) : screen === 'help' ? (
      <HelpScreen onBack={backToMyPage} appVersion={appVersion} onContact={openSupportMail} />
    ) : screen === 'inviteFriends' ? (
      <InviteFriendsScreen
        info={inviteInfo}
        loading={invitesLoading}
        loadError={invitesLoadError}
        onRetry={loadInvites}
        onRedeem={redeemInviteCode}
        initialRedeemCode={pendingFriendCode ?? undefined}
        onInitialRedeemCodeConsumed={() => {
          setPendingFriendCode(null);
          clearPendingFriendInviteCode();
        }}
        onBack={backToMyPage}
      />
    ) : null;

  return { myPageProps, settingsProps, subScreen };
}
