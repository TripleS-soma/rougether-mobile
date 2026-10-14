import { RhythmGame } from '@/components/minigame/rhythm-game';
import { MinigameLayout } from '@/components/screens/minigame-layout';
import { useT } from '@/i18n';

/** Local practice owns its result; it cannot submit a ranked run. */
export function RhythmPracticeScreen({
  active = true,
  onBack,
}: {
  active?: boolean;
  onBack?: () => void;
}) {
  const tr = useT();
  return (
    <MinigameLayout title={tr('minigame.rhythm.name')} onBack={onBack}>
      <RhythmGame active={active} />
    </MinigameLayout>
  );
}
