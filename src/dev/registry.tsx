import { openBrowserAsync } from 'expo-web-browser';
import { type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';

import { type HouseCover, HouseCoverPicker } from '@/components/room/house-cover-picker';
import { HouseOrderDots } from '@/components/room/house-order-dots';
import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import { StackedHouseDemo } from '@/dev/stacked-house-demo';
import { Room } from '@/components/room/room';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { CategoryManageScreen } from '@/components/screens/category-manage-screen';
import { CalendarImportScreen } from '@/components/screens/calendar-import-screen';
import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import { GachaPhonePreview } from '@/dev/gacha-phone-preview';
import { GachaStorybookPreview } from '@/dev/gacha-preview';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { HouseMissionsScreen } from '@/components/screens/house-missions-screen';
import { HouseMembersScreen, manageableMembers } from '@/components/screens/house-members-screen';
import { HelpScreen } from '@/components/screens/help-screen';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { InviteFriendsScreen } from '@/components/screens/invite-friends-screen';
import { LoginScreen } from '@/components/screens/login-screen';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { CharacterPickerSheet } from '@/components/screens/sheets/character-picker-sheet';
import { BugReportScreen } from '@/components/screens/bug-report-screen';
import { NotificationListScreen } from '@/components/screens/notification-list-screen';
import { MyPageScreen } from '@/components/screens/my-page-screen';
import { ListRow } from '@/components/ui/list-row';
import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';
import { OnboardingScreen } from '@/components/screens/onboarding-screen';
import { PasswordChangeScreen } from '@/components/screens/password-change-screen';
import { PolicyViewerScreen } from '@/components/screens/policy-viewer-screen';
import { ProfileEditScreen } from '@/components/screens/profile-edit-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { FontScreen } from '@/components/screens/font-screen';
import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
import { ThemeScreen } from '@/components/screens/theme-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { SoundSettingsScreen } from '@/components/screens/sound-settings-screen';
import { SignupScreen } from '@/components/screens/signup-screen';
import { Badge } from '@/components/ui/badge';
import { CoinIcon } from '@/components/ui/coin-icon';
import { BearCheck } from '@/components/ui/bear-check';
import { GlassSurface } from '@/components/ui/glass-surface';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { CATEGORY_ICON_GEOMETRY, CategoryIcon } from '@/components/ui/category-icon';
import { Button } from '@/components/ui/button';
import { AttendanceSheet } from '@/components/screens/sheets/attendance-sheet';
import { ActivityStrip } from '@/components/screens/house/activity-strip';
import { shiftIso, todayIso } from '@/utils/datetime';
import { Calendar } from '@/components/ui/calendar';
import { RecommendationSection } from '@/components/screens/my-room/recommendation-section';
import { WeeklyReportPanel } from '@/components/screens/my-room/weekly-report-panel';
import { WeeklyReportScreen } from '@/components/screens/weekly-report-screen';
import type { RecommendationItem } from '@/api';
import { CoachMarkOverlay } from '@/components/ui/coach-mark';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Loading } from '@/components/ui/loading';
import { Pill } from '@/components/ui/pill';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CurrencyGuide } from '@/components/ui/currency-guide';
import { WalletHistorySheet } from '@/components/screens/sheets/wallet-history-sheet';
import { SpringProgressBar } from '@/components/ui/spring-progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { MissionBanner } from '@/components/ui/mission-banner';
import { NotificationBanner } from '@/components/ui/notification-banner';
import { MissionSheet } from '@/components/screens/sheets/mission-sheet';
import { PendingNotice } from '@/components/ui/pending-notice';
import { RetryState } from '@/components/ui/retry-state';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { WheelPicker } from '@/components/ui/wheel-picker';
import { PolicyUrls } from '@/constants/policy';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { RECOMMENDED_HOUSES } from '@/mocks/fixtures';
import { RoomRenderReference } from '@/dev/room-render-reference';
import { TokenSwatches } from '@/dev/token-swatches';
import { TypeScalePreview } from '@/dev/type-scale-preview';
import { NavigationPreview } from '@/dev/navigation-preview';

export type GalleryEntry = {
  /** Unique, human-readable name shown as the section header. */
  name: string;
  /** Optional one-line description of what this entry demonstrates. */
  description?: string;
  /** Renders the component in isolation. */
  render: () => ReactNode;
};

/**
 * The dev gallery (`/dev` route) renders every entry here so you can eyeball a
 * component in isolation on device / simulator / web without wiring it into a
 * real screen first. Add an entry whenever you build a new component.
 */
/** 재화 내역 시트 데모 (#734). */
function WalletHistorySheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>재화 내역 열기</Text>
      </ScalePressable>
      <WalletHistorySheet
        visible={open}
        onClose={() => setOpen(false)}
        entries={[
          { id: 1, currency: 'coin', amount: 10, reason: '루틴 완료', balanceAfter: 130, createdAt: new Date().toISOString() }, // prettier-ignore
          { id: 2, currency: 'coin', amount: -100, reason: '뽑기', balanceAfter: 120, createdAt: new Date(Date.now() - 3600e3).toISOString() }, // prettier-ignore
          { id: 3, currency: 'diamond', amount: 5, reason: '뽑기 중복 전환', balanceAfter: 25, createdAt: new Date(Date.now() - 86400e3).toISOString() }, // prettier-ignore
        ]}
        hasNext
      />
    </View>
  );
}

/**
 * 출석 시트 데모 (#851) — 실제로 출석이 되게 해서 도장·코인·카운트업 연출을
 * 갤러리에서 확인할 수 있다. 10일차를 채우면 트로피 리빌까지 이어진다.
 */
