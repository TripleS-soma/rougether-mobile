import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import { type HouseCover, HouseCoverPicker } from '@/components/house-cover-picker';
import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import { Room } from '@/components/room/room';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { GroupHouseScreen } from '@/components/screens/group-house-screen';
import { HelpScreen } from '@/components/screens/help-screen';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { LoginScreen } from '@/components/screens/login-screen';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { CharacterPickerSheet } from '@/components/screens/sheets/character-picker-sheet';
import { NotificationListScreen } from '@/components/screens/notification-list-screen';
import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';
import { OnboardingScreen } from '@/components/screens/onboarding-screen';
import { PasswordChangeScreen } from '@/components/screens/password-change-screen';
import { ProfileEditScreen } from '@/components/screens/profile-edit-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { SoundSettingsScreen } from '@/components/screens/sound-settings-screen';
import { SignupScreen } from '@/components/screens/signup-screen';
import { SampleButton } from '@/components/sample-button';
import { Badge } from '@/components/ui/badge';
import { BearCheck } from '@/components/ui/bear-check';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { ScreenHeader } from '@/components/ui/screen-header';
import { PendingNotice } from '@/components/ui/pending-notice';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { RECOMMENDED_HOUSES } from '@/mocks/fixtures';
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
export const galleryEntries: GalleryEntry[] = [
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
    name: 'GroupHouseScreen',
    description:
      'Ported from the prototype GroupHouseScreen (#10): house switcher, member rooms, group goals, kick flow.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <GroupHouseScreen />
      </View>
    ),
  },
  {
    name: 'LoginScreen',
    description: 'Ported from the prototype AuthScreen (#2). Preview at fixed height.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <LoginScreen />
      </View>
    ),
  },
  {
    name: 'SignupScreen',
    description: 'Ported from the prototype SignupScreen (#3). Preview at fixed height.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <SignupScreen />
      </View>
    ),
  },
  {
    name: 'OnboardingScreen',
    description: 'Ported from the prototype OnboardingScreen (#4): slides → goals → character.',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <OnboardingScreen />
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
    name: 'AddRoutineScreen',
    description: 'Ported from the prototype AddRoutineScreen (#5, add mode; sheets deferred).',
    render: () => (
      <View style={{ height: 760, alignSelf: 'stretch' }}>
        <AddRoutineScreen />
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
    name: 'UI · Toast',
    description: '하단 토스트 (info / success / error) — useToast().show(...)로 발사.',
    render: () => (
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>
    ),
  },
  {
    name: 'SampleButton · primary',
    description: 'Reference pattern for harness components — theme-aware, testable.',
    render: () => <SampleButton label="Primary" variant="primary" />,
  },
  {
    name: 'SampleButton · secondary',
    render: () => <SampleButton label="Secondary" variant="secondary" />,
  },
  {
    name: 'SampleButton · disabled',
    render: () => <SampleButton label="Disabled" disabled />,
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
