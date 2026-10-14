import type { ImageSource } from 'expo-image';

import type { MinigameCode } from '@/constants/minigames';

export const MINIGAME_BACKGROUNDS: Record<MinigameCode, ImageSource> = {
  'room-runner': require('@/assets/images/minigames/routine-runner.webp'),
  'cat-stairs': require('@/assets/images/minigames/cat-stairs.webp'),
  'cat-merge': require('@/assets/images/minigames/cat-merge.webp'),
  'cat-tower': require('@/assets/images/minigames/cat-tower.webp'),
};

export const MINIGAME_ICONS: Record<MinigameCode, ImageSource> = {
  'room-runner': require('@/assets/images/minigames/routine-runner-icon.webp'),
  'cat-stairs': require('@/assets/images/minigames/cat-stairs-icon.webp'),
  'cat-merge': require('@/assets/images/minigames/cat-merge-icon.webp'),
  'cat-tower': require('@/assets/images/minigames/cat-tower-icon.webp'),
};