/** 조정 추천 섹션 데모 (#1006) — 적용/무시로 카드가 실제로 빠지는 걸 본다. */
function RecommendationSectionDemo() {
  const [items, setItems] = useState<RecommendationItem[]>([
    {
      recommendationId: 1,
      type: 'ADJUST_DAYS',
      message:
        '『아침 러닝』 수요일 수행이 3주 연속 실패했어요. 수요일을 빼고 나머지 요일에 집중해 보면 어떨까요?',
      routineId: 42,
      originRoutineId: 42,
      routineTitle: '아침 러닝',
      proposal: { repeatType: 'WEEKLY', daysOfWeek: ['MON', 'FRI'] },
      expiresAt: '2026-09-05T00:00:00',
    },
    {
      recommendationId: 2,
      type: 'ADJUST_DAYS',
      message:
        '『독서 30분』이 2주째 완료율 40% 아래예요. 잘 지켜지는 요일 3개로 줄여보면 어떨까요?',
      routineId: 77,
      routineTitle: '독서 30분',
      proposal: { repeatType: 'WEEKLY', daysOfWeek: ['TUE', 'THU', 'SAT'] },
      expiresAt: '2026-08-31T00:00:00',
    },
  ]);
  const remove = (id: number) => setItems((prev) => prev.filter((r) => r.recommendationId !== id));
  return (
    <RecommendationSection
      items={items}
      onAccept={remove}
      onDismiss={remove}
      // 42는 월·수·금 루틴 — 카드가 '월 수 금 → 월 금'을 그린다.
      currentDaysById={{ 42: [1, 3, 5] }}
      now={new Date('2026-08-31T09:00:00')}
    />
  );
}

function AttendanceSheetDemo() {
  const [open, setOpen] = useState(false);
  const [streak, setStreak] = useState(3);
  // 갤러리에서는 오늘 출석 잠금을 걸지 않는다 — 연속으로 눌러 10일차까지
  // 걸어가며 보너스 링·트로피 리빌까지 확인하기 위해서다. 실제 시트는
  // checkedInToday가 true가 되면 버튼이 잠긴다.
  const today = false;
  const status = {
    eventId: 7,
    code: 'ATTENDANCE_10D_2026',
    title: '10일 연속 출석',
    startsOn: '2026-08-16',
    endsOn: '2026-09-14',
    targetDays: 10,
    currentStreak: streak,
    checkedInToday: today,
    completed: streak >= 10,
    checkInDates: [],
    dailyRewards: Array.from({ length: 10 }, (_, i) => ({
      day: i + 1,
      coinAmount: i + 1 === 5 ? 50 : 30,
      furnitureReward: i + 1 === 10,
      claimed: i + 1 <= streak,
    })),
    reward: {
      itemId: 42,
      name: '10일 출석 기념 트로피',
      assetKey: 'items/events/attendance-10-day-trophy.png',
      userItemId: null,
      received: false,
    },
  };
  return (
    <View style={{ alignSelf: 'stretch', gap: 8 }}>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => {
          setStreak(3);
          setOpen(true);
        }}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>출석 시트 열기 (3일차부터)</Text>
      </ScalePressable>
      <AttendanceSheet
        visible={open}
        onClose={() => setOpen(false)}
        status={status}
        onCheckIn={async () => {
          const next = Math.min(streak + 1, 10);
          setStreak(next);
          return {
            newCheckIn: true,
            coinRewardAmount: next === 5 ? 50 : 30,
            coinBalance: 190,
            rewardGrantedNow: next >= 10,
            status: { ...status, currentStreak: next, checkedInToday: true },
          };
        }}
      />
    </View>
  );
}

/** 캐릭터 교체 시트 데모 (#854) — 열기 버튼 뒤에 둔다. 아래 참고. */
function CharacterPickerSheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>캐릭터 교체 열기</Text>
      </ScalePressable>
      <CharacterPickerSheet
        visible={open}
        characters={[
          { serverId: 1, id: 'cat', name: '고양이', selected: true },
          { serverId: 4, id: 'panda', name: '판다', selected: false },
          { serverId: 8, id: 'otter', name: '수달', selected: false },
        ]}
        onSelect={() => {}}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/** 최근 활동 스트립 데모 (#860) — 탭해서 상세 펼침을 확인한다. */
function ActivityStripDemo() {
  const [open, setOpen] = useState(false);
  const today = todayIso();
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <ActivityStrip
        today={today}
        expanded={open}
        onToggle={() => setOpen((v) => !v)}
        days={[
          { date: today, label: '오늘', titles: ['아침 기상', '물 1L 마시기'] },
          { date: shiftIso(today, -1), label: '어제', titles: ['독서 30분'] },
          { date: shiftIso(today, -2), label: '이틀 전', titles: ['아침 기상'] },
          { date: shiftIso(today, -5), label: '닷새 전', titles: ['영양제 챙겨먹기'] },
          { date: shiftIso(today, -9), label: '9일 전', titles: ['아침 기상', '독서 30분'] },
        ]}
      />
    </View>
  );
}

/** 진행 바 데모 (#696) — 버튼으로 진행률을 올려 스프링·플래시를 확인한다. */
function SpringProgressDemo() {
  const [progress, setProgress] = useState(0.4);
  return (
    <View style={{ alignSelf: 'stretch', gap: 12 }}>
      <SpringProgressBar progress={progress} color="#7FA87F" trackColor="#8888883A" />
      <SpringProgressBar progress={progress} color="#7FA87F" trackColor="#8888883A" height={6} />
      <ScalePressable
        accessibilityRole="button"
        onPress={() => setProgress((p) => (p >= 1 ? 0 : Math.min(1, p + 0.3)))}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>진행 +30% (100%에서 플래시 · 다시 누르면 0%)</Text>
      </ScalePressable>
    </View>
  );
}

