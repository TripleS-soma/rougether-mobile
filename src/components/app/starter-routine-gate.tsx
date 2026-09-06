import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OnboardingGoal } from '@/components/screens/onboarding-screen';
import { StarterRoutineScreen } from '@/components/screens/starter-routine-screen';
import { recommendStarterRoutines, type StarterRoutine } from '@/constants/starter-routines';
import { useStarterRoutine } from '@/hooks/use-starter-routine';
import { track } from '@/lib/analytics';

export function StarterRoutineGate({
  userId,
  goals,
  onFinish,
}: {
  userId: number | undefined;
  goals: OnboardingGoal[];
  onFinish: (outcome: 'created' | 'skipped' | 'existing') => Promise<void>;
}) {
  const recommendations = useMemo(() => recommendStarterRoutines(goals), [goals]);
  const { existing, loading, saving, error, needsReload, start, reload } =
    useStarterRoutine(userId);
  const [finishing, setFinishing] = useState(false);
  const closing = useRef(false);
  const exposed = useRef(false);
  const finish = useCallback(
    async (outcome: 'created' | 'skipped' | 'existing') => {
      if (closing.current) return;
      closing.current = true;
      setFinishing(true);
      if (outcome === 'skipped') track('starter_routine_skip');
      await onFinish(outcome);
    },
    [onFinish],
  );

  useEffect(() => {
    if (existing) {
      void finish('existing');
      return;
    }
    if (loading || error || exposed.current) return;
    exposed.current = true;
    track('starter_routine_view', { recommendation_count: recommendations.length });
  }, [existing, loading, error, finish, recommendations.length]);

  const starting = useRef(false);
  const handleStart = useCallback(
    async (template: StarterRoutine) => {
      if (starting.current || closing.current) return;
      starting.current = true;
      const outcome = await start(template);
      if (outcome) await finish(outcome);
      starting.current = false;
    },
    [start, finish],
  );

  return (
    <StarterRoutineScreen
      recommendations={recommendations}
      loading={loading}
      saving={saving || finishing}
      error={error}
      needsReload={needsReload}
      onStart={(template) => {
        void handleStart(template);
      }}
      onSkip={() => {
        if (!starting.current) void finish('skipped');
      }}
      onReload={() => {
        void reload();
      }}
    />
  );
}
