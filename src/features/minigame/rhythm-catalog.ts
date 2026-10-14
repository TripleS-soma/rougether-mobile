import type { Minigame } from '@/api/minigames';
import { i18n } from '@/i18n';

/** Deliberately absent from the server-compatible ranked definitions. */
export function rhythmPracticeDefinition(): Minigame {
  return {
    gameCode: 'routine-rhythm',
    name: i18n.t('minigame.rhythm.name'),
    description: i18n.t('minigame.rhythm.subtitle'),
    rulesVersion: 2,
  };
}
