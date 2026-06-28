import { type ReactNode } from 'react';
import { View } from 'react-native';

import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { LoginScreen } from '@/components/screens/login-screen';
import { OnboardingScreen } from '@/components/screens/onboarding-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { SignupScreen } from '@/components/screens/signup-screen';
import { SampleButton } from '@/components/sample-button';
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
