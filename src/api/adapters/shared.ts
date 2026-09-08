/**
 * Private helpers shared by more than one adapter domain. Not re-exported from
 * the `@/api/adapters` barrel — consumers never saw these.
 */
import { isPictogramName, type PictogramName } from '@/components/ui/pictograms';

// Categories created before the pictogram switch stored the picker emoji as
// their iconKey — map those to the equivalent pictogram so old accounts keep
// their icons. New categories store the pictogram name directly.
const LEGACY_EMOJI_ICONS: Record<string, PictogramName> = {
  '🗓': 'calendar',
  '📚': 'book',
  '🎨': 'palette',
  '💪': 'dumbbell',
  '✨': 'sparkle',
  '☀': 'sun',
  '🌙': 'moon',
  '💧': 'water',
  '🏃': 'run',
  '💖': 'heart',
  '☕': 'coffee',
  '🎵': 'music',
  '🍳': 'cooking',
  '🧘': 'meditation',
  '💼': 'briefcase',
  '🌱': 'sprout',
};

/** Server iconKey (pictogram name / legacy emoji / asset key) → pictogram. */
export function toCategoryIcon(iconKey?: string): PictogramName {
  if (!iconKey) return 'sparkle';
  if (isPictogramName(iconKey)) return iconKey;
  // Emoji lookups ignore the variation selector (🗓️ vs 🗓).
  return LEGACY_EMOJI_ICONS[iconKey.replace(/️/g, '')] ?? 'sparkle';
}
