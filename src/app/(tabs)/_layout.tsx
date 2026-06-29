import { Slot } from 'expo-router';

/**
 * The app provides its own bottom navigation (see AppShell), so this group just
 * renders the active route without a native tab bar. The /dev gallery and
 * /explore routes still resolve for development; they're simply not in any nav.
 */
export default function TabsLayout() {
  return <Slot />;
}
