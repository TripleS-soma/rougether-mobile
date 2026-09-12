import type { MinigameReplay } from '@/api/minigames';
import { RunnerGame } from '@/components/minigame/runner-game';
import { StairsGame } from '@/components/minigame/stairs-game';
import { MergeGame } from '@/components/minigame/merge-game';
import type { MinigameCode } from '@/constants/minigames';

export type MinigamePlayerProps = {
  gameCode: MinigameCode;
  seed: number;
  active: boolean;
  practice: boolean;
  onFinish: (replay: MinigameReplay) => void;
};

/** Each game owns its renderer and controls; score persistence stays in the app layer. */
export function MinigamePlayer({ gameCode, ...props }: MinigamePlayerProps) {
  switch (gameCode) {
    case 'room-runner':
      return <RunnerGame {...props} />;
    case 'cat-stairs':
      return <StairsGame {...props} />;
    case 'cat-merge':
      return <MergeGame {...props} />;
  }
}
