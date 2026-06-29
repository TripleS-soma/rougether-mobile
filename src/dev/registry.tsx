import { type ReactNode } from 'react';
import { View } from 'react-native';

import { Room } from '@/components/room/room';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { GroupHouseScreen } from '@/components/screens/group-house-screen';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { LoginScreen } from '@/components/screens/login-screen';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { OnboardingScreen } from '@/components/screens/onboarding-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { SignupScreen } from '@/components/screens/signup-screen';
import { SampleButton } from '@/components/sample-button';
import { Calendar } from '@/components/ui/calendar';
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
        <GroupHouseScreen leafBalance={5600} />
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
    description: 'Ported from the prototype GachaScreen (#13). Pull animation deferred.',
    render: () => (
      <View style={{ height: 700, alignSelf: 'stretch' }}>
        <GachaScreen leafBalance={5600} />
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