/** 휠 데모 (#390) — 시 휠 하나로 스와이프/탭 선택을 확인한다. */
function WheelPickerDemo() {
  const [hour, setHour] = useState(7);
  return (
    <View style={{ width: 120, alignSelf: 'center' }}>
      <WheelPicker
        items={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}시` }))}
        value={hour}
        onChange={setHour}
        accessibilityLabel="시 선택"
      />
    </View>
  );
}

export const galleryEntries: GalleryEntry[] = [
  {
    name: 'StackedHouseFrames',
    description: '세로형 집 10테마 · 2/3/4/6인 · 기존형 복귀 · 방 방문/자리 교환 검증 (#1077).',
    render: () => <StackedHouseDemo />,
  },
  {
    name: 'Room · renderer contract v1 reference',
    description:
      '관리자 크기 스튜디오와 동일한 geometry JSON·여름 바다 CDN fixture·캐릭터 애니메이션.',
    render: () => <RoomRenderReference />,
  },
  {
    name: 'Design tokens · active theme',
    description: 'Brand semantic colors, Astryx-aligned naming (default: cozy).',
    render: () => <TokenSwatches />,
  },
  {
    name: 'Type scale',
    description: 'Named typography roles (Astryx standard: base ≈ 16, ratio ≈ 1.2).',
    render: () => <TypeScalePreview />,
  },
  {
    name: 'ScalePressable · 프레스 스케일',
    description: '누르는 동안 0.96으로 눌리는 공용 Pressable (#442) — 버튼 기본 손맛.',
    render: () => (
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel="눌러보기"
        style={{
          alignSelf: 'center',
          backgroundColor: '#7FA87F',
          borderRadius: 999,
          paddingHorizontal: 24,
          paddingVertical: 12,
        }}>
        <Text style={{ color: '#FFFFFF' }}>눌러보기</Text>
      </ScalePressable>
    ),
  },
  {
    name: 'BottomNav · 리퀴드 바 드래그와 본문 스와이프',
    description: '누른 채 좌우로 끌어 선택, 놓을 때 한 번 이동. 집 확대 잠금 중에도 하단바는 동작.',
    render: () => <NavigationPreview />,
  },
  {
    name: 'GlassSurface · 떠 있는 버튼의 글래스 면',
    description:
      'iOS 26 리퀴드 글래스 원/알약 (#1050) — 글래스 불가 환경(웹·Android·iOS 25)에서는 fallbackColor 면. 방·집 화면의 떠 있는 버튼이 쓴다.',
    render: () => (
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', alignSelf: 'center' }}>
        <GlassSurface
          fallbackColor="#FFFFFF"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text>🎁</Text>
        </GlassSurface>
        <GlassSurface
          fallbackColor="#FFFFFF"
          interactive={false}
          style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
          <Text>라벨</Text>
        </GlassSurface>
      </View>
    ),
  },
  {
    name: 'BearCheck · 곰 헤드 체크 토글',
    description:
      '루틴 완료 토글 (#344, design-sync 시안 A) — 미완료 윤곽 / 완료 = 카테고리 색 + 흰 체크.',
    render: () => (
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', alignSelf: 'center' }}>
        <BearCheck checked={false} />
        <BearCheck checked color="#E8A87C" />
        <BearCheck checked color="#7FA8D4" />
        <BearCheck checked color="#C8869C" />
        <BearCheck checked color="#7FA87F" />
      </View>
    ),
  },
  {
    name: 'PawRefreshScroll · 곰 발바닥 당겨서 새로고침',
    description:
      '나의 방·집 스크롤의 커스텀 pull-to-refresh (#454) — 맨 위에서 당기면 발바닥이 자라나고, 놓으면 새로고침 동안 두근거린다. (네이티브 전용 — 웹은 일반 스크롤)',
    render: () => (
      <View style={{ height: 360, alignSelf: 'stretch' }}>
        <PawRefreshScroll
          onRefresh={() => new Promise((resolve) => setTimeout(resolve, 1600))}
          contentContainerStyle={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={{ height: 48, borderRadius: 12, backgroundColor: '#8888883A' }} />
          ))}
        </PawRefreshScroll>
      </View>
    ),
  },
  {
    name: 'WheelPicker · 스와이프 휠',
    description:
      '알림 시간 시트의 시간 선택 휠 (#390, design-sync Time wheel picker 채택) — 스냅 스와이프 + 행 탭 선택.',
    render: () => <WheelPickerDemo />,
  },
  {
    name: 'CategoryIcon · 스티커 팝',
    description:
      '카테고리 아이콘 16종 (#398, design-sync A안) — 카테고리 색 하나에서 파스텔·액센트·포인트 톤 파생.',
    render: () => (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {(Object.keys(CATEGORY_ICON_GEOMETRY) as (keyof typeof CATEGORY_ICON_GEOMETRY)[]).map(
          (n, i) => (
            <CategoryIcon
              key={n}
              name={n}
              color={['#E8A87C', '#7FA8D4', '#C8869C', '#96B39A'][i % 4]}
              size={32}
            />
          ),
        )}
      </View>
    ),
  },
  {
    name: 'CoinIcon · 발바닥 각인 동전',
    description:
      '코인 글리프 (#512, 시안 B) — 골드 동전 + 곰 발바닥 각인, 14px 미만은 발가락 단순화.',
    render: () => (
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', alignSelf: 'center' }}>
        <CoinIcon size={48} />
        <CoinIcon size={22} />
        <CoinIcon size={18} />
        <CoinIcon size={14} />
        <CoinIcon size={12} />
      </View>
    ),
  },
  {
    name: 'WalletHistorySheet · 재화 내역',
    description: '지갑 필 탭 → 재화 증감 이력 시트 (#734) — 적립 +/사용 −, 직후 잔액, 더보기.',
    render: () => <WalletHistorySheetDemo />,
  },
  {
    name: 'CurrencyGuide · 재화 안내',
    description: '재화 내역 시트 상단 접이식 안내 (#789) — 코인·다이아의 수급처·사용처.',
    render: () => <CurrencyGuide initialOpen />,
  },
  {
    name: 'SpringProgressBar · 스프링 진행 바',
    description:
      '공용 진행 바 (#440·#503, #696 승격) — 차오를 때 바운스, 줄어들 때 클램프, 100% 흰 플래시.',
    render: () => <SpringProgressDemo />,
  },
  {
    name: 'CoachMarkOverlay · 스포트라이트',
    description: '코치마크 튜토리얼 오버레이 (#351) — 구멍 뚫린 딤 + 말풍선.',
    render: () => (
      <View style={{ height: 420, alignSelf: 'stretch' }}>
        <CoachMarkOverlay
          steps={[{ target: 'demo', title: '오늘의 루틴', body: '곰 발바닥을 누르면 루틴 완료!' }]}
          index={0}
          targets={{ demo: { x: 40, y: 60, w: 220, h: 48 } }}
          frame={{ w: 340, h: 420 }}
          onNext={() => {}}
          onSkip={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'Room · default',
    description: 'Room renderer — wallpaper + slot-placed furniture (dummy resources) + character.',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <Room />
      </View>
    ),
  },
  {
    name: 'HousePreviewFrame · 기본 프레임 (커버 없음)',
    description: '집 탐색 미리보기 (#328) — 커버 없는 집은 기본 프레임 PNG로 폴백, 멤버 2/4.',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <HousePreviewFrame memberCount={2} name="데모 집" />
      </View>
    ),
  },
  {
    name: 'Room · CDN character poses',
    description:
      'Server poses[] art in registration order — tap the character to cycle (#263, #735).',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <Room
          characterId="panda"
          characterFrames={[
            'characters/panda/animations/idle.webp',
            'characters/panda/animations/pose-cycle.webp',
            'characters/panda/animations/wave.webp',
          ]}
          interactiveCharacter
        />
      </View>
    ),
  },
  {
    name: 'Room · hanok theme',
    description: 'Same renderer, hanok furniture + tiger character.',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <Room wallpaperId="hanok-simple" characterId="tiger" />
      </View>
    ),
  },
  {
    name: 'MyRoomScreen',
    description:
      'Ported from the prototype MyRoomZoomScreen (#7): room view + today’s routines + reward.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <MyRoomScreen routines={SAMPLE_ROUTINES} />
      </View>
    ),
  },
  {
    name: 'InviteFriendsScreen',
    description: '친구 초대 (#518): 내 초대코드 복사 + 보상 현황 + 받은 코드 사용.',
    render: () => (
      <InviteFriendsScreen
        info={{
          code: 'ROUGE123',
          rewardedCount: 2,
          maxRewardedCount: 10,
          inviterRewardCoin: 50,
          inviteeRewardCoin: 30,
        }}
        onRedeem={async () => ({ rewardCoin: 30 })}
      />
    ),
  },
  {
    name: 'RoomDecorScreen',
    description:
      'Ported from the prototype RoomDecorScreen (#8): live room preview + wallpaper/furniture catalog.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <RoomDecorScreen />
      </View>
    ),
  },
  {
    name: 'FriendRoomScreen',
    description:
      'Ported from the prototype FriendRoomScreen (#9): read-only room + routines + cheers.',
    render: () => (
      <View style={{ height: 860, alignSelf: 'stretch' }}>
        <FriendRoomScreen friendName="민지" />
      </View>
    ),
  },
  {
    name: 'HouseScreen',
    description:
      'Ported from the prototype HouseScreen (#10): house switcher, member rooms, 공동 미션 요약 줄. 구성원 관리·공동 미션은 셸 화면으로 승격(#753·#875) — 아래 항목에서 미리보기.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        {/* onOpenMissions를 배선해야 요약 줄이 그려진다 (#875). */}
        <HouseScreen onOpenMissions={() => {}} />
      </View>
    ),
  },
  {
    name: 'CalendarImportScreen',
    description:
      '마이페이지 → 캘린더 연동 (#844 → #1097): 캘린더 선택 → 미리보기 → 선택 임포트. 비슷한 루틴이 있는 항목은 기본 해제.',
    render: () => (
      <View style={{ alignSelf: 'stretch', height: 720 }}>
        <CalendarImportScreen
          calendars={[
            { id: 'c1', title: '개인', source: 'Google' },
            { id: 'c2', title: '대한민국 공휴일', source: 'Holidays' },
          ]}
          candidates={[
            {
              seriesId: 'e1',
              occurrenceId: 'e1:2026-08-20',
              title: '치과 예약',
              date: '2026-08-20',
              allDay: false,
              similar: [],
            },
            {
              seriesId: 'e2',
              occurrenceId: 'e2:2026-08-21',
              title: '영양제 먹기',
              date: '2026-08-21',
              allDay: false,
              similar: [
                { kind: 'ROUTINE', id: 21, title: '영양제 챙겨먹기', score: 0.86, matchType: 'EMBEDDING' }, // prettier-ignore
              ],
            },
            {
              seriesId: 'e3',
              occurrenceId: 'e3:2026-08-22',
              title: '팀 회식',
              date: '2026-08-22',
              allDay: false,
              similar: [],
            },
          ]}
          onBack={() => {}}
          onConnect={() => {}}
          onPreview={() => {}}
          onImport={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'HouseMissionsScreen',
    description:
      '집 → 공동 미션 (#875에서 모달 → 셸 화면으로 승격): 미션 목록·진행률, 보상 수령, 만들기 폼(유형별 목표 상한·단위 #872).',
    render: () => {
      const demoHouse: House = {
        houseId: 7,
        name: '데모 하우스',
        myRole: 'OWNER',
        maxMembers: 4,
        memberCount: 2,
        floors: [],
        missions: [
          { id: 11, title: '주간 루틴 지키기', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 3, target: 10, status: 'ACTIVE' }, // prettier-ignore
          { id: 12, title: '기상 인증 모으기', desc: '일일 구성원 달성률', icon: 'sun', current: 80, target: 80, status: 'ACTIVE', achieved: true }, // prettier-ignore
          { id: 13, title: '지난 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 5, target: 5, status: 'COMPLETED', achieved: true }, // prettier-ignore
        ],
      };
      return (
        <View style={{ height: 900, alignSelf: 'stretch' }}>
          <HouseMissionsScreen
            house={demoHouse}
            missions={demoHouse.missions ?? []}
            isOwner
            onBack={() => {}}
            onCreateMission={() => {}}
            onDeleteMission={() => {}}
            onClaimMission={() => {}}
            onAddMissionRoutine={() => {}}
          />
        </View>
      );
    },
  },
  {
    name: 'HouseMembersScreen',
    description:
      '집 → 구성원 관리 (#753에서 셸 화면으로 승격): 초대코드, 방장 도구, 강퇴(더미 집이라 로컬 강퇴 플로우).',
    render: () => {
      const demoHouse: House = {
        name: '데모 하우스',
        myRole: 'OWNER',
        maxMembers: 4,
        floors: [
          {
            level: '1층',
            rooms: [
              { name: '친구', color: '#F5E1D8', membershipId: 42 },
              { name: '나', color: '#E8E0D0', isMine: true, isOwner: true, membershipId: 43 },
            ],
          },
        ],
      };
      return (
        <View style={{ height: 900, alignSelf: 'stretch' }}>
          <HouseMembersScreen
            house={demoHouse}
            members={manageableMembers(demoHouse)}
            isOwner
            isKicked={() => false}
            memberCharacterId={(m) => (m.isMine ? 'tiger' : 'cat')}
            onBack={() => {}}
            onLocalKick={() => {}}
            onLeaveDone={() => {}}
          />
        </View>
      );
    },
  },
  {
    name: 'LoginScreen',
    description:
      'Ported from the prototype AuthScreen (#2). Preview at fixed height, 최근 로그인 배지는 카카오에.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <LoginScreen lastLoginProvider="kakao" />
      </View>
    ),
  },
  {
    name: 'SignupScreen',
    description: 'Ported from the prototype SignupScreen (#3). Preview at fixed height.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <SignupScreen onViewPolicy={(doc) => openBrowserAsync(PolicyUrls[doc])} />
      </View>
    ),
  },
  {
    name: 'OnboardingScreen · 첫 실행',
    description:
      'Ported from the prototype OnboardingScreen (#4): slides → goals → (캐러셀은 MVP 오프 #637 — 갤러리는 열어 보존 UI 확인) → nickname. 첫 실행에는 건너뛰기가 없다 (#1023).',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <OnboardingScreen characterSelectEnabled />
      </View>
    ),
  },
  {
    name: 'OnboardingScreen · 다시 보기',
    description:
      '설정 → 튜토리얼 다시 보기 진입 (#1023) — 우상단 건너뛰기가 생기고, 누르면 목표 설문이 아니라 온보딩을 끝낸다(여기서는 콘솔 로그).',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <OnboardingScreen
          characterSelectEnabled
          replay
          initialGoals={['exercise']}
          onSkip={() => console.log('[dev] 온보딩 건너뛰기 — 앱으로 복귀')}
        />
      </View>
    ),
  },
  {
    name: 'RoutineManageScreen',
    description: 'Ported from the prototype RoutineManageScreen (#6). Sample routines.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <RoutineManageScreen routines={SAMPLE_ROUTINES} />
      </View>
    ),
  },
  {
    name: 'ListRow',
    description:
      '설정·마이페이지 공용 목록 행 — 아이콘 원 + 라벨 + 화살표, 마지막 행은 구분선 없음.',
    render: () => (
      <View style={{ alignSelf: 'stretch' }}>
        <ListRow icon="help" label="도움말" />
        <ListRow icon="bug" label="버그 제보" last />
      </View>
    ),
  },
  {
    name: 'MyPageScreen',
    description:
      '마이페이지 탭 (#1088): 프로필 카드·지표 한 줄·계정/콘텐츠 행. 설정은 헤더 우측 톱니 뒤 서브화면.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <MyPageScreen
          nickname="준서"
          bio="매일 조금씩"
          streakDays={12}
          coinBalance={1240}
          diamondBalance={3}
        />
      </View>
    ),
  },
  {
    name: 'SettingsScreen',
    description:
      '마이페이지의 서브화면 (#1088): 디자인(다크모드·테마·폰트)·알림·기타·로그아웃·회원탈퇴. 업데이트 카드는 #1095에서 뺐다.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <SettingsScreen onBack={() => {}} />
      </View>
    ),
  },
  {
    name: 'ThemeScreen',
    description: '설정 → 테마 색상 (#459): 라이브 미리보기 + 테마 5종 선택.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <ThemeScreen />
      </View>
    ),
  },
  {
    name: 'AppearancePreview',
    description:
      '테마 색상·폰트 피커 공용 미리보기 카드 (#750): 활성 토큰·타입 스케일 그대로. 닉네임·캐릭터는 내 것 (#899).',
    render: () => <AppearancePreview userName="루티" characterId="otter" />,
  },
  {
    name: 'FontScreen',
    description: '설정 → 폰트 (#750): 라이브 미리보기 + 글자 스와치로 폰트 5종 선택.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <FontScreen />
      </View>
    ),
  },
  {
    name: 'ProfileEditScreen',
    description: '설정 → 프로필 편집: 닉네임 + 한 줄 소개 편집.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <ProfileEditScreen />
      </View>
    ),
  },
  {
    name: 'PasswordChangeScreen',
    description: '설정 → 비밀번호 변경: 현재/새 비밀번호 검증.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <PasswordChangeScreen />
      </View>
    ),
  },
  {
    name: 'CharacterPickerSheet',
    description: '나의 방 햄버거 → 캐릭터 교체: 보유 캐릭터 그리드 + 착용 중 배지.',
    render: () => <CharacterPickerSheetDemo />,
  },
  {
    name: 'NotificationListScreen',
    description: '나의 방 헤더 벨 → 알림 목록: 안 읽음 점 + 개별/전체 읽음.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <NotificationListScreen />
      </View>
    ),
  },
  {
    name: 'BugReportScreen',
    description: '설정 → 버그 제보: 제보 폼(제목·내용·스크린샷) + 내 제보 내역.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <BugReportScreen
          entries={[
            { id: 2, title: '달력 원 정렬이 어긋나요', status: 'IN_PROGRESS', date: '7월 20일' },
            { id: 1, title: '로그인이 안 돼요', status: 'RESOLVED', date: '7월 12일' },
          ]}
        />
      </View>
    ),
  },
  {
    name: 'NotificationSettingsScreen',
    description: '설정 → 푸시 알림: 전체 스위치 + 카테고리별 토글.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <NotificationSettingsScreen />
      </View>
    ),
  },
  {
    name: 'SoundSettingsScreen',
    description: '설정 → 효과음: 효과음 / 배경 음악 / 햅틱 토글.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <SoundSettingsScreen />
      </View>
    ),
  },
  {
    name: 'HelpScreen',
    description: '설정 → 도움말: FAQ 아코디언 + 문의 + 버전.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <HelpScreen />
      </View>
    ),
  },
  {
    name: 'PolicyViewerScreen',
    description: '설정/가입 → 약관·처리방침 인앱 웹뷰 (#652). 웹은 iframe 변형.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <PolicyViewerScreen title="이용약관" url="https://rougether.com/terms.html" />
      </View>
    ),
  },
  {
    name: 'AddRoutineScreen',
    description: 'Ported from the prototype AddRoutineScreen (#5, add mode; sheets deferred).',
    render: () => (
      <View style={{ height: 760, alignSelf: 'stretch' }}>
        <AddRoutineScreen />
      </View>
    ),
  },
  {
    name: 'CategoryManageScreen',
    description: '카테고리 관리 독립 화면 (#394) — 목록(순서·수정·삭제) + 헤더 +로 생성 시트.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <CategoryManageScreen onReorder={() => {}} />
      </View>
    ),
  },
  {
    name: 'HouseOrderDots · 집 순서 인디케이터',
    description:
      '꾹 누르면 도트가 이름표 줄로 펼쳐지고 좌우로 끌어 순서를 바꾼다 (#820). 마지막 도트는 승인 대기 페이지라 정렬에서 빠진다.',
    render: () => (
      <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 12 }}>
        <HouseOrderDots
          houses={[
            { houseId: 1, name: 'TripleS' },
            { houseId: 2, name: '우리집' },
            { houseId: 3, name: '스터디방' },
          ]}
          pendingCount={1}
          index={0}
          onReorder={(ids) => console.log('reorder', ids)}
        />
        <Text>↑ 꾹 눌러 좌우로 끌어보세요 (대기 페이지 도트 1개 포함)</Text>
      </View>
    ),
  },
  {
    name: 'Loading · 공용 로딩 표시',
    description:
      '지연 표시(기본 250ms) — 빨리 끝나는 로딩은 아무것도 안 보인다 (#849). 아래는 지연을 꺼서 바로 보이게 한 것.',
    render: () => (
      <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 16 }}>
        <Loading delayMs={0} />
        <Loading delayMs={0} size="large" />
        <Text>↑ 기본(small) · large. 실제 화면에서는 250ms 안에 끝나면 안 보인다.</Text>
      </View>
    ),
  },
  {
    name: 'GachaScreen',
    description:
      '테마 구분 없는 벽지·바닥·가구 3개 상자. 실제 재화 소모 없이 단챠·5+1·보상 목록을 확인한다.',
    render: () => <GachaPhonePreview />,
  },
  {
    name: 'GachaPhonePreview',
    description: '전체 화면 휴대폰 QA · 전설 연출 · 안전 영역 상단 59 / 하단 34',
    render: () => <GachaPhonePreview fullscreen />,
  },
  {
    name: 'GachaPhoneCommon',
    description: '전체 화면 휴대폰 QA · 일반 연출',
    render: () => <GachaPhonePreview fullscreen rarity="일반" />,
  },
  {
    name: 'GachaPhoneRare',
    description: '전체 화면 휴대폰 QA · 희귀 연출',
    render: () => <GachaPhonePreview fullscreen rarity="희귀" />,
  },
  {
    name: 'GachaPhoneReducedMotion',
    description: '전체 화면 휴대폰 QA · 동작 줄이기',
    render: () => <GachaPhonePreview fullscreen reducedMotion />,
  },
  {
    name: 'GachaStorybookArchive',
    description: '이전 PR의 숲속 선물상자 아트 비교용. 실제 유료 뽑기와 분리된 개발 전용 무대.',
    render: () => <GachaStorybookPreview />,
  },
  {
    name: 'HouseSearchScreen',
    description:
      'Ported from the prototype HouseSearchScreen (#11): invite code + recommended list.',
    render: () => (
      <View style={{ height: 760, alignSelf: 'stretch' }}>
        <HouseSearchScreen houses={RECOMMENDED_HOUSES} />
      </View>
    ),
  },
  {
    name: 'CreateHouseScreen',
    description:
      'Ported from the prototype CreateHouseScreen (#12): preview, theme, capacity, code.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <CreateHouseScreen covers={SAMPLE_HOUSE_COVERS} />
      </View>
    ),
  },
  {
    name: 'HouseCoverPicker',
    description:
      '집 테마(커버) 선택 그리드 — 서버 커버 카탈로그(GET /houses/cover-images) (#261, 문구 #1112).',
    render: () => <HouseCoverPickerDemo />,
  },
  {
    name: 'ActivityStrip',
    description: '친구 방 최근 활동 — 14칸 점 스트립, 탭하면 날짜별 상세 (#860).',
    render: () => <ActivityStripDemo />,
  },
  {
    name: 'AttendanceSheet',
    description:
      '연속 출석 시트 (#851) — 눌러서 도장·코인·카운트업 연출 확인. 10일차엔 트로피 리빌.',
    render: () => <AttendanceSheetDemo />,
  },
  {
    name: 'WeeklyReportScreen · 주간회고 화면',
    description:
      '마이페이지 > 주간회고 다시 보기 / 새 회고 배너 목적지 (#1056 → #1088). 나의 방 탭에서 빠진 패널을 헤더 달린 화면으로.',
    render: () => (
      <View style={{ height: 520 }}>
        <WeeklyReportScreen
          report={{
            reportId: 1,
            weekStartDate: '2026-08-24',
            weekEndDate: '2026-08-30',
            completionRate: 80,
            completedCount: 8,
            scheduledCount: 10,
            summary: '지난주엔 아침 루틴을 잘 지켰어요. 운동은 주중에 두 번 빠졌네요.',
          }}
          onBack={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'WeeklyReportPanel',
    description:
      '나의 방 주간회고 탭 본문 — 완료율 + 요일별·루틴별 비율 막대 + LLM 본문 (#852·#856).',
    render: () => (
      <View style={{ alignSelf: 'stretch', height: 640 }}>
        <WeeklyReportPanel
          report={{
            reportId: 1,
            weekStartDate: '2026-08-09',
            weekEndDate: '2026-08-15',
            status: 'GENERATED',
            completionRate: 0.36,
            completedCount: 14,
            scheduledCount: 39,
            summary: '이번 주는 주중 아침 루틴이 잘 붙었고, 주말에 흐름이 끊겼어요.',
            highlights: [
              '월~수 아침 스트레칭을 3일 연속 지켰어요.',
              '독서는 목표의 80%를 채웠어요.',
            ],
            failurePatterns: ['주말(토·일)에 예정된 루틴을 대부분 놓쳤어요.'],
            suggestions: ['주말 루틴 개수를 절반으로 줄여보는 건 어때요?'],
            stats: {
              byWeekday: [
                { dayOfWeek: 'SUNDAY', completed: 0, failed: 7 },
                { dayOfWeek: 'MONDAY', completed: 4, failed: 1 },
                { dayOfWeek: 'TUESDAY', completed: 3, failed: 2 },
                { dayOfWeek: 'WEDNESDAY', completed: 4, failed: 1 },
                { dayOfWeek: 'THURSDAY', completed: 2, failed: 3 },
                { dayOfWeek: 'FRIDAY', completed: 1, failed: 4 },
                { dayOfWeek: 'SATURDAY', completed: 0, failed: 7 },
              ],
              byRoutine: [
                {
                  lineageId: 1,
                  title: '아침 스트레칭',
                  categoryName: '건강',
                  completed: 5,
                  failed: 2,
                },
                {
                  lineageId: 2,
                  title: '독서 30분',
                  categoryName: '자기계발',
                  completed: 4,
                  failed: 3,
                },
                {
                  lineageId: 3,
                  title: '물 2L 마시기',
                  categoryName: '건강',
                  completed: 5,
                  failed: 2,
                },
              ],
              streak: { currentCount: 3, longestCount: 6 },
            },
          }}
        />
      </View>
    ),
  },
  {
    name: 'RecommendationSection',
    description:
      'AI 조정 추천 카드 (#1006) — 주간회고 탭 하단. 적용하기는 확인 다이얼로그를 한 번 거친다.',
    render: () => <RecommendationSectionDemo />,
  },
  {
    name: 'Calendar',
    description: 'Pure-JS month-grid date picker used by the duration sheet (#5).',
    render: () => (
      <View style={{ alignSelf: 'stretch' }}>
        <Calendar value="2026-06-15" onSelect={() => {}} />
      </View>
    ),
  },
  {
    name: 'UI · Button',
    description: 'Shared button (primary / secondary / danger), token-styled, vector left icon.',
    render: () => (
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        <Button label="저장" onPress={() => {}} />
        <Button label="집 만들기" variant="secondary" leftIcon="add" onPress={() => {}} />
        <Button label="삭제하기" variant="danger" leftIcon="trash" onPress={() => {}} />
        <Button label="비활성" disabled onPress={() => {}} />
      </View>
    ),
  },
  {
    name: 'UI · IconButton',
    description: 'Circular icon button (Ionicons, no emoji) — header/action chrome.',
    render: () => (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <IconButton name="back" accessibilityLabel="뒤로" onPress={() => {}} />
        <IconButton name="edit" accessibilityLabel="편집" onPress={() => {}} />
        <IconButton name="gift" accessibilityLabel="가챠" variant="primary" onPress={() => {}} />
        <IconButton name="close" accessibilityLabel="닫기" onPress={() => {}} />
      </View>
    ),
  },
  {
    name: 'UI · ScreenHeader',
    description: 'Standard header: back + title + right slot.',
    render: () => (
      <View style={{ alignSelf: 'stretch' }}>
        <ScreenHeader title="가챠" onBack={() => {}} right={<Pill label="5,600" icon="coin" />} />
      </View>
    ),
  },
  {
    name: 'UI · Pill / Badge / Card',
    description: 'Small chips and a surface card.',
    render: () => (
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill label="Lv.20" icon="star" />
          <Pill label="5,600" icon="coin" />
          <Badge label="전설" />
        </View>
        <Card>
          <Badge label="MY" />
        </Card>
      </View>
    ),
  },
  {
    name: 'UI · PendingNotice',
    description: '서버 준비 중(엔드포인트 미구현) 정직화 배너.',
    render: () => <PendingNotice text="이 기능은 서버 준비 중이에요." />,
  },
  {
    name: 'UI · RetryState',
    description: '로드 실패 공용 블록 (#557) — 메시지(+보조 문구)와 다시 시도 필.',
    render: () => (
      <View style={{ alignSelf: 'stretch', gap: 24 }}>
        <RetryState message="데이터를 불러오지 못했어요." onRetry={() => {}} />
        <RetryState
          message="친구 방을 불러오지 못했어요"
          detail="네트워크 상태를 확인하고 다시 시도해 주세요."
          onRetry={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'UI · ConfirmDialog',
    description: '백드롭+카드 확인 다이얼로그 (#557) — 버튼으로 열어보기.',
    render: () => <ConfirmDialogDemo />,
  },
  {
    name: 'UI · NotificationBanner',
    description:
      '앱이 켜져 있을 때 뜨는 인앱 푸시 배너 (#902) — 종류별 아이콘 + 제목/본문, 탭하면 알림함. 갤러리에서는 자동으로 안 닫힌다.',
    render: () => (
      <View style={{ alignSelf: 'stretch', minHeight: 96 }}>
        <NotificationBanner
          type="FRIEND_CHEER"
          title="루티니1님이 응원을 보냈어요"
          body="오늘도 루틴 지키는 중! 화이팅 🐾"
          visibleMs={0}
          onPress={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'UI · SheetHandle',
    description: '바텀시트 드래그 그래버 (#1015) — 세 시트에 복제돼 있던 40×4 pill의 공용화.',
    render: () => <SheetHandle />,
  },
  {
    name: 'UI · MissionBanner · 첫 실행',
    description:
      '온보딩 미션 진행 배너 (#571) — 깃발 표식 + 미션 N/4. 첫 실행에는 건너뛰기가 없다 (#1023).',
    render: () => (
      <View style={{ alignSelf: 'stretch', minHeight: 80 }}>
        <MissionBanner stepIndex={1} totalSteps={4} label="뽑기 1회 해보기" onPress={() => {}} />
      </View>
    ),
  },
  {
    name: 'UI · MissionBanner · 다시 보기',
    description:
      '설정 → 튜토리얼 다시 보기로 시작된 체인 (#1023) — 건너뛰기(확인 다이얼로그)가 붙는다.',
    render: () => (
      <View style={{ alignSelf: 'stretch', minHeight: 80 }}>
        <MissionBanner
          stepIndex={1}
          totalSteps={4}
          label="뽑기 1회 해보기"
          onPress={() => {}}
          onSkip={() => {}}
          canSkip
        />
      </View>
    ),
  },
  {
    name: 'MissionSheet · 완료 전환',
    description: '미션 완료 전환 시트 (#571) — 다음 미션 안내와 하러 가기.',
    render: () => <MissionSheetDemo />,
  },
  {
    name: 'UI · Toast',
    description: '하단 토스트 (info / success / error) — useToast().show(...)로 발사.',
    render: () => (
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>
    ),
  },
];

/** Server cover catalog snapshot (2026-07-15) for gallery/preview use. */
const SAMPLE_HOUSE_COVERS: HouseCover[] = [
  {
    code: 'cloud_balloon',
    name: '구름 풍선 집',
    coverImageKey: 'house/cloud-balloon/house-unified-cloud-balloon-frame.png',
  },
  {
    code: 'coral_aquarium',
    name: '산호 수족관 집',
    coverImageKey: 'house/coral-aquarium/house-unified-coral-aquarium-frame.png',
  },
  {
    code: 'mushroom_forest',
    name: '버섯 숲 집',
    coverImageKey: 'house/mushroom-forest/house-unified-mushroom-forest-frame.png',
  },
  {
    code: 'night_observatory',
    name: '밤의 천문대 집',
    coverImageKey: 'house/night-observatory/house-unified-night-observatory-frame-v3.png',
  },
];

/** Interactive cover grid — tap to move the selection ring. */
function HouseCoverPickerDemo() {
  const [selected, setSelected] = useState<string | undefined>(
    SAMPLE_HOUSE_COVERS[0].coverImageKey,
  );
  return (
    <HouseCoverPicker covers={SAMPLE_HOUSE_COVERS} selectedKey={selected} onSelect={setSelected} />
  );
}

/** Opens the shared confirm dialog in its destructive form. */
function MissionSheetDemo() {
  const [visible, setVisible] = useState(false);
  const [last, setLast] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch', gap: 8 }}>
      <Button
        label="미션 1 완료 시트 열기"
        onPress={() => {
          setLast(false);
          setVisible(true);
        }}
      />
      <Button
        label="마지막 미션(축하) 시트 열기"
        variant="secondary"
        onPress={() => {
          setLast(true);
          setVisible(true);
        }}
      />
      <MissionSheet
        visible={visible}
        completedStep={last ? 4 : 1}
        totalSteps={4}
        nextLabel={last ? null : '뽑기 1회 해보기'}
        onGo={() => setVisible(false)}
        onClose={() => setVisible(false)}
      />
    </View>
  );
}

function ConfirmDialogDemo() {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Button label="삭제 확인 열기" variant="danger" onPress={() => setVisible(true)} />
      <ConfirmDialog
        visible={visible}
        title="루틴 삭제"
        body={'이 루틴을 삭제할까요?\n삭제하면 지난 수행 기록도 함께 사라져요.'}
        confirmLabel="삭제"
        destructive
        onConfirm={() => setVisible(false)}
        onCancel={() => setVisible(false)}
      />
    </View>
  );
}

/** Buttons that fire each toast variant (needs its own provider in the gallery). */
function ToastDemo() {
  const { show } = useToast();
  return (
    <View style={{ alignSelf: 'stretch', gap: 8, minHeight: 200 }}>
      <Button label="정보 토스트" onPress={() => show('저장했어요')} />
      <Button
        label="성공 토스트"
        variant="secondary"
        onPress={() => show('구매 완료!', 'success')}
      />
      <Button
        label="에러 토스트"
        variant="danger"
        onPress={() => show('저장에 실패했어요', 'error')}
      />
    </View>
  );
}
