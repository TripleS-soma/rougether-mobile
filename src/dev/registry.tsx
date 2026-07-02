import { type ReactNode } from 'react';
import { View } from 'react-native';

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
import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';
import { OnboardingScreen } from '@/components/screens/onboarding-screen';
import { PasswordChangeScreen } from '@/components/screens/password-change-screen';
import { ProfileEditScreen } from '@/components/screens/profile-edit-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { ShopScreen } from '@/components/screens/shop-screen';
import { SoundSettingsScreen } from '@/components/screens/sound-settings-screen';
import { SignupScreen } from '@/components/screens/signup-screen';
import { SampleButton } from '@/components/sample-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SAMPLE_ROUTINES } from '@/constants/routines';
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
    name: 'Room · default',
    description: 'Room renderer — wallpaper + slot-placed furniture (dummy resources) + character.',
    render: () => (
      <View style={{ width: 280, alignSelf: 'center' }}>
        <Room />
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
        <GroupHouseScreen coinBalance={5600} />
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
    name: 'ShopScreen',
    description: '상점(#74): 방 꾸미기(다이아 구매) / 캐릭터 악세서리(가챠 전용) 탭.',
    render: () => (
      <View style={{ height: 760, alignSelf: 'stretch' }}>
        <ShopScreen diaBalance={480} ownedItemIds={['bed', 'rug']} />
      </View>
    ),
  },
  {
    name: 'HouseSearchScreen',
    description:
      'Ported from the prototype HouseSearchScreen (#11): invite code + recommended list.',
    render: () => (
      <View style={{ height: 760, alignSelf: 'stretch' }}>
        <HouseSearchScreen />
      </View>
    ),
  },
  {
    name: 'CreateHouseScreen',
    description:
      'Ported from the prototype CreateHouseScreen (#12): preview, theme, capacity, code.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <CreateHouseScreen />
      </View>
    ),
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
