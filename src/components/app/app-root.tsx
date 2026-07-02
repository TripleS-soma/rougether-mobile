import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app/app-shell';
import { OnboardingScreen } from '@/components/screens/onboarding-screen';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { useAuth } from '@/hooks/use-auth';
import { loadOnboarding, resetOnboarding, saveOnboarding } from '@/lib/onboarding-store';

/**
 * App entry gate: on first launch shows the onboarding flow (intro → goals →
 * character select); afterwards it goes straight to the app with the saved
 * character. The choice is persisted (onboarding-store) so the flow only runs
 * once.
 */
export function AppRoot() {
  const { status } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [characterId, setCharacterId] = useState<CharacterId>(DEFAULT_CHARACTER_ID);

  useEffect(() => {
    let active = true;
    void loadOnboarding().then((saved) => {
      if (!active) return;
      if (saved) {
        setCharacterId(saved.characterId);
        setOnboarded(true);
      } else {
        setOnboarded(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Wait for the session check; the splash overlay covers this brief gap.
  if (status === 'loading' || onboarded === null) return null;

  // Not signed in → send to the login route.
  if (status === 'guest') return <Redirect href="/login" />;

  if (!onboarded) {
    return (
      <OnboardingScreen
        onDone={(goals, chosen) => {
          setCharacterId(chosen);
          setOnboarded(true);
          void saveOnboarding({ characterId: chosen, goals });
        }}
      />
    );
  }

  return (
    <AppShell
      characterId={characterId}
      onReplayOnboarding={() => {
        void resetOnboarding();
        setOnboarded(false);
      }}
    />
  );
}
