import { openBrowserAsync } from 'expo-web-browser';
import { type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';

import { type HouseCover, HouseCoverPicker } from '@/components/room/house-cover-picker';
import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import { Room } from '@/components/room/room';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { CategoryManageScreen } from '@/components/screens/category-manage-screen';
import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { HouseScreen } from '@/components/screens/house-screen';
import { HelpScreen } from '@/components/screens/help-screen';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { InviteFriendsScreen } from '@/components/screens/invite-friends-screen';
import { LoginScreen } from '@/components/screens/login-screen';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { CharacterPickerSheet } from '@/components/screens/sheets/character-picker-sheet';
import { BugReportScreen } from '@/components/screens/bug-report-screen';
import { NotificationListScreen } from '@/components/screens/notification-list-screen';
import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';
import { OnboardingScreen } from '@/components/screens/onboarding-screen';
import { PasswordChangeScreen } from '@/components/screens/password-change-screen';
import { PolicyViewerScreen } from '@/components/screens/policy-viewer-screen';
import { ProfileEditScreen } from '@/components/screens/profile-edit-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { ThemeScreen } from '@/components/screens/theme-screen';
import { SoundSettingsScreen } from '@/components/screens/sound-settings-screen';
import { SignupScreen } from '@/components/screens/signup-screen';
import { Badge } from '@/components/ui/badge';
import { CoinIcon } from '@/components/ui/coin-icon';
import { BearCheck } from '@/components/ui/bear-check';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { CATEGORY_ICON_GEOMETRY, CategoryIcon } from '@/components/ui/category-icon';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CoachMarkOverlay } from '@/components/ui/coach-mark';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SpringProgressBar } from '@/components/ui/spring-progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MissionBanner } from '@/components/ui/mission-banner';
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
/** 휠 데모 (#390) — 시 휠 하나로 스와이프/탭 선택을 확인한다. */
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
    name: 'Room · CDN character animations',
    description: 'Server animations(idle/poseCycle/wave) art — tap the character to cycle (#263).',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <Room
          characterId="panda"
          characterAnimations={{
            idle: 'characters/panda/animations/idle.webp',
            poseCycle: 'characters/panda/animations/pose-cycle.webp',
            wave: 'characters/panda/animations/wave.webp',
          }}
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
        <Room
          wallpaperId="hanok-simple"
          characterId="tiger"
          placedFurnitureIds={[
            'hanok-bed',
            'hanok-shelf',
            'hanok-window',
            'hanok-rug',
            'hanok-plant',
            'hanok-teatable',
          ]}
        />
      </View>
    ),
  },
  {
    name: 'MyRoomScreen',
    description:
      'Ported from the prototype MyRoomZoomScreen (#7): room view + today’s routines + reward.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <MyRoomScreen
          routines={SAMPLE_ROUTINES}
          placedFurnitureIds={['bed', 'window', 'plant', 'rug']}
        />
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
        <FriendRoomScreen
          friendName="민지"
          placedFurnitureIds={['bed', 'window', 'plant', 'rug']}
        />
      </View>
    ),
  },
  {
    name: 'HouseScreen · 비 오는 날',
    description: '흐린 하늘 + 빗줄기 오버레이 (#360) — raining 주입.',
    render: () => (
      <View style={{ height: 700, alignSelf: 'stretch' }}>
        <HouseScreen raining nowHour={10} />
      </View>
    ),
  },
  {
    name: 'HouseScreen',
    description:
      'Ported from the prototype HouseScreen (#10): house switcher, member rooms, group goals, kick flow.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <HouseScreen />
      </View>
    ),
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
    name: 'OnboardingScreen',
    description:
      'Ported from the prototype OnboardingScreen (#4): slides → goals → (캐러셀은 MVP 오프 #637 — 갤러리는 열어 보존 UI 확인) → nickname.',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <OnboardingScreen characterSelectEnabled />
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
    name: 'SettingsScreen',
    description: 'Ported from the prototype SettingsScreen (#14): theme picker + rows.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <SettingsScreen />
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
    render: () => (
      <View style={{ height: 560, alignSelf: 'stretch' }}>
        <CharacterPickerSheet
          visible
          characters={[
            { serverId: 1, id: 'cat', name: '고양이', selected: true },
            { serverId: 4, id: 'panda', name: '판다', selected: false },
            { serverId: 8, id: 'otter', name: '수달', selected: false },
          ]}
          onSelect={() => {}}
          onClose={() => {}}
        />
      </View>
    ),
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
        <PolicyViewerScreen
          title="이용약관"
          url="https://triples-soma.github.io/policy/terms.html"
        />
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
    name: 'GachaScreen',
    description: 'Ported from the prototype GachaScreen (#13): box select + pull animation.',
    render: () => (
      <View style={{ height: 700, alignSelf: 'stretch' }}>
        <GachaScreen coinBalance={5600} />
      </View>
    ),
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
      '집 대표 이미지 선택 그리드 — 서버 커버 카탈로그(GET /houses/cover-images) (#261).',
    render: () => <HouseCoverPickerDemo />,
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
    name: 'UI · MissionBanner',
    description: '온보딩 미션 진행 배너 (#571) — 🎯 미션 N/4 + 건너뛰기(확인 다이얼로그).',
    render: () => (
      <View style={{ alignSelf: 'stretch', minHeight: 80 }}>
        <MissionBanner
          stepIndex={1}
          totalSteps={4}
          label="뽑기 1회 해보기"
          onPress={() => {}}
          onSkip={() => {}}
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
